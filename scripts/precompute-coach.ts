// Pre-generates AI coaching for the demo customers so the live demo makes
// no API calls. Run on demo morning, with the dev server running and
// ANTHROPIC_API_KEY set in .env.local:
//   pnpm dev   (in another terminal)
//   pnpm precompute
// Costs a few cents: one short call per persona per language.
import { writeFileSync } from 'node:fs';
import { getPersonas, PERSONA_ORDER } from '@/data/personas';
import { forecast, salaryPlan } from '@/forecast/engine';
import { buildInsights } from '@/forecast/insights';
import { coachSummary } from '@/lib/coach';
import { today } from '@/lib/dates';
import cache from '@/data/coach-cache.json';

const SERVER = process.env.STAGGER_URL ?? 'http://localhost:3000';
const LANGUAGES = (process.env.LANGUAGES ?? 'English').split(',');
const out: Record<string, unknown> = { ...cache };

for (const id of PERSONA_ORDER) {
  const p = getPersonas()[id];
  const input = { profile: p.profile, transactions: p.transactions, balance: p.balance, asOf: today() };
  const f = forecast(input);
  const summary = coachSummary(p.profile, f, salaryPlan(input, f), buildInsights(p.profile, f));
  for (const language of LANGUAGES) {
    const res = await fetch(`${SERVER}/api/coach`, {
      method: 'POST',
      body: JSON.stringify({ summary, language }),
    });
    if (!res.ok) {
      console.error(`${id}/${language}: ${res.status} ${await res.text()}`);
      continue;
    }
    const advice = await res.json();
    delete advice.source;
    out[`${id}:${language}`] = advice;
    console.log(`${id}/${language}: ${advice.headline}`);
  }
}

writeFileSync('src/data/coach-cache.json', JSON.stringify(out, null, 2) + '\n');
console.log('Saved src/data/coach-cache.json. Commit it so the demo works offline.');
