// Prints each persona's forecast summary. Run: pnpm inspect
import { getPersonas, PERSONA_ORDER } from '@/data/personas';
import { backtest, forecast, salaryPlan } from '@/forecast/engine';
import { today } from '@/lib/dates';

for (const id of PERSONA_ORDER) {
  const p = getPersonas()[id];
  const input = { profile: p.profile, transactions: p.transactions, balance: p.balance, asOf: today() };
  const f = forecast(input);
  const s = salaryPlan(input, f);
  const b = backtest(p.profile, p.transactions, p.balance, today());
  const r = (n: number) => Math.round(n);
  console.log(`\n== ${p.name}: balance £${r(p.balance)}, safe to spend £${f.safeToSpend}`);
  console.log(`  low point ${f.lowPoint.date} £${r(f.lowPoint.expected)} (cautious £${r(f.lowPoint.low)}); first risk ${f.firstRisk}; likely ${f.firstLikely}`);
  console.log(`  income: variable=${f.income.variable} base £${r(f.income.weeklyBase)}/wk sd £${r(f.income.weeklySd)} payday ${f.income.payday}; regular ${f.income.regular.map((x) => `${x.payer} £${r(x.amount)} x${x.next.length}`).join(', ')}`);
  console.log(`  bills: ${f.bills.map((x) => `${x.merchant} £${r(x.amount)}`).join(', ')}`);
  console.log(`  events: ${f.events.map((e) => `${e.date} ${e.label} £${e.amount}`).join(' | ')}`);
  console.log(`  learned festivals: ${JSON.stringify(f.festivalLearned)}`);
  if (s) console.log(`  salary £${s.weekly}/wk, pot seed £${s.seedBuffer}, pot peak £${r(Math.max(...s.weeks.map((w) => w.pot)))}`);
  const minActual = b.actual.reduce((a, x) => (x.balance < a.balance ? x : a));
  console.log(`  backtest from ${b.asOf}: predicted risk ${b.predictedRisk}, actual overdrawn ${b.actualOverdrawn} (lead ${b.leadDays}d), actual min £${r(minActual.balance)} on ${minActual.date}`);
}
