# Upgrade with removal, switch off

**Type**: AFK
**Blocked by**: 13, 14
**Repo**: Backend + admin

## What to build

The Allow Upgrade to other Courses row: the same rows as add-on, with the key `upgrade:<sourceCourseId>`. After a successful payment, every active order the student holds on the source plan gets `status: 0` and the label, once only. Validity runs from the purchase. A student who also holds the course through another plan keeps it there. A combo source goes whole. Admins can Undo, which restores every labelled order.

All of it sits behind a switch that is off by default, following `EXCHANGE_ENABLED`. With the switch off, students can't buy these upgrade plans.

## Acceptance criteria

- [ ] With the switch off, nothing is removed and no upgrade is on offer.
- [ ] With it on, a paid upgrade removes the source, a failed payment removes nothing, and a replay changes nothing.
- [ ] A double-held student loses the plan on both orders, and a holder through another plan keeps the course.
- [ ] After removal there is no playback, PDF, My Courses entry or extension offer for the source, and the sync cron doesn't bring it back.
- [ ] The source payment still counts in the five reports.
- [ ] Undo restores access and clears the label.
- [ ] A student who upgraded can still see and download the old order's invoice. `orderController` invoice orders, invoice download and student history hide `status: 0` today (found in task 14).
- [ ] An admin deleting an upgraded order is handled on purpose: it must not stay in revenue by accident, because `deleteOrder` only sets `status: 0` and the label would keep it counted.
- [ ] Undo's lookup by label has an index or a recorded reason for not needing one, built with `commitQuorum: 'majority'` per the Mongo notes.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 29, 30, 35, 36, 37, 38, 39, 40, 41
