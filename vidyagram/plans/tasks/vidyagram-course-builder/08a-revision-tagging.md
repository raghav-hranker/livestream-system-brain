# Revision tagging

**Type**: AFK
**Blocked by**: #02 — Builder settings and Builder mode
**Repos**: backend and admin

## What to build

The admin can mark classes as revision classes in Builder mode, and the outline shows how many each
chapter has. No access rule changes here (that is 08b).

- **Field**: `isRevision: boolean` on the course-class placement (`CourseClass`), default `false`. It is
  per course, because the same class can be a revision class in one course and not in another. Use
  exactly this name: task 03 counts revision classes from it.
- **Backend**: an admin-only endpoint (existing admin auth, user from the token) that sets `isRevision`
  on one or more placements of a course, refusing placements of another course. The admin outline read
  (`class-groups`) returns `isRevision` per listing. Full-access roles only for the write, like the
  builder settings save.
- **Admin**: in Builder mode only, each class row gets a Revision switch that saves at once (optimistic,
  rolled back with the backend's message on failure). Topic rows and section rows show their revision
  class count. The existing bulk-selection bar may offer "Mark as revision" / "Unmark revision" for the
  selected rows if it fits the existing pattern; skip it if it does not.
- With Builder mode off the screen is unchanged.

## Acceptance criteria

- [ ] Backend tests: set and clear one and several placements; a placement of another course is refused
      and nothing is written; non-admin and unauthenticated requests rejected; the outline read returns
      the flag.
- [ ] Admin tests: switch shows only in Builder mode, saves, rolls back on error; counts update.
- [ ] Both suites `NO NEW FAILURES` against their baselines.
- [ ] Report says what was not checked in a browser.

## User stories covered

- Story 33
