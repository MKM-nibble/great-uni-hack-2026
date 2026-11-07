// Loads reference data into the database. Safe to re-run: every row is an
// upsert, and nothing the pipeline wrote (headlines, signals, weather) is
// touched. Run: pnpm db:seed
import { Pool, type PoolClient } from '@neondatabase/serverless';
import { CATEGORY_LABEL } from '@/forecast/categorise';
import { JOB_TEMPLATES } from '@/data/jobs';
import { FESTIVALS } from '@/data/calendar';
import { BANK_RATE, CPI_ANNUAL, CPI_SOURCE, NEWS_SIGNALS, RATE_DECISIONS, RATE_SOURCE, SCHEDULED_CHANGES } from '@/data/prices';
import { getPersonas } from '@/data/personas';
import {
  DRIVERS, DRIVER_KEYWORDS, EXTRA_POLICY_CHANGES, IMPACT_RULES, JOB_WEATHER_EFFECTS,
  MARKET_SERIES, MERCHANT_RULES, REGIONS, SOURCES,
} from '../db/reference';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL });

async function upsert(c: PoolClient, table: string, key: string[], rows: Record<string, unknown>[]) {
  for (const row of rows) {
    const cols = Object.keys(row);
    const updates = cols.filter((k) => !key.includes(k)).map((k) => `${k} = excluded.${k}`);
    await c.query(
      `insert into ${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
       on conflict (${key.join(', ')}) do ${updates.length ? `update set ${updates.join(', ')}` : 'nothing'}`,
      Object.values(row),
    );
  }
  console.log(`${table}: ${rows.length}`);
}

const c = await pool.connect();
try {
  await c.query('begin');

  await upsert(c, 'categories', ['id'], Object.entries(CATEGORY_LABEL).map(([id, label]) => ({ id, label })));
  await upsert(c, 'regions', ['id'], REGIONS.map(({ id, name, lat, lon }) => ({ id, name, lat, lon })));
  await upsert(c, 'postcode_areas', ['area'], REGIONS.flatMap((r) => r.areas.map((area) => ({ area, region_id: r.id }))));
  await upsert(
    c,
    'job_templates',
    ['id'],
    Object.values(JOB_TEMPLATES).map((t) => ({ id: t.id, label: t.label, note: t.note, seasonality: t.seasonality })),
  );
  await upsert(
    c,
    'job_weather_effects',
    ['job_template_id', 'condition'],
    JOB_WEATHER_EFFECTS.map((e) => ({ job_template_id: e.job, condition: e.condition, effect: e.effect, note: e.note })),
  );
  await upsert(c, 'festivals', ['id'], FESTIVALS.map((f) => ({ id: f.id, label: f.label, lead_days: f.leadDays })));
  await upsert(
    c,
    'festival_dates',
    ['festival_id', 'date'],
    FESTIVALS.flatMap((f) =>
      f.dates.map((date) => ({ festival_id: f.id, date, approximate: /eid|diwali|lunar/.test(f.id) })),
    ),
  );

  await c.query('delete from merchant_rules');
  await upsert(
    c,
    'merchant_rules',
    ['id'],
    MERCHANT_RULES.map((r, i) => ({
      id: i + 1,
      priority: r.priority ?? 100,
      mcc: r.mcc ?? null,
      pattern: r.pattern ?? null,
      category_id: r.category,
    })),
  );

  await upsert(c, 'policy_changes', ['id'], [
    ...SCHEDULED_CHANGES.map((s) => ({
      id: s.id,
      title: s.title,
      kind: 'bill',
      category_id: s.category,
      effective_date: s.date,
      change_pct: s.pct ?? null,
      change_amount: s.monthlyAmount ?? null,
      amount_unit: s.monthlyAmount ? 'per_month' : null,
      status: s.confidence === 'certain' ? 'confirmed' : 'expected',
      source_url: s.sourceUrl ?? null,
      notes: `${s.source}. verify before demo`,
    })),
    ...EXTRA_POLICY_CHANGES.map((p) => ({
      id: p.id,
      title: p.title,
      kind: p.kind,
      category_id: p.category,
      effective_date: p.date,
      change_pct: p.pct,
      applies_to_pay_types: p.payTypes ?? null,
      status: p.status,
      source_url: p.source,
      notes: p.notes,
    })),
  ]);

  await upsert(
    c,
    'rate_decisions',
    ['date'],
    RATE_DECISIONS.map((r) => ({ date: r.date, expectation: r.expectation, confidence: r.confidence, source_url: RATE_SOURCE.url })),
  );

  await upsert(c, 'market_series', ['id'], [
    ...MARKET_SERIES.map((s) => ({ id: s.id, label: s.label, unit: s.unit, category_id: s.category, source_url: s.source })),
    ...Object.keys(CPI_ANNUAL).map((cat) => ({
      id: `cpi_${cat}`,
      label: `CPI: ${CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL]}`,
      unit: 'annual rate',
      category_id: cat,
      source_url: CPI_SOURCE.url,
    })),
  ]);
  const snapshot = new Date().toISOString().slice(0, 10);
  await upsert(
    c,
    'market_points',
    ['series_id', 'date'],
    [
      ...Object.entries(CPI_ANNUAL).map(([cat, v]) => ({ series_id: `cpi_${cat}`, date: snapshot, value: v })),
      { series_id: 'boe_bank_rate', date: BANK_RATE.asOf, value: BANK_RATE.value * 100 },
    ],
  );

  await upsert(c, 'drivers', ['id'], DRIVERS);
  await c.query('delete from driver_keywords');
  await upsert(c, 'driver_keywords', ['id'], DRIVER_KEYWORDS.map(([driver_id, pattern], i) => ({ id: i + 1, driver_id, pattern })));
  await upsert(
    c,
    'impact_rules',
    ['driver_id', 'category_id'],
    IMPACT_RULES.map((r) => ({
      driver_id: r.driver,
      category_id: r.category,
      pct_low: r.low,
      pct_high: r.high,
      lag_days: r.lag,
      duration_days: r.duration,
      rationale: r.rationale,
    })),
  );
  await upsert(c, 'sources', ['id'], SOURCES.map((s) => ({ ...s, kind: 'rss' })));

  await upsert(
    c,
    'events_catalog',
    ['id'],
    getPersonas().kayla.gigs.map((g) => ({
      id: `gig-${g.artist.toLowerCase().replace(/\W+/g, '-')}-${g.date}`,
      kind: 'gig',
      name: g.artist,
      venue: g.venue,
      region_id: 'yorkshire',
      date: g.date,
      price_low: g.priceRange[0],
      price_high: g.priceRange[1],
    })),
  );

  // Demo scenarios: live so the demo shows them, and labelled so nobody mistakes them for real news.
  await c.query("delete from signals where explanation like 'Demo scenario%'");
  for (const s of NEWS_SIGNALS) {
    await c.query(
      `insert into signals (category_id, title, pct_low, pct_high, effective_from, confidence, method, status, explanation, source_url)
       values ($1, $2, $3, $4, $5, $6, 'rule', 'live', $7, $8)`,
      [s.category, s.headline, s.pctLow ?? s.pct, s.pctHigh ?? s.pct, s.from, s.confidence, 'Demo scenario: ' + s.headline, s.sourceUrl ?? null],
    );
  }
  console.log(`demo signals: ${NEWS_SIGNALS.length}`);

  await c.query('commit');
  console.log('seed complete');
} catch (err) {
  await c.query('rollback');
  throw err;
} finally {
  c.release();
  await pool.end();
}
