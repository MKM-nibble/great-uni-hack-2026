import type { Category, Confidence } from '@/lib/types';

// ⚠ Before the demo: check every figure in this file against its source and
// update it. The values are realistic placeholders, not live data.

export interface PriceChange {
  id: string;
  title: string;
  category: Category;
  /** First date the new price applies (yyyy-mm-dd). */
  date: string;
  /** Relative change, e.g. 0.05 = +5%. Ignored when `monthlyAmount` is set. */
  pct?: number;
  /** Flat change per month in pounds, e.g. mobile contract rises. */
  monthlyAmount?: number;
  confidence: Confidence;
  source: string;
  sourceUrl?: string;
}

/** Tier 1: scheduled changes that are announced in advance. */
export const SCHEDULED_CHANGES: PriceChange[] = [
  {
    id: 'ofgem-jan',
    title: 'Energy price cap changes',
    category: 'energy',
    date: '2027-01-01',
    pct: 0.03,
    confidence: 'likely',
    source: 'Ofgem price cap (announced late November)',
    sourceUrl: 'https://www.ofgem.gov.uk/energy-price-cap',
  },
  {
    id: 'council-tax-apr',
    title: 'Council tax rises',
    category: 'council-tax',
    date: '2027-04-01',
    pct: 0.0499,
    confidence: 'certain',
    source: 'Most councils raise by up to 4.99% each April',
    sourceUrl: 'https://www.gov.uk/council-tax',
  },
  {
    id: 'phone-apr',
    title: 'Mid-contract phone & broadband rise',
    category: 'phone',
    date: '2027-04-01',
    monthlyAmount: 1.75,
    confidence: 'certain',
    source: 'Ofcom rules: rises written into contracts in pounds and pence',
    sourceUrl: 'https://www.ofcom.org.uk/phones-and-broadband/',
  },
];

/** Tier 2: official inflation by category (ONS CPI, annual rate). */
export const CPI_ANNUAL: Partial<Record<Category, number>> = {
  groceries: 0.035,
  fuel: 0.02,
  'public-transport': 0.035,
  'eating-out': 0.04,
  coffee: 0.04,
  subscriptions: 0.03,
  entertainment: 0.03,
};
export const CPI_SOURCE = {
  label: 'ONS consumer price inflation by category',
  url: 'https://www.ons.gov.uk/economy/inflationandpriceindices',
};

/** Bank of England decisions, shown as a card (they move overdraft and savings rates). */
export const RATE_DECISIONS = [
  { date: '2026-12-17', expectation: 'Hold expected', confidence: 'likely' as Confidence },
  { date: '2027-02-04', expectation: 'Possible 0.25% cut', confidence: 'signal' as Confidence },
];
export const RATE_SOURCE = {
  label: 'Bank of England Monetary Policy Committee dates',
  url: 'https://www.bankofengland.co.uk/monetary-policy/upcoming-mpc-dates',
};

/**
 * Tier 3: news signals. Generated once before the demo by
 * `scripts/extract-news-signals.mjs` from real headlines, and cached here.
 * The entries below are EXAMPLES to show the shape. Replace them.
 */
export interface NewsSignal {
  id: string;
  category: Category;
  headline: string;
  pct: number;
  from: string;
  confidence: Confidence;
  sourceUrl?: string;
  example?: boolean;
}

export const NEWS_SIGNALS: NewsSignal[] = [
  {
    id: 'coffee',
    category: 'coffee',
    headline: 'Coffee bean prices stay high after poor harvests',
    pct: 0.1,
    from: '2027-01-01',
    confidence: 'signal',
    example: true,
  },
  {
    id: 'groceries-dairy',
    category: 'groceries',
    headline: 'Supermarkets warn of dairy and chocolate price rises',
    pct: 0.02,
    from: '2026-12-01',
    confidence: 'signal',
    example: true,
  },
  {
    id: 'streaming',
    category: 'subscriptions',
    headline: 'Streaming services announce new UK price tiers',
    pct: 0.12,
    from: '2027-02-01',
    confidence: 'signal',
    example: true,
  },
];

/** Bank Rate today. ⚠ Check against the Bank of England before the demo. */
export const BANK_RATE = { value: 0.0375, asOf: '2026-11-07' };

/**
 * New fixed mortgage rates usually sit above Bank Rate. A deliberately wide
 * range, so the forecast shows a cautious and a hopeful case.
 */
export const MORTGAGE_MARGIN = { low: 0.006, high: 0.014 };
