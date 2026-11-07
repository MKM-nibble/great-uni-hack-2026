// Reference data that isn't already in src/: regions, weather effects,
// drivers, keywords, impact rules, sources and policy changes. Loaded by
// scripts/db-seed.mts. Edit here (or in the database) and re-seed.
//
// ⚠ Rows marked `verify` must be checked against their source before the demo.

export const REGIONS = [
  { id: 'yorkshire', name: 'West & North Yorkshire', lat: 53.8008, lon: -1.5491, areas: ['LS', 'BD', 'HX', 'HD', 'WF', 'YO', 'HG'] },
  { id: 'south-yorkshire', name: 'South Yorkshire', lat: 53.3811, lon: -1.4701, areas: ['S', 'DN'] },
  { id: 'greater-manchester', name: 'Greater Manchester', lat: 53.4808, lon: -2.2426, areas: ['M', 'OL', 'BL', 'SK', 'WN'] },
  { id: 'london', name: 'London', lat: 51.5072, lon: -0.1276, areas: ['E', 'EC', 'N', 'NW', 'SE', 'SW', 'W', 'WC'] },
  { id: 'west-midlands', name: 'West Midlands', lat: 52.4862, lon: -1.8904, areas: ['B', 'WV', 'CV', 'WS', 'DY'] },
  { id: 'east-midlands', name: 'East Midlands', lat: 52.9548, lon: -1.1581, areas: ['NG', 'LE', 'DE'] },
  { id: 'north-east', name: 'North East', lat: 54.9783, lon: -1.6178, areas: ['NE', 'SR', 'DH'] },
  { id: 'south-west', name: 'South West', lat: 51.4545, lon: -2.5879, areas: ['BS', 'BA', 'EX', 'PL'] },
  { id: 'wales', name: 'Wales', lat: 51.4816, lon: -3.1791, areas: ['CF', 'SA', 'NP'] },
  { id: 'scotland', name: 'Scotland', lat: 55.8642, lon: -4.2518, areas: ['G', 'EH', 'AB', 'DD'] },
  { id: 'northern-ireland', name: 'Northern Ireland', lat: 54.5973, lon: -5.9301, areas: ['BT'] },
];

export const JOB_WEATHER_EFFECTS = [
  { job: 'trades', condition: 'heavy_rain', effect: -0.25, note: 'Outdoor jobs get postponed' },
  { job: 'trades', condition: 'snow', effect: -0.6, note: 'Most site and outdoor work stops' },
  { job: 'trades', condition: 'freezing', effect: 0.15, note: 'Burst pipes and boiler call-outs rise' },
  { job: 'trades', condition: 'storm', effect: -0.4, note: 'Roof and outdoor work is unsafe' },
  { job: 'gig-delivery', condition: 'heavy_rain', effect: 0.15, note: 'More people order in when it rains' },
  { job: 'gig-delivery', condition: 'snow', effect: -0.3, note: 'Riding gets unsafe, fewer slots' },
  { job: 'gig-delivery', condition: 'storm', effect: -0.2, note: 'Platforms pause deliveries in high winds' },
  { job: 'hospitality', condition: 'heatwave', effect: 0.2, note: 'Beer gardens and terraces fill up' },
  { job: 'hospitality', condition: 'heavy_rain', effect: -0.1, note: 'Fewer walk-ins' },
  { job: 'warehouse-retail', condition: 'snow', effect: -0.1, note: 'Some shifts are cancelled' },
  { job: 'care', condition: 'snow', effect: -0.05, note: 'Visits harder to reach' },
];

export const MERCHANT_RULES = [
  { pattern: 'COUNCIL TAX', category: 'council-tax', priority: 10 },
  { pattern: 'HMRC', category: 'tax', priority: 10 },
  { pattern: 'MORTGAGE', category: 'mortgage', priority: 10 },
  { pattern: 'COSTA|STARBUCKS|PRET|CAFFE NERO', category: 'coffee', priority: 20 },
  { pattern: 'FIRST BUS|STAGECOACH|ARRIVA|GO AHEAD|NATIONAL EXPRESS|TFL', category: 'public-transport', priority: 20 },
  { pattern: 'SHELL|BP |ESSO|TEXACO|JET |MFG', category: 'fuel', priority: 20 },
  { mcc: '6513', category: 'rent' },
  { mcc: '4900', category: 'energy' },
  { mcc: '4814', category: 'phone' },
  { mcc: '4899', category: 'subscriptions' },
  { mcc: '7997', category: 'subscriptions' },
  { mcc: '5411', category: 'groceries' },
  { mcc: '5812', category: 'eating-out' },
  { mcc: '5813', category: 'eating-out' },
  { mcc: '5814', category: 'eating-out' },
  { mcc: '4111', category: 'public-transport' },
  { mcc: '4131', category: 'public-transport' },
  { mcc: '5541', category: 'fuel' },
  { mcc: '5542', category: 'fuel' },
  { mcc: '7922', category: 'entertainment' },
  { mcc: '8351', category: 'childcare' },
  { mcc: '5200', category: 'trade-supplies' },
];

export const DRIVERS = [
  { id: 'oil_supply', label: 'Oil supply shock' },
  { id: 'shipping', label: 'Shipping disruption' },
  { id: 'wholesale_gas', label: 'Wholesale gas prices' },
  { id: 'food_commodities', label: 'Food commodity prices' },
  { id: 'transport_fares', label: 'Public transport fares' },
  { id: 'transport_strikes', label: 'Transport strikes' },
  { id: 'tax_policy', label: 'Tax and benefit changes' },
  { id: 'interest_rates', label: 'Interest rates' },
];

// Matched against headline title + summary, case-insensitive.
export const DRIVER_KEYWORDS: [string, string][] = [
  ['oil_supply', 'hormuz|opec|brent|crude oil|oil (price|supply|output)s?|refiner|petrol price|diesel price'],
  ['shipping', 'red sea|houthi|yemen|suez|bab el-mandeb|shipping (route|lane|disruption)|container (rates|shipping)'],
  ['wholesale_gas', 'wholesale gas|gas prices?|lng|price cap'],
  ['food_commodities', 'poor harvest|harvest (fail|warning)|drought|cocoa|coffee (bean|price)s?|wheat price|food (prices|inflation)|grocery (prices|inflation)|(milk|dairy|butter) prices'],
  ['transport_fares', 'bus fares?|fare cap|rail fares?|train fares?|ticket prices'],
  ['transport_strikes', '(rail|train|bus|tube) strikes?|walkout'],
  ['tax_policy', 'budget|income tax|national insurance|vat|fuel duty|personal allowance|universal credit'],
  ['interest_rates', 'bank of england|interest rates?|bank rate|base rate|mpc'],
];

// How a driver reaches the till. Ranges are deliberately wide until
// calibrated against market_points (e.g. Brent vs UK pump prices).
export const IMPACT_RULES = [
  { driver: 'oil_supply', category: 'fuel', low: 0.02, high: 0.08, lag: 10, duration: 60, rationale: 'UK pump prices usually follow crude oil within one to three weeks' },
  { driver: 'oil_supply', category: 'public-transport', low: 0, high: 0.02, lag: 120, duration: 365, rationale: 'Operators pass fuel costs into fares slowly, at the next fare review' },
  { driver: 'shipping', category: 'fuel', low: 0.01, high: 0.04, lag: 14, duration: 45, rationale: 'Rerouted tankers add cost and delay to fuel imports' },
  { driver: 'shipping', category: 'groceries', low: 0.005, high: 0.02, lag: 45, duration: 120, rationale: 'Longer routes raise import costs for food and goods' },
  { driver: 'wholesale_gas', category: 'energy', low: 0.02, high: 0.1, lag: 90, duration: 90, rationale: 'Wholesale moves feed into the next quarterly Ofgem price cap' },
  { driver: 'food_commodities', category: 'groceries', low: 0.01, high: 0.03, lag: 60, duration: 180, rationale: 'Commodity costs reach shelves over a few months' },
  { driver: 'food_commodities', category: 'coffee', low: 0.03, high: 0.1, lag: 90, duration: 180, rationale: 'Coffee shops reprice after bean costs stay high' },
  { driver: 'transport_fares', category: 'public-transport', low: 0.03, high: 0.1, lag: 30, duration: 365, rationale: 'Announced fare changes apply from the stated date' },
  { driver: 'transport_strikes', category: 'public-transport', low: 0, high: 0.05, lag: 0, duration: 14, rationale: 'Strike days mean taxis or lifts instead of the usual ticket' },
];

export const SOURCES = [
  { id: 'bbc-business', name: 'BBC News: Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', trust: 'press' },
  { id: 'guardian-business', name: 'The Guardian: Business', url: 'https://www.theguardian.com/uk/business/rss', trust: 'press' },
  { id: 'boe-news', name: 'Bank of England: News', url: 'https://www.bankofengland.co.uk/rss/news', trust: 'official' },
  { id: 'govuk-treasury', name: 'GOV.UK: HM Treasury', url: 'https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=hm-treasury', trust: 'official' },
  { id: 'govuk-dft', name: 'GOV.UK: Department for Transport', url: 'https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=department-for-transport', trust: 'official' },
];

// Beyond the scheduled bill changes in src/data/prices.ts.
export const EXTRA_POLICY_CHANGES = [
  {
    id: 'rail-fares-mar', title: 'Regulated rail fares change', kind: 'fare', category: 'public-transport',
    date: '2027-03-01', pct: 0.04, status: 'expected', source: 'https://www.gov.uk/government/organisations/department-for-transport',
    notes: 'verify: the rise is set each year, usually announced in the autumn',
  },
  {
    id: 'bus-fares-jan', title: 'Bus fare cap review', kind: 'fare', category: 'public-transport',
    date: '2027-01-01', pct: 0.05, status: 'expected', source: 'https://www.gov.uk/government/organisations/department-for-transport',
    notes: 'verify: check the current England single-fare cap and any planned change',
  },
  {
    id: 'nlw-apr', title: 'National Living Wage rises', kind: 'wage', category: null,
    date: '2027-04-01', pct: 0.04, status: 'expected', payTypes: ['hourly', 'zero-hours'],
    source: 'https://www.gov.uk/national-minimum-wage-rates', notes: 'verify: confirmed in the Autumn Budget',
  },
];

export const MARKET_SERIES = [
  { id: 'brent_usd', label: 'Brent crude', unit: 'USD/bbl', category: 'fuel', source: 'https://www.eia.gov/dnav/pet/hist/rbrteD.htm' },
  { id: 'uk_petrol_ppl', label: 'UK unleaded pump price', unit: 'pence/litre', category: 'fuel', source: 'https://www.gov.uk/government/statistics/weekly-road-fuel-prices' },
  { id: 'uk_diesel_ppl', label: 'UK diesel pump price', unit: 'pence/litre', category: 'fuel', source: 'https://www.gov.uk/government/statistics/weekly-road-fuel-prices' },
  { id: 'boe_bank_rate', label: 'Bank Rate', unit: '%', category: null, source: 'https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp' },
];
