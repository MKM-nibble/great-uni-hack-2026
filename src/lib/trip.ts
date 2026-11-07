import type { LifeEvent, Profile } from '@/lib/types';
import { addDays, fmtDate, fmtMoney, iso } from '@/lib/dates';

// A scripted answer for the demo question "Can I afford a week in Spain next
// week?". Typical prices, not live quotes; the answer says so and points to
// where to check.

const PEOPLE: Record<Profile['household'], number> = { alone: 1, partner: 2, kids: 3 };

export const TRIP_QUESTION = 'Can I afford a week in Spain next week?';

export interface TripAnswer {
  text: string;
  refs: { label: string; url: string }[];
  event: LifeEvent;
}

export function spainTrip(profile: Profile, asOf: Date, safeToSpend: number, lowPoint: number): TripAnswer {
  const people = PEOPLE[profile.household];
  // Last-minute return flights from a northern UK airport, a mid-range hotel, and day-to-day costs.
  const flights = [130, 220].map((x) => x * people);
  const hotel = [65, 95].map((x) => x * 7);
  const daily = [35, 50].map((x) => x * 7 * people);
  const low = flights[0] + hotel[0] + daily[0];
  const high = flights[1] + hotel[1] + daily[1];
  const mid = Math.round((low + high) / 2 / 10) * 10;
  const leaves = addDays(asOf, 7);

  const fits = mid <= safeToSpend;
  const verdict = fits
    ? `That fits inside your ${fmtMoney(safeToSpend)} safe to spend this month.`
    : `That's more than your ${fmtMoney(safeToSpend)} safe to spend this month, and would take your lowest point to about ${fmtMoney(lowPoint - mid)}.`;

  return {
    text:
      `A week in Spain from ${fmtDate(leaves)} for ${people === 1 ? 'one person' : `${people} people`} would cost about ${fmtMoney(low)}–${fmtMoney(high)}: ` +
      `flights ${fmtMoney(flights[0])}–${fmtMoney(flights[1])}, hotel ${fmtMoney(hotel[0])}–${fmtMoney(hotel[1])}, ` +
      `food and activities ${fmtMoney(daily[0])}–${fmtMoney(daily[1])}. ${verdict} ` +
      'These are typical prices, not quotes, so do your own research before booking.',
    refs: [
      { label: 'Skyscanner: flights to Spain', url: 'https://www.skyscanner.net/flights-to/es/cheap-flights-to-spain.html' },
      { label: 'Booking.com: hotels in Spain', url: 'https://www.booking.com/country/es.html' },
      { label: 'Post Office: travel money', url: 'https://www.postoffice.co.uk/travel-money' },
    ],
    event: { id: 'trip-spain', date: iso(leaves), label: 'Week in Spain', amount: mid, source: 'personal', note: 'Added from Stagger AI' },
  };
}
