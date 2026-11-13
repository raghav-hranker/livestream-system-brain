# Course-page exchange signal and order history label

**Type**: AFK
**Blocked by**: 04
**Repo**: backend

## What to build

The app decides whether to show the Exchange action from the course detail response it already loads.
After a swap, the order history names the swap.

- **Course detail.** The by-id response the app reads for a course page gains
  `exchange: { orderId, eligible, reason? } | null`.
  - It is `null` when the student holds no active order granting this course on a plan with a non-empty
    "Exchange to" list, or when `EXCHANGE_ENABLED` is off.
  - When two orders qualify, it uses the newer one (D14).
  - It reuses the task 03 policy and usage reader; there is no second copy of the rules.
- **Order history.** The student's order list shows an exchanged order with `exchangedFrom: { courseId,
  title }`, so the app can render "Exchanged from <title>".

## Acceptance criteria

- [ ] Integration: an eligible buyer gets `eligible: true` with the order id. A buyer over the watch limit
      gets `eligible: false, reason: 'watched_too_much'`. A combo buyer, a non-buyer and a signed-out
      request get `null`.
- [ ] Integration: with two qualifying orders on the same course, `orderId` is the newer one.
- [ ] Integration: with the flag off, the field is `null`.
- [ ] Integration: after a swap, the order list carries `exchangedFrom` with the source course title.
- [ ] Latency: the course detail p50 on the local fixture does not move by more than 20 ms with the field
      on. Measure and report the number.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 1, 2, 13
