# Compute and store one day; equivalence test

State: ready-for-agent
Type: AFK
Repo: quicktricks-backend
Blocked by: 01
Parent: [Daily facts rollup](../../prd-dashboard-daily-rollup.md) — D1, D2, D7, D12

## What to build

In `src/services/dashboardDailyFacts.ts`:

- `computeDayFacts(day, deviceType, excludedSignupIds): Promise<DayFacts>` runs the three live
  aggregations over the one-day IST window with the same queries and scopes the loaders build
  (`customer_id`, `status: { $ne: 0 }`, `createdAt` window; device → `userScope` via the
  controller's `signupDeviceFor`; signups put `signup_device` in the user query). Strip `topPlans`.
  Use `.allowDiskUse(true)` and `readPreference('secondaryPreferred')` on the aggregations.
- `storeDayFacts(day, deviceType, facts)` → `replaceOne` by `_id` with upsert (D1, D7), stamping
  `version`, `computedAt`, `windowStart`, `windowEnd`.
- `computeAndStoreDay(day, excludedSignupIds)` does the three device variants for one day.
- Collection name `dashboard_daily_facts`, plain driver via `mongoose.connection.db`, no Mongoose
  model (the document is a bag of facets, not a domain entity). Index `{ customer_id: 1, deviceType: 1, day: 1 }`
  created by the cron's start (task 04); this task only exports `ensureDailyFactsIndexes()`.

## Acceptance criteria

- [ ] Equivalence integration test (`src/tests/integration/dashboardDailyFacts.integration.test.ts`)
  per the PRD's testing section: seed three IST days with a `pay_` sibling pair, an APX capture
  that re-dates an order to the next day (see how `dashboardAccounting.integration.test.ts` seeds
  `apx_transactions`), a free grant, a failed order, an Apple sandbox order, an extension and an
  exchange order, users across devices and states. Compute all three days for all three devices.
  For each pipeline and device, `mergeDayFacts(days)` deep-equals the live range pipeline over the
  same three days after the registry sort is applied to both. Also assert one- and two-day
  sub-ranges.
- [ ] Idempotence: computing a day twice leaves one document with identical facets and a newer
  `computedAt`.
- [ ] Suites at baseline; `npx tsc --noEmit` clean; commit `feat(dashboard): compute and store daily facts`.
