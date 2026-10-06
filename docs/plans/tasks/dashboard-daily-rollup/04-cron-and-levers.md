# Refresh cron, rebuild and parity levers

State: ready-for-agent
Type: AFK
Repo: quicktricks-backend
Blocked by: 03
Parent: [Daily facts rollup](../../prd-dashboard-daily-rollup.md) — D8, D9, D10, D11, D12

## What to build

- `selectDaysToRefresh({ now, firstDay, existing, budget })` in the service: pure, returns the
  newest-first list per the D8 table. `existing` is the `{ day → { version, computedAt } }` map for
  the `all` variant (the three variants are written together, so one is enough to decide).
  `firstDay` comes from the earliest `orders.createdAt` after 2020-01-01 for the tenant, cached per
  process.
- `src/cron/dashboardDailyFactsCron.ts`: every 15 minutes under the `DistributedLock` pattern of
  `pdfUploadSessionCleanupCron.ts`, lock key `dashboard-daily-facts-cron-lock`, TTL just under the
  interval. One cycle: `ensureDailyFactsIndexes()`, load the signup snapshot once (D12), select
  days, compute them in order under the budget (default 40 days or 90 s), log the one summary line
  and one line per failed day (D11). Register in `app.ts` next to `startDashboardAnalyticsPrewarm()`
  inside the `DISABLE_CRONS` guard.
- `src/scripts/dashboardDailyFactsRebuild.ts` (D9): copy the arg handling and env loading style
  of `src/scripts/backfillClassHomeFiling.ts` if present on this branch, else of
  `src/scripts/dashboardAccountingAudit.ts`. Dry run lists the days and variants; `--commit`
  writes through `computeAndStoreDay`. Exits 0 and disconnects.
- `src/scripts/dashboardDailyFactsParity.ts` (D10): for each range × device, call each of the four
  loaders twice (rollup read vs forced live), strip `generatedAt`, deep-compare, print the first
  differing JSON path with both values, exit 1 on any difference. Expose a `forceLive` option on
  the readers (or honour `DASHBOARD_DAILY_FACTS=off` per call) so the script can switch modes
  in-process. Read-only by construction.

## Acceptance criteria

- [ ] Unit tests for `selectDaysToRefresh`: fixed `now`, seeded map with missing, wrong-version,
  stale-recent, fresh-recent, stale-old and old-frozen days → expected newest-first list; budget
  cuts the list; nothing older than 35 days is selected unless missing or wrong version.
- [ ] Cron cycle test with a fake clock and a stubbed `computeAndStoreDay`: respects the lock,
  computes only the selected days, logs one summary line.
- [ ] Rebuild dry run writes nothing; `--commit` on the in-memory DB writes the three variants per day.
- [ ] Parity script exits non-zero when a stored day is tampered with, zero otherwise (integration).
- [ ] Suites at baseline; `npx tsc --noEmit` clean; commit `feat(dashboard): daily facts cron, rebuild and parity scripts`.
