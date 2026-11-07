import Anthropic from '@anthropic-ai/sdk';
import { sql } from '@/lib/db';

// Keywords find candidate stories for free; this decides what they mean.
// One batched call per ingest run (a few cents a day). Magnitude and timing
// still come from our impact rules. The model only judges relevance,
// direction and strength, which keyword rules get wrong ("Hormuz could reopen"
// is a price fall, not a rise).

export interface Judgement {
  id: number;
  relevant: boolean;
  direction: 'up' | 'down' | 'none';
  strength: 'small' | 'medium' | 'large';
  categories: string[];
  reason: string;
}

const MODEL = process.env.STAGGER_MODEL ?? 'claude-opus-5-5';
// USD per million tokens [input, output].
const PRICES: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};

const DOWN = /\b(falls?|fell|cuts?|drops?|lower|eases?|easing|reopens?|slumps?|cheaper|tumbles?|slides?)\b/i;
const UP = /\b(rises?|rose|soars?|surges?|jumps?|hikes?|higher|spikes?|closes?|closure|blockade|shortages?|strikes?)\b/i;

/** No API key: a plain word check for direction, and only clear stories count. */
export function heuristicJudge(id: number, text: string, categories: string[]): Judgement {
  const down = DOWN.test(text);
  const up = UP.test(text);
  const direction = up && !down ? 'up' : down && !up ? 'down' : 'none';
  return { id, relevant: direction !== 'none', direction, strength: 'small', categories, reason: 'Keyword match' };
}

export async function claudeJudge(
  items: { id: number; text: string; categories: string[] }[],
  allowed: string[],
): Promise<Judgement[]> {
  if (!items.length) return [];
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  relevant: { type: 'boolean' },
                  direction: { type: 'string', enum: ['up', 'down', 'none'] },
                  strength: { type: 'string', enum: ['small', 'medium', 'large'] },
                  categories: { type: 'array', items: { type: 'string', enum: allowed } },
                  reason: { type: 'string', description: 'One short sentence a customer could read.' },
                },
                required: ['id', 'relevant', 'direction', 'strength', 'categories', 'reason'],
                additionalProperties: false,
              },
            },
          },
          required: ['items'],
          additionalProperties: false,
        },
      },
    },
    system:
      'You judge whether UK news stories will change what UK households pay in the next few months. ' +
      'relevant=false unless the story clearly affects UK consumer prices for one of the listed categories. ' +
      'direction is the effect on the price people pay. Keep only the suggested categories that genuinely apply. ' +
      'Be conservative: speculation, opinion pieces and foreign stories with no clear UK price effect are not relevant.',
    messages: [
      {
        role: 'user',
        content: items
          .map((i) => `id ${i.id} [suggested: ${i.categories.join(', ')}]: ${i.text.slice(0, 400)}`)
          .join('\n'),
      },
    ],
  });
  await recordUsage('headline-judging', response.usage);
  if (response.stop_reason === 'refusal') throw new Error('Claude declined the headline batch');
  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No text in Claude response');
  return (JSON.parse(text.text) as { items: Judgement[] }).items;
}

export async function recordUsage(purpose: string, usage: { input_tokens: number; output_tokens: number }) {
  const [inPrice, outPrice] = PRICES[MODEL] ?? PRICES['claude-opus-5-5'];
  const cost = (usage.input_tokens * inPrice + usage.output_tokens * outPrice) / 1_000_000;
  try {
    await sql()`insert into llm_usage (purpose, model, input_tokens, output_tokens, cost_usd)
                values (${purpose}, ${MODEL}, ${usage.input_tokens}, ${usage.output_tokens}, ${cost})`;
  } catch {
    // Usage logging must never break the request.
  }
}
