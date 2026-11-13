# Student swap

**Type**: AFK
**Blocked by**: 01, 03
**Repo**: backend

## What to build

An eligible student confirms a target and the swap happens at once.

- **Order grant rewrite.** This is the one function that changes what an order grants. It sets `planId`
  and the item ids resolved from the target plan (`resolvePlanEntitlements`), sets `planFor` and
  `updatedTime`, and clears `latestCourseId`. Nothing else in the codebase may change an order's grant for
  an exchange. Refactor `exchangeOrderPlan` to call it too.
- **`Order.exchange` subdocument.** Fields: `fromPlanId`, `fromCourseIds`, `toPlanId`, `at`,
  `by: 'student'`, `watchedPct`, `pdfsOpened`, `testsAttempted`, `undoneAt`, `undoneBy`.
- **`POST /api/orders/:id/exchange-self`**, with body `{ targetPlanId }`. It runs the policy again,
  requires the target to be on the source plan's list, and then makes one conditional update. The update
  only applies if `_id`, `userId`, `orderStatus: 'success'`, `status != 0`, `planId = source` and no
  `exchange` all match.
  - It changes no totals, coins, coupon usage, invoice or validity.
  - A retry that finds the order already swapped to the same target returns 200 with the order and writes
    nothing.
  - Another target after a swap returns 409 `already_exchanged`.
  - A target not on the list returns 400 `target_not_allowed`.
  - Ineligible returns 409 with the reason.
  - Another user's order returns 404, and so does any request while the flag is off.

## Acceptance criteria

- [ ] Integration: after a swap, the source course's class playback and PDF access are refused. The target
      course's class access is allowed. My Courses lists only the target. `expireDate`, `grandTotal` and
      `orderStatus` are unchanged.
- [ ] Integration: the same call twice gives one swap and 200 both times. A different target after it gives
      409 `already_exchanged`.
- [ ] Integration: two concurrent calls with different targets leave exactly one swap, and one of them
      gets 409.
- [ ] Integration: 404 for another user's order; 400 for a target not on the list; 409 `watched_too_much`
      for an over-limit student.
- [ ] Integration: a Razorpay sync run over the swapped order leaves it unchanged.
- [ ] Integration: the admin `PUT /:id/exchange` still works through the shared rewrite function.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 9, 10, 11, 12, 14, 15, 30, 31, 33, 34
