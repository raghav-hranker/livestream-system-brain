# Add existing classes here (from a header)

**Type**: AFK
**Blocked by**: #15 (same header ⋯ menus)

## What to build

PRD Round 3, "Adding existing classes from the place", decisions 34, 35 and 37 (the with-a-place half).
Backend + admin. Board L of the preview canvas shows it.

**Backend**
- `GET /api/admin/courses/:courseId/class-library` (decision 34). Reuse `buildTitleSearch`,
  `searchMatchStages` and the vocabulary cache exactly as `classController` uses them; don't write a
  second search. `inCourse` covers placements with `isActive: true`, on or off, with their outline
  paths (a class in two places lists both).
- `POST /api/admin/courses/:courseId/placements/assign` (decision 35), both shapes (`target` and
  none; task 18 is the first caller of "none"). Read how `assignClassToCourse` / `bulk-classes` build a
  placement and reuse it; reuse decision 13's landing-last helper and the destination-topic append
  from the move endpoint. 409 `ALREADY_IN_COURSE` before any write; restore a removed placement
  instead of adding a second.
- Both routes in `adminCoursePickerRoutes.ts` behind `requireAdmin`.

**Admin**
- Section, topic and subtopic ⋯ → **Add existing classes here** (under "Add recorded classes here",
  sub-line "Pick from the class library").
- `AddExistingClassesSheet` (decision 37) with a place: "Filed under ‹place› (n)" | "All classes",
  ranked search with the near-spelling label, rows with the video pill (`classVideoStatus`), "in N
  courses", "Filed under ‹path›", disabled `inCourse` rows with their reason, "Load more", the footer
  note, "Add N classes". On success: close, refetch the outline, toast "N classes added to ‹path›,
  last." Rows filed elsewhere then carry round 2's "Moved here in this course" tag (`taxonomyState:
  custom`), with no new code for the tag.

## Acceptance criteria

- [ ] From Percentage's ⋯, ticking two Percentage classes and one Profit & Loss class adds all three
      last in Percentage; the Profit & Loss one is tagged and stays filed under Profit & Loss in every
      other course.
- [ ] A class already in the course (on or off) can't be ticked and says where it is.
- [ ] A typo still finds the class, labelled as a near spelling.
- [ ] A class whose filing equals the place follows the class (`class-default`), not an override.
- [ ] Tests: backend integration for the library (scope, ranking hook-up, `inCourse` on/off/two
      places, paging) and assign-with-target (override vs follow, landing order, topic append, 409
      writes nothing, removed placement restored). Admin: the sheet's disabled rows, footer note, and
      the assign body.
- [ ] Baselines stay green.

## User stories covered

- 48, 49, 50, 51, 52
