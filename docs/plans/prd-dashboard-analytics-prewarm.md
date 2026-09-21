# Prewarm predefined analytics dashboard views

State: ready-for-agent  
Date: 2026-09-21

## Problem Statement

The analytics dashboard runs expensive aggregations when an administrator
selects a filter combination. The current cache is process-local, covers only
the default view, and expires before a later administrator can reliably reuse
the result. This makes common dashboard views wait on the database instead of
loading immediately.

The product needs a small, predictable set of dashboard views to remain warm
without attempting to precompute every possible state, city, or custom date
range.

## Solution

Add backend-owned automatic prewarming for 15 predefined analytics views:

- Date ranges: `today`, `7d`, `30d`, `90d`, and `financial_year`.
- Device filters: `all`, `web`, and `mobile`.
- State and city filters: `all`.

The backend computes these views in the background on startup and refreshes
them every 20 minutes. Each successful refresh stores the result for 25 minutes
so a scheduler delay or a slow refresh cannot leave a gap where the cache
expires. The existing dashboard endpoint continues to accept the same query
parameters and returns the same response shape; it reads a warmed result when
one exists and computes on demand for all other combinations.

## User Stories

1. As an administrator, I want the default analytics view to load immediately, so that I do not wait for a database aggregation after opening the dashboard.
2. As an administrator, I want the 7-day analytics view to load immediately, so that I can review recent activity without a cold query.
3. As an administrator, I want the 30-day analytics view to load immediately, so that the dashboard remains responsive for the most common reporting period.
4. As an administrator, I want the 90-day analytics view to load immediately, so that longer-term reporting does not cause a visible delay.
5. As an administrator, I want the financial-year view to load immediately, so that annual reporting is practical from the dashboard.
6. As an administrator, I want each predefined date range to work with all devices, so that total activity is available without a cold request.
7. As an administrator, I want each predefined date range to work with website users, so that web activity is available without a cold request.
8. As an administrator, I want each predefined date range to work with mobile users, so that app activity is available without a cold request.
9. As an administrator, I want switching between predefined views to reuse the corresponding cached result, so that returning to a view is fast.
10. As an administrator, I want refreshed results to use the current Asia/Kolkata date boundaries, so that rolling periods and the financial year do not become stale because their calendar window moved.
11. As an administrator, I want a predefined view to refresh every 20 minutes, so that its data remains reasonably current while staying warm.
12. As an administrator, I want the previous successful result to remain available during a slow or failed refresh, so that a transient background error does not make the dashboard unusable.
13. As an administrator, I want a cold request for a non-prewarmed state or city selection to continue working, so that this optimization does not remove existing dashboard functionality.
14. As an administrator, I want custom date ranges to continue working on demand, so that one-off investigations remain possible even though they are not prewarmed.
15. As an administrator, I want dashboard detail records to remain on demand, so that prewarming does not load every paginated transaction or activity row unnecessarily.
16. As an administrator, I want all dashboard users and backend instances to share warmed results, so that response time does not depend on which process receives my request.
17. As an administrator, I want the dashboard response contract to remain unchanged, so that the existing frontend needs no filter or rendering rewrite.
18. As a platform operator, I want the prewarm workload bounded to 15 views, so that background work cannot grow with the number of locations or administrators.
19. As a platform operator, I want only one backend scheduler to refresh a view at a time, so that multiple production instances do not multiply the expensive aggregation load.
20. As a platform operator, I want prewarm failures to be observable, so that database, Redis, or configuration problems can be diagnosed without silently degrading performance.
21. As a maintainer, I want the predefined matrix to be configuration-driven, so that a later decision to add a location or another device option does not require rewriting scheduling logic.
22. As a maintainer, I want the cache policy isolated behind one backend module, so that cache storage, refresh timing, and locking can be tested without duplicating route behavior.

## Implementation Decisions

- The production QuickTricks backend owns the prewarm behavior. The admin
  dashboard remains a consumer of the existing analytics endpoint and does not
  become responsible for server-wide warming.
- Introduce a backend analytics-cache coordinator at the highest useful seam.
  Its small interface should accept normalized analytics filters, return a
  cached or freshly computed analytics response, and expose an internal
  prewarm operation for the scheduler. Redis is the shared cache adapter;
  aggregation code remains the existing source of the response.
- Replace the current process-local default-only cache as the source of truth
  for prewarmed views. A process-local optimization may remain only if it is
  demonstrably safe and subordinate to the shared cache, never as the only
  cache layer.
- The prewarm matrix is version-controlled configuration containing exactly
  the five date-range presets crossed with the three device presets. Every
  entry has no state or city filter. Custom ranges and location filters are not
  included in the initial matrix.
- Preset date ranges are resolved at each refresh using the existing
  Asia/Kolkata calendar rules. Cache identity must include the resolved range
  boundaries as well as the logical filters, so a new day cannot reuse a
  result for yesterday's window.
- Cache identity includes time range, resolved start and end, device type,
  state filter, and city filter. Key construction must be deterministic so
  equivalent requests share one result.
- A successful prewarm stores the complete summary response for 25 minutes.
  The scheduler runs every 20 minutes. The longer retention is intentional: a
  delayed tick or a refresh that takes several minutes must not create an
  expiration gap.
- Prewarming runs in the background and must not delay application startup.
  It performs an initial pass after the backend is ready, then repeats at the
  20-minute interval. Refreshes should use a bounded concurrency level rather
  than launching all expensive aggregations without control.
- Use a distributed per-view lock with a short lock lifetime and safe release,
  so multiple backend instances do not refresh the same view concurrently.
  Lock loss or an expired lock must not delete an existing cached response.
- On a refresh failure, retain the last successful response until its cache
  retention ends, record the failure, and allow the next scheduled pass or an
  on-demand request to retry. A failed first fill must not be represented as a
  successful cache entry.
- On-demand requests for the 15 configured views use the same coordinator and
  cache keys as the scheduler. Requests for state, city, or custom-date views
  continue through the existing aggregation path and may be cached only by
  the normal request policy; they are not added to the prewarm set.
- The paginated records endpoint is excluded from prewarming. Only the
  summary analytics endpoint and its existing response are in scope.
- The existing response payload, authorization behavior, filter semantics,
  and frontend query parameters remain unchanged. No new public endpoint and
  no database schema migration are required.
- Add bounded operational logging or metrics for prewarm start, success,
  failure, duration, cache hit, cache miss, and lock contention. Logs must not
  include administrator credentials or sensitive response contents.
- Configuration errors must fail clearly at backend startup or prewarm setup;
  invalid date-range or device values must never create unbounded or
  duplicate work.

## Testing Decisions

Tests should cross the analytics-cache coordinator and dashboard handler seams,
asserting observable cache behavior and response correctness rather than
reproducing Redis commands or scheduler internals in every test. Existing
dashboard analytics integration tests and the backend's cron/lock test patterns
are the prior art.

- Configuration tests verify that the initial matrix contains exactly 15
  entries, has the five agreed date ranges and three device values, and omits
  state, city, and custom-date filters.
- Key normalization tests verify that equivalent filter requests share a key,
  that different device/location/date values do not collide, and that rolling
  date ranges produce new identities when their resolved boundaries change.
- Coordinator behavior tests verify a cache miss computes and stores a result,
  a cache hit avoids recomputation, and an on-demand request uses the same
  result that prewarm created.
- Refresh tests verify that each configured view is refreshed every scheduled
  cycle, successful refreshes retain the 25-minute policy, and bounded
  concurrency does not omit or duplicate configured entries.
- Failure tests verify that a failed refresh preserves the prior successful
  result, that a failed first fill is retried, and that errors are observable.
- Distributed-lock tests verify that competing scheduler instances do not
  compute the same view concurrently and that a stale lock cannot permanently
  block future refreshes.
- Date-boundary tests cover Asia/Kolkata midnight, rolling 7/30/90-day ranges,
  financial-year rollover, and a scheduler run across a calendar-day change.
- Handler integration tests verify unchanged response shape, authorization,
  cache hits for all-device/device-specific predefined views, and on-demand
  behavior for location and custom-date views.
- Records endpoint tests verify that detail pagination is not triggered by the
  prewarm scheduler and continues to use its existing behavior.
- Frontend verification should confirm that the current dashboard can select
  all existing filters and render a response from the unchanged endpoint. No
  frontend cache-timing assertion should be required for the backend feature.

## Out of Scope

- Prewarming every state/city combination.
- Prewarming arbitrary custom date ranges.
- Prewarming paginated transaction, signup, test, progress, placement, or
  live-asset records.
- Changing the analytics response schema, filter names, authorization, or
  dashboard layout.
- Adding a user-configurable prewarm schedule or an admin UI for cache policy.
- Adding a cache invalidation event stream for every user, order, test, or
  progress mutation.
- Replacing the underlying analytics aggregations or changing their business
  definitions.
- Guaranteeing zero latency for a location or custom-date query that was not
  included in the predefined matrix.
- Deployment, infrastructure resizing, or production rollout execution.

## Further Notes

The initial design intentionally favors a small deep module and a bounded
prewarm matrix. It provides predictable performance for the common dashboard
views while leaving a clear extension point for explicitly approved location
presets later.

The 25-minute retention is not a promise that dashboard data is exactly 25
minutes old. It is a safety window around the 20-minute refresh cadence. The
freshness contract is that successful predefined views are recomputed at each
scheduled cycle when the backend is healthy, while the last known result may be
served during a transient refresh failure.

Implementation should target the deployed `quicktricks-backend` and
`quicktricks-admin` pair described in the system map, while preserving parity
with the upstream backend lineage where applicable. Follow the fork exception
and branch guidance in [BRANCHES.md](../../BRANCHES.md); do not treat the
System Brain checkout as the runtime implementation repository.
