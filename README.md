# Great Uni Hack 2026: Stagger by NatWest

**Track:** NatWest, AI-Powered Financial Inclusion & Resilience · also opted in for **Overall winners**

> Your bank balance has a weather forecast. Stagger sees the storm coming weeks ahead,
> and helps you get through it.

## The problem

Budgeting apps look backwards and assume a steady monthly salary. Stagger looks **forwards**,
and works for **everyone**: salaried people still get hit by price rises, rate changes,
Christmas and weddings. But it's **built first for the people traditional tools fail**:
shift and zero-hours workers, the self-employed, and students. For them, the problem isn't
overspending. It's **timing**: money comes in at different times from when bills go out.

## How it works for the user (3 steps, then the forecast)

1. **Your job:** *what do you do?* (free text with suggestions: "warehouse operative",
   "plumber", "nurse").
2. **How are you paid?** Salaried · Hourly / shifts · Zero-hours · Self-employed · Student ·
   Not working / benefits.
3. **Your calendar (optional, mocked):** connect a calendar and Stagger picks up upcoming
   dates, events and trips. There's always a "Skip".

Then **your Time Machine:** a 90-day forecast, danger zones, and 2–3 actions.

## What the app does with that: modules switch on from the answers

| Module | Who gets it | What it does |
| --- | --- | --- |
| **Spending baseline** | Everyone | Regular bills and typical spend per category from past transactions |
| **Future prices & rates** | Everyone | Upcoming price rises and rate changes, **filtered to what you actually spend on** |
| **Life events** | Everyone | Birthdays, festivals, gigs and trips from the calendar, Spotify and chips |
| **Income forecast** | Hourly · Zero-hours · Self-employed · Student | Predicts income swings from past pay and a seasonal template for the job |
| **Pay yourself a salary** | Anyone with an income forecast | A steady weekly amount moved from a buffer pot |

Salaried users get a flat income line and skip the income module entirely. The answer to
"how are you paid?" decides this, which is simple, transparent and easy to explain.

**Seasonal templates per job** (a small JSON file): warehouse / retail (peak in Nov–Dec, dip
in Jan), hospitality (summer and December peaks), construction / trades (winter dip, late
invoices), care / nursing (steady, with overtime spikes). Each template is a starting
guess; the user's own pay history overrides it.

## Future prices & rates: where the predictions come from

Three tiers, most reliable first. Every card shows its **source and a confidence level**.

1. **Scheduled and certain:** the Ofgem energy price cap (announced in advance), April rises
   (council tax, phone contracts at CPI+, minimum wage), rail fares, Bank of England meeting
   dates. Stored as a JSON calendar.
2. **Official trends:** ONS CPI inflation by category (food, transport, energy…) applied to
   the user's own category spend.
3. **News signals:** a curated batch of recent headlines that Claude reads **once, before
   the demo**, extracting `{category, direction, rough size, confidence, source link}`.
   We cache the result and never call it live. Cards say "Signal from the news, low confidence".

**Personal, not generic:** we only show a price card when it touches the user's spending.
For example: "You spend about £48 a month on coffee. Coffee prices are forecast to rise
~10%: that's about £5 a month." No coffee spend, no card.

## Connectors: what's real, what's mocked

| Connector | Status | How |
| --- | --- | --- |
| NatWest account | Mocked | Seeded 12 months of transactions in **Open Banking JSON shape** |
| Spotify → gigs | **Real if time allows**, cached fallback | Spotify top artists → Ticketmaster Discovery API (free key) for UK gigs → "Your top artist plays Manchester on 14 Mar, tickets usually £45–£70" |
| Calendar | Mocked | A realistic connect flow (pick a provider, permissions, sync) that returns a fixed set of sample events. No real sign-in. `src/data/mock-calendar.ts` |
| Other AI assistants | **Not built**: a "coming soon" tile only | No consumer API exists, and pulling someone's AI chat history into a bank is a privacy red flag for judges |

## MVP features (build these)

1. **Time Machine timeline:** a 90-day balance forecast with a **confidence band** and shaded danger zones.
2. **Safe to spend today:** one number.
3. **Pay yourself a salary:** income smoothing for irregular earners.
4. **What-if:** "+2 shifts", "£65 gig ticket". The timeline updates instantly.
5. **Early warning + support routes:** talk to the bank early, Breathing Space, a benefits check, free debt advice.
6. **"Why am I seeing this?"** on every card: the transactions, sources and assumptions behind it.

**Out of scope (say so honestly):** real bank connection, auth, live news, regulated advice.

## Demo personas (one switcher)

The demo is built around **Sam** and **Amira**. Dev and Kayla stay in the switcher for questions.

| Persona | Pay type | The storm Stagger catches |
| --- | --- | --- |
| **Sam, 31**, software engineer, Leeds, one child *(demo)* | Salaried | Mortgage fix (1.89%) ends 1 Apr: +£273–£371/month at today's Bank Rate. The March bonus hides it; the 1-year view shows him overdrawn by August |
| **Amira, 41**, plumber, Sheffield *(demo)* | Self-employed | 31 Jan tax bill, live heavy-rain days cutting outdoor work, late invoices, then Eid |
| **Dev, 34**, warehouse nights, 2 kids | Zero-hours | Peak season ends as Christmas hits, then a January drought. The rewind shows Stagger warning him 17 weeks early |
| **Kayla, 19**, student, bar shifts | Student | Loan runs out before the 12 Jan instalment; bus fare changes; a Spotify-found gig |

## Suggested demo (3 min)

1. (20s) **The problem.** Budgeting apps look backwards and assume a steady salary. Real life doesn't work like that.
2. (60s) **Sam, the well-paid engineer.** Six months looks fine and the coach says "fine for now". Switch to **1 year**:
   the mortgage fix ends in April, the bonus hides it for a few months, and he's overdrawn by August.
   Tap *Why?* to show Bank Rate + lender margin. Then the what-ifs: **lock a rate now** + **pause the ISA**, and
   balance in a year goes from −£541 to +£2,600. Line: *this works for everyone, not just people in trouble.*
3. (60s) **Amira, the plumber.** Same engine, different storm: the January tax bill, plus *live* weather.
   "Heavy rain on 11–12 Nov: about −£63 pay" comes from today's forecast for Sheffield. 
4. (20s) **Rewind a year** (Dev, or whoever is on screen): "Stagger would have warned him 17 weeks early."
5. (20s) **Honesty.** Live data from Neon (news, weather, rates), a person approves every news signal,
   demo transactions are synthetic, and nothing personal is stored. In NatWest, setup is zero steps.

## Running it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

The app works fully **without an API key**: coaching falls back to built-in rules. To turn on
the AI coach, copy `.env.example` to `.env.local` and add `ANTHROPIC_API_KEY`.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the app locally |
| `pnpm build` | Production build (run it before pushing) |
| `pnpm lint` / `pnpm typecheck` | Checks |
| `pnpm inspect` | Print each persona's forecast, salary plan and backtest in the terminal |
| `pnpm precompute` | With `pnpm dev` running: pre-generate AI coaching for the 4 demo customers into `src/data/coach-cache.json`. **Run on demo morning and commit**, so the demo makes no live calls |
| `pnpm news` | Turn real headlines in `scripts/headlines.txt` into price signals (check them, then paste into `src/data/prices.ts`) |

## Database (Neon Postgres)

The outside world lives in a Neon project, **`great-uni-hack-2026`** (London, `aws-eu-west-2`).
Nothing personal is stored there: transactions stay in the (synthetic) bank account and onboarding
answers stay in the browser.

**Getting access (teammates):** get invited to the Neon org, then in the repo folder:

```bash
neon login
```
```bash
neon link --project-id dark-bonus-61945676 -y
```

This writes `DATABASE_URL` into `.env.local`. Ask for `CRON_SECRET` and `ADMIN_TOKEN` in the team chat.
Without a database the app still works on the built-in snapshot (the dashboard shows "Offline snapshot").

| Command | What it does |
| --- | --- |
| `pnpm db:migrate` | Apply `db/migrations/*.sql` |
| `pnpm db:seed` | Load reference data (safe to re-run) |
| `pnpm db:ingest headlines` | Fetch RSS (BBC, Guardian, BoE, GOV.UK), match price drivers, propose signals |
| `pnpm db:ingest weather` | 16-day Open-Meteo forecast for every region |
| `pnpm db:ingest weather-normals` | 10 years of history → monthly normals (run once) |

Then open **`/admin`** (with `ADMIN_TOKEN`) to review proposed signals: nothing reaches customers
until someone clicks **Make live**. The page also shows ingest runs and total Claude spend.
On Vercel, `vercel.json` runs the weather and headline jobs daily.

**How a headline becomes a price on someone's forecast**

1. **Keywords** (`driver_keywords`, free) spot candidate stories: "Strait of Hormuz", "bus fare cap", "Red Sea shipping".
2. **Judging**: one batched Claude call per run decides *relevant? up or down? how strongly?* Without a key,
   a simple up/down word check is used. Keywords alone get direction wrong: "Hormuz could reopen" means fuel gets *cheaper*.
3. **Impact rules** (`impact_rules`, ours) turn the driver into a range and a lag per category. For example,
   oil supply means fuel +2–8% after ~10 days, and buses +0–2% at the next fare review.
4. **A person approves it** in `/admin`. Then `/api/world` serves it, and only people who actually spend
   on that category see a card, sized to their own spend.

**Tables:** `regions`, `postcode_areas`, `job_templates`, `job_weather_effects`, `festivals`,
`festival_dates`, `merchant_rules`, `policy_changes` (tax, wages, fares, bills), `rate_decisions`,
`market_series` + `market_points` (CPI, Brent, pump prices, Bank Rate), `weather_daily`,
`weather_normals`, `sources`, `headlines`, `drivers`, `driver_keywords`, `impact_rules`, `signals`,
`events_catalog`, `ingest_runs`, `llm_usage`.

### Before the demo checklist

- [ ] Check Bank Rate (`BANK_RATE` in `src/data/prices.ts`, `boe_bank_rate` in the database) and the lender margin range
- [ ] Check every row in `policy_changes` and `rate_decisions` against its source, then set `verified_at` (cards say "not yet verified" until then)
- [ ] Run `pnpm db:ingest headlines` and `weather` on demo morning, and review signals in `/admin`
- [ ] Check festival dates in `src/data/calendar.ts`
- [ ] Drop NatWest's official logo into `public/` and swap it into `src/components/Header.tsx`
- [ ] `pnpm precompute` (add `LANGUAGES=English,Polski` to pre-generate more languages) and commit the cache

## Code map

| Path | What's there |
| --- | --- |
| `src/forecast/engine.ts` | The forecast: bill detection, income model with seasonality, festival learning, price adjustments, daily balance with a likely range, safe-to-spend, salary plan, one-year backtest |
| `src/forecast/insights.ts` | Turns a forecast into cards (each with "why" and a source) and what-if options |
| `src/forecast/categorise.ts` | Transaction categories from merchant codes and keywords |
| `src/data/personas.ts` | The 4 demo customers: 24 months of synthetic Open Banking-shaped transactions each |
| `src/data/jobs.ts` | Pay types and seasonal income templates per kind of job |
| `src/data/prices.ts` | Snapshot of price changes, CPI, BoE dates (seed data + offline fallback) |
| `src/data/world.ts` | The `World` type: everything outside the account that moves a forecast |
| `src/app/api/world` | Builds a person's `World` from the database (region, job, live signals, weather) |
| `src/ingest/` | RSS headlines → signals, Claude judging, Open-Meteo weather |
| `db/` | Schema migrations and reference data |
| `src/app/admin` | Signal review queue, ingest log, Claude spend |
| `src/data/mock-calendar.ts` | The mocked calendar provider list and sample events |
| `src/data/calendar.ts` | Festivals, learned festival spending, the self-assessment tax rule |
| `src/lib/claude.ts` | The only code that calls Claude (coach + job matching), with memo cache |
| `src/lib/spend-guard.ts` | Hard cap on live Claude calls per server (`STAGGER_MAX_CALLS`, default 150) |
| `src/app/start` | 3-step onboarding: job, pay type, calendar (saved in the browser only) |
| `src/components/Dashboard.tsx` | The Time Machine screen |

## Tech

- **Next.js 16 + TypeScript + Tailwind 4**, one app; deploys to Vercel as-is.
- The forecast runs **in the browser**: pure TypeScript, no AI.
- `/api/coach` and `/api/job` are the only server routes that call Claude. The **API key stays server-side** in `.env.local`, never committed.
- Claude only ever sees a ~300-token summary (pay type, job, a few totals and dates), never transactions.

### Claude budget (~$25): rules

- Claude does only three things: match a job the keyword rules don't recognise, extract the
  news signals (once, cached), and write the plain-English coaching (in 7 languages).
- **Nothing calls Claude on page load.** Demo customers load pre-generated coaching from
  `coach-cache.json`; anything else waits for someone to tap "Ask Stagger AI".
- Default model is `claude-opus-5-5` at low effort. One coaching call is roughly 1–2p.
  If credits run low, set `STAGGER_MODEL=claude-haiku-5-5` in `.env.local`.
- Answers are cached in memory, and `STAGGER_MAX_CALLS` caps live calls per server.

## Design

"Stagger by NatWest": NatWest purple and logo, lots of white space, calm cards, one clear
action per screen, accessible contrast and large tap targets. A small "Hackathon prototype ·
demo data" tag in the footer.

## How it scores

| Criterion | Where we earn it |
| --- | --- |
| Problem & Impact / Social impact | Works for everyone; built for under-served earners; support routes |
| Technical execution / AI & data | Real forecast engine + backtest; AI only where it adds value |
| Creativity | Modules switch on by pay type; prices personalised to your spend; Spotify → gigs |
| Design / Customer focus | 4 screens, big buttons, one number, "why" on everything |
| Presentation / Feasibility | Honest real-vs-mocked table; Open Banking-shaped data |
