'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PayType, Profile } from '@/lib/types';
import { PAY_TYPES, matchJob } from '@/data/jobs';
import { accountFor } from '@/data/personas';
import { saveProfile } from '@/lib/profile-store';
import { ChoiceButton, PrimaryButton } from '@/components/ui';
import { CalendarConnect, type CalendarState } from '@/components/CalendarConnect';

/** The whole onboarding on one screen: job, how you're paid, calendar. */
export function OnboardingForm() {
  const router = useRouter();
  const [job, setJob] = useState('');
  const [payType, setPayType] = useState<PayType | null>(null);
  const [calendar, setCalendar] = useState<CalendarState>({ connected: false, events: [] });
  const [busy, setBusy] = useState(false);

  const ready = Boolean(job.trim() && payType);

  async function finish() {
    setBusy(true);
    // Keyword rules handle most jobs for free; the API is only asked about the rest.
    let jobTemplate = matchJob(job);
    if (!jobTemplate) {
      try {
        const res = await fetch('/api/job', { method: 'POST', body: JSON.stringify({ job }) });
        jobTemplate = (await res.json()).template;
      } catch {
        jobTemplate = 'steady';
      }
    }
    const profile: Profile = {
      name: 'You',
      // Not asked in onboarding: neutral defaults (only used for festival spend when there's no history).
      household: 'alone',
      housing: 'rent',
      job: job.trim(),
      jobTemplate: jobTemplate ?? 'steady',
      payType: payType!,
      connections: { spotify: false, calendar: calendar.connected },
      festivals: ['christmas'],
      personalEvents: calendar.events,
      account: accountFor(payType!),
    };
    saveProfile(profile);
    router.push('/forecast/me');
  }

  return (
    <div className="space-y-7">
      <section className="space-y-3">
        <h2 className="text-xl">1. What do you do?</h2>
        <input
          aria-label="Your job"
          value={job}
          onChange={(e) => setJob(e.target.value)}
          className="w-full rounded-lg border-2 border-nw-line bg-white px-4 py-3 text-nw-ink placeholder:text-nw-muted/70 focus:border-nw-violet focus:outline-none"
          placeholder="e.g. warehouse operative, plumber, student"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">2. How are you paid?</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAY_TYPES.map((p) => (
            <ChoiceButton
              key={p.id}
              selected={payType === p.id}
              onClick={() => setPayType(p.id)}
              title={p.label}
              hint={p.hint}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl">3. Your calendar (optional)</h2>
          <p className="text-sm text-nw-muted">
            Birthdays, weddings and trips change when money goes out. We’ll find them for you.
          </p>
        </div>
        <CalendarConnect onChange={setCalendar} />
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-nw-line pt-4">
        {!ready && <span className="text-sm text-nw-muted">Add your job and how you’re paid to continue</span>}
        <PrimaryButton disabled={!ready || busy} onClick={finish}>
          {busy ? 'Building your forecast…' : 'Show my forecast'}
        </PrimaryButton>
      </div>
    </div>
  );
}
