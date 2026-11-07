// Turns real headlines into price signals, once, before the demo.
// 1. Put one headline per line in scripts/headlines.txt, as: headline | url
// 2. pnpm news > signals.json
// 3. Check every signal by hand, then paste them into NEWS_SIGNALS in src/data/prices.ts.
import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const CATEGORIES = ['groceries', 'energy', 'transport', 'phone', 'subscriptions', 'eating-out', 'coffee', 'entertainment', 'rent', 'other'];

const headlines = readFileSync('scripts/headlines.txt', 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .slice(0, 40);
if (!headlines.length) throw new Error('Add headlines to scripts/headlines.txt first');

const client = new Anthropic();
const response = await client.beta.messages.create({
  model: process.env.STAGGER_MODEL ?? 'claude-opus-5-5',
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
          signals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                category: { type: 'string', enum: CATEGORIES },
                headline: { type: 'string' },
                pct: { type: 'number', description: 'Expected UK consumer price change, e.g. 0.05 for +5%' },
                from: { type: 'string', description: 'yyyy-mm-dd when it is likely to reach shoppers' },
                sourceUrl: { type: 'string' },
              },
              required: ['id', 'category', 'headline', 'pct', 'from', 'sourceUrl'],
              additionalProperties: false,
            },
          },
        },
        required: ['signals'],
        additionalProperties: false,
      },
    },
  },
  system:
    'You extract consumer price signals for UK households from news headlines. Only include a headline ' +
    'if it clearly implies a price change people will pay. Use the size stated in the headline; if none ' +
    'is stated, give a cautious estimate. Skip anything speculative or unrelated.',
  messages: [{ role: 'user', content: `Today is ${new Date().toISOString().slice(0, 10)}.\n\n${headlines.join('\n')}` }],
});

if (response.stop_reason === 'refusal') throw new Error('Request declined');
const text = response.content.find((b) => b.type === 'text');
if (!text || text.type !== 'text') throw new Error('No text in response');
const { signals } = JSON.parse(text.text) as { signals: object[] };
console.log(JSON.stringify(signals.map((s) => ({ ...s, confidence: 'signal' })), null, 2));
