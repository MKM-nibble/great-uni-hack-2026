import type { Profile } from '@/lib/types';

// The onboarding answers live only in this browser. Nothing is sent to a server
// except the short forecast summary used for AI coaching.
const KEY = 'stagger-profile';

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Private mode or storage blocked: the forecast still works for this visit.
  }
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}
