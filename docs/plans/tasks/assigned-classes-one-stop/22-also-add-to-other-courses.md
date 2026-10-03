# Also add new classes to other courses

**Type**: AFK
**Blocked by**: #20 (same dialog), #21 (`CourseMultiSelect`)

## What to build

PRD Round 4 decisions 42 and 43. Backend + admin.

**Backend**
- The in-place endpoint (`adminCourseClassInPlaceController.ts`, `src/services/courseClassInPlace.ts`)
  accepts `alsoCourseIds: string[]` (0–20, distinct, not the course itself; 400 otherwise), for
  `title`, `titles` and live bodies alike.
- In the **same transaction** as the main create: for each extra course, one placement per class with
  the same section/topic/subtopic, landing last there in the order sent (that course's
  listing-aware max + 1, its topic-order append, as the main course does). Recorded placements wait
  for their recording (`status: 0` + `waitingForRecordingSince`, task 14), so the stream-status flip
  turns them on in every course; live placements get the same dates as the main one.
- 404 naming an unknown course, before any write. 403 for a restricted role when `alsoCourseIds` is
  non-empty, matching Copy's rule and message style (`adminCourseCopyController.ts`).
- Response adds `alsoAdded: [{ courseId, placementIds }]`.

**Admin**
- In `AddClassInPlaceDialog`, under Teacher: "Also add to other courses" with `CourseMultiSelect`
  (current course excluded), hidden for restricted roles. Works in every shape: no video, one video,
  several videos, live, and from the course-level picker (task 20).
- Create sends `alsoCourseIds`; the toast adds "Also added to N courses". The upload queue is
  unchanged.
- A sentence under the picker: "Same Section › Topic › Subtopic, last there. Recorded classes stay
  hidden in every course until the recording is ready."

## Acceptance criteria

- [ ] Creating 3 recorded classes with two extra courses makes 9 placements, each last in its course
      in list order, all waiting; one `ended` stream-status per class turns that class on in all
      three courses.
- [ ] A live class lands in the extra courses with the same dates.
- [ ] An unknown course or a restricted role writes nothing.
- [ ] Tests: backend integration (single, several titles, live, ordering per course, topic-order
      append in an extra course, waiting flip across courses, 404/403/400 write nothing). Admin: the
      picker hidden for restricted roles, the body, the toast. Baselines stay green.

## User stories covered

- 56
