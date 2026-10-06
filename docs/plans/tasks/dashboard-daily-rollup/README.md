# Tasks: Daily facts rollup for the analytics dashboard

State: **DEPLOYED 2026-10-06 18:40 IST** — origin/quicktricks-admin f5613f835→0e73b42a3 (6 src + 1 dist commits, rebased onto the day's two earlier deploys), box pulled + pm2 27 restarted. Prod backfill complete (4,122 docs, 2023-01-01..2026-10-05). Stored-path parity 47/48 (the one diff was a today-window status race); timing all four sections: 7d 1.6 s vs 7.8 s, 30d 1.7 s vs 22 s, 90d 1.9 s vs 45 s, FY 2.7 s vs 80 s. Evidence `reference/dashboard-daily-rollup-parity-2026-10-06.md`. First cron cycle confirmed 18:45 IST (10-03..10-05 refreshed, older untouched). Follow-ups = rebuild-script retry on connect errors, retire the prewarm?

Vertical-slice breakdown of [the PRD](../../prd-dashboard-daily-rollup.md). Tasks cite the PRD's
decisions (D1–D12) and do not restate them.

| # | Task | Type | Repo | Blocked by |
|---|---|---|---|---|
| 01 | [Facts registry, keyed merge, day enumeration](01-facts-merge.md) | AFK | quicktricks-backend | None |
| 02 | [Compute and store one day; equivalence test](02-compute-day.md) | AFK | quicktricks-backend | 01 |
| 03 | [Read path behind the four section loaders](03-read-path.md) | AFK | quicktricks-backend | 02 |
| 04 | [Refresh cron, rebuild and parity levers](04-cron-and-levers.md) | AFK | quicktricks-backend | 03 |
| 05 | [Parity on prod, dist, deploy](05-parity-and-deploy.md) | Human | quicktricks-backend | 04 |

## Why one owner

Every task adds to `src/services/dashboardDailyFacts.ts` and 03 edits the controller the others
import from. Parallel owners would share one write target, so the four tasks run in order in one
worktree, one commit per task, each green before the next.

## Working-copy rules

- Worktree: `/private/tmp/claude-501/-Users-raghav-Projects-system-brain/aae679c0-12c5-4163-87c6-0e33dac2a359/scratchpad/qb-rollup`,
  branch `feat/dashboard-daily-rollup` cut from `origin/quicktricks-admin` 3b9b385bc. `node_modules`
  is a symlink; `.env.development` is a copy of the main checkout's and must never be committed.
- **The controller on this branch differs from the user's main checkout** (`agent/course-qa`).
  Read `src/controllers/dashboardAnalyticsController.ts` in the worktree, not elsewhere. The four
  loaders are `loadDashboardSignups`, `loadDashboardTransactions`, `loadDashboardTransactionSummary`,
  `loadDashboardOrderTypes` (around lines 711–845).
- Existing code to build on: `src/services/dashboardPaymentReporting.ts` (`dashboardPaymentScope`),
  `src/services/dashboardSignupReporting.ts` (`signupDuplicateIds`), `src/services/dashboardAnalyticsCache.ts`
  (`dashboardCacheNamespace`, do not reuse its Redis keys for Mongo), `src/utils/distributedLock.ts`
  and `src/cron/pdfUploadSessionCleanupCron.ts` (lock + cron pattern), `src/tests/integration/dashboardAccounting.integration.test.ts`
  (seeding style, `request()` helper, `clearCollections`).
- Never connect to a production database from a task. The in-memory replica set is the only DB.
- Commit as `raghavsharma@hranker.com`, no trailers, message style `feat(dashboard): …`.
- Tests: `~/Projects/system-brain/scripts/qt-tasks.sh suites <worktree> docs/plans/tasks/dashboard-daily-rollup/baseline-backend.txt`
  must print `NO NEW FAILURES` before the final report. `npx tsc --noEmit` must stay clean.
- Comments: only a non-obvious *why*. No phase narration. The PRD already explains the design; link
  to it from the module header in one line.
