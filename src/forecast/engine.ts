import type { Category, Confidence, LifeEvent, ObTransaction, Profile, WhatIf } from '@/lib/types';
import { addDays, daysBetween, iso, parseIso } from '@/lib/dates';
import { categorise } from '@/forecast/categorise';
import { JOB_TEMPLATES, hasVariableIncome } from '@/data/jobs';
import { FESTIVALS, festivalEvents, previousOccurrence, ruleEvents } from '@/data/calendar';
import { SNAPSHOT_WORLD, conditionsOn, midpoint, type WeatherCondition, type World } from '@/data/world';
import { MORTGAGE_MARGIN } from '@/data/prices';

// The forecast is plain arithmetic, not AI: every number can be traced back
// to transactions, a rule or a published source. Claude only explains it.

export interface Flow {
  date: string;
  amount: number; // + in, - out
  label: string;
  kind: 'income' | 'bill' | 'spend' | 'event' | 'whatif';
  category?: Category;
  /** Standard deviation of this flow, for uncertain income. */
  sd?: number;
}

export interface DayPoint {
  date: string;
  expected: number;
  low: number;
  high: number;
}

export interface RecurringBill {
  merchant: string;
  category: Category;
  amount: number;
  day: number;
  months: number[];
}

export interface IncomeModel {
  variable: boolean;
  regular: { payer: string; amount: number; next: string[] }[];
  weeklyBase: number;
  weeklySd: number;
  payday: number; // 0 = Sunday
  template: string;
}

export interface Forecast {
  asOf: string;
  startBalance: number;
  days: DayPoint[];
  flows: Flow[];
  events: LifeEvent[];
  bills: RecurringBill[];
  income: IncomeModel;
  monthlySpend: Partial<Record<Category, number>>;
  festivalLearned: Record<string, number>;
  lowPoint: { date: string; expected: number; low: number };
  /** Last day the headline numbers and cards look at. */
  statsEnd: string;
  firstRisk: string | null; // first day the cautious line goes below zero
  firstLikely: string | null; // first day the expected line goes below zero
  safeToSpend: number;
  world: World;
  /** Forecast days where the weather changes how much this person can earn. */
  weatherImpact: { date: string; condition: WeatherCondition; effect: number; note: string }[];
  mortgage: MortgageOutlook | null;
}

const BAND_Z = 1.28; // ~80% band
const SAFETY_BUFFER = 50;
const VARIABLE_CATEGORIES: Category[] = [
  'groceries',
  'fuel',
  'public-transport',
  'eating-out',
  'coffee',
  'entertainment',
  'other',
  'childcare',
];

type Txn = { date: Date; amount: number; category: Category; name: string; credit: boolean };

function prepare(txns: ObTransaction[], asOf: Date): Txn[] {
  return txns
    .map((t) => ({
      date: parseIso(t.BookingDateTime),
      amount: Number(t.Amount.Amount),
      category: categorise(t),
      name: t.TransactionInformation,
      credit: t.CreditDebitIndicator === 'Credit',
    }))
    .filter((t) => t.date < asOf);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}

/** Monthly bills: same merchant, roughly the same amount, about a month apart. */
function detectBills(txns: Txn[], asOf: Date): { bills: RecurringBill[]; billNames: Set<string> } {
  const yearAgo = addDays(asOf, -365);
  const debits = txns.filter((t) => !t.credit && t.date >= yearAgo && t.category !== 'tax');
  const bills: RecurringBill[] = [];
  for (const [merchant, ts] of groupBy(debits, (t) => t.name)) {
    if (ts.length < 4) continue;
    const gaps = ts.slice(1).map((t, i) => daysBetween(ts[i].date, t.date));
    const amounts = ts.map((t) => t.amount);
    const steady = sd(amounts) / mean(amounts) < 0.05;
    const monthly = median(gaps) >= 26 && median(gaps) <= 35;
    if (!steady || !monthly) continue;
    bills.push({
      merchant,
      category: ts[0].category,
      amount: ts[ts.length - 1].amount,
      day: ts[ts.length - 1].date.getUTCDate(),
      months: [...new Set(ts.map((t) => t.date.getUTCMonth() + 1))],
    });
  }
  return { bills, billNames: new Set(bills.map((b) => b.merchant)) };
}

/**
 * Income model. Payments with a fixed amount (salary, loan instalments,
 * Child Benefit) are projected on their own schedule. Everything else is
 * variable pay: we remove the job's seasonal pattern, take the average and
 * spread of a normal week, then put the season back for the weeks ahead.
 */
function modelIncome(txns: Txn[], asOf: Date, horizonEnd: Date, profile: Profile): IncomeModel {
  const yearAgo = addDays(asOf, -365);
  const credits = txns.filter((t) => t.credit && t.date >= yearAgo);
  const regular: IncomeModel['regular'] = [];
  const regularNames = new Set<string>();

  for (const [payer, ts] of groupBy(credits, (t) => t.name)) {
    if (ts.length < 3) continue;
    const amounts = ts.map((t) => t.amount);
    if (sd(amounts) / mean(amounts) > 0.02) continue;
    regularNames.add(payer);
    const gap = median(ts.slice(1).map((t, i) => daysBetween(ts[i].date, t.date)));
    const last = ts[ts.length - 1].date;
    const next: string[] = [];
    if (gap >= 26 && gap <= 35) {
      for (let m = 1; m <= 14; m++) {
        const d = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + m, last.getUTCDate()));
        if (d >= asOf && d <= horizonEnd) next.push(iso(d));
      }
    } else if (gap >= 6 && gap <= 30) {
      for (let d = addDays(last, gap); d <= horizonEnd; d = addDays(d, gap)) if (d >= asOf) next.push(iso(d));
    } else {
      // Irregular schedule (e.g. termly loan instalments): repeat last year's dates.
      for (const t of ts) {
        const d = addDays(t.date, 365);
        if (d >= asOf && d <= horizonEnd) next.push(iso(d));
      }
    }
    regular.push({ payer, amount: amounts[amounts.length - 1], next });
  }

  // Once-a-year payments (a bonus, a tax refund): seen twice, about a year apart.
  const twoYearsAgo = addDays(asOf, -730);
  const older = txns.filter((t) => t.credit && t.date >= twoYearsAgo && !regularNames.has(t.name));
  for (const [payer, ts] of groupBy(older, (t) => t.name)) {
    if (ts.length !== 2) continue;
    const gap = daysBetween(ts[0].date, ts[1].date);
    if (gap < 330 || gap > 400) continue;
    const nextDate = addDays(ts[1].date, 365);
    regularNames.add(payer);
    regular.push({
      payer,
      amount: ts[1].amount,
      next: nextDate >= asOf && nextDate <= horizonEnd ? [iso(nextDate)] : [],
    });
  }

  const template = JOB_TEMPLATES[profile.jobTemplate];
  const variable = hasVariableIncome(profile.payType);
  const varCredits = credits.filter((t) => !regularNames.has(t.name));
  const weekly = new Map<number, { total: number; month: number }>();
  for (const t of varCredits) {
    const w = Math.floor(daysBetween(yearAgo, t.date) / 7);
    const cur = weekly.get(w) ?? { total: 0, month: t.date.getUTCMonth() };
    cur.total += t.amount;
    weekly.set(w, cur);
  }
  const deseasoned: number[] = [];
  for (let w = 0; w < 52; w++) {
    const wk = weekly.get(w);
    const monthIdx = addDays(yearAgo, w * 7 + 3).getUTCMonth();
    deseasoned.push((wk?.total ?? 0) / template.seasonality[wk?.month ?? monthIdx]);
  }
  const weekdays = varCredits.map((t) => t.date.getUTCDay());
  const payday = weekdays.length
    ? Number([...groupBy(weekdays, String)].sort((a, b) => b[1].length - a[1].length)[0][0])
    : 5;

  return {
    variable: variable && varCredits.length > 0,
    regular,
    weeklyBase: variable ? mean(deseasoned) : 0,
    weeklySd: variable ? sd(deseasoned) : 0,
    payday,
    template: template.label,
  };
}

/** Typical monthly spend per category over the last 12 weeks. */
function spendBaseline(txns: Txn[], asOf: Date, billNames: Set<string>) {
  const from = addDays(asOf, -84);
  const monthly: Partial<Record<Category, number>> = {};
  for (const t of txns) {
    if (t.credit || t.date < from) continue;
    monthly[t.category] = (monthly[t.category] ?? 0) + (t.amount * 365) / 12 / 84;
  }
  const variableDaily: Partial<Record<Category, number>> = {};
  for (const c of VARIABLE_CATEGORIES) {
    const total = txns
      .filter((t) => !t.credit && t.date >= from && t.category === c && !billNames.has(t.name))
      .reduce((s, t) => s + t.amount, 0);
    if (total > 0) variableDaily[c] = total / 84;
  }
  return { monthly, variableDaily };
}

/** Extra spent around each festival last time, compared with a normal fortnight. */
function learnFestivalSpend(txns: Txn[], profile: Profile, asOf: Date, billNames: Set<string>) {
  const learned: Record<string, number> = {};
  for (const f of FESTIVALS) {
    if (!profile.festivals.includes(f.id)) continue;
    const upcoming = f.dates.map(parseIso).find((d) => d >= asOf);
    const prev = upcoming && previousOccurrence(f, upcoming);
    if (!prev || prev >= asOf) continue;
    const winStart = addDays(prev, -f.leadDays);
    const spendIn = (a: Date, b: Date) =>
      txns
        .filter((t) => !t.credit && t.date >= a && t.date <= b && !billNames.has(t.name) && t.category !== 'tax')
        .reduce((s, t) => s + t.amount, 0);
    const baselineDaily = spendIn(addDays(winStart, -90), addDays(winStart, -1)) / 90;
    const excess = spendIn(winStart, prev) - baselineDaily * (f.leadDays + 1);
    if (excess > 40) learned[f.id] = Math.round(excess / 10) * 10;
  }
  return learned;
}

function priceFactor(world: World, category: Category, date: Date, asOf: Date): number {
  let f = 1;
  const cpi = world.cpi[category];
  if (cpi) f *= (1 + cpi) ** (daysBetween(asOf, date) / 365);
  // Several stories about the same shock are one move, not many: take the strongest active signal.
  let signal = 0;
  for (const s of world.signals) {
    if (s.category !== category || date < parseIso(s.from) || (s.to && date > parseIso(s.to))) continue;
    if (Math.abs(midpoint(s)) > Math.abs(signal)) signal = midpoint(s);
  }
  return f * (1 + signal);
}

function billAmount(world: World, b: RecurringBill, date: Date): number {
  let amt = b.amount;
  for (const c of world.scheduled) {
    if (c.category !== b.category || date < parseIso(c.date)) continue;
    amt = c.monthlyAmount ? amt + c.monthlyAmount : amt * (1 + (c.pct ?? 0));
  }
  return amt;
}

export interface ForecastInput {
  profile: Profile;
  transactions: ObTransaction[];
  balance: number;
  asOf: Date;
  horizonDays?: number;
  /** Days the headline numbers (lowest point, safe to spend, warnings) look across. Default 180. */
  statsDays?: number;
  whatIfs?: WhatIf[];
  extraEvents?: LifeEvent[];
  world?: World;
}

/**
 * Pay multiplier for the week ending on `payday`: the average effect of the
 * weather on each of the seven working days before it. Only days with a
 * real forecast count; beyond that the job's seasonal pattern covers it.
 */
function weatherFactor(world: World, payday: Date, hits: Map<string, { effect: number }[]>): number {
  let total = 0;
  for (let k = 1; k <= 7; k++) {
    const day = hits.get(iso(addDays(payday, -k + 1)));
    total += 1 + (day ? day.reduce((s, h) => s + h.effect, 0) : 0);
  }
  return world.weather.days.length ? total / 7 : 1;
}

export function forecast(input: ForecastInput): Forecast {
  const { profile, asOf, whatIfs = [] } = input;
  const world = input.world ?? SNAPSHOT_WORLD;
  const horizon = input.horizonDays ?? 180;
  const end = addDays(asOf, horizon);
  const txns = prepare(input.transactions, asOf);

  const { bills, billNames } = detectBills(txns, asOf);
  const income = modelIncome(txns, asOf, end, profile);
  const { monthly, variableDaily } = spendBaseline(txns, asOf, billNames);
  const festivalLearned = learnFestivalSpend(txns, profile, asOf, billNames);
  const lastTax = [...txns].reverse().find((t) => t.category === 'tax' && t.date.getUTCMonth() === 0);

  const inWindow = (e: LifeEvent) => parseIso(e.date) >= asOf && parseIso(e.date) <= end;
  const events: LifeEvent[] = [
    ...festivalEvents(profile, asOf, end, festivalLearned),
    ...ruleEvents(profile, asOf, end, lastTax?.amount ?? null),
    ...profile.personalEvents.filter(inWindow),
    ...(input.extraEvents ?? []).filter(inWindow),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const scale: Partial<Record<Category, number>> = {};
  for (const w of whatIfs) if (w.categoryScale) scale[w.categoryScale.category] = w.categoryScale.factor;

  // Weather only moves pay for variable earners in jobs it affects.
  const mortgage = mortgageOutlook(profile, world, asOf);
  const locked = whatIfs.some((w) => w.mortgageLock);
  const paused = new Set(whatIfs.flatMap((w) => w.pauseBills ?? []));
  const mortgageAfterFix = (b: RecurringBill, d: Date) => {
    if (!mortgage || b.category !== 'mortgage' || d < parseIso(mortgage.fixEnds)) return null;
    if (locked) return { amount: mortgage.low, sd: 0 };
    return { amount: (mortgage.low + mortgage.high) / 2, sd: (mortgage.high - mortgage.low) / 2 / BAND_Z };
  };

  const weatherImpact: Forecast['weatherImpact'] = [];
  if (income.variable) {
    for (const day of world.weather.days) {
      for (const c of conditionsOn(day)) {
        const e = world.weather.effects.find((x) => x.condition === c);
        if (e) weatherImpact.push({ date: day.date, condition: c, effect: e.effect, note: e.note });
      }
    }
  }
  const weatherHits = groupBy(weatherImpact, (w) => w.date);
  const wageFactor = (d: Date) =>
    world.incomeChanges
      .filter((c) => d >= parseIso(c.date) && (!c.payTypes || c.payTypes.includes(profile.payType)))
      .reduce((f, c) => f * (1 + c.pct), 1);

  const flows: Flow[] = [];
  for (let i = 0; i < horizon; i++) {
    const d = addDays(asOf, i);
    const ds = iso(d);
    const m = d.getUTCMonth();

    for (const b of bills) {
      if (d.getUTCDate() === b.day && b.months.includes(m + 1) && !paused.has(b.merchant)) {
        const newDeal = mortgageAfterFix(b, d);
        flows.push({
          date: ds,
          amount: -(newDeal?.amount ?? billAmount(world, b, d)),
          label: newDeal ? `${b.merchant} (new rate)` : b.merchant,
          kind: 'bill',
          category: b.category,
          sd: newDeal?.sd,
        });
      }
    }
    for (const r of income.regular) {
      if (r.next.includes(ds)) flows.push({ date: ds, amount: r.amount, label: r.payer, kind: 'income' });
    }
    if (income.variable && d.getUTCDay() === income.payday) {
      const season = JOB_TEMPLATES[profile.jobTemplate].seasonality[m];
      const factor = season * wageFactor(d) * weatherFactor(world, d, weatherHits);
      flows.push({
        date: ds,
        amount: income.weeklyBase * factor,
        label: 'Expected pay',
        kind: 'income',
        sd: income.weeklySd * season,
      });
    }
    for (const [c, daily] of Object.entries(variableDaily) as [Category, number][]) {
      const amt = daily * priceFactor(world, c, d, asOf) * (scale[c] ?? 1);
      flows.push({ date: ds, amount: -amt, label: c, kind: 'spend', category: c });
    }
  }
  for (const e of events) flows.push({ date: e.date, amount: -e.amount, label: e.label, kind: 'event' });
  for (const w of whatIfs) for (const f of w.flows) flows.push({ ...f, label: w.label, kind: 'whatif' });

  const byDay = groupBy(flows, (f) => f.date);
  const days: DayPoint[] = [];
  let bal = input.balance;
  let variance = 0;
  for (let i = 0; i < horizon; i++) {
    const ds = iso(addDays(asOf, i));
    for (const f of byDay.get(ds) ?? []) {
      bal += f.amount;
      variance += (f.sd ?? 0) ** 2;
    }
    const spread = BAND_Z * Math.sqrt(variance);
    days.push({ date: ds, expected: bal, low: bal - spread, high: bal + spread });
  }

  // The chart can look a year ahead; the headline numbers cover the next six months.
  const statsWindow = days.slice(0, input.statsDays ?? 180);
  const low = statsWindow.reduce((a, b) => (b.expected < a.expected ? b : a), statsWindow[0]);

  return {
    asOf: iso(asOf),
    startBalance: input.balance,
    days,
    flows,
    events,
    bills,
    income,
    monthlySpend: monthly,
    festivalLearned,
    lowPoint: { date: low.date, expected: low.expected, low: low.low },
    statsEnd: statsWindow[statsWindow.length - 1].date,
    firstRisk: statsWindow.find((d) => d.low < 0)?.date ?? null,
    firstLikely: statsWindow.find((d) => d.expected < 0)?.date ?? null,
    // Spending more today lowers every later day, so the limit is set by the lowest point ahead.
    safeToSpend: Math.max(0, Math.floor((low.expected - SAFETY_BUFFER) / 5) * 5),
    world,
    weatherImpact,
    mortgage,
  };
}

/** Standard repayment mortgage: monthly payment for a balance, rate and term. */
export function monthlyPayment(balance: number, annualRate: number, years: number): number {
  const r = annualRate / 12;
  const n = Math.round(years * 12);
  return r === 0 ? balance / n : (balance * r) / (1 - (1 + r) ** -n);
}

function balanceAfter(balance: number, annualRate: number, years: number, months: number): number {
  const r = annualRate / 12;
  const pay = monthlyPayment(balance, annualRate, years);
  return balance * (1 + r) ** months - (pay * ((1 + r) ** months - 1)) / r;
}

export interface MortgageOutlook {
  fixEnds: string;
  current: number;
  low: number;
  high: number;
  rateLow: number;
  rateHigh: number;
  balanceAtEnd: number;
  bankRate: number;
}

/**
 * When a fixed rate ends, the payment is re-worked from the balance left,
 * the years left and a new rate: Bank Rate plus a typical lender margin,
 * given as a range rather than a guess at one number.
 */
function mortgageOutlook(profile: Profile, world: World, asOf: Date): MortgageOutlook | null {
  const m = profile.mortgage;
  if (!m) return null;
  const fixEnds = parseIso(m.fixEnds);
  if (fixEnds < asOf) return null;
  const months = Math.max(0, Math.round(daysBetween(asOf, fixEnds) / 30.44));
  const balanceAtEnd = balanceAfter(m.balance, m.rate, m.yearsLeft, months);
  const yearsLeft = m.yearsLeft - months / 12;
  const rateLow = world.bankRate + MORTGAGE_MARGIN.low;
  const rateHigh = world.bankRate + MORTGAGE_MARGIN.high;
  return {
    fixEnds: m.fixEnds,
    current: monthlyPayment(m.balance, m.rate, m.yearsLeft),
    low: monthlyPayment(balanceAtEnd, rateLow, yearsLeft),
    high: monthlyPayment(balanceAtEnd, rateHigh, yearsLeft),
    rateLow,
    rateHigh,
    balanceAtEnd,
    bankRate: world.bankRate,
  };
}

export interface SalaryPlan {
  weekly: number;
  seedBuffer: number;
  /** Expected pay per week, and the pot balance after paying the salary. */
  weeks: { date: string; pay: number; pot: number }[];
}

/**
 * Pay yourself a salary: all variable pay goes into a buffer pot, and a
 * steady weekly amount comes out. The seed is the most the pot would ever
 * need to cover a run of bad weeks.
 */
export function salaryPlan(input: ForecastInput, base: Forecast): SalaryPlan | null {
  if (!base.income.variable) return null;
  const season = JOB_TEMPLATES[input.profile.jobTemplate].seasonality;
  // Students: the salary also spreads loan instalments across the weeks until the next one.
  const lumps = input.profile.payType === 'student' ? base.income.regular : [];
  const weeks: number[] = [];
  for (let i = 0; i < 26; i++) {
    const d = addDays(input.asOf, i * 7);
    const end = addDays(d, 7);
    const lump = lumps
      .flatMap((r) => r.next.map((n) => ({ date: parseIso(n), amount: r.amount })))
      .filter((x) => x.date >= d && x.date < end)
      .reduce((s, x) => s + x.amount, 0);
    weeks.push(base.income.weeklyBase * season[d.getUTCMonth()] + lump);
  }
  const weekly = Math.floor(mean(weeks) / 5) * 5;
  // Size the pot for a cautious run of weeks, not just the average.
  let pot = 0;
  let variance = 0;
  let worst = 0;
  weeks.forEach((w, i) => {
    pot += w - weekly;
    variance += (base.income.weeklySd * season[addDays(input.asOf, i * 7).getUTCMonth()]) ** 2;
    worst = Math.min(worst, pot - BAND_Z * Math.sqrt(variance));
  });
  const seedBuffer = Math.ceil(-worst / 10) * 10;
  let running = seedBuffer;
  const path = weeks.map((pay, i) => {
    running += pay - weekly;
    return { date: iso(addDays(input.asOf, i * 7)), pay, pot: running };
  });
  return { weekly, seedBuffer, weeks: path };
}

export interface Backtest {
  asOf: string;
  predicted: DayPoint[];
  actual: { date: string; balance: number }[];
  warnedOn: string;
  predictedRisk: string | null;
  actualOverdrawn: string | null;
  leadDays: number | null;
}

/**
 * Rewind one year, forecast using only what was known then, and compare
 * with what really happened.
 */
export function backtest(profile: Profile, transactions: ObTransaction[], balanceToday: number, today: Date): Backtest {
  const asOf = addDays(today, -365);
  const all = prepare(transactions, today);
  const signed = (t: Txn) => (t.credit ? t.amount : -t.amount);
  const balanceAsOf = balanceToday - all.filter((t) => t.date >= asOf).reduce((s, t) => s + signed(t), 0);

  const past = forecast({
    profile: { ...profile, personalEvents: [] },
    transactions,
    balance: balanceAsOf,
    asOf,
    horizonDays: 150,
  });

  const byDay = groupBy(all.filter((t) => t.date >= asOf), (t) => iso(t.date));
  const actual: Backtest['actual'] = [];
  let bal = balanceAsOf;
  for (let i = 0; i < 150; i++) {
    const ds = iso(addDays(asOf, i));
    for (const t of byDay.get(ds) ?? []) bal += signed(t);
    actual.push({ date: ds, balance: bal });
  }
  const actualOverdrawn = actual.find((a) => a.balance < 0)?.date ?? null;
  return {
    asOf: iso(asOf),
    predicted: past.days,
    actual,
    warnedOn: iso(asOf),
    predictedRisk: past.firstRisk,
    actualOverdrawn,
    leadDays: actualOverdrawn ? daysBetween(asOf, parseIso(actualOverdrawn)) : null,
  };
}

export type { Confidence };
