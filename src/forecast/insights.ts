import type { Category, Confidence, Profile, WhatIf } from '@/lib/types';
import type { Forecast } from '@/forecast/engine';
import type { GigSuggestion } from '@/data/personas';
import { CATEGORY_LABEL } from '@/forecast/categorise';
import { CPI_ANNUAL, CPI_SOURCE, NEWS_SIGNALS, RATE_DECISIONS, RATE_SOURCE, SCHEDULED_CHANGES } from '@/data/prices';
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

/** Price and rate cards, only for things this person actually spends money on. */
export function priceInsights(f: Forecast): Insight[] {
  const spend = (c: Category) => f.monthlySpend[c] ?? 0;
  const out: Insight[] = [];
  const end = parseIso(f.days[f.days.length - 1].date);

  for (const c of SCHEDULED_CHANGES) {
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
        c.monthlyAmount ? `Rise of ${fmtMoney(c.monthlyAmount)} a month` : `Change of ${((c.pct ?? 0) * 100).toFixed(1)}%`,
      ],
      source: { label: c.source, url: c.sourceUrl },
    });
  }

  for (const s of NEWS_SIGNALS) {
    const monthly = spend(s.category) * s.pct;
    if (monthly < MIN_MONTHLY_IMPACT) continue;
    out.push({
      id: `news-${s.id}`,
      kind: 'price',
      title: `${CATEGORY_LABEL[s.category]} may cost ${fmtMoney(monthly, { sign: true })} a month`,
      body: `${s.headline}. You spend about ${fmtMoney(spend(s.category))} a month on this.`,
      date: s.from,
      confidence: s.confidence,
      why: [`Signal from the news, roughly +${Math.round(s.pct * 100)}%`, 'Low confidence: news is not a guarantee'],
      source: { label: s.example ? 'Example news signal (demo)' : 'News', url: s.sourceUrl },
      example: s.example,
    });
  }

  const cpiCats = (Object.entries(CPI_ANNUAL) as [Category, number][])
    .map(([c, pct]) => ({ c, extra: (spend(c) * pct) }))
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

  const nextRate = RATE_DECISIONS.find((r) => parseIso(r.date) >= parseIso(f.asOf));
  if (nextRate) {
    out.push({
      id: 'rate',
      kind: 'rate',
      title: `Bank of England decision on ${fmtDate(nextRate.date)}`,
      body: `${nextRate.expectation}. This moves overdraft, credit card and savings rates, not most everyday bills.`,
      date: nextRate.date,
      confidence: nextRate.confidence,
      why: ['Shown for awareness; it has a small effect on your forecast'],
      source: RATE_SOURCE,
    });
  }
  return out;
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
      title: 'No storms ahead',
      body: `Your balance stays above ${fmtMoney(Math.max(0, low.low))} for the next six months, even in a cautious case.`,
      confidence: 'likely',
      why: ['Regular income covers your bills and usual spending', ...f.events.slice(0, 2).map((e) => `${e.label} is already included`)],
    });
  }

  const bigEvents = f.events.filter((e) => e.amount >= 100);
  for (const e of dedupeByLabel(bigEvents).slice(0, 3)) {
    const total = f.events.filter((x) => x.label === e.label).reduce((s, x) => s + x.amount, 0);
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

  out.push(...priceInsights(f));

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
  return out.filter((w) => w.flows.length || w.categoryScale);
}
