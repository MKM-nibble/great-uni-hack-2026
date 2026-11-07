import type { Category, Confidence, Profile, WhatIf } from '@/lib/types';
import type { Forecast } from '@/forecast/engine';
import type { GigSuggestion } from '@/data/personas';
import { CATEGORY_LABEL } from '@/forecast/categorise';
import { CPI_SOURCE, RATE_SOURCE } from '@/data/prices';
import { CONDITION_LABEL, type WeatherCondition } from '@/data/world';
import { addDays, daysBetween, fmtDate, fmtMoney, iso, parseIso } from '@/lib/dates';

export interface Insight {
  id: string;
  kind: 'warning' | 'price' | 'event' | 'salary' | 'support' | 'rate' | 'good';
  title: string;
  body: string;
  date?: string;
  confidence: Confidence;
  why: string[];
  source?: { label: string; url?: string };
  example?: boolean;
}

const MIN_MONTHLY_IMPACT = 0.5;
const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(x !== 0 && Math.abs(x) < 0.1 ? 1 : 0)}%`;

/**
 * Price, rate, wage and weather cards, only for things this person actually
 * spends money on or that touch how they're paid.
 */
export function worldInsights(profile: Profile, f: Forecast): Insight[] {
  const w = f.world;
  const spend = (c: Category) => f.monthlySpend[c] ?? 0;
  const out: Insight[] = [];
  const asOf = parseIso(f.asOf);
  const end = parseIso(f.statsEnd);

  for (const c of w.scheduled) {
    if (parseIso(c.date) > end || spend(c.category) <= 0) continue;
    const monthly = c.monthlyAmount ?? spend(c.category) * (c.pct ?? 0);
    if (monthly < MIN_MONTHLY_IMPACT) continue;
    out.push({
      id: `sched-${c.id}`,
      kind: 'price',
      title: `${c.title}: about ${fmtMoney(monthly, { sign: true })} a month`,
      body: `From ${fmtDate(c.date)}. You pay about ${fmtMoney(spend(c.category))} a month for ${CATEGORY_LABEL[c.category].toLowerCase()}.`,
      date: c.date,
      confidence: c.confidence,
      why: [
        `Your ${CATEGORY_LABEL[c.category].toLowerCase()} costs about ${fmtMoney(spend(c.category))} a month`,
        c.monthlyAmount ? `Rise of ${fmtMoney(c.monthlyAmount)} a month` : `Change of ${pct(c.pct ?? 0)}`,
      ],
      source: { label: c.source, url: c.sourceUrl },
    });
  }

  // One card per category: the strongest live signal, with the rest counted.
  const live = w.signals.filter((s) => !s.to || parseIso(s.to) >= asOf);
  for (const [cat, group] of groupBy(live, (s) => s.category)) {
    const c = cat as Category;
    const strength = (s: (typeof group)[number]) => Math.abs(s.pctLow + s.pctHigh);
    const top = group.reduce((a, b) => (strength(b) > strength(a) ? b : a));
    const falling = top.pctHigh < 0;
    const [lo, hi] = [Math.abs(spend(c) * top.pctLow), Math.abs(spend(c) * top.pctHigh)].sort((a, b) => a - b);
    if (hi < MIN_MONTHLY_IMPACT) continue;
    const range = Math.round(lo) === Math.round(hi) ? fmtMoney(hi) : `${fmtMoney(lo)} to ${fmtMoney(hi)}`;
    out.push({
      id: `signal-${c}`,
      kind: falling ? 'good' : 'price',
      title: falling
        ? `${CATEGORY_LABEL[c]} may get cheaper: ${range} a month less`
        : `${CATEGORY_LABEL[c]} may cost ${range} more a month`,
      body: `${top.title}. You spend about ${fmtMoney(spend(c))} a month on ${CATEGORY_LABEL[c].toLowerCase()}.`,
      date: top.from,
      confidence: top.confidence,
      why: [
        top.explanation,
        `Expected change ${pct(top.pctLow)} to ${pct(top.pctHigh)}, from about ${fmtDate(top.from)}`,
        ...(group.length > 1 ? [`${group.length - 1} more related ${group.length === 2 ? 'story' : 'stories'}`] : []),
        top.method === 'official' ? 'Official announcement' : 'Early signal from the news, not a guarantee',
      ],
      source: { label: top.example ? 'Example news signal (demo)' : top.sourceUrl ? 'Read the story' : 'News', url: top.sourceUrl },
      example: top.example,
    });
  }

  const cpiCats = (Object.entries(w.cpi) as [Category, number][])
    .map(([c, rate]) => ({ c, extra: spend(c) * rate }))
    .filter((x) => x.extra >= MIN_MONTHLY_IMPACT)
    .sort((a, b) => b.extra - a.extra);
  if (cpiCats.length) {
    const total = cpiCats.reduce((s, x) => s + x.extra, 0);
    out.push({
      id: 'cpi',
      kind: 'price',
      title: `Everyday prices: about ${fmtMoney(total, { sign: true })} a month over the next year`,
      body: `Mostly ${cpiCats.slice(0, 2).map((x) => CATEGORY_LABEL[x.c].toLowerCase()).join(' and ')}. Already built into your forecast.`,
      confidence: 'likely',
      why: cpiCats.map((x) => `${CATEGORY_LABEL[x.c]}: ${fmtMoney(x.extra, { sign: true })}/month`),
      source: CPI_SOURCE,
    });
  }

  for (const c of w.incomeChanges) {
    if (parseIso(c.date) > end || !f.income.variable) continue;
    if (c.payTypes && !c.payTypes.includes(profile.payType)) continue;
    out.push({
      id: `wage-${c.id}`,
      kind: 'good',
      title: `${c.title}: about ${fmtMoney(f.income.weeklyBase * c.pct, { sign: true })} a week`,
      body: `From ${fmtDate(c.date)}, if your hours stay the same. Already in your forecast.`,
      date: c.date,
      confidence: c.confidence,
      why: [`A ${pct(c.pct)} rise on your usual week of about ${fmtMoney(f.income.weeklyBase)}`],
      source: c.sourceUrl ? { label: 'GOV.UK', url: c.sourceUrl } : undefined,
    });
  }

  if (f.weatherImpact.length) {
    const byCondition = groupBy(f.weatherImpact, (x) => x.condition);
    const [cond, hits] = [...byCondition].sort((a, b) => b[1].length - a[1].length)[0];
    const effect = hits[0].effect;
    const total = (f.income.weeklyBase / 5) * effect * hits.length;
    out.push({
      id: 'weather',
      kind: effect < 0 ? 'warning' : 'good',
      title: `${CONDITION_LABEL[cond as WeatherCondition]} on ${hits.length} day${hits.length > 1 ? 's' : ''} soon: about ${fmtMoney(total, { sign: true })} pay`,
      body: `${hits[0].note}. ${hits.map((h) => fmtDate(h.date)).slice(0, 4).join(', ')}${hits.length > 4 ? '…' : ''}.`,
      date: hits[0].date,
      confidence: 'likely',
      why: [
        `16-day forecast for ${w.regionName ?? 'your area'}`,
        `For your kind of work, pay moves about ${pct(effect)} on those days`,
        'Further ahead, your usual seasonal pattern is used instead',
      ],
      source: { label: 'Open-Meteo weather forecast', url: 'https://open-meteo.com/' },
    });
  }

  const m = f.mortgage;
  if (m) {
    const [up, upHigh] = [m.low - m.current, m.high - m.current];
    const rate = (x: number) => `${(x * 100).toFixed(2)}%`;
    out.push({
      id: 'mortgage',
      kind: 'warning',
      title: `Your mortgage fix ends ${fmtDate(m.fixEnds)}: about ${fmtMoney(up)} to ${fmtMoney(upHigh)} more a month`,
      body: `From about ${fmtMoney(m.current)} to ${fmtMoney(m.low)}–${fmtMoney(m.high)} a month, or ${fmtMoney(up * 12)}–${fmtMoney(upHigh * 12)} a year. Many lenders let you lock in a new deal up to six months before.`,
      date: m.fixEnds,
      confidence: 'likely',
      why: [
        `Your current rate is ${rate(profile.mortgage!.rate)}, with about ${fmtMoney(m.balanceAtEnd)} left to repay when the fix ends`,
        `Bank Rate is ${rate(m.bankRate)} today; new fixes usually sit about ${rate(m.rateLow - m.bankRate)}–${rate(m.rateHigh - m.bankRate)} above it`,
        `So a new rate of roughly ${rate(m.rateLow)}–${rate(m.rateHigh)}, over the same remaining term`,
        'A Bank Rate cut before you fix would bring the new payment down',
      ],
      source: RATE_SOURCE,
    });
  }

  const nextRate = w.rates.find((r) => parseIso(r.date) >= asOf);
  if (nextRate) {
    out.push({
      id: 'rate',
      kind: 'rate',
      title: `Bank of England decision on ${fmtDate(nextRate.date)}`,
      body: m
        ? `${nextRate.expectation}. This matters to you: it moves the rate you'll be offered when your fix ends.`
        : `${nextRate.expectation}. This moves overdraft, credit card and savings rates, not most everyday bills.`,
      date: nextRate.date,
      confidence: nextRate.confidence,
      why: m
        ? ['New fixed rates follow where Bank Rate is expected to go', `Your fix ends ${fmtDate(m.fixEnds)}`]
        : ['Shown for awareness; it has a small effect on your forecast'],
      source: RATE_SOURCE,
    });
  }
  return out;
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}

export function buildInsights(profile: Profile, f: Forecast): Insight[] {
  const out: Insight[] = [];
  const low = f.lowPoint;

  if (f.firstLikely || f.firstRisk) {
    const when = (f.firstLikely ?? f.firstRisk)!;
    const likely = Boolean(f.firstLikely);
    out.push({
      id: 'danger',
      kind: 'warning',
      title: likely
        ? `You’re likely to go overdrawn around ${fmtDate(when)}`
        : `Things could get tight from ${fmtDate(when)}`,
      body: `Your lowest point is about ${fmtMoney(low.expected)} on ${fmtDate(low.date)}. That’s ${Math.round(daysBetween(parseIso(f.asOf), parseIso(when)) / 7)} weeks away, so there’s time to act.`,
      date: when,
      confidence: likely ? 'likely' : 'signal',
      why: whyDanger(f, profile),
    });
  } else {
    out.push({
      id: 'clear',
      kind: 'good',
      title: f.mortgage ? `Fine for now, but ${fmtDate(f.mortgage.fixEnds)} changes things` : 'No storms ahead',
      body: f.mortgage
        ? `Your balance stays above ${fmtMoney(Math.max(0, low.low))} for six months, but your mortgage payment goes up when the fix ends. Switch to the 1-year view to see it.`
        : `Your balance stays above ${fmtMoney(Math.max(0, low.low))} for the next six months, even in a cautious case.`,
      confidence: 'likely',
      why: ['Regular income covers your bills and usual spending', ...f.events.slice(0, 2).map((e) => `${e.label} is already included`)],
    });
  }

  const soon = f.events.filter((e) => e.date <= f.statsEnd);
  const bigEvents = soon.filter((e) => e.amount >= 100);
  for (const e of dedupeByLabel(bigEvents).slice(0, 3)) {
    const total = soon.filter((x) => x.label === e.label).reduce((s, x) => s + x.amount, 0);
    out.push({
      id: `event-${e.id}`,
      kind: 'event',
      title: `${e.label}: ${fmtMoney(total)}`,
      body: e.source === 'festival' ? `Spread over the weeks running up to ${e.label}.` : `On ${fmtDate(e.date)}.`,
      date: e.date,
      // The date is known; for festivals and tax the amount is an estimate.
      confidence: e.source === 'festival' || e.source === 'rule' ? 'likely' : 'certain',
      why: [e.note ?? `From your ${e.source === 'calendar' ? 'calendar' : 'details'}`],
    });
  }

  out.push(...worldInsights(profile, f));

  if (f.firstLikely || f.firstRisk) {
    out.push({
      id: 'support',
      kind: 'support',
      title: 'Help is there, and asking early helps most',
      body: 'Talk to NatWest before you miss a payment: we can look at your overdraft, payment dates or a break on repayments.',
      confidence: 'certain',
      why: ['Free, confidential options, listed below'],
      source: { label: 'NatWest financial support', url: 'https://www.natwest.com/support-centre/financial-support.html' },
    });
  }
  return out;
}

function whyDanger(f: Forecast, profile: Profile): string[] {
  const why: string[] = [];
  if (f.income.variable) {
    why.push(`Your pay usually drops in quieter months (${f.income.template.toLowerCase()} pattern)`);
  }
  const lowDate = parseIso(f.lowPoint.date);
  const before = f.events.filter((e) => parseIso(e.date) <= lowDate);
  const totals = new Map<string, number>();
  for (const e of before) totals.set(e.label, (totals.get(e.label) ?? 0) + e.amount);
  for (const [label, amt] of [...totals].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
    why.push(`${label}: ${fmtMoney(amt)}`);
  }
  if (profile.payType === 'student') why.push('Your next loan instalment comes after the money runs low');
  why.push('Regular bills and your usual spending from the last 12 weeks');
  return why;
}

function dedupeByLabel<T extends { label: string }>(xs: T[]): T[] {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x.label) ? false : (seen.add(x.label), true)));
}


/** What-if toggles that make sense for this person's situation. */
export function whatIfsFor(profile: Profile, f: Forecast, asOf: Date, gigs: GigSuggestion[]): WhatIf[] {
  const out: WhatIf[] = [];
  const next = (days: number) => iso(addDays(asOf, days));
  if (['zero-hours', 'hourly', 'student'].includes(profile.payType) && f.income.weeklyBase > 0) {
    const shift = Math.round(f.income.weeklyBase / (profile.payType === 'student' ? 2 : 4));
    out.push({
      id: 'shifts',
      label: `Pick up 2 extra shifts (≈${fmtMoney(shift * 2)})`,
      flows: [{ date: next(7), amount: shift }, { date: next(14), amount: shift }],
    });
  }
  if (profile.payType === 'self-employed') {
    out.push({
      id: 'invoices',
      label: 'Chase 2 overdue invoices (≈£600)',
      flows: [{ date: next(10), amount: 600 }],
    });
  }
  for (const g of gigs.filter((g) => parseIso(g.date) > asOf).slice(0, 1)) {
    const price = Math.round((g.priceRange[0] + g.priceRange[1]) / 2) + 4;
    out.push({
      id: `gig-${g.artist}`,
      label: `Buy ${g.artist} tickets (≈${fmtMoney(price)})`,
      flows: [{ date: next(2), amount: -price }],
    });
  }
  for (const b of f.bills.filter((b) => /SAVINGS|ISA/.test(b.merchant))) {
    out.push({
      id: `pause-${b.merchant}`,
      label: `Pause your ${fmtMoney(b.amount)} monthly savings transfer`,
      flows: [],
      pauseBills: [b.merchant],
    });
  }
  if (f.mortgage) {
    out.push({
      id: 'mortgage-lock',
      label: `Lock a new mortgage rate now (≈${fmtMoney(f.mortgage.low)}/month)`,
      flows: [],
      mortgageLock: true,
    });
  }
  if ((f.monthlySpend['eating-out'] ?? 0) > 40) {
    out.push({
      id: 'takeaways',
      label: `Halve takeaways & eating out (saves ≈${fmtMoney((f.monthlySpend['eating-out'] ?? 0) / 2)}/month)`,
      flows: [],
      categoryScale: { category: 'eating-out', factor: 0.5 },
    });
  }
  if ((f.monthlySpend.coffee ?? 0) > 30) {
    out.push({
      id: 'coffee',
      label: `Make coffee at home 3 days a week (saves ≈${fmtMoney((f.monthlySpend.coffee ?? 0) * 0.6)}/month)`,
      flows: [],
      categoryScale: { category: 'coffee', factor: 0.4 },
    });
  }
  return out.filter((w) => w.flows.length || w.categoryScale || w.mortgageLock || w.pauseBills?.length);
}
