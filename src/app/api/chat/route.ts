import { claudeChat, hasApiKey, type ChatTurn } from '@/lib/claude';
import { LANGUAGES, type CoachSummary, type Language } from '@/lib/coach';
import { spendGuard } from '@/lib/spend-guard';

export async function POST(request: Request) {
  const body = (await request.json()) as { summary: CoachSummary; messages: ChatTurn[]; language?: Language };
  const language = LANGUAGES.includes(body.language as Language) ? (body.language as Language) : 'English';
  const messages = (body.messages ?? []).filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim(),
  );
  if (!messages.length || messages.at(-1)!.role !== 'user') return Response.json({ error: 'bad request' }, { status: 400 });
  if (!hasApiKey()) return Response.json({ error: 'no-key' }, { status: 503 });
  if (!spendGuard()) return Response.json({ error: 'limit' }, { status: 429 });

  try {
    return Response.json({ reply: await claudeChat(body.summary, messages, language) });
  } catch (err) {
    console.error('chat failed', err);
    return Response.json({ error: 'failed' }, { status: 502 });
  }
}
