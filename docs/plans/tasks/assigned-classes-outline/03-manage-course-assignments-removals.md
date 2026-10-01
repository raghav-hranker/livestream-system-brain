# Manage Course Assignments removals (class side)

**Type**: AFK
**Blocked by**: None — can start immediately

## What to build

PRD Admin 9. Assigning a class to a course from the class side becomes the same simple step as from the
course side.

- `app/admin/classes/manage-courses/page.tsx`: remove End date and Priority from the assign dialog, the
  assigned-courses list and its bulk update. Requests stop sending `endDate` and `priority`, so the
  backend's defaults apply: last + 1, and the existing assignment window (PRD Backend 5).
- Delete `components/admin/ManageCoursesDialog.tsx` if nothing imports it.
- No backend change. Existing end dates stay in the data, and the live schedule still reads them.

## Acceptance criteria

- [ ] The assign dialog, the assigned-courses list and the bulk update show no End date and no
      Priority, and none of their requests carry either field.
- [ ] A class newly assigned from this page lands at the end of its topic in that course's Assigned
      Classes tab.
- [ ] `ManageCoursesDialog` is gone, or a note says why it was kept.
- [ ] Admin type errors do not grow; a manual pass on the page is recorded in the commit message.
      (No new tests: PRD Testing Decisions.)

## User stories covered

- 36–39
