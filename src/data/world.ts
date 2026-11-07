import type { Category, Confidence, PayType } from '@/lib/types';
import {
  BANK_RATE,
  CPI_ANNUAL,
  NEWS_SIGNALS,
  RATE_DECISIONS,
  SCHEDULED_CHANGES,
  type PriceChange,
} from '@/data/prices';

// Everything outside the customer's own account that moves their forecast.
// The app loads it from the database (/api/world); SNAPSHOT_WORLD is the
// built-in copy used when the database can't be reached, so a demo never
// breaks on bad wifi.

export interface Signal {
  id: string;
  category: Category;
  title: string;
  pctLow: number;
  pctHigh: number;
  from: string;
  to?: string;
  confidence: Confidence;
  method: 'official' | 'rule' | 'llm' | 'series';
  explanation: string;
  sourceUrl?: string;
  example?: boolean;
}

export interface IncomeChange {
  id: string;
  title: string;
  date: string;
  pct: number;
  payTypes: PayType[] | null;
  confidence: Confidence;
  sourceUrl?: string;
}

export type WeatherCondition = 'heavy_rain' | 'snow' | 'freezing' | 'heatwave' | 'storm';

export interface WeatherDay {
  date: string;
  tMin: number;
  tMax: number;
  precipMm: number;
  snowCm: number;
  windKph: number;
}

export interface World {
  source: 'database' | 'snapshot';
  regionName?: string;
  scheduled: PriceChange[];
  incomeChanges: IncomeChange[];
  cpi: Partial<Record<Category, number>>;
  signals: Signal[];
  rates: { date: string; expectation: string; confidence: Confidence }[];
  /** Bank Rate today, e.g. 0.0375. */
  bankRate: number;
  weather: {
    days: WeatherDay[];
    effects: { condition: WeatherCondition; effect: number; note: string }[];
  };
}

export const SNAPSHOT_WORLD: World = {
  source: 'snapshot',
  scheduled: SCHEDULED_CHANGES,
  incomeChanges: [],
  cpi: CPI_ANNUAL,
  signals: NEWS_SIGNALS.map((s) => ({
    id: s.id,
    category: s.category,
    title: s.headline,
    pctLow: s.pct,
    pctHigh: s.pct,
    from: s.from,
    confidence: s.confidence,
    method: 'rule',
    explanation: s.headline,
    sourceUrl: s.sourceUrl,
    example: s.example,
  })),
  rates: RATE_DECISIONS,
  bankRate: BANK_RATE.value,
  weather: { days: [], effects: [] },
};

/** Which conditions a day meets. Thresholds are simple and explainable. */
export function conditionsOn(d: WeatherDay): WeatherCondition[] {
  const out: WeatherCondition[] = [];
  if (d.snowCm >= 1) out.push('snow');
  if (d.precipMm >= 10) out.push('heavy_rain');
  if (d.tMin <= -2) out.push('freezing');
  if (d.tMax >= 27) out.push('heatwave');
  if (d.windKph >= 60) out.push('storm');
  return out;
}

export const CONDITION_LABEL: Record<WeatherCondition, string> = {
  heavy_rain: 'Heavy rain',
  snow: 'Snow',
  freezing: 'Hard frost',
  heatwave: 'Hot weather',
  storm: 'High winds',
};

export const midpoint = (s: Signal) => (s.pctLow + s.pctHigh) / 2;
