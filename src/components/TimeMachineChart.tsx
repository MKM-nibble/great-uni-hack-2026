'use client';

import { useEffect, useRef, useState } from 'react';
import type { DayPoint, Flow } from '@/forecast/engine';
import { fmtDate, fmtMoney } from '@/lib/dates';

const H = 260;
const PAD = { top: 16, right: 12, bottom: 28, left: 52 };

export interface Marker {
  date: string;
  label: string;
}

/**
 * Balance forecast: expected line, cautious-to-hopeful band, red shading
 * below zero, and markers for big events. `scrub` is the time-travel slider.
 */
export function TimeMachineChart({
  days,
  compare,
  compareLabel,
  actual,
  markers,
  scrub,
  onScrub,
}: {
  days: DayPoint[];
  compare?: DayPoint[];
  compareLabel?: string;
  actual?: { date: string; balance: number }[];
  markers: Marker[];
  scrub: number;
  onScrub: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(300, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = days.length;
  const values = [
    ...days.flatMap((d) => [d.low, d.high]),
    ...(compare ?? []).slice(0, n).map((d) => d.expected),
    ...(actual ?? []).slice(0, n).map((d) => d.balance),
    0,
  ];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const yMin = min - span * 0.08;
  const yMax = max + span * 0.08;
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / Math.max(1, n - 1)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  const index = new Map(days.map((d, i) => [d.date, i]));

  const line = (pts: number[]) => pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const band =
    days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.high).toFixed(1)}`).join('') +
    [...days].reverse().map((d, i) => `L${x(n - 1 - i).toFixed(1)},${y(d.low).toFixed(1)}`).join('') +
    'Z';

  const ticks = niceTicks(yMin, yMax);
  const months = days
    .map((d, i) => ({ d, i }))
    .filter(({ d }, i) => i === 0 || d.date.endsWith('-01'));
  const s = days[Math.min(scrub, n - 1)];

  return (
    <div ref={ref} className="w-full select-none">
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Balance forecast from ${fmtDate(days[0].date)} to ${fmtDate(days[n - 1].date)}`}
        onPointerMove={(e) => {
          if (e.buttons !== 1 && e.pointerType === 'mouse') return;
          const rect = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - rect.left - PAD.left) / innerW) * (n - 1));
          onScrub(Math.max(0, Math.min(n - 1, i)));
        }}
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - rect.left - PAD.left) / innerW) * (n - 1));
          onScrub(Math.max(0, Math.min(n - 1, i)));
        }}
      >
        <defs>
          <clipPath id="below-zero">
            <rect x={PAD.left} y={y(0)} width={innerW} height={Math.max(0, PAD.top + innerH - y(0))} />
          </clipPath>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#ece8ef" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#646068">
              {fmtMoney(t)}
            </text>
          </g>
        ))}
        {yMin < 0 && (
          <rect
            x={PAD.left}
            y={y(0)}
            width={innerW}
            height={PAD.top + innerH - y(0)}
            fill="#c4122f"
            opacity={0.05}
          />
        )}
        <line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke="#c4122f" strokeDasharray="4 4" />
        {months.map(({ d, i }) => (
          <text key={d.date} x={x(i)} y={H - 8} fontSize="11" fill="#646068" textAnchor={i === 0 ? 'start' : 'middle'}>
            {new Date(d.date).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}
          </text>
        ))}
        <path d={band} fill="#5a287d" opacity={0.12} />
        {actual && (
          <path d={line(actual.slice(0, n).map((a) => a.balance))} fill="none" stroke="#1d1d1b" strokeWidth={2} />
        )}
        {compare && (
          <path
            d={line(compare.slice(0, n).map((d) => d.expected))}
            fill="none"
            stroke="#1d7b8a"
            strokeWidth={2.5}
            strokeDasharray="6 4"
          />
        )}
        <path d={line(days.map((d) => d.expected))} fill="none" stroke="#5a287d" strokeWidth={2.5} />
        <path
          d={line(days.map((d) => d.expected))}
          fill="none"
          stroke="#c4122f"
          strokeWidth={3}
          clipPath="url(#below-zero)"
        />
        {markers.map((m) => {
          const i = index.get(m.date);
          if (i == null) return null;
          return (
            <g key={m.date + m.label}>
              <line x1={x(i)} x2={x(i)} y1={PAD.top} y2={PAD.top + innerH} stroke="#b45d00" opacity={0.35} />
              <circle cx={x(i)} cy={PAD.top + 4} r={4} fill="#b45d00">
                <title>{`${m.label} · ${fmtDate(m.date)}`}</title>
              </circle>
            </g>
          );
        })}
        <line x1={x(scrub)} x2={x(scrub)} y1={PAD.top} y2={PAD.top + innerH} stroke="#3c1053" strokeWidth={1.5} />
        <circle cx={x(scrub)} cy={y(s.expected)} r={6} fill="#fff" stroke="#3c1053" strokeWidth={2.5} />
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-nw-muted">
        <Legend color="#5a287d" label="Expected balance" />
        <Legend color="#5a287d" label="Likely range" faded />
        {compare && <Legend color="#1d7b8a" label={compareLabel ?? 'Comparison'} dashed />}
        {actual && <Legend color="#1d1d1b" label="What actually happened" />}
        <Legend color="#b45d00" label="Events" dot />
      </div>
    </div>
  );
}

function Legend({ color, label, faded, dashed, dot }: { color: string; label: string; faded?: boolean; dashed?: boolean; dot?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {dot ? (
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      ) : (
        <span
          className="h-1 w-5 rounded"
          style={{
            background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 5px, transparent 5px 8px)` : color,
            opacity: faded ? 0.25 : 1,
            height: faded ? 8 : 3,
          }}
        />
      )}
      {label}
    </span>
  );
}

function niceTicks(min: number, max: number): number[] {
  const raw = (max - min) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(Math.round(v));
  return out;
}

/** Big events on a given day, for the scrubber readout. */
export function eventsOn(flows: Flow[], date: string): Flow[] {
  return flows.filter((f) => f.date === date && (f.kind === 'event' || f.kind === 'whatif' || Math.abs(f.amount) >= 100));
}
