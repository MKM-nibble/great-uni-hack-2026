import { hasDb, sql } from '@/lib/db';
import type { Category, Confidence, PayType } from '@/lib/types';
import { BANK_RATE, type PriceChange } from '@/data/prices';
import type { IncomeChange, Signal, WeatherCondition, World } from '@/data/world';

// Everything outside the customer's account that matters to them: price and
// policy changes, live news signals, rates, CPI, and the weather forecast
// for their area with how it affects their kind of work.
//   GET /api/world?postcode=LS6&job=trades

const STATUS_CONFIDENCE: Record<string, Confidence> = {
  in_force: 'certain',
  confirmed: 'certain',
  announced: 'likely',
  expected: 'signal',
};

// The driver turns `date` columns into a Date at local midnight, so read the
// local calendar day rather than the UTC one (which is a day early in BST).
const iso = (d: unknown) =>
  d instanceof Date
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : String(d).slice(0, 10);
const num = (v: unknown) => (v == null ? undefined : Number(v));
const sourceName = (url: unknown) => {
  try {
    const host = new URL(String(url)).hostname.replace(/^www\./, '');
    return host === 'gov.uk' ? 'GOV.UK' : host;
  } catch {
    return 'Official source';
  }
};

export async function GET(request: Request) {
  if (!hasDb()) return Response.json({ error: 'no database' }, { status: 503 });
  const url = new URL(request.url);
  const area = (url.searchParams.get('postcode') ?? '').toUpperCase().match(/^[A-Z]{1,2}/)?.[0] ?? '';
  const job = url.searchParams.get('job') ?? 'steady';
  const db = sql();

  const [region] = (await db`
    select r.id, r.name from regions r join postcode_areas p on p.region_id = r.id
    where p.area = ${area} or p.area = ${area.slice(0, 1)}
    order by length(p.area) desc limit 1`) as { id: string; name: string }[];
  const regionId = region?.id ?? null;

  const [policies, cpi, signals, rates, weather, effects, bankRate, normals] = await Promise.all([
    db`select * from policy_changes
       where effective_date >= current_date - 30
         and (applies_to_regions is null or ${regionId}::text = any(applies_to_regions))
       order by effective_date`,
    db`select distinct on (s.category_id) s.category_id, p.value
       from market_series s join market_points p on p.series_id = s.id
       where s.id like 'cpi\\_%' order by s.category_id, p.date desc`,
    db`select s.*, h.published_at from signals s left join headlines h on h.id = s.headline_id
       where s.status = 'live' and (s.effective_to is null or s.effective_to >= current_date)
         and (s.region_id is null or s.region_id = ${regionId})
       order by s.pct_high desc limit 200`,
    db`select * from rate_decisions where date >= current_date order by date limit 3`,
    regionId
      ? db`select * from weather_daily where region_id = ${regionId} and date >= current_date and is_forecast order by date`
      : Promise.resolve([]),
    db`select condition, effect, note from job_weather_effects where job_template_id = ${job}`,
    db`select value from market_points where series_id = 'boe_bank_rate' order by date desc limit 1`,
    regionId
      ? db`select t_mean from weather_normals where region_id = ${regionId} and month = extract(month from current_date)`
      : Promise.resolve([]),
  ]);

  const verifiedNote = (p: Record<string, unknown>) => (p.verified_at ? '' : ' (not yet verified)');

  const world: World = {
    source: 'database',
    regionName: region?.name,
    scheduled: policies
      .filter((p) => p.category_id && p.kind !== 'wage')
      .map(
        (p): PriceChange => ({
          id: String(p.id),
          title: String(p.title),
          category: p.category_id as Category,
          date: iso(p.effective_date),
          pct: num(p.change_pct),
          monthlyAmount: p.amount_unit === 'per_month' ? num(p.change_amount) : undefined,
          confidence: STATUS_CONFIDENCE[String(p.status)] ?? 'signal',
          source: (String(p.notes ?? '').replace(/(^|\.\s*)verify[\s\S]*$/i, '').trim() || sourceName(p.source_url)) + verifiedNote(p),
          sourceUrl: (p.source_url as string) ?? undefined,
        }),
      ),
    incomeChanges: policies
      .filter((p) => p.kind === 'wage' && p.change_pct != null)
      .map(
        (p): IncomeChange => ({
          id: String(p.id),
          title: String(p.title),
          date: iso(p.effective_date),
          pct: Number(p.change_pct),
          payTypes: (p.applies_to_pay_types as PayType[] | null) ?? null,
          confidence: STATUS_CONFIDENCE[String(p.status)] ?? 'signal',
          sourceUrl: (p.source_url as string) ?? undefined,
        }),
      ),
    cpi: Object.fromEntries(cpi.map((r) => [r.category_id, Number(r.value)])),
    signals: signals.map(
      (s): Signal => ({
        id: String(s.id),
        category: s.category_id as Category,
        title: String(s.title),
        pctLow: Number(s.pct_low),
        pctHigh: Number(s.pct_high),
        from: iso(s.effective_from),
        to: s.effective_to ? iso(s.effective_to) : undefined,
        confidence: s.confidence as Confidence,
        method: s.method as Signal['method'],
        explanation: String(s.explanation),
        sourceUrl: (s.source_url as string) ?? undefined,
        example: String(s.explanation).startsWith('Demo scenario'),
      }),
    ),
    rates: rates.map((r) => ({
      date: iso(r.date),
      expectation: String(r.expectation ?? 'Decision due'),
      confidence: r.confidence as Confidence,
    })),
    bankRate: bankRate[0] ? Number(bankRate[0].value) / 100 : BANK_RATE.value,
    weather: {
      days: weather.map((w) => ({
        date: iso(w.date),
        tMin: Number(w.t_min),
        tMax: Number(w.t_max),
        precipMm: Number(w.precip_mm),
        snowCm: Number(w.snow_cm),
        windKph: Number(w.wind_max_kph),
      })),
      effects: effects.map((e) => ({
        condition: e.condition as WeatherCondition,
        effect: Number(e.effect),
        note: String(e.note),
      })),
      normalTMean: normals[0] ? Number(normals[0].t_mean) : undefined,
    },
  };

  return Response.json(world, { headers: { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600' } });
}
