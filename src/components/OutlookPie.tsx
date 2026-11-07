'use client';

import { useState } from 'react';
import type { OutlookSection, SectionId } from '@/forecast/outlook';
import { fmtMoney } from '@/lib/dates';
import { Card } from '@/components/ui';

const R = 70;
const STROKE = 26;
const C = 2 * Math.PI * R;

/** Donut of what's changing over the next six months. Tap a slice or a label to see why. */
export function OutlookPie({ sections }: { sections: OutlookSection[] }) {
  const [open, setOpen] = useState<SectionId | null>(sections[0]?.id ?? null);
  // Items without a price still get a visible sliver, so every section can be opened.
  const weights = sections.map((s) => Math.max(s.total, 1));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const current = sections.find((s) => s.id === open);
  const lengths = weights.map((w) => (w / sum) * C);
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-2xl">What’s changing in the next six months</h2>
        <p className="text-sm text-nw-muted">Tap a section to see each estimate and why.</p>
      </div>
      <div className="grid items-center gap-6 sm:grid-cols-[200px_1fr]">
        <svg viewBox="0 0 200 200" className="mx-auto w-48" role="img" aria-label="What's changing, by type">
          <circle cx={100} cy={100} r={R} fill="none" stroke="#e1dce6" strokeWidth={STROKE} />
          {sections.map((s, i) => {
            const dash = `${Math.max(0, lengths[i] - 2)} ${C}`;
            return (
              <circle
                key={s.id}
                cx={100}
                cy={100}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={open === s.id ? STROKE + 8 : STROKE}
                strokeDasharray={dash}
                strokeDashoffset={-offsets[i]}
                transform="rotate(-90 100 100)"
                className="cursor-pointer transition-all"
                onClick={() => setOpen(s.id)}
              >
                <title>{s.label}</title>
              </circle>
            );
          })}
          <text x={100} y={96} textAnchor="middle" fontSize="13" fill="#646068">
            {current?.label ?? ''}
          </text>
          <text x={100} y={118} textAnchor="middle" fontSize="20" fontWeight={700} fill="#1d1d1b">
            {current && current.total > 0 ? fmtMoney(current.total) : ''}
          </text>
        </svg>

        <div className="space-y-2">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setOpen(open === s.id ? null : s.id)}
              aria-expanded={open === s.id}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition ${
                open === s.id ? 'bg-white shadow-sm' : 'hover:bg-white/60'
              }`}
            >
              <span className="flex items-center gap-3 font-semibold text-nw-ink">
                <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
              <span className="text-sm text-nw-muted">
                {s.total > 0 ? fmtMoney(s.total) : `${s.items.length} to watch`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {current && (
        <ul className="divide-y divide-nw-line rounded-lg bg-white">
          {current.items.map((i) => (
            <li key={i.id} className="p-4">
              <p className="font-semibold text-nw-ink">{i.title}</p>
              <p className="text-sm">{i.detail}</p>
              <p className="mt-1 text-sm text-nw-muted">Why: {i.why}</p>
              {!!i.refs?.length && (
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs">
                  {i.refs.map((r) => (
                    <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="nw-link">
                      {r.label} ↗
                    </a>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
