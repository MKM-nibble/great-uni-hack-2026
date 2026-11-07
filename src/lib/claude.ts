import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { CoachAdvice, CoachSummary, Language } from '@/lib/coach';
import type { JobTemplateId } from '@/lib/types';
import { recordUsage } from '@/ingest/classify';

// Every call is small: a ~300-token summary in, a short JSON answer out.
// Results are cached in memory, and demo personas use answers committed in
// src/data/coach-cache.json, so a live demo needs no API calls at all.

const MODEL = process.env.STAGGER_MODEL ?? 'claude-opus-5-5';

export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const COACH_SYSTEM = `You are Stagger, a friendly money coach inside the NatWest app.
You help people with uneven income (shift workers, self-employed people, students) and
everyone else get ahead of tight spots in their finances.

Rules:
- Use only the numbers in the summary. Never invent figures, products or rates.
- Plain words a 12-year-old could follow. Short sentences. No jargon, no blame.
- Give practical steps, not regulated financial advice. Do not recommend investments or credit products.
- If money is likely to get tight, one action should be talking to NatWest early.
- Write in the requested language.`;

const COACH_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'One sentence, max 20 words.' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Max 8 words.' },
          detail: { type: 'string', description: 'One sentence, max 25 words.' },
        },
        required: ['title', 'detail'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'actions'],
  additionalProperties: false,
};

const memo = new Map<string, unknown>();

async function structured<T>(key: string, system: string, user: string, schema: object): Promise<T> {
  if (memo.has(key)) return memo.get(key) as T;
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: schema as Record<string, unknown> } },
    system,
    messages: [{ role: 'user', content: user }],
  });
  await recordUsage(key.split(':')[0], response.usage);
  if (response.stop_reason === 'refusal') throw new Error('Claude declined this request');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No text in Claude response');
  const parsed = JSON.parse(text.text) as T;
  memo.set(key, parsed);
  return parsed;
}

export async function claudeCoach(summary: CoachSummary, language: Language): Promise<CoachAdvice> {
  const user = `Language: ${language}\n\nForecast summary (JSON):\n${JSON.stringify(summary)}\n\nGive a headline and exactly 3 actions.`;
  const result = await structured<Omit<CoachAdvice, 'source'>>(
    `coach:${language}:${JSON.stringify(summary)}`,
    COACH_SYSTEM,
    user,
    COACH_SCHEMA,
  );
  return { ...result, actions: result.actions.slice(0, 3), source: 'claude' };
}

const JOB_SCHEMA = {
  type: 'object',
  properties: {
    template: {
      type: 'string',
      enum: ['steady', 'warehouse-retail', 'hospitality', 'trades', 'care', 'gig-delivery'],
    },
    tidyJob: { type: 'string', description: 'The job title, tidied up, max 5 words.' },
  },
  required: ['template', 'tidyJob'],
  additionalProperties: false,
};

/** Only called for jobs the keyword rules can't place. */
export async function claudeMatchJob(job: string): Promise<{ template: JobTemplateId; tidyJob: string }> {
  return structured(
    `job:${job.toLowerCase().trim()}`,
    'Match a UK job description to the seasonal income pattern it most likely follows. ' +
      'steady = no seasonal pattern; warehouse-retail = Nov-Dec peak, January drop; hospitality = summer and December peaks; ' +
      'trades = winter slowdown; care = mostly steady; gig-delivery = busier in winter.',
    `Job: ${job.slice(0, 200)}`,
    JOB_SCHEMA,
  );
}
