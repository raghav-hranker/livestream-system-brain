# Resilient multi-instance refresh and observability

State: ready-for-agent  
Type: AFK  
Repo: quicktricks-backend  
Blocked by: [02 — Automatic prewarm for the 15 configured dashboard views](02-dashboard-prewarm-scheduler.md)  
Parent: [Prewarm predefined analytics dashboard views](../../prd-dashboard-analytics-prewarm.md)

## What to build

Make scheduled analytics prewarming safe in a multi-instance deployment and
safe during transient failures. Use a distributed per-view lock so only one
backend instance computes a given view at a time. If a refresh fails, preserve
the previous successful summary until its retention ends, expose the failure,
and allow a later scheduled or on-demand attempt to retry. A failed first fill
must not be presented as a valid cached response.

Add bounded operational visibility for prewarm start, success, failure,
duration, cache hit/miss, and lock contention without logging credentials or
full response contents. Verify the complete behavior through the existing
dashboard endpoint and test seams; no public endpoint or frontend contract
change is required.

## Acceptance criteria

- [ ] Competing backend instances cannot refresh the same predefined view concurrently.
- [ ] Lock expiry or an interrupted worker cannot permanently prevent future refreshes, and losing a lock does not delete an existing result.
- [ ] A failed refresh retains the last successful result and records an observable failure.
- [ ] A failed first fill is not treated as a successful cache hit and is retried by a later cycle or on-demand request.
- [ ] Refresh duration, success/failure, hit/miss, and lock-contention signals are emitted without sensitive payloads.
- [ ] The 15-view workload remains bounded under multiple scheduler instances.
- [ ] Integration tests verify stale-result retention, retry behavior, lock contention, stale-lock recovery, unchanged response shape, authorization, and frontend compatibility with the existing endpoint.

## Blocked by

- [02 — Automatic prewarm for the 15 configured dashboard views](02-dashboard-prewarm-scheduler.md)
