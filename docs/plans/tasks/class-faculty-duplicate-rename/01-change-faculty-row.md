# 01 Change faculty from the row ⋯

**Type**: AFK
**Blocked by**: None, can start immediately
**Feature**: A, prefix `qt-faculty`

## What to build

An admin on Assign Classes opens a class row's ⋯, picks "Change faculty…", chooses an active faculty and
saves. The class's faculty changes everywhere, and the row shows the new name. See board A of the faculty
mockup and PRD "Module 3. Faculty change".

- **Backend.** Add a new admin-only route that sets the faculty for a list of class ids from a faculty
  id. Suggested route is `POST /api/admin/classes/faculty` with `{ classIds, facultyId }`.
  - Validate that the faculty is an active Faculty profile.
  - Write its `name` into `Class.teacherName`.
  - Apply the same per-class ownership check as the class update route.
  - Skip classes that already have the name.
  - Return `{ changed, skipped, courseCount, notLiveYet: [{ id, title }] }`.
  - `courseCount` is the distinct courses holding a placement of any changed class.
  - `notLiveYet` is the classes with no recording. Use the same "has playback" notion the outline uses.
- **Admin.** In the row ⋯, after Tests, add a separator and then "Change faculty…" with the current
  faculty as its sub-label. It opens the dialog:
  - a searchable list from the existing active-faculty hook, with the current faculty marked and not
    selectable
  - "This changes the faculty in all N courses" with the course titles
  - the orange "hasn't gone live yet" note, only when the class has no recording
  - Cancel and "Change faculty"
  
  On success, refresh the outline rows and show the toast "Faculty changed to X in N courses". Send the
  admin token like the other one-stop admin calls.

## Acceptance criteria

- [ ] Route returns 401 without an admin token.
- [ ] Route returns 400 for an inactive or unknown faculty.
- [ ] Changing one class writes `teacherName` and reports `courseCount` correctly. Integration test on
      the Mongo harness.
- [ ] A class that already has the faculty is counted as skipped and is not written.
- [ ] The dialog lists the class's courses. The orange note shows only when there is no recording.
- [ ] After save, the row shows the new faculty without a page reload.
- [ ] Suites print NO NEW FAILURES on both sides.

## User stories covered

1–8, 14, 15
