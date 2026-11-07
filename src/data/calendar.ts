import type { LifeEvent, Profile } from '@/lib/types';
import { addDays, iso, nextOn, parseIso } from '@/lib/dates';

export interface Festival {
  id: string;
  label: string;
  /** Upcoming dates; moon-sighted festivals can shift by a day. */
  dates: string[];
  /** How many days before the date spending starts. */
  leadDays: number;
}

// ⚠ Check these dates before the demo. Past dates are used to learn what
// someone spent last time.
export const FESTIVALS: Festival[] = [
  { id: 'christmas', label: 'Christmas', dates: ['2024-12-25', '2025-12-25', '2026-12-25', '2027-12-25'], leadDays: 24 },
  { id: 'diwali', label: 'Diwali', dates: ['2024-11-01', '2025-10-20', '2026-11-08', '2027-10-29'], leadDays: 10 },
  { id: 'lunar-new-year', label: 'Lunar New Year', dates: ['2025-01-29', '2026-02-17', '2027-02-06'], leadDays: 10 },
  { id: 'eid-al-fitr', label: 'Eid al-Fitr', dates: ['2025-03-30', '2026-03-20', '2027-03-10'], leadDays: 10 },
  { id: 'eid-al-adha', label: 'Eid al-Adha', dates: ['2025-06-06', '2026-05-27', '2027-05-17'], leadDays: 10 },
  { id: 'hanukkah', label: 'Hanukkah', dates: ['2024-12-25', '2025-12-14', '2026-12-05'], leadDays: 7 },
];

/** The occurrence of a festival roughly one year before `date`, if known. */
export function previousOccurrence(f: Festival, date: Date): Date | null {
  const target = date.getTime() - 365 * 86_400_000;
  let best: Date | null = null;
  for (const s of f.dates) {
    const d = parseIso(s);
    if (Math.abs(d.getTime() - target) < 40 * 86_400_000) best = d;
  }
  return best;
}

const DEFAULT_SPEND: Record<Profile['household'], number> = {
  alone: 220,
  partner: 380,
  kids: 600,
};

/**
 * Turn the festivals someone picked into spending events. Spending is split
 * into three chunks in the run-up, which is closer to real life than one
 * big payment on the day.
 */
export function festivalEvents(
  profile: Profile,
  from: Date,
  to: Date,
  lastYearSpend: Record<string, number>,
): LifeEvent[] {
  const events: LifeEvent[] = [];
  for (const f of FESTIVALS) {
    if (!profile.festivals.includes(f.id)) continue;
    const date = f.dates.map(parseIso).find((d) => d >= from && d <= to);
    if (!date) continue;
    const learned = lastYearSpend[f.id];
    const total = learned ?? DEFAULT_SPEND[profile.household];
    for (let i = 0; i < 3; i++) {
      const when = addDays(date, -Math.round((f.leadDays * (3 - i)) / 3));
      if (when < from) continue;
      events.push({
        id: `${f.id}-${i}`,
        date: iso(when),
        label: f.label,
        amount: Math.round(total / 3),
        source: 'festival',
        note: learned
          ? `Based on what you spent around ${f.label} last year`
          : `Typical spend for your household`,
      });
    }
  }
  return events;
}

/** Fixed-date bills that come from rules about someone's situation. */
export function ruleEvents(profile: Profile, from: Date, to: Date, lastTaxBill: number | null) {
  const events: LifeEvent[] = [];
  if (profile.payType === 'self-employed') {
    const due = nextOn(from, 1, 31);
    if (due <= to) {
      events.push({
        id: 'self-assessment',
        date: iso(due),
        label: 'Self Assessment tax + payment on account',
        amount: Math.round((lastTaxBill ?? 2000) * 1.05),
        source: 'rule',
        note: lastTaxBill
          ? 'Estimated from last January’s HMRC payment, plus 5% for income growth'
          : 'Estimated: connect your HMRC account for the exact figure',
      });
    }
  }
  return events;
}
