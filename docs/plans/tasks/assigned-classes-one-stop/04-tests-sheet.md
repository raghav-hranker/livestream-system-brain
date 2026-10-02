# Tests sheet from the row

**Type**: AFK
**Blocked by**: #01 — Row ⋯ menu + Go live; the separate class-tests auth fix ("Guard class
test-assignment routes with requireAdmin")

## What to build

PRD decision 8. The row ⋯ menu gets **Tests**, which opens a side sheet for the class's tests (Series),
built like task 03's PDF sheet.

- Make the class series views (`AssignedSeriesViewForClass` and its available counterpart) take
  `classId` as a prop, keeping `/admin/classes/assign-series?classId=` working.
- Reuse task 03's course-count banner.
- This must run on top of the auth fix: until the hook sends the admin token and the routes require
  it, the sheet would write through unauthenticated routes.

## Acceptance criteria

- [ ] The Tests sheet opens from a row and lists, reorders, removes and attaches the class's tests,
      through authenticated requests.
- [ ] Banner with N, as in task 03.
- [ ] The assign-series page still works.
- [ ] Component test: the sheet passes `classId` and shows the banner.
- [ ] Baselines stay green.

## User stories covered

- 8, 9
