# Teachers tab and faculty page section

**Type**: AFK
**Blocked by**: 05, 06
**Repo**: backend + admin

## What to build

Admins see teachers ranked by their classes' ratings, and each teacher's classes worst first.

Backend:
- `GET /api/admin/feedback/teachers?from&to&courseId&sort`: class feedback grouped by `facultyIds`, one
  row per teacher with `facultyId`, `name`, `classesRated`, `count`, `average`, `lowCount`, `score` (with
  `m` the class mean) and top three tags. Each row also carries `courseAverage`, the average course
  rating across courses whose `faculties` include the teacher. It sits beside `score` and never enters it.

Admin:
- A Teachers tab on the Feedback page with that ranked table. A row opens the teacher's classes ranked
  worst first (`/items?kind=class&facultyId=`), and each class opens the drawer from 06.
- A Feedback section on the faculty page showing that teacher's row and their classes.

## Acceptance criteria

- [ ] Integration: a teacher whose classes average 2 sorts above one whose classes average 4, worst first.
- [ ] Integration: changing course ratings moves `courseAverage` and leaves `score` unchanged.
- [ ] Integration: feedback on a class with no `facultyId` appears under no teacher.
- [ ] Admin component tests: the Teachers tab drills into classes; the faculty page section renders.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 11, 18
