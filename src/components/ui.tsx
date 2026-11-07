import type { ReactNode } from 'react';
import type { Confidence } from '@/lib/types';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-nw-line bg-white p-5 ${className}`}>{children}</div>;
}

export function ChoiceButton({
  selected,
  onClick,
  title,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-xl border-2 p-4 text-left transition ${
        selected ? 'border-nw-purple bg-nw-lilac' : 'border-nw-line bg-white hover:border-nw-purple/50'
      }`}
    >
      <span className="block font-semibold">{title}</span>
      {hint && <span className="block text-sm text-nw-muted">{hint}</span>}
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-nw-purple px-6 py-3 font-semibold text-white hover:bg-nw-deep disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

const CONFIDENCE: Record<Confidence, { label: string; cls: string }> = {
  certain: { label: 'Confirmed', cls: 'bg-nw-green/10 text-nw-green' },
  likely: { label: 'Likely', cls: 'bg-nw-teal/10 text-nw-teal' },
  signal: { label: 'Early signal', cls: 'bg-nw-amber/10 text-nw-amber' },
};

export function ConfidencePill({ c }: { c: Confidence }) {
  const { label, cls } = CONFIDENCE[c];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}

export function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${on ? 'bg-nw-purple' : 'bg-nw-line'}`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`}
      />
    </button>
  );
}
