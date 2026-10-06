# Parity on prod, dist, deploy

State: ready-for-human
Type: Human (orchestrator runs it, user confirms the deploy)
Repo: quicktricks-backend
Blocked by: 04
Parent: [Daily facts rollup](../../prd-dashboard-daily-rollup.md)

## Steps

1. From the worktree, backfill the last 120 days against the prod DB with the rebuild lever
   (`--commit`), `readPreference` secondary. Record the wall time per day.
2. Run the parity lever for `7d, 30d, 90d, financial_year × all, web, mobile` (financial_year will
   fall back to one live gap aggregation for the days before the backfill; that is still a valid
   parity check of the read path). Expect exit 0. Keep the output under `reference/`.
3. Measure cold request time per view through the loaders with the Redis cache bypassed, rollup vs
   live, three runs each. Report with the spread (benchmark checklist).
4. Surgical `dist` commit per the deploy memory (`quicktricks-backend-dist-deploy`), rebase onto
   `origin/quicktricks-admin`, push with the `git@raghav-hranker` alias.
5. **Pause for the user.** Box `git pull --ff-only` + `pm2 restart 27`, then confirm the cron's
   first summary line in the pm2 log and that `dashboard_daily_facts` grows.
6. Update memory `dashboard-perf-work-state` and the task README state.
