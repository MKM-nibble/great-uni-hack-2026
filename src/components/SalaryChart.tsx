import type { SalaryPlan } from '@/forecast/engine';
import { fmtDate, fmtMoney } from '@/lib/dates';

const W = 640;
const H = 150;
const PAD = { top: 10, bottom: 22, left: 4, right: 4 };

/**
 * Bars: expected pay each week. Line: the steady salary. Bars above the
 * line fill the pot; bars below are topped up from it.
 */
export function SalaryChart({ plan }: { plan: SalaryPlan }) {
  const max = Math.max(...plan.weeks.map((w) => w.pay), plan.weekly) * 1.1;
  const innerH = H - PAD.top - PAD.bottom;
  const bw = (W - PAD.left - PAD.right) / plan.weeks.length;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const peakPot = plan.weeks.reduce((a, w) => (w.pot > a.pot ? w : a), plan.weeks[0]);
  const lowPot = plan.weeks.reduce((a, w) => (w.pot < a.pot ? w : a), plan.weeks[0]);

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weekly pay against a steady salary">
        {plan.weeks.map((w, i) => (
          <rect
            key={w.date}
            x={PAD.left + i * bw + 1.5}
            y={y(w.pay)}
            width={bw - 3}
            height={PAD.top + innerH - y(w.pay)}
            rx={2}
            fill={w.pay >= plan.weekly ? '#1d7b8a' : '#b45d00'}
            opacity={0.75}
          >
            <title>{`Week of ${fmtDate(w.date)}: pay about ${fmtMoney(w.pay)}`}</title>
          </rect>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(plan.weekly)} y2={y(plan.weekly)} stroke="#3c1053" strokeWidth={2.5} />
        {plan.weeks
          .filter((w, i) => i === 0 || w.date.slice(8) <= '07')
          .map((w) => (
            <text
              key={w.date}
              x={PAD.left + plan.weeks.indexOf(w) * bw}
              y={H - 6}
              fontSize="11"
              fill="#646068"
            >
              {new Date(w.date).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}
            </text>
          ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-nw-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-nw-teal" /> Good week: extra goes in the pot
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-nw-amber" /> Slow week: the pot tops you up
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-nw-deep" /> Your salary: {fmtMoney(plan.weekly)}/week
        </span>
      </div>
      <p className="text-sm">
        Your pot peaks around <b>{fmtMoney(peakPot.pot)}</b> in {monthOf(peakPot.date)} and is lowest around{' '}
        <b>{fmtMoney(lowPot.pot)}</b> in {monthOf(lowPot.date)}, so the same amount keeps landing even in the
        quiet weeks.
      </p>
    </div>
  );
}

function monthOf(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
}
