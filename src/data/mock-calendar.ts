import type { LifeEvent } from '@/lib/types';
import { addDays, iso } from '@/lib/dates';

export const CALENDAR_PROVIDERS = [
  { id: 'google', label: 'Google Calendar', mark: 'G', color: 'bg-[#1a73e8]' },
  { id: 'apple', label: 'Apple Calendar', mark: 'A', color: 'bg-[#1d1d1b]' },
  { id: 'outlook', label: 'Outlook', mark: 'O', color: 'bg-[#0f6cbd]' },
] as const;
export type CalendarProviderId = (typeof CALENDAR_PROVIDERS)[number]['id'];

/**
 * Stand-in for what a real calendar sync would return: upcoming events with a
 * rough cost Stagger guesses from the title. Dates are relative to today so
 * they always land inside the forecast window.
 */
export function mockCalendarEvents(now: Date): LifeEvent[] {
  const at = (days: number) => iso(addDays(now, days));
  const note = 'Found in your calendar; cost is a rough guess';
  return [
    { id: 'cal-birthday', date: at(18), label: 'Mum’s birthday', amount: 40, source: 'calendar', note },
    { id: 'cal-wedding', date: at(70), label: 'Jess & Tom’s wedding', amount: 250, source: 'calendar', note },
    { id: 'cal-trip', date: at(112), label: 'Weekend in Edinburgh', amount: 180, source: 'calendar', note },
    { id: 'cal-dentist', date: at(26), label: 'Dentist', amount: 60, source: 'calendar', note },
  ];
}
