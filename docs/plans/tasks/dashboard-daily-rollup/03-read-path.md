# Read path behind the four section loaders

State: ready-for-agent
Type: AFK
Repo: quicktricks-backend
Blocked by: 02
Parent: [Daily facts rollup](../../prd-dashboard-daily-rollup.md) — D3, D4, D5, D6

## What to build

- In `dashboardDailyFacts.ts`: `readOrderFacets(context)`, `readSignupFacets(context, excludedIds)`,
  `readOrderTypeFacets(context)` implementing D6. Shared core: `resolveRange(context)` returns
  `{ mode: 'live' } | { mode: 'rollup', storedDays, gapSpan?: { start, end }, todayWindow? }`
  as a discriminated union, so the three readers only differ in which live pipeline they call for
  the gap and for today. `readStoredDays(days, deviceType)` fetches by `_id` list and drops
  version mismatches. The rollup result for orders adds the derived `topPlans` (D5) so the loader
  sees the same facet set as before.
- In `src/controllers/dashboardAnalyticsController.ts`: each of the four loaders replaces its one
  `Model.aggregate(...)` line with the matching reader. `loadDashboardTransactionSummary` runs a
  reduced pipeline today (`summaryOnly`, revenue+orders by day); serve it from the `revenue` facet
  of the orders facts (same match, same grouping) so it needs no fourth facet set. Nothing else
  in the loaders changes. Export the helpers the service needs instead of duplicating them.
- Add an env switch `DASHBOARD_DAILY_FACTS=off` that forces live mode for every request, read once
  at module load, so the deploy can be reverted without a redeploy. Default on.

## Acceptance criteria

- [ ] Integration test: with three stored days and `now` fixed inside day four, each of the four
  section handlers returns `data` (minus `generatedAt`) deep-equal to the forced-live response for
  `custom` ranges of one, two, three and four days (the fourth is today) and for each device.
  Fix `now` by exporting the controller's `getDateRange`'s clock or by using `custom` ranges only.
- [ ] Fallback tests: a missing middle day → exactly one live aggregation per pipeline covering
  the gap span (spy on the aggregate call count); a version-mismatched day behaves as missing;
  `stateId` set → collection never read; `timeRange=today` → collection never read;
  `DASHBOARD_DAILY_FACTS=off` → collection never read.
- [ ] No handler request writes `dashboard_daily_facts` (assert document count unchanged).
- [ ] Existing `dashboardAccounting` tests unchanged and green; suites at baseline; `npx tsc --noEmit`
  clean; commit `feat(dashboard): serve section loaders from daily facts`.
