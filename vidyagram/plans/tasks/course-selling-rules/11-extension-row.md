# Extension row

**Type**: AFK
**Blocked by**: 03
**Repo**: Backend + admin

## What to build

The Extension row in one line: show before expiry, validity, price (% or ₹) and minimum. An empty box uses the default. It writes `extensionTerms` to every main plan, adding an optional `windowDays`. Absent means the existing setting. Bulk edits on the Plans page keep working.

## Acceptance criteria

- [ ] A custom window changes when that course's owners see the offer, and other plans are unaffected.
- [ ] Off removes the offer for this course.
- [ ] A fixed price hides Minimum and charges exactly that price.
- [ ] Every length gets the same terms.
- [ ] The bulk dialog still reads and writes these plans.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 24, 25, 26, 27, 28
