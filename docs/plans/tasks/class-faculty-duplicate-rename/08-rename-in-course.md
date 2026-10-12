# 08 Rename in this course only

**Type**: AFK (run on `task-implementer-high`)
**Blocked by**: None, can start immediately
**Feature**: C, prefix `qt-rename`

## What to build

The tracer for the Class names module (PRD "Data shape" and "Module 1. Class names").

- **Schema.** Add `Class.oldTitles: [String]` and `Class.searchNames: [String]`. Neither has a default,
  and nothing reads them yet except the module.
- **Rule function.** Add the pure rule function over (title, old titles, shown names). It does name
  normalisation (trim, case-fold, collapse spaces), removability, and the `searchNames` union. A shown
  name is `CourseClass.title`, else `apxTitle`.
- **Module calls.** Add "rename in course (course, class, title or none)" and "recompute (class ids)". A
  rename with none clears both `title` and `apxTitle` on that placement.
- **Route.** Add an admin-only route for a per-course rename. Suggested route is
  `PUT /api/admin/courses/:courseId/classes/:classId/title` with `{ title | null }`.
- **Lock the legacy route.** Put the admin requirement on `PATCH /api/course-classes/:id`. Check the
  legacy Assign Classes screen's hook sends the token, and fix it if not. That route must call recompute
  when it writes `title`.
- **Rename dialog.** In the outline row ⋯, add "Rename…" after "Change faculty…" when present. It opens
  the board D dialog with only the "Only in this course" option enabled for now. Task 09 adds
  "Everywhere". When the course already has its own name, show the second board D layout with "Use the
  class title again in this course".
- **Row display.** Outline rows carry the class title next to the shown name. A row whose names differ
  shows "Class title: …" under the title (board E).

## Acceptance criteria

- [ ] Rule unit tests:
  - names that differ only in case or spaces collapse
  - a shown name is not removable
  - `searchNames` is the union without duplicates
- [ ] Integration tests:
  - A per-course rename changes only that placement.
  - Class-tabs, course classes and topic classes show the new name for that course only.
  - Clearing restores the class title even when `apxTitle` was set.
  - `searchNames` is recomputed.
- [ ] The new route and the legacy PATCH return 401 without an admin token.
- [ ] Suites print NO NEW FAILURES.

## User stories covered

33, 34, 37, 38, 40, 56, 58
