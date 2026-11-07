'use client';

import { useState } from 'react';
import { Card, Container, PageHero, PrimaryButton } from '@/components/ui';
import { CATEGORY_LABEL } from '@/forecast/categorise';
import type { Category } from '@/lib/types';
import { fmtDate } from '@/lib/dates';

interface SignalRow {
  id: number;
  category_id: Category;
  title: string;
  pct_low: string;
  pct_high: string;
  effective_from: string;
  effective_to: string | null;
  confidence: string;
  method: string;
  status: 'proposed' | 'live';
  explanation: string;
  source_url: string | null;
  source_id: string | null;
}

interface Data {
  signals: SignalRow[];
  runs: { job: string; started_at: string; ok: boolean | null; items: number | null; error: string | null }[];
  spend: { usd: string; calls: string };
}

const KEY = 'stagger-admin-token';
const pct = (v: string) => `${Number(v) >= 0 ? '+' : ''}${(Number(v) * 100).toFixed(1)}%`;

export default function Admin() {
  // The token is remembered in this browser only, as a convenience.
  const [token, setToken] = useState(() => {
    try {
      return typeof window === 'undefined' ? '' : (localStorage.getItem(KEY) ?? '');
    } catch {
      return '';
    }
  });
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  async function load(t: string) {
    const r = await fetch('/api/admin/signals', { headers: { authorization: `Bearer ${t}` } });
    if (!r.ok) {
      setError(r.status === 401 ? 'Wrong token' : 'Could not load');
      return;
    }
    setError('');
    setData(await r.json());
    try {
      localStorage.setItem(KEY, t);
    } catch {}
  }

  async function review(id: number, status: 'live' | 'rejected' | 'proposed') {
    await fetch('/api/admin/signals', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status }),
    });
    await load(token);
  }

  if (!data) {
    return (
      <Container className="py-16">
      <Card className="mx-auto max-w-sm space-y-3">
        <h1 className="text-2xl">Signal review</h1>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Admin token"
          aria-label="Admin token"
          className="w-full rounded-lg border-2 border-nw-line bg-white px-3 py-2"
        />
        {error && <p className="text-sm text-nw-red">{error}</p>}
        <PrimaryButton onClick={() => load(token)}>Open</PrimaryButton>
      </Card>
      </Container>
    );
  }

  const proposed = data.signals.filter((s) => s.status === 'proposed');
  const live = data.signals.filter((s) => s.status === 'live');
  return (
    <>
    <PageHero
      eyebrow="Stagger · Admin"
      title="Signal review"
      lead="News the pipeline thinks will move prices. Nothing reaches customers until you make it live."
    >
      <p className="text-white/85">
        Claude spend so far: <b className="text-white">${Number(data.spend.usd).toFixed(3)}</b> over {data.spend.calls} calls
      </p>
    </PageHero>
    <Container className="space-y-8 py-10">

      <Section title={`To review (${proposed.length})`} rows={proposed} onReview={review} />
      <Section title={`Live (${live.length})`} rows={live} onReview={review} />

      <Card>
        <h2 className="mb-2 text-xl">Recent ingest runs</h2>
        <ul className="space-y-1 text-sm">
          {data.runs.map((r, i) => (
            <li key={i}>
              {r.ok ? '✓' : r.ok === false ? '✕' : '…'} <b>{r.job}</b> · {new Date(r.started_at).toLocaleString('en-GB')} ·{' '}
              {r.items ?? 0} items {r.error && <span className="text-nw-red">· {r.error.slice(0, 120)}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </Container>
    </>
  );
}

function Section({
  title,
  rows,
  onReview,
}: {
  title: string;
  rows: SignalRow[];
  onReview: (id: number, status: 'live' | 'rejected' | 'proposed') => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-2xl">{title}</h2>
      {!rows.length && <p className="text-sm text-nw-muted">Nothing here.</p>}
      {rows.map((s) => (
        <Card key={s.id} className="!p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-nw-muted">
                {CATEGORY_LABEL[s.category_id] ?? s.category_id} · {pct(s.pct_low)} to {pct(s.pct_high)} · from{' '}
                {fmtDate(s.effective_from)} · {s.method} · {s.source_id}
              </p>
              <p className="font-semibold">
                {s.source_url ? (
                  <a href={s.source_url} target="_blank" rel="noreferrer" className="text-nw-ink hover:underline">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
              </p>
              <p className="text-sm text-nw-muted">{s.explanation}</p>
            </div>
            <div className="flex gap-2">
              {s.status === 'proposed' ? (
                <>
                  <button
                    type="button"
                    onClick={() => onReview(s.id, 'live')}
                    className="rounded-full bg-nw-green px-4 py-1.5 text-sm font-semibold text-white"
                  >
                    Make live
                  </button>
                  <button
                    type="button"
                    onClick={() => onReview(s.id, 'rejected')}
                    className="rounded-full border-2 border-nw-violet bg-white px-4 py-1.5 text-sm font-semibold text-nw-violet"
                  >
                    Reject
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onReview(s.id, 'proposed')}
                  className="rounded-full border-2 border-nw-violet bg-white px-4 py-1.5 text-sm font-semibold text-nw-violet"
                >
                  Take down
                </button>
              )}
            </div>
          </div>
        </Card>
      ))}
    </section>
  );
}
