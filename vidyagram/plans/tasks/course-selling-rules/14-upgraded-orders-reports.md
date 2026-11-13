# Reports keep upgraded orders, close access gaps

**Type**: AFK
**Blocked by**: None, can start immediately
**Repo**: Backend + admin

## What to build

Make an order with `status: 0` and `upgradedToOrderId` count as revenue in the sales report, dashboard analytics, daily facts, coupon analytics and product analytics. The GST report needs no change. Admin order screens show Upgraded instead of Deleted. Confirm whether `packageUtils` and `plansController` really lack the status check, and close any gap, which fits the 19 Oct decision that a deleted order loses access everywhere. No order carries the label yet, so students and today's reports see no change.

## Acceptance criteria

- [ ] A test order with the label counts in each of the five reports, and an order deleted by an admin still doesn't.
- [ ] Report totals on a copy of real data match before and after.
- [ ] The admin order list and detail show Upgraded.
- [ ] Each suspected gap is recorded as real or not. A deleted order gives no test series, ebook or already-bought flag.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 52
