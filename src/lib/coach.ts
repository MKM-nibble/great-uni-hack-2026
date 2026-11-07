import type { Profile } from '@/lib/types';
import type { Forecast, SalaryPlan } from '@/forecast/engine';
import type { Insight } from '@/forecast/insights';
import { fmtDate, fmtMoney } from '@/lib/dates';

export interface CoachAdvice {
  headline: string;
  actions: { title: string; detail: string }[];
  source: 'rules' | 'claude' | 'cache';
}

export const LANGUAGES = ['English', 'Polski', 'اردو', 'العربية', 'Română', 'বাংলা', 'Español'] as const;
export type Language = (typeof LANGUAGES)[number];

/**
 * A short summary of the forecast: the only thing Claude ever sees.
 * No transactions, names of payers or account details leave the app.
 */
export function coachSummary(profile: Profile, f: Forecast, salary: SalaryPlan | null, insights: Insight[]) {
  return {
    payType: profile.payType,
    job: profile.job,
    household: profile.household,
    balanceToday: Math.round(f.startBalance),
    safeToSpendToday: f.safeToSpend,
    lowestPoint: { date: f.lowPoint.date, amount: Math.round(f.lowPoint.expected) },
    likelyOverdrawnFrom: f.firstLikely,
    cautiousRiskFrom: f.firstRisk,
    usualWeeklyPay: f.income.variable ? Math.round(f.income.weeklyBase) : null,
    salaryPlan: salary ? { weekly: salary.weekly, potSize: salary.seedBuffer } : null,
    mortgage: f.mortgage
      ? {
          fixEnds: f.mortgage.fixEnds,
          paymentNow: Math.round(f.mortgage.current),
          paymentAfter: [Math.round(f.mortgage.low), Math.round(f.mortgage.high)],
        }
      : null,
    upcoming: insights
      .filter((i) => i.kind !== 'support')
      .slice(0, 6)
      .map((i) => i.title),
  };
}
export type CoachSummary = ReturnType<typeof coachSummary>;

/** Deterministic advice. Always available, and the fallback when there's no API key. */
export function rulesCoach(profile: Profile, f: Forecast, salary: SalaryPlan | null, insights: Insight[]): CoachAdvice {
  const actions: CoachAdvice['actions'] = [];
  const danger = f.firstLikely ?? f.firstRisk;

  if (salary) {
    actions.push({
      title: `Start paying yourself ${fmtMoney(salary.weekly)} a week`,
      detail: `Good weeks top up your pot, slow weeks draw from it. Build the pot towards ${fmtMoney(salary.seedBuffer)}.`,
    });
  }
  if (danger && profile.payType === 'zero-hours') {
    actions.push({
      title: 'Pick up extra shifts while work is busy',
      detail: 'A couple of extra shifts in a good month go further than cutting back in a quiet one.',
    });
  }
  if (danger && profile.payType === 'self-employed') {
    actions.push({
      title: 'Set money aside for the January tax bill now',
      detail: 'Move a fixed amount from each invoice into a tax pot so the bill is already covered.',
    });
  }
  if (danger && profile.payType === 'student') {
    actions.push({
      title: 'Plan for the gap before your next loan',
      detail: 'Your interest-free student overdraft can bridge it, so check your limit now rather than in January.',
    });
  }
  if (f.mortgage) {
    const extra = (f.mortgage.low + f.mortgage.high) / 2 - f.mortgage.current;
    actions.push({
      title: `Look at new mortgage deals before ${fmtDate(f.mortgage.fixEnds)}`,
      detail: 'Many lenders let you lock a rate months ahead, so a later rise can’t catch you out.',
    });
    const bonus = f.income.regular.find((r) => /bonus/i.test(r.payer) && r.next.length);
    actions.push(
      bonus
        ? {
            title: 'Keep your March bonus for April',
            detail: `It covers about ${Math.floor(bonus.amount / extra)} months of the higher mortgage payment while you adjust.`,
          }
        : {
            title: `Find about ${fmtMoney(extra)} a month before the fix ends`,
            detail: 'Starting now spreads the change instead of it landing all at once.',
          },
    );
  }
  const event = insights.find((i) => i.kind === 'event' && !i.id.includes('self-assessment'));
  if (event && actions.length < 3) {
    actions.push({
      title: `Put a little aside for ${event.title.split(':')[0]}`,
      detail: 'A little each week from now means no single big hit when it arrives.',
    });
  }
  if (danger && actions.length < 3) {
    actions.push({
      title: 'Talk to NatWest early',
      detail: 'It is free and confidential, and there are more options before a payment is missed.',
    });
  }
  if (!danger) {
    actions.push({
      title: 'Grow a small rainy-day pot',
      detail: `You can comfortably move ${fmtMoney(Math.min(100, f.safeToSpend / 4))} a month into savings.`,
    });
  }

  const m = f.mortgage;
  const headline = danger
    ? `Heads up: money gets tight around ${fmtDate(danger)}. Here’s how to get ahead of it.`
    : m
      ? `You’re fine for now, but your mortgage goes up about ${fmtMoney((m.low + m.high) / 2 - m.current)} a month from ${fmtDate(m.fixEnds)}.`
      : `You’re on track. Your lowest point is ${fmtMoney(f.lowPoint.expected)} on ${fmtDate(f.lowPoint.date)}.`;
  return { headline, actions: actions.slice(0, 3), source: 'rules' };
}
