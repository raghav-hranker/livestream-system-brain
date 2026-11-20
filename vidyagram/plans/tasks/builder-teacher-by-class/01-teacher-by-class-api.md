---
status: done (live 2026-11-20, backend b28b96a42)
tenant: vidyagram
repo: quicktricks-backend (Vidyagram line, branch vidyagram-admin)
worktree: ~/Projects/worktrees/vg-builder-teacher-class (branch feat/vg-builder-teacher-by-class, off origin/vidyagram-admin 93624469c)
supersedes: ../builder-teacher-choice/01-teacher-choice-api.md (pair model; do not deploy feat/vg-builder-teacher-choice)
---

# Course Builder: teacher per class in merged chapters (backend API)

## Why

Course builder v2 (`6aff1280d8f488b0916b2f98`, on sale, no orders yet) sells chapters of a maths course built from two
single-teacher courses: Aditya Ranjan (`6ad5fa4c308a95d039c360fe`, faculty `6ada06b0ab837d7b99531da3`) and Abhinay
Sharma (`6af50ea418e98c6518eebd67`, faculty `6af82ced78ca0c03c5968bb8`). The client wants chapters taught by both
teachers **merged into one topic**, with **access decided per class**: a student who picks Abhinay Sir for Algebra gets
only Abhinay's Algebra classes. The app shows one row per chapter with an "Aditya Sir / Abhinay Sir" toggle, pre-set to
the suggested teacher; class count and View follow the selected teacher. The app team needs this API first; the admin
screen comes later. The data (merges, teacher per placement, weights) is written by a separate script (task 02).

## Decisions (grilled with the user 2026-11-20; do not reopen)

- **Teacher per class lives on the placement**: new optional `CourseClass.teacher` (ObjectId, ref `FacultyDetails`).
  Never on `Class` (shared with the source courses; AppX nightly writes it). Absent = no known teacher.
- **Teacher config lives on the builder**: new optional `Course.builder.teachers`:
  ```ts
  teachers?: {
    options: { facultyId: Types.ObjectId; label: string }[];   // toggle order; label e.g. "Aditya Sir"
    suggestedFacultyId: Types.ObjectId;                        // default suggestion for every chapter
    chapterSuggestions?: { topicId: Types.ObjectId; facultyId: Types.ObjectId }[]; // per-chapter override (admin UI later)
  }
  ```
  Like `teacherChoices` on the old branch: not part of the admin save (`saveCourseBuilder` `$set`s named fields), so a
  save keeps it. Check that is still true and keep it so. Absent = the course has no teacher logic at all (every other
  builder course behaves exactly as today).
- A **two-teacher chapter** is computed, not configured: a builder chapter whose active placements (status 1,
  isActive) carry two or more distinct `teacher` values that are among `builder.teachers.options`. Every other chapter
  has no toggle and no teacher restriction.
- **Same price whichever teacher.** Pricing (`priceBuild`) does not change.
- **One teacher per chapter in a build**, never both. Checkout input gains
  `teachers: { [topicId]: facultyId }` (optional). For each picked two-teacher chapter: a given teacher must be one of
  that chapter's teachers (else 400 with a clear message naming the chapter); a missing one = the chapter's suggested
  teacher (an older app sending nothing gets the suggestion). A teacher sent for a chapter that is not two-teacher (or
  not picked) is ignored.
- **Teacher change after purchase is admin-only** (admin UI later). Checkout refuses a two-teacher chapter the student
  already owns with a different teacher (409, e.g. "You already have Algebra with Aditya Sir. Contact support to switch
  teacher."). Re-buying with the same teacher keeps today's behaviour.
- **Content with no teacher in a two-teacher chapter is open to every buyer of the chapter**: a placement with no
  `teacher`, course PDFs, course tests. So `courseTestAccess.ts` and the PDF branch of `classAccessAuthz.ts` do not
  change.
- **Buyer view of class lists**: for a partial owner restricted to one teacher in a chapter, the student class lists
  drop the other teacher's placements of that chapter. Non-buyers and full owners see every class, each tagged with its
  teacher.
- Revision only stays paused; no whole-course purchase in the builder; no admin screen in this task.

## Work

1. **Models.** `src/models/CourseClass.ts`: `teacher?: Types.ObjectId` (ref `FacultyDetails`, default undefined, no
   index). `src/models/Course.ts`: `builder.teachers` as above (sub-schemas `_id: false`, default undefined).
   `src/models/Order.ts` `IOrderBuild` / `orderBuildSchema`: `teachers?: { topicId: ObjectId; facultyId: ObjectId }[]`
   (absent on builds before this task and on builds with no two-teacher chapter).

2. **Teacher rule, one place** (`src/services/courseScope.ts`):
   - `ScopeBuild.teachers?: Map<string, string>` (topicId → facultyId) read by `scopeBuild` from `build.teachers`.
   - `CourseScope` partial gains `teachers: Map<string, Set<string>>`: per topic the teachers the user owns. A topic
     absent from the map = every teacher (an older build, a single-teacher chapter, or any build of that topic without
     a teacher entry: no restriction beats a restriction). Several builds with entries for one topic union their sets.
   - Replace `chapterOpensClass(chapter, isRevision)` with one rule that also takes the placement's teacher, e.g.
     `scopeOpensPlacement(scope, { topicId, isRevision, teacherId })` = today's chapter rule AND
     (`teacherId` null OR topic not in `scope.teachers` OR `scope.teachers.get(topic).has(teacherId)`). Keep the
     revision behaviour byte-for-byte. Same for `buildOpensClass(build, placement)` (notification audiences).
   - `ClassPlacement` gains `teacherId?: string | null`. Every caller passes it:
     `classIdsOpenedByScope` (select `teacher` from CourseClass), `scopeOpensClass` in `classAccessAuthz.ts` (extend
     `CoursePlacementForAuthz` and `mongoAuthorizationDeps.findCoursesForClass` to read `teacher`),
     `certificatePolicy.ts everOwnedWholeCourse` (its placement loader), `notificationAudience/buildBuyers.ts`.
     Grep for every `chapterOpensClass` / `buildOpensClass` / `scope.chapters` use; none may be left on the old rule
     for classes.
   - `PartialOwnership` gains `ownedTeachers: Record<topicId, facultyId[]>`, only topics with a restriction. It flows
     to the course card (`courseAccessState.ts`) and to the builder `ownership` automatically; check both.

3. **Builder API** (`src/controllers/courseBuilderDataController.ts`, `GET /api/courses/:id/builder`): still one row per
   chapter. When `builder.teachers` is set, a two-teacher chapter row also carries
   ```json
   "suggestedTeacherId": "<facultyId>",
   "teacherOptions": [
     { "teacher": { "id": "<facultyId>", "label": "Aditya Sir", "name": "<FacultyDetails.name>", "imageUrl": "<FacultyDetails.imageUrl|null>" },
       "classCount": 20, "revisionClassCount": 0, "durationSeconds": 0, "hours": 0, "suggested": true },
     { "teacher": { "id": "…", "label": "Abhinay Sir", … }, "classCount": 21, …, "suggested": false }
   ]
   ```
   in `builder.teachers.options` order. Option counts = that teacher's classes **plus the no-teacher classes** of the
   chapter (what that buyer would get). The row's own `classCount`/`hours` stay the whole chapter. Rows without a
   toggle carry neither field. Top level `data.teachers`: the options with `{ id, label, name, imageUrl }` (so the app
   can render labels once). Reuse the FacultyDetails lookup and response code from `feat/vg-builder-teacher-choice`
   (`~/Projects/worktrees/vg-builder-teachers`, commit d0490a5c2), not its pair/pricing parts.

4. **Checkout** (`src/services/buildOrder.service.ts` `buildPicksSchema` + `prepareBuildOrder`): `teachers` input and
   the rules above; the snapshot stores `build.teachers` for every picked two-teacher chapter (resolved suggestion
   included, so access never depends on later setting changes). The admin grant and the admin quote share this path:
   check they still work with no `teachers` (suggestion applies). `describeBuildOrders` adds per chapter
   `teacher: { id, label } | null` (label from the course's current `builder.teachers`, else FacultyDetails name), and
   `describeBuildInWords` writes "Algebra (Abhinay Sir)".

5. **Student class lists** (`GET /api/courses/:courseId/classes` = `getClassesForCourse`, `POST
   /api/courses/:courseId/class-tabs` = `classTabsController`; check `getClassesForTopic`, `todays-classes` and
   `courses/:courseId/search` too and apply where they list a course's placements): each class carries
   `teacherId` (placement teacher or null) and `teacherLabel` (from `builder.teachers`, else null). For a signed-in
   partial owner whose scope restricts a topic, drop placements of that topic whose `teacherId` is set and not owned.
   Only on the student mount: the admin mount (`/api/admin/courses/:courseId/classes`) is untouched. One helper (e.g.
   `teacherVisibilityFor(userId, courseId)` in courseScope.ts or a small service) so all lists share the rule.

6. **Tests** (vitest, suites run as in `vidyagram/plans/tasks/vidyagram-course-builder/README.md`): pure scope rule
   (restriction, no-teacher class open, older build unrestricted, union, revision unchanged); authz (playback refused
   for the other teacher's class, allowed for own and for no-teacher); checkout (default suggestion, explicit teacher,
   foreign teacher 400, owned-other-teacher 409, snapshot); builder response shape; class list filtering for a
   partial owner and not for a non-owner. Baselines: compare failing suites against `origin/vidyagram-admin` before
   your change; report any new failure.

## Out of scope

Admin screens (teacher per class, per-chapter suggestion, teacher change on an order), the post-purchase course page
beyond the class-list filter, other student lists (timetable, global search, watch history, home continue: server-side
playback already refuses the other teacher's classes), Revision only, data writes (task 02).

## Done when

All of the above with tests green against the baseline, `npx tsc --noEmit` clean apart from the baseline's known
errors, one commit (or a few) on `feat/vg-builder-teacher-by-class` as raghavsharma@hranker.com with **no
Co-Authored-By trailer**, nothing pushed, and a short report: files touched, any caller found that the list above
missed, test counts vs baseline.
