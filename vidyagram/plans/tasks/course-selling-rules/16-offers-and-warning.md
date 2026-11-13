# Offers and warning on the owned course's page

**Type**: AFK
**Blocked by**: 13, 15
**Repo**: Backend + this repo

## What to build

`by-id-2` gains `offers[]` for a signed-in student, `{ kind, planId, targetCourseId, price, duration, removes }`, in the admin's order, listing what an upgrade would remove, all courses for a combo. My plans' `upgradeOffers` gains `kind` and `removes`. Course page, My plans and checkout quote one price. Write the app guide, covering pricing plans, the coupon timer, the Sub Courses tab, offers and the required warning. Sending the guide is the user's call.

## Acceptance criteria

- [ ] A student sees the same price on the course page, My plans and at checkout, for each student type in the prototype.
- [ ] Offers come in the dragged order.
- [ ] `removes` names every course lost, and a student's token is required.
- [ ] The guide has sample payloads from a real local run.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 31, 32, 34, 43, 44
