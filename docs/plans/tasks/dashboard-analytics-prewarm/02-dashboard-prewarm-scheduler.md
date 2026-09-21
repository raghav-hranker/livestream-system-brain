# Automatic prewarm for the 15 configured dashboard views

State: ready-for-agent  
Type: AFK  
Repo: quicktricks-backend  
Blocked by: [01 — Shared analytics cache for predefined dashboard requests](01-shared-analytics-cache.md)  
Parent: [Prewarm predefined analytics dashboard views](../../prd-dashboard-analytics-prewarm.md)

## What to build

Add a configuration-driven backend scheduler that uses the shared analytics
cache coordinator to keep the agreed 15 summary views warm. The matrix is the
five date ranges (`today`, `7d`, `30d`, `90d`, `financial_year`) crossed with
the three device values (`all`, `web`, `mobile`), with state and city set to
`all`.

Run an initial background fill after the backend is ready and refresh the
matrix every 20 minutes. Resolve rolling date ranges at each refresh using the
existing Asia/Kolkata rules. Successful results retain a 25-minute cache
window. Bound concurrency so the scheduler cannot launch all expensive
aggregations without control, and do not block application startup.

## Acceptance criteria

- [ ] The version-controlled configuration expands to exactly 15 valid entries and contains no location or custom-date entries.
- [ ] The scheduler performs an initial background fill after application readiness without delaying startup.
- [ ] The scheduler repeats the refresh cycle every 20 minutes and uses the same cache identity as on-demand requests.
- [ ] Each successful refresh stores or renews the summary result for 25 minutes.
- [ ] Preset ranges are recalculated at every cycle with Asia/Kolkata calendar boundaries.
- [ ] Scheduler concurrency is bounded and every configured entry is attempted once per cycle.
- [ ] Existing summary requests can observe a warmed response, while non-prewarmed location/custom requests still compute normally.
- [ ] Tests verify exact matrix membership, initial fill, scheduled refresh, retention, dynamic date resolution, and bounded work.

## Blocked by

- [01 — Shared analytics cache for predefined dashboard requests](01-shared-analytics-cache.md)
