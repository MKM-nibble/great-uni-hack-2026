# Great Uni Hack 2026: Stagger

**Track:** NatWest, AI-Powered Financial Inclusion & Resilience · also opted in for **Overall winners**

> Your bank balance has a weather forecast. Stagger sees the storm coming weeks ahead,
> and helps people with uneven income get through it.

## The problem

Budgeting apps assume a steady monthly salary. Millions of people don't get one: shift and
zero-hours workers, the self-employed, and students living on termly loans plus casual work.
For them, the problem isn't overspending. It's **timing**: money comes in at different times
from when bills go out. A bad January, a tax bill, or a loan that runs out in week 9 of term
can push them into overdraft fees, high-cost credit, or missed bills.

## The idea in one line

A **financial time machine**: one forecast timeline of your balance for the next 90 days,
built from your own past income and spending plus known future events. It marks the danger
weeks and gives you a few small, specific actions to get through them.

## One idea ties it together: everything is an event on the timeline

| Source | Example event | Data (MVP) |
| --- | --- | --- |
| Past income pattern | "Peak season ends, shifts drop ~40% in Jan" | Synthetic 12-month transactions per persona |
| Past spending | "Weekly food shop ≈ £62" | Same |
| Calendar | Birthdays, Christmas, Eid, Diwali, a concert | Built-in UK + religious calendars, user adds own |
| Industry / life pattern | Self-assessment tax due 31 Jan, loan instalment dates | Rules per persona type |
| Market / prices | Ofgem price cap change, CPI food inflation | Static snapshot of public data (ONS, Ofgem) |
| Interest rates | BoE base rate decision changes your overdraft or savings | Static snapshot plus announced dates |

The **forecast engine is deterministic TypeScript**, not the LLM. Claude only does two jobs:

1. **Onboarding:** turn plain-English answers ("I do nights at a warehouse, paid weekly,
   usually £350–£450") into a structured profile.
2. **Coaching:** explain the forecast in plain words and suggest actions, with a short
   reason for every claim.

That split keeps the numbers checkable, the API costs tiny, and the demo safe.

## MVP features (build these)

1. **Time Machine timeline:** a 90-day balance forecast with a **confidence band**
   (a range, not a single fake-precise line) and danger zones shaded.
2. **Safe to spend today:** one number, adjusted for what's coming.
3. **Pay yourself a salary:** income smoothing. Stagger suggests a steady weekly amount to
   move from a buffer pot into everyday spending, so a lumpy income feels like a salary.
   This is the headline feature for irregular earners.
4. **What-if:** "pick up 2 extra shifts", "buy the £85 concert ticket", "skip the takeaway".
   Drag it onto the timeline and watch the danger zone move.
5. **Early warning + support routes:** when hardship is forecast, show real options
   (talk to the bank early, a Breathing Space referral, a benefits check, a free debt-advice
   charity), not just "spend less".
6. **"Why am I seeing this?"** on every insight: the transactions and assumptions behind it.

### Nice to have (only if the MVP is solid)

- **Universal Credit pay-date clash:** irregular pay can mean two paydays land in one UC
  assessment period and the next payment drops. Stagger warns about it. Very specific and
  real, and it shows we understand the users.
- Plain-English / reading-level toggle and other languages (Claude translates the coaching).
- A voice briefing ("Your week ahead…").
- CSV statement upload so someone can try it with their own data.

### Out of scope (say so honestly in the demo)

Real Open Banking connection, auth, live market feeds, regulated financial advice. In
production the data would come from the user's NatWest account, so **setup would be zero
steps**. That's our feasibility story.

## Demo personas (one switcher, three angles)

| Persona | Income shape | The storm Stagger catches |
| --- | --- | --- |
| **Dev, 34**, warehouse nights, zero-hours, 2 kids | Weekly, swings with season | Peak season ends just as Christmas and a kid's birthday hit, then a January drought |
| **Amira, 41**, self-employed plumber | Lumpy invoices, late payers | Self-assessment tax bill + payment on account on 31 Jan, plus Eid spending |
| **Kayla, 19**, student, bar shifts | Maintenance loan 3x a year + casual pay | Loan runs out in week 9 of term, and a concert ticket she wants |

**Make it memorable: the backtest.** Rewind Dev's last 12 months and show that Stagger
*would have* warned him 6 weeks before he actually went overdrawn last January, and that
paying himself a salary would have avoided it. That's the "time travel" moment, and it
shows the prediction works instead of just claiming it does.

## Suggested demo (3 min)

1. (20s) The problem: one sentence and Dev's real-looking January crash.
2. (40s) Onboarding: Dev types two sentences, Claude builds his profile, and the timeline appears.
3. (60s) The time machine: danger zone, "why", pay-yourself-a-salary, a what-if drag.
4. (30s) Backtest rewind: "it would have warned him 6 weeks early."
5. (20s) Switch to Amira, then Kayla: same engine, different storms.
6. (10s) What's real, what's mocked, and how it plugs into NatWest.

## Tech

- **Next.js + TypeScript + Tailwind**, one app, deployed on Vercel.
- `forecast/`: pure TS engine (income model, recurring bills, calendar events, price and
  rate adjustments, confidence band). Unit-testable, no AI.
- `data/`: seeded persona transactions and public-data snapshots (JSON).
- `/api/coach`: a server route that calls Claude. The **API key stays on the server** and
  is never committed (`.env.local`).

### Claude budget (~$25): rules

- Use a small, fast model for onboarding parsing and a bigger one only for coaching text.
- **Pre-generate and cache** each persona's coaching output to JSON. The demo runs with no
  live calls, and live calls are a bonus only for the "type your own" onboarding.
- Keep prompts short, send summaries rather than raw transactions, and cap `max_tokens`.
- Build with a mock response first. Only switch on the real API when the UI is done.

## Design

A clean, bank-grade look in the spirit of NatWest's app: deep purple, lots of white space,
calm cards, one clear action per screen, accessible contrast and large tap targets.
Use our own wordmark ("Stagger") with a "NatWest challenge prototype" label rather than
copying NatWest's logo or pretending to be their real site. Check with the NatWest mentors
on the day about what branding they're happy with.

## How it scores

| Criterion | Where we earn it |
| --- | --- |
| Problem & Impact / Social impact | Specific under-served groups, timing not blame, support routes |
| Technical execution / Use of AI & data | Real forecast engine + backtest; AI where it adds value, not everywhere |
| Creativity | Everything is an event on one timeline; pay-yourself-a-salary; UC clash |
| Design / Customer focus | Plain-English onboarding, one number, clean bank-grade UI |
| Presentation / Feasibility | Honest about mocks; zero-setup story through existing bank data |
