# Facts registry, keyed merge, day enumeration

State: ready-for-agent
Type: AFK
Repo: quicktricks-backend
Blocked by: None
Parent: [Daily facts rollup](../../prd-dashboard-daily-rollup.md) — D1, D2, D3, D4, D5

## What to build

Create `src/services/dashboardDailyFacts.ts` with the pure half of the service: no Mongo access
in this task.

- The data shape. `DayFacts = { orders: OrderFacets; signups: SignupFacets; orderTypes: OrderTypeFacets }`
  where each facet set is `Record<facetName, FacetRow[]>` and `FacetRow = { _id: unknown } & Record<string, number>`.
  A stored document is `DayFactsDoc = { _id: string; customer_id; day; deviceType; version; computedAt; windowStart; windowEnd } & DayFacts`.
  Export `DASHBOARD_FACTS_VERSION = 1` and `DEVICE_TYPES = ['all', 'web', 'mobile'] as const`.
- The registry (D4). `FACETS` lists every facet name each pipeline emits with its sort:
  orders `paymentReconciliation`, `total`, `revenue` (`_id` asc), `statusStats`, `subscriptionRows`
  (`value desc, _id.planId asc, _id.fallback asc`), `sourcePurchaseRows` (`_id` asc), `itemRows`,
  `locationRows` (`revenue desc, count desc`), `deviceRevenue` (`_id` asc); signups `total`,
  `signups` (`_id` asc), `deviceSignups` (`_id` asc), `stateRows` (`count desc`), `cityRows`
  (`count desc`); orderTypes `types`, `extensionFrom`, `exchangeFrom`, `exchangeTo`
  (`count desc, revenue desc, _id.planId asc`). Read the sorts off the pipelines in the worktree
  and copy them exactly. An unsorted facet keeps insertion order.
- `mergeDayFacts(days: DayFacts[]): DayFacts` groups rows by `JSON.stringify(_id)` within each
  facet, sums every numeric field, drops nothing, re-applies the registry sort. Non-numeric,
  non-`_id` fields are a thrown error (there are none today; this guards a future facet).
- `deriveTopPlans(subscriptionRows)` per D5.
- `enumerateIstDays(start: Date, end: Date): { day: string; start: Date; end: Date }[]` using the
  controller's IST helpers (export the two or three you need from the controller rather than
  copying them). `istDayKey(now)` for "today".

## Acceptance criteria

- [ ] Unit tests (`src/tests/dashboardDailyFacts.test.ts`, node:test): merge of two days sums per
  key and re-sorts per registry; a facet with a single-row `total` sums `count`; `deriveTopPlans`
  on a fixture equals the live `topPlans` rule (sort, limit 8, relabel); `enumerateIstDays`
  across an IST midnight and across a month boundary returns the right keys and windows.
- [ ] Registry completeness test (integration, in-memory Mongo): run the three pipelines on seeded
  rows and assert the set of facet names each returns equals the registry's names for that pipeline.
- [ ] `npx tsc --noEmit` clean; commit `feat(dashboard): daily facts registry, merge and day enumeration`.
