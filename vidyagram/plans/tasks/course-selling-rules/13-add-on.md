# Add-on

**Type**: AFK
**Blocked by**: 03
**Repo**: Backend + admin

## What to build

The Allow Add-on row, on the course a student owns: ordered rows of destination, price and validity. Each row makes a plan on the destination using the live upgrade fields, with the key `addon:<sourceCourseId>`, and the source order stays untouched. This is today's upgrade behaviour.

Ownership is checked across all of a course's plans, so an owner of the main plan isn't offered its add-on plan. If a destination's contents change, every plan selling it updates. A destination lists the courses that lead to it, read-only, with a link to each. ₹0 and admin-granted orders qualify.

## Acceptance criteria

- [ ] An owner of the source can buy the add-on at its price and validity, and keeps both.
- [ ] A non-owner can't buy it and doesn't see it.
- [ ] An owner of any plan of the destination isn't offered it.
- [ ] Several sources to one destination quote the cheapest.
- [ ] Adding to a destination's contents reaches its add-on plans.
- [ ] The destination's form shows where students come from.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 23, 30, 33, 40, 42, 43, 44, 51
