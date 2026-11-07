import { claudeCoach, hasApiKey } from '@/lib/claude';
import { LANGUAGES, type CoachSummary, type Language } from '@/lib/coach';
import { spendGuard } from '@/lib/spend-guard';
import cached from '@/data/coach-cache.json';

const CACHE = cached as Record<string, unknown>;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    summary: CoachSummary;
    language?: Language;
    cacheKey?: string;
    /** Only return a pre-generated answer; never spend credits. */
    cacheOnly?: boolean;
  };
  const language = LANGUAGES.includes(body.language as Language) ? (body.language as Language) : 'English';

  if (body.cacheKey && CACHE[`${body.cacheKey}:${language}`]) {
    return Response.json({ ...(CACHE[`${body.cacheKey}:${language}`] as object), source: 'cache' });
  }
  if (body.cacheOnly) return Response.json({ error: 'not-cached' }, { status: 404 });
  if (!hasApiKey()) return Response.json({ error: 'no-key' }, { status: 503 });
  if (!spendGuard()) return Response.json({ error: 'limit' }, { status: 429 });

  try {
    return Response.json(await claudeCoach(body.summary, language));
  } catch (err) {
    console.error('coach failed', err);
    return Response.json({ error: 'failed' }, { status: 502 });
  }
}
