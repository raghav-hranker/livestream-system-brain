# Course, PDF and test feedback

**Type**: AFK
**Blocked by**: 01
**Repo**: backend + admin

## What to build

A student can rate a course they can access, and a PDF or test they reached through a course, through
the same three routes. The admin list gains a kind filter.

Backend, registry entries only (no new routes, no `if kind` outside the registry):
- `course`: `authorizeCourseAccess`; no `parent`; `facultyIds` = `Course.faculties`; `consumed` always true.
- `pdf`: placed in the parent course via `CoursePdf`, then the course rule for that placement (match how
  the course PDF access route decides); `facultyIds` `[]`; `consumed` = a `DocumentRead` of kind
  course-pdf or class-pdf for this PDF and user.
- `test`: placed via `CourseTest`, then the course rule. Confirm what Vidyagram's test access check is
  (`CourseTest.topic` exists for build orders) and reuse it; if there is none, write the placement plus
  course rule into the registry entry and say so in the report. `consumed` = an attempt in `UserTestData`
  or `Scores` for this series and user.

Admin: a kind select on the list page; the request carries `kind`.

## Acceptance criteria

- [ ] Integration: a buyer rates a course; a non-buyer gets 403; a free course accepts any logged-in student.
- [ ] Integration: `facultyIds` on a course row equals the course's `faculties`.
- [ ] Integration: a PDF and a test placed in a bought course can be rated with `parent: course`; the same
      items with an unrelated course as parent are refused.
- [ ] Integration: a build order granting a test's topic allows rating that test; one that does not, refuses.
- [ ] Integration: `consumed` is true for a PDF after a `DocumentRead`, and for a test after an attempt.
- [ ] Integration: course tags are accepted on a course and refused on a PDF.
- [ ] Admin component test: the kind select sets `kind` on the request.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 1 (course, PDF, test), 3, 16
