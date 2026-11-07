-- Stagger: the outside world, as data.
--
-- Nothing personal lives here. Customer transactions and onboarding answers
-- stay in the bank / the browser; this database holds what is true for
-- everyone (prices, policy, rates, weather, news) and the rules that turn it
-- into a forecast for one person.

-- ─── Reference data ──────────────────────────────────────────────────────

create table categories (
  id    text primary key,          -- matches Category in src/lib/types.ts
  label text not null
);

create table regions (
  id    text primary key,          -- e.g. 'yorkshire'
  name  text not null,
  lat   numeric(7, 4) not null,    -- a representative point, for weather
  lon   numeric(7, 4) not null
);

-- First part of a postcode -> region. Users give only this (e.g. "LS6"),
-- never a full address.
create table postcode_areas (
  area      text primary key,      -- 'LS', 'BD', 'S'
  region_id text not null references regions(id)
);

create table job_templates (
  id          text primary key,    -- matches JobTemplateId
  label       text not null,
  note        text not null,
  seasonality numeric(4, 2)[] not null check (array_length(seasonality, 1) = 12)
);

-- How weather moves income for a kind of job. effect = relative change in
-- pay on a day that meets the condition (-0.3 = 30% less work).
create table job_weather_effects (
  job_template_id text not null references job_templates(id),
  condition       text not null check (condition in ('heavy_rain', 'snow', 'freezing', 'heatwave', 'storm')),
  effect          numeric(4, 2) not null,
  note            text not null,
  primary key (job_template_id, condition)
);

create table festivals (
  id        text primary key,
  label     text not null,
  lead_days int  not null
);

create table festival_dates (
  festival_id text not null references festivals(id),
  date        date not null,
  approximate boolean not null default false,  -- moon-sighted dates
  primary key (festival_id, date)
);

-- Transaction categorisation rules, tried in priority order.
create table merchant_rules (
  id          serial primary key,
  priority    int  not null default 100,
  mcc         text,
  pattern     text,                -- case-insensitive regex on the merchant name
  category_id text not null references categories(id),
  check (mcc is not null or pattern is not null)
);

-- ─── Official, scheduled changes ─────────────────────────────────────────

-- Tax, benefits, wages, fares, bills: anything a government or regulator
-- announces with a date.
create table policy_changes (
  id                  text primary key,
  title               text not null,
  kind                text not null check (kind in ('tax', 'benefit', 'wage', 'fare', 'bill', 'regulation')),
  category_id         text references categories(id),   -- null = affects income, not a spending category
  effective_date      date not null,
  change_pct          numeric(6, 4),                     -- 0.05 = +5%
  change_amount       numeric(10, 2),                    -- flat change in pounds
  amount_unit         text check (amount_unit in ('per_month', 'per_week', 'per_journey', 'one_off', 'per_year')),
  applies_to_pay_types text[],                           -- null = everyone
  applies_to_regions  text[],                            -- null = whole UK
  status              text not null default 'announced' check (status in ('expected', 'announced', 'confirmed', 'in_force')),
  source_url          text,
  notes               text,
  verified_at         timestamptz,                        -- set when a human has checked it against the source
  check (change_pct is not null or change_amount is not null)
);
create index on policy_changes (effective_date);

create table rate_decisions (
  date        date primary key,
  body        text not null default 'Bank of England MPC',
  bank_rate   numeric(5, 2),                              -- null until announced
  expectation text,
  confidence  text not null check (confidence in ('certain', 'likely', 'signal')),
  source_url  text
);

-- ─── Time series we analyse ourselves ────────────────────────────────────

-- Brent crude, UK pump prices, CPI by category, bus fares index, Bank Rate...
create table market_series (
  id          text primary key,    -- 'brent_usd', 'uk_petrol_ppl', 'cpi_groceries'
  label       text not null,
  unit        text not null,       -- 'USD/bbl', 'pence/litre', 'annual %'
  category_id text references categories(id),
  source_url  text
);

create table market_points (
  series_id text not null references market_series(id),
  date      date not null,
  value     numeric(12, 4) not null,
  primary key (series_id, date)
);

-- ─── Weather ─────────────────────────────────────────────────────────────

create table weather_daily (
  region_id   text not null references regions(id),
  date        date not null,
  t_min       numeric(4, 1),
  t_max       numeric(4, 1),
  precip_mm   numeric(5, 1),
  snow_cm     numeric(5, 1),
  wind_max_kph numeric(5, 1),
  is_forecast boolean not null,
  fetched_at  timestamptz not null default now(),
  primary key (region_id, date)
);

-- Long-run normals per month: what a "normal" January looks like here.
create table weather_normals (
  region_id           text not null references regions(id),
  month               int  not null check (month between 1 and 12),
  t_mean              numeric(4, 1) not null,
  precip_mm           numeric(6, 1) not null,
  heating_degree_days numeric(6, 1) not null,
  rain_days           numeric(4, 1) not null,
  primary key (region_id, month)
);

-- ─── News → signals ──────────────────────────────────────────────────────

create table sources (
  id         text primary key,
  name       text not null,
  kind       text not null check (kind in ('rss', 'api', 'manual')),
  url        text,
  trust      text not null check (trust in ('official', 'press')),
  active     boolean not null default true
);

create table headlines (
  id           bigserial primary key,
  source_id    text not null references sources(id),
  guid         text not null,
  title        text not null,
  summary      text,
  url          text,
  published_at timestamptz,
  fetched_at   timestamptz not null default now(),
  processed_at timestamptz,
  unique (source_id, guid)
);
create index on headlines (published_at desc);
create index on headlines (processed_at) where processed_at is null;

-- What actually moves prices: an oil supply shock, a shipping disruption,
-- a strike, a fare review. Headlines map to drivers; drivers map to categories.
create table drivers (
  id    text primary key,          -- 'oil_supply', 'shipping', 'transport_fares'
  label text not null
);

create table driver_keywords (
  id        serial primary key,
  driver_id text not null references drivers(id),
  pattern   text not null,         -- case-insensitive regex on title + summary
  weight    numeric(3, 2) not null default 1
);

-- The analysis: how a driver passes through to what people pay, how fast,
-- and for how long. Built from history in market_points where we have it.
create table impact_rules (
  driver_id     text not null references drivers(id),
  category_id   text not null references categories(id),
  pct_low       numeric(6, 4) not null,
  pct_high      numeric(6, 4) not null,
  lag_days      int not null,      -- headline to the till
  duration_days int not null,
  rationale     text not null,
  evidence_url  text,
  primary key (driver_id, category_id)
);

-- What the app reads. Proposed by the pipeline, made live by a person.
create table signals (
  id             bigserial primary key,
  driver_id      text references drivers(id),
  headline_id    bigint references headlines(id),
  category_id    text not null references categories(id),
  title          text not null,
  pct_low        numeric(6, 4) not null,
  pct_high       numeric(6, 4) not null,
  effective_from date not null,
  effective_to   date,
  region_id      text references regions(id),           -- null = whole UK
  confidence     text not null check (confidence in ('certain', 'likely', 'signal')),
  method         text not null check (method in ('official', 'rule', 'llm', 'series')),
  status         text not null default 'proposed' check (status in ('proposed', 'live', 'rejected', 'expired')),
  explanation    text not null,
  source_url     text,
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);
create index on signals (status, effective_from);
create unique index signals_one_per_headline on signals (headline_id, category_id) where headline_id is not null;

-- Things people might spend on: gigs from a Spotify match, matches, shows.
create table events_catalog (
  id          text primary key,
  kind        text not null check (kind in ('gig', 'sport', 'show', 'festival')),
  name        text not null,
  venue       text,
  region_id   text references regions(id),
  date        date not null,
  price_low   numeric(8, 2),
  price_high  numeric(8, 2),
  source_url  text
);

-- ─── Operations ──────────────────────────────────────────────────────────

create table ingest_runs (
  id          bigserial primary key,
  job         text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  items       int,
  error       text
);

-- Every Claude call, so the team can see the credit burn.
create table llm_usage (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  purpose       text not null,
  model         text not null,
  input_tokens  int not null,
  output_tokens int not null,
  cost_usd      numeric(8, 5) not null
);
