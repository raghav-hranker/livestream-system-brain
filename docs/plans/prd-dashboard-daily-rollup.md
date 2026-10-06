# Daily facts rollup for the analytics dashboard

State: ready-for-agent
Date: 2026-10-06
Repo: quicktricks-backend (fork, branch `feat/dashboard-daily-rollup` from `origin/quicktricks-admin` 3b9b385bc)
Tasks: [docs/plans/tasks/dashboard-daily-rollup/](tasks/dashboard-daily-rollup/README.md)

## Problem

Every range on the admin Analytics Dashboard is computed from the raw `orders` and `users`
collections at request time. The order pipeline is prefixed by the payment-reconciliation prelude
(`dashboardPaymentScope`), which re-dates paid orders to their APX capture date and dedupes sibling
orders per payment. That prelude has to touch every order in the window before it can group, so
the cost grows with the number of orders in range and no index can shorten it.

Measured on prod with the cache bypassed (memory `dashboard-perf-work-state`, 2026-09-20): a cold
30-day view takes about 8.5 s and a cold 90-day view about 20 s. The 20-minute Redis cache and the
20-minute prewarm hide this most of the time, but every cache miss, every custom range and every
first load after a deploy pays it, and the financial-year view pays the most.

Measured on prod on 2026-10-06 (read-only, secondaryPreferred): the same pipelines restricted to a
single IST day take 0.5 to 1.2 s for orders and about 0.1 s for signups, per device variant.
Orders exist from January 2023 (six rows carry an epoch-zero date and are ignored).

## Solution

Materialise one **facts document per completed IST day** and answer any range by summing the
documents for the days it covers. Today is never stored. It is computed live over a one-day
window, which is already fast, and merged with the stored days.

The decisive property: the one-day pipeline over day D returns exactly the payment groups whose
final (reconciled) date falls on D, because the prelude seeds from both orders and APX captures in
the window and then applies the date match after reconciliation. So the sum over days of the
one-day result equals the range result by construction. The rollup therefore stores the **raw
facet rows** that the existing pipelines return, unchanged, and the range read is a generic keyed
sum of those rows. No business rule is re-expressed.

Scope: the four section endpoints the admin calls (`/signups`, `/transactions`,
`/transaction-summary`, `/order-types`) for the device filters `all`, `web`, `mobile` with no
state or city filter. Location-filtered requests, the records drilldowns and the test-analytics
endpoints keep their live path untouched.

## User stories

1. As an administrator, I want the 30-day, 90-day and financial-year views to load in about the time today's view loads, so that long-range reporting stops waiting on the database.
2. As an administrator, I want every number on a rolled-up view to equal what the live computation would return, so that the speed-up never changes a figure I report.
3. As an administrator, I want today's numbers to stay as fresh as they are now, so that rolling up history does not make the live day stale.
4. As an administrator, I want a custom date range to be fast too, so that one-off investigations get the same benefit.
5. As an administrator, I want a late APX capture or an order whose status changes days later to be reflected in the dashboard within a day, so that recent history self-corrects.
6. As a platform operator, I want the backfill to run in the background in bounded slices, so that the API never stalls while history is being built.
7. As a platform operator, I want a request to fall back to the live computation when a day is missing or stale, so that the dashboard is never wrong, only occasionally slower.
8. As a platform operator, I want one command that rebuilds any day range and one command that proves parity against the live pipeline on real data, so that a rule change can be rolled out and checked without hand work.
9. As a maintainer, I want a change to any dashboard pipeline to invalidate the stored days automatically, so that a stale rollup cannot survive a rule change.

## Implementation decisions

- **D1. Collection and key.** `dashboard_daily_facts`, one document per
  `(customer_id, day, deviceType)` where `day` is the IST calendar day `YYYY-MM-DD` and
  `deviceType ∈ {all, web, mobile}`. `_id` is `${customer_id}:${day}:${deviceType}`. Unique by
  construction, so an upsert is idempotent.
- **D2. Document body is the raw facet output.** Fields `orders`, `signups`, `orderTypes` hold
  exactly what `orderAnalyticsPipeline(dayQuery, true, true, true, scope)`,
  `userAnalyticsPipeline(dayQuery, true, true, excludedIds)` and the order-types aggregation
  return for that day, minus `topPlans` (derived at read, see D5). Plus `version`, `computedAt`,
  `windowStart`, `windowEnd`.
- **D3. Version stamp.** `DASHBOARD_FACTS_VERSION` is a constant next to the pipelines. Any change
  to a dashboard pipeline, scope stage or facet bumps it. Readers ignore documents with another
  version; the cron recomputes them.
- **D4. The merge is a keyed sum, described by a registry.** A facet is a list of rows with an
  `_id` key and numeric fields. Merging days means grouping rows by `JSON.stringify(_id)`, summing
  every numeric field, then re-applying that facet's sort. One registry
  `FACETS: Record<facetName, { sort }>` lists every facet of the three pipelines with its sort
  order, so the loaders see rows in the order the live pipeline would have produced. `total` is
  the single-row facet `[{ count }]` and sums the same way. A facet missing from the registry is a
  startup error, not a silent drop.
- **D5. `topPlans` is derived, not stored.** It is `subscriptionRows` re-sorted by
  `amount desc, value desc, planId, fallback`, limited to 8, with `value→count`, `amount→revenue`
  and the plan-less fallback label `Plan` replaced by `Unknown Plan`, which is the only difference
  between the two live facets.
- **D6. Read path.** A new service `dashboardDailyFacts` exposes one function per pipeline that
  takes the request context and returns the same facet object the live aggregation returns. Rule:
  - location filter present, or `timeRange === 'today'` → live pipeline, unchanged;
  - otherwise enumerate IST days in `[start, end]`; completed days (before today) are read from
    the collection; today is computed live over its one-day window; everything is merged (D4).
  - any completed day missing or at another version → **one** live pipeline over the contiguous
    span of missing days replaces those days. A request never writes the collection and never runs
    more than two aggregations per pipeline (one for the gap, one for today).
  The four loaders change only the line that ran the aggregation. Their post-processing, the
  response shape and the existing Redis section cache are untouched.
- **D7. Single writer.** Only the cron and the rebuild script write `dashboard_daily_facts`.
  Writes are `replaceOne` with `upsert` on `_id`.
- **D8. Refresh policy as a table.** Each cycle the cron selects days from the first order day
  through yesterday that need work, newest first, and processes them under a per-cycle budget
  (default 40 days or 90 s, whichever first):
  - missing or `version` mismatch → compute;
  - age 1–3 days and `computedAt` older than 15 minutes → compute (late captures, status changes);
  - age 4–35 days and `computedAt` older than 24 hours → compute;
  - older → leave alone.
  Each day computes its three device variants together. Schedule every 15 minutes under the Mongo
  `DistributedLock` pattern the other crons use (key `dashboard-daily-facts-cron-lock`), started
  with the other crons in `app.ts` and skipped when `DISABLE_CRONS=true`. Aggregations run with
  `readPreference: secondaryPreferred` like the hourly report script does.
- **D9. Rebuild lever.** `src/scripts/dashboardDailyFactsRebuild.ts --from YYYY-MM-DD --to YYYY-MM-DD [--device all|web|mobile]`
  recomputes the range through the same `computeDay` function the cron uses. Dry run prints the
  plan; `--commit` writes.
- **D10. Parity lever.** `src/scripts/dashboardDailyFactsParity.ts --ranges 7d,30d,90d,financial_year --devices all,web,mobile`
  runs each section loader twice, once through the rollup read path and once forcing the live
  path, and deep-compares `data` minus `generatedAt`. It prints the first differing path per
  view and exits non-zero on any difference. It never writes.
- **D11. Observability.** The cron logs one line per cycle: days considered, computed, skipped,
  duration, and one line per failed day. The read path logs nothing on the hot path except the
  existing cache lines.
- **D12. Signup identity snapshot.** `signupDuplicateIds` is read once per cycle and used for
  every day in that cycle, matching the live loader. The snapshot currently excludes zero ids on
  prod (measured 2026-10-06).

## Testing decisions

Tests cross the `dashboardDailyFacts` seam and the four section handlers, on the in-memory replica
set the existing dashboard integration tests use.

- **Merge unit tests.** Keyed sum over two days per facet, re-sort per registry entry, derived
  `topPlans` matches a live `topPlans` facet on the same rows, registry covers every facet name
  the three pipelines emit (assert by running each pipeline on seeded data and diffing key sets).
- **Equivalence integration test (the regression rule).** Seed orders across three IST days
  including a sibling pair under one `pay_` id, an APX capture whose date moves an order to the
  next day, a free grant, a failed order, an Apple sandbox order, users across devices and states.
  Compute the three day documents, then assert each section handler's `data` minus `generatedAt`
  is deep-equal between the rollup path and the forced live path for `custom` ranges covering
  one, two and three days and for each device.
- **Fallback tests.** A missing middle day and a version-mismatched day each produce a live
  range aggregation for exactly the gap and an unchanged response. A location filter never reads
  the collection. `today` never reads the collection. No test request writes the collection.
- **Policy tests.** The selection function returns the right days for a fixed `now` and a seeded
  mix of missing, stale-recent, stale-old and fresh documents, newest first, cut at the budget.
- **Idempotence test.** Computing a day twice yields one document with identical facets.
- **Scripts.** Rebuild dry run prints the plan without writing; parity script exits non-zero on
  a seeded mismatch.

## Out of scope

- Rolling up location-filtered views (state or city). They stay live. The facts documents carry
  state and city rows for the unfiltered views only.
- Rolling up the records drilldowns, the test-analytics endpoints or the full `/` summary.
- Removing the Redis section cache or the prewarm. Both stay. Retiring the prewarm is a follow-up
  once the rollup is deployed and the cold numbers are measured.
- Changing any response field, filter name or business rule.
- Deployment. The surgical `dist` commit, push and box pull follow the repo's deploy discipline
  and are a separate, confirmed step.

## Further notes

Completed days older than 35 days freeze. An admin data fix that touches older orders needs the
rebuild lever (D9) for the affected range. The parity lever (D10) is the acceptance gate before
the deploy and after any version bump.

Follow the fork exception in [BRANCHES.md](../../BRANCHES.md). Prod access and deploy rules live
in the memory notes `quicktricks-prod-box` and `quicktricks-backend-dist-deploy`.
