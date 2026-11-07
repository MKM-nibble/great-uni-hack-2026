import type { Category, Profile } from '@/lib/types';
import type { Forecast } from '@/forecast/engine';
import { CATEGORY_LABEL } from '@/forecast/categorise';
import { addDays, daysBetween, fmtDate, fmtMoney, parseIso } from '@/lib/dates';

// The two things the top of the page answers: what's changing over the next
// six months, and what that means for this month.

export type SectionId = 'up' | 'down' | 'coming' | 'buffer';

export interface OutlookItem {
  id: string;
  title: string;
  /** Effect over the next six months in pounds, or null when we can't price it reliably. */
  amount: number | null;
  detail: string;
  why: string;
  /** When it has to be paid (big costs coming). */
  due?: string;
}

export interface OutlookSection {
  id: SectionId;
  label: string;
  color: string;
  total: number;
  items: OutlookItem[];
}

export interface MonthPlan {
  safeToSpend: number;
  putAside: number;
}

/** How unsure a news-driven estimate is: keep this much extra on top of the usual spend. */
const BUFFER = 0.1;
const ESSENTIAL: Category[] = [
  'rent', 'mortgage', 'energy', 'council-tax', 'groceries', 'fuel', 'public-transport',
  'phone', 'childcare', 'trade-supplies', 'tax',
];

const monthsBetween = (a: Date, b: Date) => Math.max(0, daysBetween(a, b) / 30.44);

export function buildOutlook(profile: Profile, f: Forecast): { sections: OutlookSection[]; plan: MonthPlan } {
  const asOf = parseIso(f.asOf);
  const end = parseIso(f.statsEnd);
  const spend = (c: Category) => f.monthlySpend[c] ?? 0;
  // Months of the six-month window that a change starting on `from` covers.
  const monthsFrom = (from: string) => monthsBetween(parseIso(from) > asOf ? parseIso(from) : asOf, end);

  const up: OutlookItem[] = [];
  const down: OutlookItem[] = [];
  const buffer: OutlookItem[] = [];

  if (f.mortgage) {
    const extra = (f.mortgage.low + f.mortgage.high) / 2 - f.mortgage.current;
    up.push({
      id: 'mortgage',
      title: 'Mortgage payment',
      amount: extra * monthsFrom(f.mortgage.fixEnds),
      detail: `+${fmtMoney(f.mortgage.low - f.mortgage.current)} to +${fmtMoney(f.mortgage.high - f.mortgage.current)} a month from ${fmtDate(f.mortgage.fixEnds)}`,
      why: `Your fixed rate ends. New deals are around Bank Rate (${(f.mortgage.bankRate * 100).toFixed(2)}%) plus a lender margin.`,
    });
  }

  for (const c of f.world.scheduled) {
    const months = monthsFrom(c.date);
    if (parseIso(c.date) > end || spend(c.category) <= 0 || months <= 0) continue;
    const monthly = c.monthlyAmount ?? spend(c.category) * (c.pct ?? 0);
    if (monthly < 0.5) continue;
    up.push({
      id: `sched-${c.id}`,
      title: c.title,
      amount: monthly * months,
      detail: `About +${fmtMoney(monthly)} a month from ${fmtDate(c.date)}`,
      why: c.source,
    });
  }

  // News: one item per category, strongest story first.
  const seen = new Set<Category>();
  for (const s of [...f.world.signals].sort((a, b) => Math.abs(b.pctHigh + b.pctLow) - Math.abs(a.pctHigh + a.pctLow))) {
    if (seen.has(s.category) || spend(s.category) <= 0) continue;
    if (s.to && parseIso(s.to) < asOf) continue;
    seen.add(s.category);
    const label = CATEGORY_LABEL[s.category];
    const monthly = spend(s.category);
    if (s.pctHigh < 0) {
      const saving = (monthly * Math.abs(s.pctLow + s.pctHigh)) / 2;
      down.push({
        id: `signal-${s.category}`,
        title: `${label} getting cheaper`,
        amount: -saving * monthsFrom(s.from),
        detail: `About ${fmtMoney(saving)} a month less from ${fmtDate(s.from)}`,
        why: `${s.title}.${s.example ? ' (Demo scenario.)' : ''}`,
      });
    } else if (s.confidence === 'signal') {
      // A news story can't be priced reliably: hold a buffer instead of a guess.
      buffer.push({
        id: `signal-${s.category}`,
        title: `${label} may go up`,
        amount: monthly * BUFFER * monthsFrom(s.from),
        detail: `No reliable estimate. Keep a 10% buffer: about ${fmtMoney(monthly * BUFFER)} a month`,
        why: `${s.title}.${s.example ? ' (Demo scenario.)' : ''}`,
      });
    } else {
      const extra = (monthly * (s.pctLow + s.pctHigh)) / 2;
      up.push({
        id: `signal-${s.category}`,
        title: `${label} going up`,
        amount: extra * monthsFrom(s.from),
        detail: `About +${fmtMoney(extra)} a month from ${fmtDate(s.from)}`,
        why: s.title,
      });
    }
  }

  // Weather against a normal month for the area: direction only, no made-up figure.
  const days = f.world.weather.days;
  const normal = f.world.weather.normalTMean;
  if (days.length && normal != null) {
    const avg = days.reduce((t, d) => t + (d.tMin + d.tMax) / 2, 0) / days.length;
    const month = asOf.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
    const where = f.world.regionName ?? 'your area';
    if (avg <= normal - 1) {
      buffer.push({
        id: 'weather-cold',
        title: `Colder than a normal ${month}`,
        amount: null,
        detail:
          profile.jobTemplate === 'trades'
            ? 'Heating will cost more, but expect more boiler and burst-pipe call-outs too'
            : 'Heating is likely to cost more than usual',
        why: `The next two weeks in ${where} average ${avg.toFixed(1)}°C, against a usual ${normal.toFixed(1)}°C. We don't put a figure on it.`,
      });
    } else if (avg >= normal + 1) {
      buffer.push({
        id: 'weather-mild',
        title: `Milder than a normal ${month}`,
        amount: null,
        detail: 'Heating may cost a little less than usual',
        why: `The next two weeks in ${where} average ${avg.toFixed(1)}°C, against a usual ${normal.toFixed(1)}°C.`,
      });
    }
  }
  if (f.weatherImpact.length && f.income.variable) {
    const loss = (f.income.weeklyBase / 5) * f.weatherImpact.reduce((t, w) => t + w.effect, 0);
    buffer.push({
      id: 'weather-pay',
      title: loss < 0 ? 'Weather costing work days' : 'Weather bringing extra work',
      amount: null,
      detail: `${f.weatherImpact.length} day${f.weatherImpact.length > 1 ? 's' : ''} in the next two weeks: about ${fmtMoney(Math.abs(loss))} ${loss < 0 ? 'less' : 'more'} pay`,
      why: `${f.weatherImpact[0].note}. From the forecast for ${f.world.regionName ?? 'your area'}.`,
    });
  }

  const coming: OutlookItem[] = [];
  const byLabel = new Map<string, { total: number; last: string; note?: string }>();
  for (const e of f.events.filter((e) => e.date <= f.statsEnd)) {
    const cur = byLabel.get(e.label) ?? { total: 0, last: e.date, note: e.note };
    cur.total += e.amount;
    cur.last = e.date;
    byLabel.set(e.label, cur);
  }
  for (const [label, e] of byLabel) {
    coming.push({
      id: `event-${label}`,
      title: label,
      amount: e.total,
      detail: `${fmtMoney(e.total)} by ${fmtDate(e.last)}`,
      why: e.note ?? 'From your calendar',
      due: e.last,
    });
  }

  const section = (id: SectionId, label: string, color: string, items: OutlookItem[]): OutlookSection => ({
    id,
    label,
    color,
    items: items.sort((a, b) => Math.abs(b.amount ?? 0) - Math.abs(a.amount ?? 0)),
    total: items.reduce((t, i) => t + Math.abs(i.amount ?? 0), 0),
  });
  const sections = [
    section('up', 'Costs going up', '#c4122f', up),
    section('coming', 'Big costs coming', '#5e10b1', coming),
    section('buffer', 'Keep a buffer', '#b45d00', buffer),
    section('down', 'Costs going down', '#2a7d3e', down),
  ].filter((s) => s.items.length);

  return { sections, plan: monthPlan(f, [...coming, ...up], buffer) };
}

/**
 * Put aside: what the coming costs and buffers need, less what today's
 * balance already covers, spread over the months until they're due.
 * Safe to spend: this month's expected pay, minus essentials, minus that.
 */
function monthPlan(f: Forecast, upcoming: OutlookItem[], buffer: OutlookItem[]): MonthPlan {
  const asOf = parseIso(f.asOf);
  const monthEnd = addDays(asOf, 30);
  const inMonth = f.flows.filter((x) => parseIso(x.date) < monthEnd);
  const income = inMonth.filter((x) => x.amount > 0 && x.kind === 'income').reduce((t, x) => t + x.amount, 0);
  const essentials = inMonth
    .filter((x) => x.amount < 0 && (x.kind === 'bill' || x.kind === 'spend') && x.category && ESSENTIAL.includes(x.category))
    .reduce((t, x) => t - x.amount, 0);

  const needed =
    upcoming.reduce((t, i) => t + Math.max(0, i.amount ?? 0), 0) + buffer.reduce((t, i) => t + Math.max(0, i.amount ?? 0), 0);
  const covered = Math.max(0, f.startBalance - essentials);
  // Spread over the months until the last big cost is due.
  const lastDue = upcoming.reduce((d, i) => (i.due && i.due > d ? i.due : d), f.asOf);
  const months = Math.max(1, monthsBetween(asOf, parseIso(lastDue)));
  const putAside = Math.max(0, Math.ceil((needed - covered) / months / 10) * 10);
  const safeToSpend = Math.max(0, Math.floor((income - essentials - putAside) / 10) * 10);
  return { safeToSpend, putAside };
}
