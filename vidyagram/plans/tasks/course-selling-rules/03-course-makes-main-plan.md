# Course makes its main plan

**Type**: AFK
**Blocked by**: 02
**Repo**: Backend + admin

## What to build

Saving a new course at a price creates or updates its main plan, so the admin never makes a plan by hand. Add `Course.selling` with one price option, `Plans.courseSale`, the pure `plansForCourse`, and an idempotent sync, following the single-ebook plan's pattern except for going off sale.

Status controls sale. Off sale clears `displayOn` and refuses new purchases, and never sets plan status 0, because about 680k orders get access only through an active plan. Allow Payment replaces Close Admission and keeps the price. A blank price makes no plan. Each row shows its current value in one line. A course not yet connected keeps working as today.

Show Draft in the course list instead of Inactive, so its toggle doesn't mislead.

Set up one file per rule for the form row, the parser and its part of `plansForCourse`. Tasks 07 to 13 depend on this structure so that they don't collide.

## Acceptance criteria

- [ ] A new course saved at a price creates one plan, and the card price and the charge match. A real local checkout buys it.
- [ ] Saving twice changes nothing. A price edit keeps the plan id and leaves existing orders alone.
- [ ] A course taken off sale refuses new purchases, and its buyers keep access.
- [ ] A live Bulk Sale keeps its sale price, and the edit applies when the sale ends.
- [ ] A course without `selling` is untouched by a save, and no plan is created.
- [ ] Adding a rule needs a new file plus one registry line, shown by the structure of a test rule.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 1, 3, 4, 5, 6, 7, 8, 9
