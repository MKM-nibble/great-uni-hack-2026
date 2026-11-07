import type { ReactNode } from 'react';
import type { Confidence } from '@/lib/types';

/** natwest.com-style content card: soft grey-lilac fill, no border, 8px corners. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg bg-nw-mist p-6 ${className}`}>{children}</div>;
}

/** The centred content column every page sits in. */
export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

/**
 * Full-width purple title band, like the top of a natwest.com page:
 * a small breadcrumb-style eyebrow, a big white slab-serif title and a lead line.
 */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-nw-purple via-nw-purple to-nw-deep text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-nw-violet/40 blur-3xl"
      />
      <Container className="relative pb-10 pt-20 sm:pb-14 sm:pt-24">
        {eyebrow && <p className="mb-3 text-[15px] text-white/80">{eyebrow}</p>}
        <h1 className="max-w-3xl text-4xl !text-white sm:text-[46px] sm:leading-[1.25]">{title}</h1>
        {lead && <p className="mt-4 max-w-3xl text-lg text-white/90 sm:text-[22px] sm:leading-8">{lead}</p>}
        {children && <div className="mt-7">{children}</div>}
      </Container>
    </section>
  );
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
      className={`w-full rounded-lg border-2 p-4 text-left transition ${
        selected ? 'border-nw-violet bg-nw-lilac' : 'border-nw-line bg-white hover:border-nw-violet/50'
      }`}
    >
      <span className="block font-semibold text-nw-ink">{title}</span>
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
      className="rounded-full bg-nw-violet px-7 py-3 font-semibold text-white hover:bg-nw-violet-dark disabled:cursor-not-allowed disabled:opacity-40"
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
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${on ? 'bg-nw-violet' : 'bg-nw-line'}`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`}
      />
    </button>
  );
}
