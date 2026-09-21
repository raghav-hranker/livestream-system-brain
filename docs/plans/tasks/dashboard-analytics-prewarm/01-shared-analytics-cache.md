# Shared analytics cache for predefined dashboard requests

State: ready-for-agent  
Type: AFK  
Repo: quicktricks-backend  
Blocked by: None  
Parent: [Prewarm predefined analytics dashboard views](../../prd-dashboard-analytics-prewarm.md)

## What to build

Put the dashboard summary response behind a backend-owned analytics-cache
coordinator backed by shared Redis. The existing summary endpoint must use one
deterministic cache identity for normalized analytics filters, so an on-demand
request and a future prewarm request can reuse the same result across backend
instances.

Preserve the existing endpoint, authorization, filter semantics, response
shape, Asia/Kolkata date rules, and aggregation behavior. The coordinator must
support the five date-range presets and three device values without including
location filters in the initial predefined set. State, city, and custom-date
requests must continue to compute on demand. Keep the paginated records
endpoint out of this cache path.

## Acceptance criteria

- [ ] A repeated request for the same normalized predefined filter set returns the shared cached summary without rerunning the aggregation.
- [ ] Cache identity distinguishes time range, resolved start/end boundaries, device type, state, and city without collisions; equivalent requests share an identity.
- [ ] Rolling presets resolve their current Asia/Kolkata boundaries before cache lookup, so a new calendar day cannot reuse yesterday's result.
- [ ] All 15 predefined combinations are representable by the coordinator, while location and custom-date requests remain functional on demand.
- [ ] The existing summary response payload and authorization behavior remain unchanged.
- [ ] The records endpoint is not populated or traversed by summary cache requests.
- [ ] Tests exercise cache miss, cache hit, key separation, date-boundary changes, and unchanged on-demand behavior through the coordinator/handler interface.

## Blocked by

None - can start immediately.
