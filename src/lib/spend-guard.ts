import 'server-only';

// A hard cap on live Claude calls per server process, so a demo left open
// (or a curious judge mashing buttons) can't drain the API credits.
const MAX_CALLS = Number(process.env.STAGGER_MAX_CALLS ?? 150);
let calls = 0;

export function spendGuard(): boolean {
  if (calls >= MAX_CALLS) return false;
  calls++;
  return true;
}
