# Admin exchange badge and undo

**Type**: AFK
**Blocked by**: 04
**Repo**: backend + admin

## What to build

An admin sees that an order was exchanged and can put it back.

Backend:
- **`POST /api/orders/:id/exchange-undo`** behind `requireAdmin`. It makes one conditional update, which
  only applies if the order has an `exchange` with no `undoneAt` and `planId = exchange.toPlanId`.
  - It calls the shared grant rewrite function back to `exchange.fromPlanId`.
  - It stamps `undoneAt` and `undoneBy`, and keeps the record.
  - Validity and totals are unchanged.
  - A second undo returns 200 and writes nothing.
  - An order changed since the swap returns 409.
- The order detail and history responses the admin reads return the `exchange` record.
- The admin `PUT /:id/exchange` refuses with 409 when the order has a student exchange that has not been undone.
  The message tells the admin to use Undo first. This keeps the `exchange` record true to the order's plan.
  Without the check, an admin swap would leave `toPlanId` stale and the undo would refuse. Decided 10-23.

Admin:
- On the order history row and the order detail, show an "Exchanged" badge with from, to, time and the
  usage snapshot (watched %, PDFs opened, tests attempted).
- Show an "Undo exchange" button with a confirm step.
- An undone exchange shows "Exchange undone" with its time and no button.

## Acceptance criteria

- [ ] Integration: undo restores the source plan's course access and removes the target's. `expireDate`
      is unchanged.
- [ ] Integration: a second undo is a no-op; an order moved to another plan after the swap gives 409; a
      student token gets 403.
- [ ] Integration: after an undo, `exchange-self` returns 409 `already_exchanged`.
- [ ] Integration: admin `PUT /:id/exchange` on an order with a live student exchange returns 409 and writes nothing.
      After an undo, it works again.
- [ ] Admin component test: the badge shows the snapshot, Undo calls the route, and the undone state hides
      the button.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 24, 25, 26, 27, 28
