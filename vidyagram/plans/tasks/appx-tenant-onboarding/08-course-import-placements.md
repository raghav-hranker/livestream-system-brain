# 08 — Courses and their class placements (Vidyagram)

Status: **done 2026-10-19** — 129 courses / 32,928 rows imported into vidyagramdb (see Round 2 and memory prod-data-changes); branch `feat/vg-course-import` (b1de0c75b) local, not pushed. Tenant: Vidyagram (customer 781, DB `vidyagramdb`). Repo: `abhi092515/quicktricks-backend`. Cut a new branch
`feat/vg-course-import` from `feat/vg-nightly-sync` (tip f79842940; 49 ahead of `feat/vg-class-import` a9e223745, 0
behind). Read [04b-class-import-commit.md](04b-class-import-commit.md) and
[07-class-naming-reconcile.md](07-class-naming-reconcile.md) first.

## Decisions (user, 2026-10-19)

- **Courses come in now, class names stay as they are.** The Class rename (task 07) waits until the courses exist;
  the app has not launched, so no student sees the interim names.
- **Course-row names:** `CourseClass.apxTitle` = the ledger placement's `apxTitle` (AppX's exact title, e.g.
  "CLASS-01"). `CourseClass.title` is never set (it is the admin's course-only rename). Never read the ledger
  placement's `title`: it carries the planner's in-course counter ("CLASS-01 (2)", `applyTitleCounter`,
  `apxCatalogPlanner.ts:668`). Students see `title ?? apxTitle ?? Class.title` (`cardTitleExpr`,
  `services/classTabs/courseClassCard.ts:23`), so they see "CLASS-01". This matches the existing convention: the
  AppX status sync writes only `apxTitle` (`apxClassStatusSync.ts:234-236`).
- **Several "CLASS-01" rows in one course are fine.** Only `{course, class}` is unique (`models/CourseClass.ts:245`);
  each row points to a different Class.
- **Classes only.** PDFs and notes stay with task 06.
- Earlier decisions still hold: disabled AppX courses come in off-sale, status 0 (0c); MainCategory "Vidyagram",
  Category "All Courses" (0d); faculty "Vidyagram Team" (0b).

## Round 2 (user, 2026-10-19, after the first read-only dry run)

Dry run on `--run daily-2026-10-19` (outputs/vidyagram-course-import-dryrun-2026-10-19/): 120 courses, 31,690 rows,
1,202 placements skipped for "no topic". Those break down as 1,047 that today's planner files (teacher-folder rules
03c/03d landed 10-14, after the ledger snapshot of 10-13), 100 that sit loose at a course's top level, and 55 no longer in
AppX's visible tree. Changes:

1. **Filing comes from today's plan**, keyed by (apxCourseId, rowId): section, topic, subTopic, priority, free, active.
   The ledger placement is the fallback only when today's plan lacks the item. `apxTitle` still comes from the ledger
   placement (or today's plan item's `apxTitle`, which is the same raw AppX text), never a counted `title`.
2. **Loose classes** (in today's plan with no topic): section = the course's section (plan `courseSection`, else the
   first section the course uses), topic **"Start Here"** when the course also has foldered classes, **"All Classes"**
   when every class of the course is loose. Test courses 66 and 4 included (both come in off-sale).
3. **Gone from AppX** (in the ledger for this course, not in today's plan): bring in **inactive**, as an AppX-disabled
   placement is (`isActive: false`, `status: 0`). Filing: today's filing of another class in the same course with the
   same AppX folder path (ledger `path`), else the ledger's own filing, else the course's "Start Here".
4. **Existing course guard:** an existing Course found by `apxCourseId` whose title differs from AppX's (by
   `classNameKey`-style comparison) is refused and listed, never filled. (10-19: 20 placeholder courses held AppX ids
   143–162 and would have taken 749 rows; they were unlinked, see `apxUnlinked` on each and
   `courses_backup_20261019_apxunlink`.)
5. Report adds: rows filed from today's plan vs ledger fallback, loose rows per topic name, gone rows, guard refusals.

## Courses with no classes are not created

A course is created only when at least one class row lands in it. `Course.title` is unique (`models/Course.ts:117`)
and three AppX pairs share a title: "STATE EXAMS" (116, 145), "RAILWAY EXAMS" (117, 146), "SSC EXAMS" (97, 144). None
has a class: 116, 117 and 97 hold only PDFs (2, 2, 10; exam info under folders like "UP SI", "SSC CGL"), 145, 146 and
144 are empty, and all six have no price (mrp -1 or -3). They look like AppX category pages. They stay out of this
task; whether the PDF-only three are wanted belongs to task 06. If any other course hits the title clash, refuse and
list it rather than suffixing " [apx:<id>]" (`resolveCourseTitle`, `apxBuildService.ts`).

## Build

`src/scripts/apxCatalogImportCourses.ts`: dry run by default, `--commit`, `--courses <ids>`; keep the DB-name guard.

- **Inputs:** the ledger `apxcatalogimports {customerId:'781'}` (`classId`, `placements[]` with `apxCourseId`, `rowId`,
  `apxTitle`, `section`, `topic`, `subTopic`, `priority`, `free`, `active`) and the planner's course object for course
  fields (same plans the class import used). Skip ledger rows without a `classId` (PDF, skipped-no-link).
- **Course:** find-or-create by `apxCourseId`, as `findOrCreateCourseForApx` does (`apxBuildService.ts:98`), adapted to
  the catalogue course (it reads `apxcourses`, which Vidyagram never writes). Fields from the plan's course object:
  title, description, image, price, mrp, isFree, validity, start/end date; status 0 when disabled or on the off-sale
  list. An existing course is never overwritten.
- **Taxonomy:** `resolveNamedApxPlacementTaxonomy` (`apxTaxonomyResolver.ts:194`) with the placement's section, topic
  and subTopic names. Create nodes only when a placement lands in them (plan rule 7). A placement with no topic
  (79 classes in the 10-16 preview) is skipped and listed, not forced into a holding topic.
- **CourseClass:** one row per (course, class), written the way the admin assign path writes it
  (`services/courseClassAssign.ts`, `newPlacementFields` / `assignClassesToCourse`), so `coursetopics` and any other
  side rows stay consistent; check what that path writes and mirror it. Set `apxTitle` (raw), priority from the
  placement, section/topic/subTopic ids and names, `isActive` from `active`, free from `free`. Never set `title`.
- **Same class twice in one course:** the first placement by priority wins; list the others (course, rowId, topic, and
  whether the topic differs) for the team. The 10-16 preview had 654 in the same topic and 116 in a different one.
- **Rerun is a no-op:** an existing (course, class) row is left untouched (first write wins, as the fork's Build does,
  `apxPortingService.ts:206-213`).
- **Never touches `Class`** (no title, taxonomy or status writes).
- Report: courses created / existing / off-sale, rows created, duplicates skipped, unfiled skipped, topics and sections
  created.

## Tests

- A ledger placement with `title` "CLASS-01 (2)" and `apxTitle` "CLASS-01" gives a row whose student card
  (`cardTitleExpr`) reads "CLASS-01", and `CourseClass.title` is unset.
- Four placements titled "CLASS-01" under four topics of one course give four rows.
- The same class placed twice in one course: one row, the first by priority; the other listed.
- Disabled course → status 0. A course with no class rows → not created. Duplicate course title → refused and listed.
- No topic → skipped and listed. Rerun → nothing changes. No `Class` document changes.

## Trial

1. Dry run against `vidyagramdb` (read-only): the report above, for all courses. Show it to the user.
2. With the user's go: `--commit --courses 85` (Grammar Pro, the "CLASS-01" course).
   Re-read the DB: course doc, row count per topic, four "CLASS-01" rows, and the student listing
   (`GET /api/courses/85-id/classes` on a local backend, `PORT=5912 DISABLE_CRONS=true`) shows "CLASS-01". Rerun, show
   nothing changed.
3. Only then the remaining courses, again with the user's go.

## Done when

Tests pass, `tsc --noEmit` clean, trial step 2 verified twice, commits local on `feat/vg-course-import` (not pushed, no
dist rebuild).

## Later, not this task

- Merge batch copies (one recording placed as many Classes, e.g. "Circle 03" in CHAMPIONS 6.0 to 18.0) before launch;
  once students watch, progress attaches to a copy.
- Task 07 rename: before launch; its bulk rename must not run `followClassTitle` (`services/classNames.ts:212-235`),
  or every row whose `apxTitle` equals the old Class title is rewritten to the new one.
