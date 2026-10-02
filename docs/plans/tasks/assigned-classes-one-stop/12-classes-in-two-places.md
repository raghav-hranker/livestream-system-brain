# Classes that appear in two places

**Type**: AFK
**Blocked by**: #09 (same view files)

## What to build

PRD Round 2 "Classes that appear in two places" and decisions 14, 15 and 22. Backend + admin. The
admin never says "AppX" about these rows.

**Backend**
- Outline rows of a placement with places carry `otherPlaces: string[]`: the group paths ("Maths ATM
  Batch › Percentage") of the class's other rows in this course.
- `DELETE /api/admin/courses/:courseId/placements/:placementId/listings/:listingId` (admin auth) pulls
  that entry from `apxDisplayPlacements`. Removing the last entry is 409; the class remove handles that
  case.

**Admin**
- An "Also under ‹path›" tag on each such row (several paths joined by commas).
- The In course switch on such a row: same write as today (the placement status, so every place
  follows); the toast says "‹title› switched off in this course. Also hidden under ‹path›." (and
  "shown again" when switched on). Both rows reflect the new state after the refetch.
- Bulk **Remove** (`page.tsx` remove handler, `use-course-classes.ts:326-336`):
  - a ticked row whose sibling place is **not** ticked → delete that place only; the toast says
    where the class stays ("so nobody loses it");
  - every place of a class ticked → the existing class remove;
  - ordinary rows → unchanged.
  The confirm dialog counts classes leaving the course separately from places removed.

## Acceptance criteria

- [ ] Rows of a class in two places show where else it is.
- [ ] Removing one place leaves the class in the course under the other place, for students too.
- [ ] Ticking both places and removing takes the class out of the course.
- [ ] The switch hides both places, and says so.
- [ ] Tests: backend — `otherPlaces` on outline rows; the place delete (and its 409 on the last
      entry). Admin — the remove plan (place vs class) as a pure function; the tag and the toast.
- [ ] Baselines stay green.

## User stories covered

- 33, 34
