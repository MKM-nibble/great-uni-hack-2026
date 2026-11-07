'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { PersonaId, Profile } from '@/lib/types';
import { getPersonas, type Persona } from '@/data/personas';
import { backtest, forecast, salaryPlan, type ForecastInput } from '@/forecast/engine';
import { buildInsights } from '@/forecast/insights';
import { buildOutlook } from '@/forecast/outlook';
import { OutlookPie } from '@/components/OutlookPie';
import { coachSummary, rulesCoach, LANGUAGES, type CoachAdvice, type Language } from '@/lib/coach';
import { daysBetween, fmtDate, fmtMoney, parseIso, today } from '@/lib/dates';
import { loadProfile } from '@/lib/profile-store';
import { Card, Container, PageHero } from '@/components/ui';
import { TimeMachineChart, eventsOn } from '@/components/TimeMachineChart';
import { SNAPSHOT_WORLD, type World } from '@/data/world';

type View = 'forecast' | 'rewind';

const noopSubscribe = () => () => {};

export function Dashboard({ id }: { id: PersonaId | 'me' }) {
  // Everything is computed in the browser after mount: the forecast depends
  // on today's date and, for "me", on answers saved in this browser.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const now = useMemo(() => (mounted ? today() : null), [mounted]);
  const mine = useMemo(() => (mounted && id === 'me' ? loadProfile() : null), [mounted, id]);

  if (!now) return <p className="py-20 text-center text-nw-muted">Loading your forecast…</p>;
  if (id === 'me' && !mine) {
    return (
      <Container className="py-16">
        <Card className="mx-auto max-w-md text-center">
          <p className="mb-4">You haven’t set up your forecast yet.</p>
          <Link href="/start" className="nw-link font-semibold">
            Get started
          </Link>
        </Card>
      </Container>
    );
  }
  const persona = getPersonas()[id === 'me' ? mine!.account : id];
  const profile = id === 'me' ? mine! : persona.profile;
  return <Loaded key={id} id={id} persona={persona} profile={profile} now={now} />;
}

function Loaded({ id, persona, profile, now }: { id: PersonaId | 'me'; persona: Persona; profile: Profile; now: Date }) {
  const [horizon, setHorizon] = useState<90 | 180 | 365>(180);
  const [view, setView] = useState<View>('forecast');
  const [scrub, setScrub] = useState(0);

  const world = useWorld(profile);
  const input: ForecastInput = useMemo(
    () => ({ profile, transactions: persona.transactions, balance: persona.balance, asOf: now, world, horizonDays: 365 }),
    [profile, persona, now, world],
  );
  const f = useMemo(() => forecast(input), [input]);
  const salary = useMemo(() => salaryPlan(input, f), [input, f]);
  const insights = useMemo(() => buildInsights(profile, f), [profile, f]);
  const outlook = useMemo(() => buildOutlook(profile, f), [profile, f]);
  const rewind = useMemo(
    () => (view === 'rewind' ? backtest(profile, persona.transactions, persona.balance, now) : null),
    [view, profile, persona, now],
  );

  const shown = view === 'rewind' && rewind ? rewind.predicted : f.days.slice(0, horizon);
  const point = shown[Math.min(scrub, shown.length - 1)];
  const markers = (view === 'rewind' ? [] : f.events).map((e) => ({ date: e.date, label: e.label }));

  const isMe = id === 'me';
  return (
    <>
      <PageHero
        eyebrow={isMe ? 'Stagger · Your forecast' : `Stagger · Demo · ${persona.blurb}`}
        title={isMe ? 'Your money forecast' : `${profile.name}’s money forecast`}
        lead={`Looking ${horizon === 90 ? 'three' : 'six'} months ahead from ${fmtDate(f.days[0].date)}.`}
      />
    <Container className="space-y-6 py-10 sm:py-12">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Balance today" value={fmtMoney(persona.balance)} />
        <Stat
          label="Safe to spend this month"
          value={fmtMoney(outlook.plan.safeToSpend)}
          hint="On non-essentials, after bills, everyday costs and what to put aside"
          tone={outlook.plan.safeToSpend < 50 ? 'warn' : 'good'}
        />
        <Stat
          label="Put aside this month"
          value={fmtMoney(outlook.plan.putAside)}
          hint="For the costs coming up, with a 10% buffer where prices are uncertain"
        />
      </div>

      <OutlookPie sections={outlook.sections} />

      <Coach
        cacheKey={id !== 'me' ? id : undefined}
        rules={rulesCoach(profile, f, salary, insights)}
        summary={coachSummary(profile, f, salary, insights)}
      />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl">{view === 'rewind' ? 'Rewind: one year ago' : 'Time Machine'}</h2>
            <p className="text-sm text-nw-muted">
              {view === 'rewind'
                ? 'What Stagger would have predicted a year ago, against what really happened.'
                : 'Drag across the chart to travel through time.'}
            </p>
          </div>
          <div className="flex gap-2">
            {view === 'forecast' && (
              <Segmented
                value={horizon}
                options={[
                  [90, '3 months'],
                  [180, '6 months'],
                  [365, '1 year'],
                ]}
                onChange={(v) => {
                  setHorizon(v);
                  setScrub(0);
                }}
              />
            )}
            <button
              type="button"
              onClick={() => {
                setView(view === 'rewind' ? 'forecast' : 'rewind');
                setScrub(0);
              }}
              className="whitespace-nowrap rounded-full border-2 border-nw-violet bg-white px-4 py-1.5 text-sm font-semibold text-nw-violet hover:bg-nw-lilac"
            >
              {view === 'rewind' ? '→ Back to now' : '⟲ Rewind a year'}
            </button>
          </div>
        </div>

        {view === 'rewind' && rewind && <RewindBanner name={profile.name} b={rewind} />}

        <div className="rounded-lg bg-white p-3 text-sm" aria-live="polite">
          <span className="font-semibold">{fmtDate(point.date)}:</span> expected{' '}
          <span className={`font-bold ${point.expected < 0 ? 'text-nw-red' : ''}`}>{fmtMoney(point.expected)}</span>
          <span className="text-nw-muted">
            {' '}
            (likely {fmtMoney(point.low)} to {fmtMoney(point.high)})
          </span>
          {view === 'rewind' && rewind && (
            <span>
              {' '}
              · actually <span className="font-bold">{fmtMoney(rewind.actual[scrub]?.balance ?? 0)}</span>
            </span>
          )}
          {view === 'forecast' &&
            eventsOn(f.flows, point.date)
              .slice(0, 3)
              .map((e, i) => (
                <span key={i} className="ml-2 inline-block rounded bg-nw-lilac px-2 text-xs">
                  {e.label} {fmtMoney(e.amount, { sign: true })}
                </span>
              ))}
        </div>

        <TimeMachineChart
          days={shown}
          actual={view === 'rewind' ? rewind?.actual : undefined}
          markers={markers}
          scrub={Math.min(scrub, shown.length - 1)}
          onScrub={setScrub}
        />
        <input
          type="range"
          min={0}
          max={shown.length - 1}
          value={Math.min(scrub, shown.length - 1)}
          onChange={(e) => setScrub(Number(e.target.value))}
          aria-label="Travel through time"
          className="w-full"
        />

      </Card>
    </Container>
    </>
  );
}

/**
 * Prices, policy, news signals and weather for this person's area and job,
 * from the database. Starts on the built-in snapshot and swaps in live data
 * when it arrives, so the page never waits on the network.
 */
function useWorld(profile: Profile): World {
  const [world, setWorld] = useState<World>(SNAPSHOT_WORLD);
  const query = `postcode=${encodeURIComponent(profile.postcode ?? '')}&job=${profile.jobTemplate}`;
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/world?${query}`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<World>) : null))
      .then((w) => {
        if (!cancelled && w) setWorld(w);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [query]);
  return world;
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'bad' }) {
  const color = { good: 'text-nw-green', warn: 'text-nw-amber', bad: 'text-nw-red' }[tone ?? 'good'];
  return (
    <Card className="!p-5">
      <p className="text-[15px] text-nw-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl font-extrabold ${tone ? color : 'text-nw-purple'}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-nw-muted">{hint}</p>}
    </Card>
  );
}

function Segmented<T extends number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-full bg-white p-1 text-sm">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`whitespace-nowrap rounded-full px-3 py-1 font-semibold ${value === v ? 'bg-nw-violet text-white' : 'text-nw-muted hover:text-nw-violet'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function RewindBanner({ name, b }: { name: string; b: ReturnType<typeof backtest> }) {
  if (b.actualOverdrawn && b.predictedRisk && parseIso(b.predictedRisk) <= parseIso(b.actualOverdrawn)) {
    const weeks = Math.round(daysBetween(parseIso(b.asOf), parseIso(b.actualOverdrawn)) / 7);
    return (
      <div className="rounded-lg bg-nw-purple p-4 text-white">
        <p className="text-lg font-bold">Stagger would have warned {name} {weeks} weeks early.</p>
        <p className="text-white/85">
          On {fmtDate(b.asOf)} it would have flagged a risk from {fmtDate(b.predictedRisk)}. {name} actually went
          overdrawn on {fmtDate(b.actualOverdrawn)}.
        </p>
      </div>
    );
  }
  const errors = b.actual.map((a, i) => Math.abs(a.balance - b.predicted[i].expected));
  const avg = errors.reduce((s, e) => s + e, 0) / errors.length;
  return (
    <div className="rounded-lg bg-nw-lilac p-4">
      <p className="font-bold">Last year’s forecast was within about {fmtMoney(avg)} of reality on average.</p>
      <p className="text-sm text-nw-muted">
        {b.actualOverdrawn ? `${name} went overdrawn on ${fmtDate(b.actualOverdrawn)}.` : `${name} never went overdrawn.`}
      </p>
    </div>
  );
}

function Coach({ rules, summary, cacheKey }: { rules: CoachAdvice; summary: ReturnType<typeof coachSummary>; cacheKey?: string }) {
  const [language, setLanguage] = useState<Language>('English');
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'nokey'>('idle');
  const summaryKey = JSON.stringify(summary);
  const adviceKey = `${summaryKey}|${language}`;
  // AI answers are stored against the forecast they describe, so a stale one
  // is never shown after a what-if or language change.
  const [answers, setAnswers] = useState<Record<string, CoachAdvice>>({});
  const ai = answers[adviceKey] ?? null;

  // Pre-generated answers for demo customers load for free; anything else
  // waits for a tap, so credits are only spent when someone asks.
  useEffect(() => {
    if (!cacheKey) return;
    let cancelled = false;
    fetch('/api/coach', {
      method: 'POST',
      body: JSON.stringify({ summary: JSON.parse(summaryKey), language, cacheKey, cacheOnly: true }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setAnswers((a) => ({ ...a, [`${summaryKey}|${language}`]: d }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cacheKey, summaryKey, language]);

  async function ask() {
    setState('loading');
    try {
      const r = await fetch('/api/coach', { method: 'POST', body: JSON.stringify({ summary, language, cacheKey }) });
      if (r.status === 503) return setState('nokey');
      if (!r.ok) return setState('error');
      const d = (await r.json()) as CoachAdvice;
      setAnswers((a) => ({ ...a, [adviceKey]: d }));
      setState('idle');
    } catch {
      setState('error');
    }
  }

  const advice = ai ?? rules;
  return (
    <section
      className="rounded-lg bg-nw-purple p-6 text-white sm:p-8"
      dir={['اردو', 'العربية'].includes(language) && ai ? 'rtl' : undefined}
      aria-label="Your Stagger coach"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Your coach</p>
      <p className="mt-2 font-display text-2xl font-extrabold leading-snug">{advice.headline}</p>
      <ol className="mt-4 space-y-3">
        {advice.actions.map((a, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
              {i + 1}
            </span>
            <span>
              <span className="block font-semibold">{a.title}</span>
              <span className="text-sm text-white/80">{a.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/15 pt-4 text-sm" dir="ltr">
        <button
          type="button"
          onClick={ask}
          disabled={state === 'loading'}
          className="rounded-full bg-white px-4 py-1.5 font-semibold text-nw-purple hover:bg-nw-lilac disabled:opacity-60"
        >
          {state === 'loading' ? 'Thinking…' : ai ? 'Ask again' : '✨ Ask Stagger AI'}
        </button>
        <label className="flex items-center gap-2">
          <span className="text-white/70">Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="rounded-md bg-white/15 px-2 py-1 text-white"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l} className="text-nw-ink">
                {l}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-white/60">
          {advice.source === 'rules' ? 'Written by Stagger’s rules' : 'Written by AI from your forecast summary'}
          {state === 'nokey' && ' · AI not set up on this server'}
          {state === 'error' && ' · AI unavailable, showing rules'}
        </span>
      </div>
    </section>
  );
}
