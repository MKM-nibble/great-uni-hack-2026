import type { Category, ObTransaction } from '@/lib/types';

// Rules first: merchant category codes plus a few keywords cover nearly
// every transaction for free. Unknown merchants fall through to 'other'
// (in production, a single batched LLM call would label those once).

const MCC: Record<string, Category> = {
  '6513': 'rent',
  '4900': 'energy',
  '4814': 'phone',
  '4899': 'subscriptions',
  '7997': 'subscriptions',
  '5411': 'groceries',
  '5812': 'eating-out',
  '5813': 'eating-out',
  '4111': 'public-transport',
  '4131': 'public-transport',
  '5541': 'fuel',
  '5542': 'fuel',
  '7922': 'entertainment',
  '8351': 'childcare',
};

export function categorise(t: ObTransaction): Category {
  if (t.CreditDebitIndicator === 'Credit') return 'income';
  const name = t.TransactionInformation.toUpperCase();
  if (name.includes('COUNCIL TAX')) return 'council-tax';
  if (name.includes('HMRC')) return 'tax';
  if (name.includes('MORTGAGE')) return 'mortgage';
  if (/COSTA|STARBUCKS|PRET|CAFFE NERO/.test(name)) return 'coffee';
  const mcc = t.MerchantDetails?.MerchantCategoryCode;
  if (mcc === '5814') return 'eating-out';
  return (mcc && MCC[mcc]) || 'other';
}

export const CATEGORY_LABEL: Record<Category, string> = {
  income: 'Income',
  rent: 'Rent',
  mortgage: 'Mortgage',
  energy: 'Energy',
  'council-tax': 'Council tax',
  groceries: 'Groceries',
  fuel: 'Fuel',
  'public-transport': 'Buses & trains',
  phone: 'Phone & broadband',
  subscriptions: 'Subscriptions',
  'eating-out': 'Eating out & takeaways',
  coffee: 'Coffee',
  entertainment: 'Going out',
  childcare: 'Childcare',
  tax: 'Tax',
  other: 'Shopping & other',
};
