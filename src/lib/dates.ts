const DAY = 86_400_000;

/** Midnight UTC for the given date, so day arithmetic ignores DST. */
export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function today(): Date {
  return startOfDay(new Date());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseIso(s: string): Date {
  return startOfDay(new Date(s));
}

/** Next occurrence of month/day on or after `from`. Month is 1-based. */
export function nextOn(from: Date, month: number, day: number): Date {
  const y = from.getUTCFullYear();
  const candidate = new Date(Date.UTC(y, month - 1, day));
  return candidate < from ? new Date(Date.UTC(y + 1, month - 1, day)) : candidate;
}

export function fmtDate(s: string | Date): string {
  const d = typeof s === 'string' ? parseIso(s) : s;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function fmtMoney(n: number, opts: { sign?: boolean } = {}): string {
  const abs = Math.abs(n).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
  if (n < 0) return `-${abs}`;
  return opts.sign ? `+${abs}` : abs;
}
