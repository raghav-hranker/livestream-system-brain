# Dashboard analytics prewarm

Vertical-slice issues for [the PRD](../../prd-dashboard-analytics-prewarm.md).

| # | Issue | Type | Repo | Blocked by |
|---|---|---|---|---|
| 01 | [Shared analytics cache for predefined dashboard requests](01-shared-analytics-cache.md) | AFK | quicktricks-backend | None |
| 02 | [Automatic prewarm for the 15 configured dashboard views](02-dashboard-prewarm-scheduler.md) | AFK | quicktricks-backend | 01 |
| 03 | [Resilient multi-instance refresh and observability](03-prewarm-resilience-observability.md) | AFK | quicktricks-backend | 02 |

Implementation targets the deployed `quicktricks-backend` fork. The admin
dashboard keeps its existing analytics endpoint and response contract; no
frontend issue is required for this slice set.
