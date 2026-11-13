# Bulk preview, save and matching routes, list filter

**Type**: AFK
**Blocked by**: 02
**Repo**: backend

## What to build

The routes the admin dialog needs. All `requireAdmin`, under `/api/plans`, registered before `/:id`.

- `POST /extension-terms/preview` with `{ items: [{ planId, terms }] }` (1 to 500; `terms` is a `PlanExtensionTerms`
  or `null` for all default). Returns per plan `{ planId, planName, listPrice, currentTerms, before, after }`, where
  `before` and `after` are `{ price, days } | null` for a holder who paid the list price, both computed by the pure
  policy with the current default. This is the admin's only source of offer numbers.
- `PUT /extension-terms` with the same body. Parses every item first (any bad item ⇒ 400, nothing written), then one
  `bulkWrite` of `$set` or `$unset` per plan. Returns `{ matched, modified }`. Repeating a save changes nothing. Undo
  is the same call with each plan's `currentTerms` from the preview.
- `GET /extension-terms/matching` takes the same query as `GET /api/plans` (search, status, product filters,
  `extension`) and returns `{ total, plans: [{ id, planName, amount, status, extensionTerms }] }`, the first 500 in the
  list's order.
- `GET /api/plans` (the admin list, `getPlans` in `controllers/plansController.ts`) accepts
  `extension=default|custom|off` and returns `extensionTerms` on each row. Default = field absent; off =
  `extensionTerms.kind 'off'`; custom = `kind 'custom'`.

## Acceptance criteria

- [ ] Integration: the preview's `after` for a plan equals the `amount` and `duration` a lapsed holder who paid the
      list price sees on a listing once the terms are saved.
- [ ] Integration: saving 3 plans, saving again (`modified` 0), and undoing with the preview's `currentTerms` restores
      all three, including one that had no terms (unset again).
- [ ] Integration: 0 items, 501 items, an unknown plan id and a bad terms body each return 400 and write nothing.
- [ ] Integration: `extension=custom` and `extension=off` filter the list; `matching` with the same filters returns
      the same plans and `total`.
- [ ] Non-admin tokens are refused on every new route.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 1, 12, 13, 14, 15, 17
