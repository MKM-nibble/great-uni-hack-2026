import type { JobTemplateId, PayType } from '@/lib/types';

export interface JobTemplate {
  id: JobTemplateId;
  label: string;
  /** Income multiplier per calendar month, January first. 1 = a typical month. */
  seasonality: number[];
  note: string;
}

export const JOB_TEMPLATES: Record<JobTemplateId, JobTemplate> = {
  steady: {
    id: 'steady',
    label: 'Steady work',
    seasonality: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    note: 'No strong seasonal pattern.',
  },
  'warehouse-retail': {
    id: 'warehouse-retail',
    label: 'Warehouse & retail',
    seasonality: [0.6, 0.75, 0.9, 0.95, 1, 1, 1, 1, 1, 1.05, 1.3, 1.35],
    note: 'Peak season in Nov–Dec, then hours drop sharply in January.',
  },
  hospitality: {
    id: 'hospitality',
    label: 'Hospitality',
    seasonality: [0.7, 0.75, 0.85, 0.95, 1.05, 1.15, 1.2, 1.2, 1, 0.95, 0.95, 1.25],
    note: 'Busy summers and December, quiet January and February.',
  },
  trades: {
    id: 'trades',
    label: 'Trades & construction',
    seasonality: [0.8, 0.85, 0.95, 1.05, 1.1, 1.1, 1.05, 0.95, 1.05, 1.05, 1, 0.85],
    note: 'Winter slowdown and invoices that are often paid late.',
  },
  care: {
    id: 'care',
    label: 'Health & care',
    seasonality: [1.05, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.1],
    note: 'Mostly steady, with overtime spikes over winter.',
  },
  'gig-delivery': {
    id: 'gig-delivery',
    label: 'Delivery & gig work',
    seasonality: [1.1, 1, 0.95, 0.95, 0.9, 0.85, 0.85, 0.85, 0.95, 1, 1.1, 1.25],
    note: 'More orders in cold and dark months, fewer in summer.',
  },
};

const KEYWORDS: [RegExp, JobTemplateId][] = [
  [/warehouse|picker|packer|retail|shop|stock|forklift|cashier|supermarket/i, 'warehouse-retail'],
  [/bar|pub|waiter|waitress|chef|kitchen|barista|hotel|restaurant|hospitality/i, 'hospitality'],
  [/plumb|electric|builder|carpent|joiner|roofer|decorat|construct|plaster|trade/i, 'trades'],
  [/nurse|carer|care work|support worker|hca|nhs|healthcare|midwife/i, 'care'],
  [/deliver|courier|driver|uber|deliveroo|rider|gig/i, 'gig-delivery'],
];

/**
 * Match a free-text job to a seasonal template. Rules cover the common
 * cases for free; only unmatched jobs are worth an LLM call.
 */
export function matchJob(job: string): JobTemplateId | null {
  for (const [re, id] of KEYWORDS) if (re.test(job)) return id;
  return null;
}

export const PAY_TYPES: { id: PayType; label: string; hint: string }[] = [
  { id: 'salaried', label: 'Salaried', hint: 'Same pay every month' },
  { id: 'hourly', label: 'Hourly / shifts', hint: 'Set hours, pay varies a bit' },
  { id: 'zero-hours', label: 'Zero-hours', hint: 'Hours change week to week' },
  { id: 'self-employed', label: 'Self-employed', hint: 'Invoices, clients, tax returns' },
  { id: 'student', label: 'Student', hint: 'Loan instalments, maybe part-time work' },
  { id: 'not-working', label: 'Not working / benefits', hint: 'Benefits or other support' },
];

/** Pay types whose income is forecast rather than treated as a flat line. */
export function hasVariableIncome(pay: PayType): boolean {
  return pay === 'hourly' || pay === 'zero-hours' || pay === 'self-employed' || pay === 'student';
}
