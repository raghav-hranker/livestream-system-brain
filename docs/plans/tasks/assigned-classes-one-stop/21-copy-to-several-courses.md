# Copy to several courses at once

**Type**: AFK
**Blocked by**: — (round 3 is merged)

## What to build

PRD Round 4 decision 44 (and the shared picker of decision 43). Admin only: `POST
/admin/courses/:courseId/copy-to/:targetCourseId` is unchanged.

- **`CourseMultiSelect`** (new, shared): search box over `useCourseSearch`, results with checkboxes,
  picked courses as removable chips, an `excludeIds` prop, a `max` (20). Task 22 reuses it, so keep
  it free of copy-specific wording.
- **`CopyToCourseDialog`** picks courses with it (source course excluded).
- **Preview**: call the endpoint with `preview: true` for each picked course, one after another.
  Show one line per course ("12 added · 3 already there · 1 new topic"), expandable to today's
  per-topic table. A course whose preview fails shows its error on its line and is left out of Copy.
- **Copy**: run the picked (previewed) courses one at a time; each line turns into its result. A 409
  on one course says "changed while copying; nothing copied there" on that line, and the rest
  continue. A 403 stops everything (it is the same for every course). Close shows a toast summing
  the copied classes and courses.
- Every entry that opens the dialog (row ⋯, ticked set, section ⋯, whole course) gets the
  multi-course behaviour; the scope prop is unchanged.

## Acceptance criteria

- [ ] Picking three courses previews three lines, each expandable; Copy copies to all three and
      reports each.
- [ ] One course failing (409) is reported on its line; the other two are copied.
- [ ] The source course can't be picked; more than 20 can't be picked.
- [ ] Tests: `CourseMultiSelect` (search, pick, chip remove, exclude, max), the dialog's preview and
      copy sequencing with a mixed success/409 result. Baselines stay green.

## User stories covered

- 57
