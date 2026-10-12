# 04 Duplicate on the Classes page with pre-ticked courses

**Type**: AFK (run on `task-implementer-high`)
**Blocked by**: None, can start immediately
**Feature**: B, prefix `qt-dupcourses`

## What to build

The Duplicate dialog on `/admin/classes` gains "Also put it in these courses" (board C). Every course the
original sits in is ticked and shows its place (Section › Topic, "right after <original>") and the
original's Free and On/Off pills. The admin can untick courses. "Create in N courses" creates the class
and its placements together. See PRD "Module 2. Duplicate planner".

- **Title helper.** Add a pure next-title helper in the admin. It increments a trailing number and keeps
  its zero padding and separator style, or appends " (Copy)". The in-place create already has
  next-title logic. Reuse or generalise it into one helper. Also drop the start-date note text ("same
  length as …"), which the user removed. The start date behaves as today's Duplicate.
- **Placements read.** Add a backend read of a class's placements for the dialog: course id and title,
  main place path, Free, On/Off. Main place means the placement's own taxonomy, not
  `apxDisplayPlacements` listings.
- **Planner.** Add a pure backend duplicate planner. Its input is the source placements, the ticked
  course ids, and the ordering in each source topic. Its output is placement writes for the copy, plus the
  priority shifts.
  - The copy sits directly after the original in that topic.
  - Later rows in the topic shift down one.
  - Other topics' order is unchanged.
  - Reuse the numbering rule of the drop-line move (`POST …/placements/move`) instead of inventing one.
  - Free and On/Off are copied.
  - `title`, `apxTitle` and listings are not copied.
- **Route.** Add an admin-only route that duplicates a class with its courses, taking the class form
  fields and the course ids.
  - Create the class with the existing create logic, including the image copy to its own object.
  - Apply the plan in the same `startPrimarySession()` transaction.
  - Do not copy PDF or series assignments.
- In this task, the course list only allows unticking. Task 05 adds other courses.

## Acceptance criteria

- [ ] Planner unit tests:
  - With Class-01..04, duplicating 01 puts the copy directly after 01, and 02 to 04 keep their relative
    order after it.
  - Other topics are untouched.
  - Free and On/Off are copied.
  - A class shown in two places gets the copy only in its main place.
  - An unticked course gets nothing.
- [ ] Next-title unit tests:
  - "Class-01" becomes "Class-02".
  - "Class - 9" becomes "Class - 10".
  - "Day-1 || Prehistoric" becomes "Day-1 || Prehistoric (Copy)".
- [ ] Integration tests:
  - Duplicating into 3 courses creates one class and 3 placements in the right order, as shown by the
    course's class list or outline read.
  - A forced failure mid-plan leaves no class and no placements.
  - The route returns 401 without an admin token.
- [ ] Student topic lists show the copy right after the original, since they sort by priority.
- [ ] The dialog pre-ticks the original's courses (component test).
- [ ] Suites print NO NEW FAILURES.

## User stories covered

17–23, 25–32
