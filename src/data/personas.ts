import type { LifeEvent, ObTransaction, PersonaId, Profile } from '@/lib/types';
import { JOB_TEMPLATES } from '@/data/jobs';
import { addDays, iso, today } from '@/lib/dates';

// Synthetic demo accounts: 24 months of transactions per persona, generated
// deterministically up to today. Everything is fictional.

export interface GigSuggestion {
  artist: string;
  venue: string;
  date: string;
  priceRange: [number, number];
}

export interface Persona {
  id: PersonaId;
  name: string;
  age: number;
  blurb: string;
  storm: string;
  profile: Profile;
  balance: number;
  transactions: ObTransaction[];
  gigs: GigSuggestion[];
}

const HISTORY_DAYS = 730;

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ledger = {
  credit(d: Date, amount: number, info: string): void;
  debit(d: Date, amount: number, merchant: string, mcc?: string): void;
};

/** `balanceToday` pins today's balance; history is worked out backwards from it. */
function generate(seed: number, balanceToday: number, day: (d: Date, l: Ledger, r: () => number) => void) {
  const r = rng(seed);
  const txns: ObTransaction[] = [];
  let n = 0;
  const push = (d: Date, amount: number, ind: 'Credit' | 'Debit', info: string, mcc?: string) => {
    txns.push({
      TransactionId: `${seed}-${n++}`,
      BookingDateTime: `${iso(d)}T09:00:00Z`,
      CreditDebitIndicator: ind,
      Amount: { Amount: amount.toFixed(2), Currency: 'GBP' },
      TransactionInformation: info,
      ...(ind === 'Debit' ? { MerchantDetails: { MerchantName: info, MerchantCategoryCode: mcc } } : {}),
    });
  };
  const ledger: Ledger = {
    credit: (d, a, info) => push(d, Math.round(a * 100) / 100, 'Credit', info),
    debit: (d, a, m, mcc) => push(d, Math.round(a * 100) / 100, 'Debit', m, mcc),
  };
  const end = today();
  for (let d = addDays(end, -HISTORY_DAYS); d < end; d = addDays(d, 1)) day(d, ledger, r);
  return { txns, balance: balanceToday };
}

const between = (r: () => number, lo: number, hi: number) => lo + r() * (hi - lo);
const dom = (d: Date) => d.getUTCDate();
const dow = (d: Date) => d.getUTCDay(); // 0 = Sunday
const month = (d: Date) => d.getUTCMonth() + 1;
const isDay = (d: Date, m: number, day: number) => month(d) === m && dom(d) === day;

function baseProfile(p: Partial<Profile> & Pick<Profile, 'name' | 'account'>): Profile {
  return {
    household: 'alone',
    housing: 'rent',
    job: '',
    jobTemplate: 'steady',
    payType: 'salaried',
    connections: { spotify: false, calendar: false },
    festivals: ['christmas'],
    personalEvents: [],
    ...p,
  };
}

function personal(id: string, date: string, label: string, amount: number, source: LifeEvent['source']): LifeEvent {
  return { id, date, label, amount, source };
}

// Sam: salaried software engineer. A good salary, but a young family, nursery
// fees, and a cheap five-year mortgage fix that ends in April.
const SAM_MORTGAGE = { balance: 214_000, rate: 0.0189, fixEnds: '2027-04-01', yearsLeft: 26 };

function sam(): Persona {
  const { txns, balance } = generate(11, 3200, (d, l, r) => {
    if (dom(d) === 28) l.credit(d, 3350, 'NORTHSTACK LTD SALARY');
    if (isDay(d, 3, 28)) l.credit(d, 2400, 'NORTHSTACK LTD BONUS');
    if (dom(d) === 1) l.debit(d, 868, 'NATWEST MORTGAGE', '6012');
    if (dom(d) === 1) l.debit(d, 740, 'BRIGHT START NURSERY', '8351');
    if (dom(d) === 10) l.debit(d, 265, 'BLACK HORSE CAR FINANCE', '6141');
    if (dom(d) === 29) l.debit(d, 250, 'TRANSFER TO ISA', '6012');
    if (dom(d) === 5) l.debit(d, 140, 'OCTOPUS ENERGY', '4900');
    if (dom(d) === 15 && month(d) !== 2 && month(d) !== 3) l.debit(d, 165, 'LEEDS CITY COUNCIL TAX', '9311');
    if (dom(d) === 20) l.debit(d, 48, 'VIRGIN MEDIA', '4814');
    if (dom(d) === 12) l.debit(d, 10.99, 'NETFLIX', '4899');
    if (dom(d) === 18) l.debit(d, 19.99, 'SPOTIFY', '4899');
    if (dom(d) === 2) l.debit(d, 30, 'PUREGYM', '7997');
    if (dom(d) % 10 === 0) l.debit(d, between(r, 38, 52), 'SHELL', '5541');
    if (dow(d) === 6) l.debit(d, between(r, 85, 105), 'TESCO', '5411');
    if (dow(d) >= 1 && dow(d) <= 4 && r() < 0.8) l.debit(d, between(r, 3.1, 3.8), 'COSTA COFFEE', '5814');
    if (dow(d) === 5 && r() < 0.8) l.debit(d, between(r, 35, 70), 'DISHOOM', '5812');
    if (r() < 0.25) l.debit(d, between(r, 15, 60), 'AMAZON', '5942');
    if (month(d) === 12 && dom(d) <= 22 && r() < 0.35) l.debit(d, between(r, 30, 90), 'JOHN LEWIS', '5311');
  });
  return {
    id: 'sam',
    name: 'Sam',
    age: 31,
    blurb: 'Software engineer, salaried, one child',
    storm: 'Mortgage fix ends in April, on top of nursery fees',
    balance,
    transactions: txns,
    gigs: [],
    profile: baseProfile({
      name: 'Sam',
      account: 'sam',
      postcode: 'LS6',
      household: 'kids',
      housing: 'mortgage',
      job: 'Software engineer',
      payType: 'salaried',
      festivals: ['christmas'],
      personalEvents: [personal('wedding', '2027-02-19', 'Ana’s wedding in Lisbon', 650, 'calendar')],
      connections: { spotify: false, calendar: true },
      mortgage: SAM_MORTGAGE,
    }),
  };
}

// Dev: zero-hours warehouse nights, two kids.
function dev(): Persona {
  const season = JOB_TEMPLATES['warehouse-retail'].seasonality;
  let week = 0;
  const { txns, balance } = generate(22, 700, (d, l, r) => {
    if (dow(d) === 5) {
      week++;
      // Zero-hours: hours swing week to week, and some weeks are nearly empty.
      const swing = r() < 0.08 ? between(r, 0.3, 0.5) : between(r, 0.75, 1.25);
      const pay = 430 * season[month(d) - 1] * swing;
      l.credit(d, pay, 'NORTHGATE LOGISTICS PAYROLL');
    }
    if (dow(d) === 1 && week % 4 === 0) l.credit(d, 173.2, 'HMRC CHILD BENEFIT');
    if (dom(d) === 1) l.debit(d, 850, 'RENT - HOMEWISE HOUSING', '6513');
    if (dom(d) === 5) l.debit(d, 135, 'OCTOPUS ENERGY', '4900');
    if (dom(d) === 15 && month(d) !== 2 && month(d) !== 3) l.debit(d, 140, 'BRADFORD COUNCIL TAX', '9311');
    if (dom(d) === 20) l.debit(d, 28, 'VODAFONE', '4814');
    if (dom(d) === 12) l.debit(d, 10.99, 'NETFLIX', '4899');
    if (dom(d) === 9) l.debit(d, 165, 'MOTONOVO CAR FINANCE', '6141');
    if (dow(d) === 6) l.debit(d, between(r, 75, 95), 'ALDI', '5411');
    if (dow(d) === 3) l.debit(d, between(r, 15, 28), 'TESCO EXPRESS', '5411');
    if (dom(d) % 10 === 0) l.debit(d, between(r, 35, 45), 'SHELL', '5541');
    if (dow(d) === 6 && r() < 0.7) l.debit(d, between(r, 20, 32), 'JUST EAT', '5814');
    if (month(d) === 12 && dom(d) <= 22 && r() < 0.45) l.debit(d, between(r, 30, 80), 'SMYTHS TOYS', '5945');
    if (isDay(d, 6, 3)) l.debit(d, 120, 'SMYTHS TOYS', '5945');
  });
  return {
    id: 'dev',
    name: 'Dev',
    age: 34,
    blurb: 'Warehouse nights, zero-hours, two kids',
    storm: 'Peak season ends as Christmas hits, then a January drought',
    balance,
    transactions: txns,
    gigs: [],
    profile: baseProfile({
      name: 'Dev',
      account: 'dev',
      postcode: 'BD3',
      household: 'kids',
      job: 'Warehouse operative (nights)',
      jobTemplate: 'warehouse-retail',
      payType: 'zero-hours',
      festivals: ['christmas', 'diwali'],
      personalEvents: [personal('aarav-bday', '2026-12-14', 'Aarav’s 7th birthday', 150, 'calendar')],
      connections: { spotify: false, calendar: true },
    }),
  };
}

// Amira: self-employed plumber.
function amira(): Persona {
  const season = JOB_TEMPLATES.trades.seasonality;
  const clients = ['K WRIGHT', 'HALLAM LETTINGS LTD', 'P OKAFOR', 'BROOKSIDE HOMES', 'S PATEL', 'R JONES'];
  const { txns, balance } = generate(33, 3400, (d, l, r) => {
    // Invoices land on random weekdays and are often paid late, so income is lumpy.
    if (dow(d) >= 1 && dow(d) <= 5 && r() < 0.3) {
      const amt = between(r, 125, 535) * season[month(d) - 1];
      l.credit(d, amt, `${clients[Math.floor(r() * clients.length)]} INVOICE`);
    }
    if (dom(d) === 1) l.debit(d, 950, 'RENT - PRIMROSE ESTATES', '6513');
    if (dom(d) === 5) l.debit(d, 110, 'BRITISH GAS', '4900');
    if (dom(d) === 15 && month(d) !== 2 && month(d) !== 3) l.debit(d, 160, 'SHEFFIELD COUNCIL TAX', '9311');
    if (dom(d) === 20) l.debit(d, 32, 'EE', '4814');
    if (dom(d) === 8) l.debit(d, 85, 'ADMIRAL VAN INSURANCE', '6300');
    if (dow(d) === 1) l.debit(d, between(r, 50, 70), 'BP FUEL', '5541');
    if (dow(d) === 2) l.debit(d, between(r, 40, 110), 'SCREWFIX', '5200');
    if (dow(d) === 6) l.debit(d, between(r, 65, 85), 'LIDL', '5411');
    if (dow(d) === 0 && r() < 0.5) l.debit(d, between(r, 25, 45), 'NANDOS', '5812');
    if (isDay(d, 1, 31)) l.debit(d, 2900, 'HMRC SELF ASSESSMENT', '9311');
    if (isDay(d, 7, 31)) l.debit(d, 1450, 'HMRC SELF ASSESSMENT', '9311');
    // Eid al-Fitr 2026 (20 Mar) and 2025 (30 Mar): gifts, food and clothes.
    if ((month(d) === 3 && dom(d) >= 12 && dom(d) <= 20 && d.getUTCFullYear() === 2026) ||
        (month(d) === 3 && dom(d) >= 22 && dom(d) <= 30 && d.getUTCFullYear() === 2025)) {
      if (r() < 0.6) l.debit(d, between(r, 40, 90), 'PRIMARK', '5651');
    }
  });
  return {
    id: 'amira',
    name: 'Amira',
    age: 41,
    blurb: 'Self-employed plumber',
    storm: 'January tax bill, late-paying clients, then Eid',
    balance,
    transactions: txns,
    gigs: [],
    profile: baseProfile({
      name: 'Amira',
      account: 'amira',
      postcode: 'S8',
      household: 'partner',
      job: 'Plumber',
      jobTemplate: 'trades',
      payType: 'self-employed',
      festivals: ['eid-al-fitr', 'eid-al-adha'],
      connections: { spotify: false, calendar: false },
    }),
  };
}

// Kayla: student with a maintenance loan and bar shifts.
function kayla(): Persona {
  const season = JOB_TEMPLATES.hospitality.seasonality;
  const termTime = (d: Date) => ![7, 8].includes(month(d));
  const { txns, balance } = generate(44, 820, (d, l, r) => {
    if (isDay(d, 9, 22) || isDay(d, 1, 12) || isDay(d, 4, 20)) l.credit(d, 1560, 'SLC MAINTENANCE LOAN');
    if (dow(d) === 4) {
      const base = termTime(d) ? 110 : 230;
      if (r() < 0.85) l.credit(d, base * season[month(d) - 1] * between(r, 0.6, 1.3), 'THE RED LION PAYROLL');
    }
    if (dom(d) === 1 && termTime(d)) l.debit(d, 560, 'UNITE STUDENTS RENT', '6513');
    if (r() < 0.05) l.debit(d, between(r, 20, 60), 'ASOS', '5651');
    if (dom(d) === 20) l.debit(d, 15, 'GIFFGAFF', '4814');
    if (dom(d) === 18) l.debit(d, 5.99, 'SPOTIFY', '4899');
    if (dom(d) === 3) l.debit(d, 22, 'FIRST BUS', '4111');
    if (dow(d) === 0) l.debit(d, between(r, 28, 42), 'LIDL', '5411');
    if (dow(d) >= 1 && dow(d) <= 5 && r() < 0.5) l.debit(d, between(r, 2.9, 3.6), 'COSTA COFFEE', '5814');
    if (dow(d) === 5 && r() < 0.7) l.debit(d, between(r, 10, 25), 'WETHERSPOONS', '5813');
    if (r() < 0.02) l.debit(d, between(r, 15, 45), 'SKIDDLE TICKETS', '7922');
  });
  return {
    id: 'kayla',
    name: 'Kayla',
    age: 19,
    blurb: 'Student, maintenance loan plus bar shifts',
    storm: 'Loan runs out before the next instalment, and a gig she wants',
    balance,
    transactions: txns,
    gigs: [
      { artist: 'Maya Rivers', venue: 'O2 Academy Leeds', date: '2026-12-05', priceRange: [32, 45] },
      { artist: 'Lowlight', venue: 'Brudenell Social Club', date: '2027-02-26', priceRange: [18, 24] },
    ],
    profile: baseProfile({
      name: 'Kayla',
      account: 'kayla',
      postcode: 'LS2',
      job: 'Student + bar staff',
      jobTemplate: 'hospitality',
      payType: 'student',
      festivals: ['christmas', 'lunar-new-year'],
      connections: { spotify: true, calendar: false },
    }),
  };
}

let cache: Record<PersonaId, Persona> | null = null;

export function getPersonas(): Record<PersonaId, Persona> {
  cache ??= { sam: sam(), dev: dev(), amira: amira(), kayla: kayla() };
  return cache;
}

// Sam and Amira first: they are the two the demo is built around.
export const PERSONA_ORDER: PersonaId[] = ['sam', 'amira', 'dev', 'kayla'];

/** Static details for menus, safe to render on the server. */
export const PERSONA_META: Record<PersonaId, { name: string; age: number; blurb: string; storm: string }> = {
  sam: { name: 'Sam', age: 31, blurb: 'Software engineer, salaried, one child', storm: 'Mortgage fix ends in April' },
  dev: { name: 'Dev', age: 34, blurb: 'Warehouse nights, zero-hours, two kids', storm: 'Christmas, then a January drought' },
  amira: { name: 'Amira', age: 41, blurb: 'Self-employed plumber', storm: 'January tax bill and late-paying clients' },
  kayla: { name: 'Kayla', age: 19, blurb: 'Student with a loan and bar shifts', storm: 'Loan runs out before the next one lands' },
};

/** Which demo account a new user gets, based on how they're paid. */
export function accountFor(payType: Profile['payType']): PersonaId {
  if (payType === 'self-employed') return 'amira';
  if (payType === 'student') return 'kayla';
  if (payType === 'salaried') return 'sam';
  return 'dev';
}
