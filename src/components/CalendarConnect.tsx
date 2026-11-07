'use client';

import { useState } from 'react';
import type { LifeEvent } from '@/lib/types';
import { CALENDAR_PROVIDERS, mockCalendarEvents, type CalendarProviderId } from '@/data/mock-calendar';
import { today } from '@/lib/dates';

type Phase =
  | { name: 'idle' }
  | { name: 'consent'; provider: CalendarProviderId }
  | { name: 'syncing'; provider: CalendarProviderId }
  | { name: 'connected'; provider: CalendarProviderId };

export interface CalendarState {
  connected: boolean;
  events: LifeEvent[];
}

/**
 * Connect-a-calendar flow as it would look in a real app: pick a provider,
 * review what we can read, then sync.
 * The sign-in and sync are simulated; the events feed the real forecast.
 */
export function CalendarConnect({ onChange }: { onChange: (s: CalendarState) => void }) {
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });
  const [found, setFound] = useState<LifeEvent[]>([]);

  const provider = (id: CalendarProviderId) => CALENDAR_PROVIDERS.find((p) => p.id === id)!;

  function allow(id: CalendarProviderId) {
    setPhase({ name: 'syncing', provider: id });
    setTimeout(() => {
      const events = mockCalendarEvents(today());
      setFound(events);
      setPhase({ name: 'connected', provider: id });
      onChange({ connected: true, events });
    }, 1400);
  }

  function disconnect() {
    setPhase({ name: 'idle' });
    setFound([]);
    onChange({ connected: false, events: [] });
  }

  if (phase.name === 'idle') {
    return (
      <div className="space-y-2">
        {CALENDAR_PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPhase({ name: 'consent', provider: p.id })}
            className="flex w-full items-center gap-3 rounded-lg border border-nw-line bg-white p-3 text-left hover:border-nw-violet"
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white ${p.color}`}>
              {p.mark}
            </span>
            <span className="font-semibold">Connect {p.label}</span>
            <span className="ml-auto text-nw-muted" aria-hidden>
              ›
            </span>
          </button>
        ))}
      </div>
    );
  }

  const p = provider(phase.provider);

  if (phase.name === 'consent') {
    return (
      <div className="space-y-4 rounded-lg border border-nw-line bg-white p-5">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white ${p.color}`}>
            {p.mark}
          </span>
          <div>
            <p className="font-semibold">Stagger would like to use your {p.label}</p>
            <p className="text-sm text-nw-muted">You can disconnect at any time.</p>
          </div>
        </div>
        <ul className="space-y-1.5 text-sm">
          <li className="flex gap-2">
            <span className="text-nw-green">✓</span> See the titles and dates of upcoming events
          </li>
          <li className="flex gap-2">
            <span className="text-nw-red">✕</span> See who’s invited, or event notes
          </li>
          <li className="flex gap-2">
            <span className="text-nw-red">✕</span> Create, change or delete events
          </li>
        </ul>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setPhase({ name: 'idle' })} className="px-3 font-semibold text-nw-violet">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => allow(p.id)}
            className="rounded-full bg-nw-violet px-5 py-2 font-semibold text-white hover:bg-nw-violet-dark"
          >
            Allow
          </button>
        </div>
      </div>
    );
  }

  if (phase.name === 'syncing') {
    return (
      <div role="status" className="flex items-center gap-3 rounded-lg border border-nw-line bg-white p-5">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-nw-line border-t-nw-violet" aria-hidden />
        <span>Looking through the next six months of your {p.label}…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-nw-line bg-white p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white ${p.color}`}>
          {p.mark}
        </span>
        <div>
          <p className="font-semibold">
            {p.label} <span className="text-sm font-normal text-nw-green">· Connected</span>
          </p>
          <p className="text-sm text-nw-muted">
            Found {found.length} upcoming events and added them to your forecast.
          </p>
        </div>
        <button type="button" onClick={disconnect} className="ml-auto text-sm font-semibold text-nw-violet">
          Disconnect
        </button>
      </div>
    </div>
  );
}
