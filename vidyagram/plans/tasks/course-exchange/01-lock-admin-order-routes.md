# Lock the admin order exchange and extend-validity routes

**Type**: AFK
**Blocked by**: None, can start immediately
**Repo**: backend (admin checked, not changed)

## What to build

`PUT /api/orders/:id/exchange` (`exchangeOrderPlan`) and `PUT /api/orders/:id/extend-validity`
(`extendOrderValidity`) are commented "admin". Both run `authenticateToken` only, which accepts any student
JWT. Neither controller checks who owns the order. Move both routes behind `requireAdmin`
(authMiddleware.ts).

Confirm that the admin UI caller (`components/admin/OrderAdjustDialogs.tsx`, `hooks/api/use-orders.ts`)
sends the admin token, so the dialogs keep working. This closes the hole the student exchange would
otherwise sit beside. The quicktricks copy of this fix is separate and is never part of this change.

## Acceptance criteria

- [ ] Integration: a student token gets 403 on both routes, and the order is unchanged.
- [ ] Integration: an admin token gets 200 on both routes, with today's behaviour.
- [ ] The admin Exchange and Extend validity dialogs still send an admin bearer token (read the hook, or
      run a local preview).
- [ ] The memory ledger `backend-authz-gaps.md` marks these two routes fixed on Vidyagram (on deploy).
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Story 29
