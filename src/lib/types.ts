// Shared types. Transactions use the field names of the UK Open Banking
// Account & Transaction API, so the seeded demo data can be swapped for a real
// feed without touching the engine.

export type PayType =
  | 'salaried'
  | 'hourly'
  | 'zero-hours'
  | 'self-employed'
  | 'student'
  | 'not-working';

export type Category =
  | 'income'
  | 'rent'
  | 'mortgage'
  | 'energy'
  | 'council-tax'
  | 'groceries'
  | 'fuel'
  | 'public-transport'
  | 'phone'
  | 'subscriptions'
  | 'eating-out'
  | 'coffee'
  | 'entertainment'
  | 'childcare'
  | 'tax'
  | 'other';

export interface ObTransaction {
  TransactionId: string;
  BookingDateTime: string;
  CreditDebitIndicator: 'Credit' | 'Debit';
  Amount: { Amount: string; Currency: 'GBP' };
  TransactionInformation: string;
  MerchantDetails?: { MerchantName: string; MerchantCategoryCode?: string };
}

export type JobTemplateId =
  | 'steady'
  | 'warehouse-retail'
  | 'hospitality'
  | 'trades'
  | 'care'
  | 'gig-delivery';

export interface LifeEvent {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  label: string;
  amount: number; // positive = money out
  source: 'festival' | 'calendar' | 'spotify' | 'personal' | 'rule';
  note?: string;
}

export interface Profile {
  name: string;
  household: 'alone' | 'partner' | 'kids';
  housing: 'rent' | 'mortgage' | 'family';
  job: string;
  jobTemplate: JobTemplateId;
  payType: PayType;
  connections: { spotify: boolean; calendar: boolean };
  festivals: string[];
  personalEvents: LifeEvent[];
  /** Fixed-rate mortgage details (in production, read from the NatWest mortgage account). */
  mortgage?: { balance: number; rate: number; fixEnds: string; yearsLeft: number };
  /** First part of the postcode (e.g. "LS6"), for local weather, fares and prices. */
  postcode?: string;
  /** Which seeded account the demo reads transactions from. */
  account: PersonaId;
}

export type PersonaId = 'sam' | 'dev' | 'amira' | 'kayla';

export type Confidence = 'certain' | 'likely' | 'signal';

export interface WhatIf {
  id: string;
  label: string;
  /** Extra money in (positive) or out (negative), by ISO date. */
  flows: { date: string; amount: number }[];
  /** Regular payments to stop, by merchant name (e.g. a savings transfer). */
  pauseBills?: string[];
  /** Lock a new mortgage rate now, at the hopeful end of today's range. */
  mortgageLock?: boolean;
  /** Multiplier applied to a spending category for the whole horizon. */
  categoryScale?: { category: Category; factor: number };
}
