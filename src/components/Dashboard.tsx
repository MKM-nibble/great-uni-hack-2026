'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { PersonaId, Profile } from '@/lib/types';
import { getPersonas, PERSONA_META, PERSONA_ORDER, type Persona } from '@/data/personas';
import { PAY_TYPES, JOB_TEMPLATES } from '@/data/jobs';
import { backtest, forecast, salaryPlan, type ForecastInput } from '@/forecast/engine';
import { buildInsights, whatIfsFor, type Insight } from '@/forecast/insights';
import { coachSummary, rulesCoach, LANGUAGES, type CoachAdvice, type Language } from '@/lib/coach';
import { daysBetween, fmtDate, fmtMoney, parseIso, today } from '@/lib/dates';
import { loadProfile } from '@/lib/profile-store';
import { Card, ConfidencePill } from '@/components/ui';
import { TimeMachineChart, eventsOn } from '@/components/TimeMachineChart';
import { SalaryChart } from '@/components/SalaryChart';

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
      <Card className="mx-auto max-w-md text-center">
        <p className="mb-4">You haven’t set up your forecast yet.</p>
        <Link href="/start" className="font-semibold text-nw-purple underline">
          Get started
        </Link>
      </Card>
    );
  }
  const persona = getPersonas()[id === 'me' ? mine!.account : id];
  const profile = id === 'me' ? mine! : persona.profile;
  return <Loaded key={id} id={id} persona={persona} profile={profile} now={now} />;
}

function Loaded({ id, persona, profile, now }: { id: PersonaId | 'me'; persona: Persona; profile: Profile; now: Date }) {
  const [horizon, setHorizon] = useState<90 | 180>(180);
  const [active, setActive] = useState<string[]>([]);
  const [view, setView] = useState<View>('forecast');
  const [scrub, setScrub] = useState(0);

  const gigs = useMemo(
    () => (profile.connections.spotify ? (persona.gigs.length ? persona.gigs : getPersonas().kayla.gigs) : []),
    [profile, persona],
  );
  const input: ForecastInput = useMemo(
    () => ({ profile, transactions: persona.transactions, balance: persona.balance, asOf: now }),
    [profile, persona, now],
  );
  const base = useMemo(() => forecast(input), [input]);
  const options = useMemo(() => whatIfsFor(profile, base, now, gigs), [profile, base, now, gigs]);
  const chosen = useMemo(() => options.filter((o) => active.includes(o.id)), [options, active]);
  const f = useMemo(() => (chosen.length ? forecast({ ...input, whatIfs: chosen }) : base), [input, base, chosen]);
  const salary = useMemo(() => salaryPlan({ ...input, whatIfs: chosen }, f), [input, chosen, f]);
  const insights = useMemo(() => buildInsights(profile, f), [profile, f]);
  const rewind = useMemo(
    () => (view === 'rewind' ? backtest(profile, persona.transactions, persona.balance, now) : null),
    [view, profile, persona, now],
  );

  const shown = view === 'rewind' && rewind ? rewind.predicted : f.days.slice(0, horizon);
  const point = shown[Math.min(scrub, shown.length - 1)];
  const markers = (view === 'rewind' ? [] : f.events).map((e) => ({ date: e.date, label: e.label }));
  const payLabel = PAY_TYPES.find((p) => p.id === profile.payType)?.label;

  return (
    <div className="space-y-6">
      <PersonaTabs current={id} />

      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Hi {profile.name === 'You' ? 'there' : profile.name}</h1>
        <p className="mt-1 flex flex-wrap gap-2 text-sm text-nw-muted">
          <Chip>{payLabel}</Chip>
          {profile.job && <Chip>{profile.job}</Chip>}
          {f.income.variable && <Chip>Pattern: {JOB_TEMPLATES[profile.jobTemplate].label}</Chip>}
          {profile.connections.spotify && <Chip>Spotify connected</Chip>}
          {profile.connections.calendar && <Chip>Calendar connected</Chip>}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Balance today" value={fmtMoney(persona.balance)} />
        <Stat
          label="Safe to spend today"
          value={fmtMoney(f.safeToSpend)}
          hint={
            f.safeToSpend > 0
              ? 'Extra you can spend and still stay above £50 at your lowest point'
              : 'Your forecast dips below zero, so hold off on extras for now'
          }
          tone={f.safeToSpend < 50 ? 'warn' : 'good'}
        />
        <Stat
          label="Lowest point"
          value={fmtMoney(f.lowPoint.expected)}
          hint={`Around ${fmtDate(f.lowPoint.date)}`}
          tone={f.lowPoint.expected < 0 ? 'bad' : undefined}
        />
      </div>

      <Coach
        cacheKey={id !== 'me' && !chosen.length ? id : undefined}
        rules={rulesCoach(profile, f, salary, insights)}
        summary={coachSummary(profile, f, salary, insights)}
      />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{view === 'rewind' ? 'Rewind: one year ago' : 'Time Machine'}</h2>
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
              className="whitespace-nowrap rounded-full border border-nw-purple px-4 py-1.5 text-sm font-semibold text-nw-purple hover:bg-nw-lilac"
            >
              {view === 'rewind' ? '→ Back to now' : '⟲ Rewind a year'}
            </button>
          </div>
        </div>

        {view === 'rewind' && rewind && <RewindBanner name={profile.name} b={rewind} />}

        <div className="rounded-lg bg-nw-mist p-3 text-sm" aria-live="polite">
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
                <span key={i} className="ml-2 inline-block rounded bg-white px-2 text-xs">
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

      {view === 'forecast' && salary && (
        <Card className="space-y-3">
          <div>
            <h2 className="text-lg font-bold">Pay yourself a salary: {fmtMoney(salary.weekly)} a week</h2>
            <p className="text-sm text-nw-muted">
              Your {profile.payType === 'student' ? 'loan and pay go' : 'pay goes'} into a Stagger pot, and the
              same amount lands in your current account every week. Start the pot with about{' '}
              {fmtMoney(salary.seedBuffer)} and it covers a run of slow weeks.
            </p>
            {salary.seedBuffer > persona.balance && (
              <p className="rounded-lg bg-nw-amber/10 p-3 text-sm">
                That’s more than the {fmtMoney(persona.balance)} you have today. The gap is exactly the tight spot
                on your Time Machine, so it’s worth acting on now.
              </p>
            )}
          </div>
          <SalaryChart plan={salary} />
        </Card>
      )}

      {view === 'forecast' && options.length > 0 && (
        <Card>
          <h2 className="mb-1 text-lg font-bold">What if…</h2>
          <p className="mb-3 text-sm text-nw-muted">Tap to see how it changes your forecast.</p>
          <div className="flex flex-wrap gap-2">
            {options.map((o) => {
              const on = active.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setActive(on ? active.filter((a) => a !== o.id) : [...active, o.id])}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    on ? 'border-nw-purple bg-nw-purple text-white' : 'border-nw-line bg-white hover:border-nw-purple'
                  }`}
                >
                  {on ? '✓ ' : '+ '}
                  {o.label}
                </button>
              );
            })}
          </div>
          {chosen.length > 0 && (
            <p className="mt-3 text-sm">
              Lowest point moves from <b>{fmtMoney(base.lowPoint.expected)}</b> to{' '}
              <b className={f.lowPoint.expected >= base.lowPoint.expected ? 'text-nw-green' : 'text-nw-red'}>
                {fmtMoney(f.lowPoint.expected)}
              </b>
              .
            </p>
          )}
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">What’s coming up</h2>
        {insights.map((i) => (
          <InsightCard key={i.id} i={i} />
        ))}
      </section>

      {(f.firstLikely || f.firstRisk) && <SupportRoutes />}

      <Card className="text-sm text-nw-muted">
        <h2 className="mb-2 font-semibold text-nw-ink">How Stagger works</h2>
        <p>
          The forecast is plain maths on your own transactions, the usual seasons for your work, your
          dates, and published price changes. Every number has a reason you can tap. AI only writes the
          coaching in plain words, and it sees a short summary, never your transactions.
        </p>
      </Card>
    </div>
  );
}

function PersonaTabs({ current }: { current: PersonaId | 'me' }) {
  const tabs: [string, string][] = [...PERSONA_ORDER.map((p) => [p, PERSONA_META[p].name] as [string, string]), ['me', 'You']];
  return (
    <nav aria-label="Demo customers" className="-mx-4 overflow-x-auto px-4">
      <div className="flex w-max gap-1 rounded-full bg-white p-1 shadow-sm">
        {tabs.map(([id, name]) => (
          <Link
            key={id}
            href={id === 'me' ? '/forecast/me' : `/forecast/${id}`}
            aria-current={current === id ? 'page' : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              current === id ? 'bg-nw-purple text-white' : 'text-nw-muted hover:text-nw-purple'
            }`}
          >
            {name}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white px-3 py-1 shadow-sm">{children}</span>;
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'bad' }) {
  const color = { good: 'text-nw-green', warn: 'text-nw-amber', bad: 'text-nw-red' }[tone ?? 'good'];
  return (
    <Card className="!p-4">
      <p className="text-sm text-nw-muted">{label}</p>
      <p className={`text-2xl font-bold ${tone ? color : ''}`}>{value}</p>
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
    <div className="flex rounded-full bg-nw-mist p-1 text-sm">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`whitespace-nowrap rounded-full px-3 py-1 font-semibold ${value === v ? 'bg-white text-nw-purple shadow-sm' : 'text-nw-muted'}`}
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

function InsightCard({ i }: { i: Insight }) {
  const [open, setOpen] = useState(false);
  const accent = {
    warning: 'border-l-nw-red',
    price: 'border-l-nw-amber',
    event: 'border-l-nw-purple',
    salary: 'border-l-nw-teal',
    support: 'border-l-nw-green',
    rate: 'border-l-nw-muted',
    good: 'border-l-nw-green',
  }[i.kind];
  return (
    <Card className={`border-l-4 ${accent} !p-4`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{i.title}</h3>
        <ConfidencePill c={i.confidence} />
      </div>
      <p className="mt-1 text-sm text-nw-muted">{i.body}</p>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="mt-2 text-sm font-semibold text-nw-purple hover:underline"
      >
        {open ? 'Hide' : 'Why am I seeing this?'}
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-nw-mist p-3 text-sm">
          <ul className="list-disc space-y-1 pl-5">
            {i.why.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {i.source && (
            <p className="mt-2 text-xs text-nw-muted">
              Source:{' '}
              {i.source.url ? (
                <a href={i.source.url} target="_blank" rel="noreferrer" className="underline">
                  {i.source.label}
                </a>
              ) : (
                i.source.label
              )}
            </p>
          )}
        </div>
      )}
    </Card>
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
      className="rounded-xl bg-gradient-to-br from-nw-purple to-nw-deep p-5 text-white"
      dir={['اردو', 'العربية'].includes(language) && ai ? 'rtl' : undefined}
      aria-label="Your Stagger coach"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Your coach</p>
      <p className="mt-1 text-lg font-semibold">{advice.headline}</p>
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

function SupportRoutes() {
  const routes = [
    {
      title: 'Talk to NatWest',
      body: 'Overdraft options, moving payment dates, or a break on repayments.',
      url: 'https://www.natwest.com/support-centre/financial-support.html',
    },
    {
      title: 'Check what benefits you can get',
      body: 'Free, anonymous calculator. Many working people are entitled to more than they think.',
      url: 'https://www.entitledto.co.uk/',
    },
    {
      title: 'Free debt advice',
      body: 'Including Breathing Space, which pauses interest and charges for 60 days.',
      url: 'https://www.moneyhelper.org.uk/en/money-troubles/dealing-with-debt',
    },
  ];
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">Support, before you need it</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {routes.map((r) => (
          <a key={r.title} href={r.url} target="_blank" rel="noreferrer" className="block">
            <Card className="h-full !p-4 hover:border-nw-purple">
              <h3 className="font-semibold text-nw-purple">{r.title} ↗</h3>
              <p className="mt-1 text-sm text-nw-muted">{r.body}</p>
            </Card>
          </a>
        ))}
      </div>
    </section>
  );
}
