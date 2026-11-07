'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LifeEvent, PayType, Profile } from '@/lib/types';
import { PAY_TYPES, matchJob } from '@/data/jobs';
import { FESTIVALS } from '@/data/calendar';
import { accountFor } from '@/data/personas';
import { saveProfile } from '@/lib/profile-store';
import { Card, ChoiceButton, PrimaryButton, Toggle } from '@/components/ui';

const JOB_SUGGESTIONS = ['Warehouse operative', 'Plumber', 'Nurse', 'Bar staff', 'Delivery rider', 'Office admin'];
const STEP_TITLES = ['About you', 'Your work', 'Connect & dates'];

export default function Start() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [household, setHousehold] = useState<Profile['household'] | null>(null);
  const [housing, setHousing] = useState<Profile['housing'] | null>(null);
  const [job, setJob] = useState('');
  const [payType, setPayType] = useState<PayType | null>(null);
  const [spotify, setSpotify] = useState(false);
  const [calendar, setCalendar] = useState(false);
  const [festivals, setFestivals] = useState<string[]>(['christmas']);
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [busy, setBusy] = useState(false);

  const canNext = [household && housing, job.trim() && payType, true][step];

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
      name: name.trim() || 'You',
      household: household!,
      housing: housing!,
      job: job.trim(),
      jobTemplate: jobTemplate ?? 'steady',
      payType: payType!,
      connections: { spotify, calendar },
      festivals,
      personalEvents: events.filter((e) => e.label && e.date && e.amount > 0),
      account: accountFor(payType!),
    };
    saveProfile(profile);
    router.push('/forecast/me');
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-nw-purple">
          Step {step + 1} of 3 · {STEP_TITLES[step]}
        </p>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {STEP_TITLES.map((t, i) => (
            <span key={t} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-nw-purple' : 'bg-nw-line'}`} />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Let’s get to know you</h1>
          <label className="block">
            <span className="mb-1 block font-semibold">What should we call you? (optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-nw-line bg-white px-4 py-3"
              placeholder="First name"
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-semibold">Who do you live with?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              <ChoiceButton selected={household === 'alone'} onClick={() => setHousehold('alone')} title="Just me" />
              <ChoiceButton selected={household === 'partner'} onClick={() => setHousehold('partner')} title="Partner" />
              <ChoiceButton selected={household === 'kids'} onClick={() => setHousehold('kids')} title="Children" />
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-2 font-semibold">Your home</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              <ChoiceButton selected={housing === 'rent'} onClick={() => setHousing('rent')} title="I rent" />
              <ChoiceButton selected={housing === 'mortgage'} onClick={() => setHousing('mortgage')} title="Mortgage" />
              <ChoiceButton selected={housing === 'family'} onClick={() => setHousing('family')} title="With family" />
            </div>
          </fieldset>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Your work</h1>
          <label className="block">
            <span className="mb-1 block font-semibold">What do you do?</span>
            <input
              value={job}
              onChange={(e) => setJob(e.target.value)}
              className="w-full rounded-lg border border-nw-line bg-white px-4 py-3"
              placeholder="e.g. warehouse operative, plumber, student"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {JOB_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setJob(s)}
                className="rounded-full border border-nw-line bg-white px-3 py-1.5 text-sm hover:border-nw-purple"
              >
                {s}
              </button>
            ))}
          </div>
          <fieldset>
            <legend className="mb-2 font-semibold">How are you paid?</legend>
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
          </fieldset>
          <p className="rounded-lg bg-nw-lilac p-3 text-sm">
            This decides what Stagger looks at. If your pay changes week to week, we’ll forecast it
            using your history and the usual seasons for your kind of work.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Connect & add your dates</h1>
          <p className="text-nw-muted">Everything here is optional. Each one makes your forecast sharper.</p>
          <div className="space-y-3">
            <Connection
              title="NatWest current account"
              body="We look at 24 months of payments to learn your pay pattern and bills."
              on
              locked
            />
            <Connection
              title="Spotify"
              body="We read your top artists to spot gigs you might want tickets for. Nothing else."
              on={spotify}
              onChange={setSpotify}
            />
            <Connection
              title="Calendar"
              body="We read event dates and titles (birthdays, trips), never who’s invited."
              on={calendar}
              onChange={setCalendar}
            />
            <div className="flex items-center justify-between rounded-xl border border-dashed border-nw-line p-4 text-nw-muted">
              <span>
                <span className="block font-semibold">Other apps</span>
                <span className="text-sm">Coming soon</span>
              </span>
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 font-semibold">Which of these do you celebrate?</legend>
            <div className="flex flex-wrap gap-2">
              {FESTIVALS.map((f) => {
                const on = festivals.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFestivals(on ? festivals.filter((x) => x !== f.id) : [...festivals, f.id])}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      on ? 'border-nw-purple bg-nw-purple text-white' : 'border-nw-line bg-white'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="mb-2 font-semibold">Anything coming up? (birthdays, trips, a wedding)</legend>
            {events.map((e, i) => (
              <div key={e.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
                <input
                  aria-label="What is it?"
                  placeholder="What is it?"
                  value={e.label}
                  onChange={(ev) => setEvents(events.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))}
                  className="min-w-0 rounded-lg border border-nw-line bg-white px-3 py-2"
                />
                <input
                  aria-label="Date"
                  type="date"
                  value={e.date}
                  onChange={(ev) => setEvents(events.map((x, j) => (j === i ? { ...x, date: ev.target.value } : x)))}
                  className="rounded-lg border border-nw-line bg-white px-2 py-2"
                />
                <input
                  aria-label="Rough cost in pounds"
                  type="number"
                  min={0}
                  placeholder="£"
                  value={e.amount || ''}
                  onChange={(ev) =>
                    setEvents(events.map((x, j) => (j === i ? { ...x, amount: Number(ev.target.value) } : x)))
                  }
                  className="w-20 rounded-lg border border-nw-line bg-white px-2 py-2"
                />
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => setEvents(events.filter((_, j) => j !== i))}
                  className="px-2 text-nw-muted"
                >
                  ✕
                </button>
              </div>
            ))}
            {events.length < 3 && (
              <button
                type="button"
                onClick={() =>
                  setEvents([...events, { id: `me-${Date.now()}`, label: '', date: '', amount: 0, source: 'personal' }])
                }
                className="text-sm font-semibold text-nw-purple hover:underline"
              >
                + Add a date
              </button>
            )}
          </fieldset>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        {step > 0 ? (
          <button type="button" onClick={() => setStep(step - 1)} className="font-semibold text-nw-purple">
            Back
          </button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <PrimaryButton disabled={!canNext} onClick={() => setStep(step + 1)}>
            Continue
          </PrimaryButton>
        ) : (
          <PrimaryButton disabled={busy} onClick={finish}>
            {busy ? 'Building your forecast…' : 'Show my forecast'}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

function Connection({
  title,
  body,
  on,
  onChange,
  locked,
}: {
  title: string;
  body: string;
  on: boolean;
  onChange?: (v: boolean) => void;
  locked?: boolean;
}) {
  return (
    <Card className="flex items-center justify-between gap-4 !p-4">
      <span>
        <span className="block font-semibold">
          {title} {locked && <span className="text-sm font-normal text-nw-green">· Connected</span>}
        </span>
        <span className="text-sm text-nw-muted">{body}</span>
      </span>
      <Toggle on={on} onChange={onChange ?? (() => {})} label={`Connect ${title}`} disabled={locked} />
    </Card>
  );
}
