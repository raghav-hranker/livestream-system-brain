# Courses screen builder strip: Revision extra and labels

**Type**: AFK
**Blocked by**: 01
**Repo**: admin

## What to build

The existing builder settings on a course's classes screen follow the task 01 rule.

- `lib/course-builder.ts`: types, `builderDraftFrom`, `builderSaveBody` and the price helpers with `revision` as an
  extra and no Revision only. These helpers are what task 06's preview uses, so they must equal the backend rule.
- `components/admin/assign-classes/CourseBuilderMode.tsx` and `BuilderPricePreview.tsx`: Revision is a third extra
  row (price, ticked by default); each extra's switch reads **Show in the app** with the hint "Hidden in the app:
  students don't see or get it"; labels **Maximum selling price**, **Minimum selling price**, **MRP**. Remove the
  Revision-only controls. The revision tag switches on class rows stay (they mark which classes the extra opens).
- `hooks/api/use-course-builder.ts` types follow.

## Acceptance criteria

- [ ] Unit (`lib/course-builder.test.ts`): the helper prices the same cases as the backend `priceBuild` tests in
      task 01 (copy the numbers).
- [ ] The strip saves a Revision extra and reloads it; Revision only is gone from the screen.
- [ ] `NO NEW FAILURES` against the admin baseline.

## User stories covered

- Stories 16, 17
