# Teacher catalogue fields and API

**Type**: AFK
**Blocked by**: None — tasks 00–04 are deployed; cut from `feat/vg-catalogue-filters`
**Repo**: backend only

## What to build

The app's Teacher tab: a list of teachers, top rated first, with subject chips and per-teacher course
counts and exam-body chips.

- `FacultyDetails` gains three optional fields: `subject` (string, trimmed), `rating` (number 0–5, one
  decimal), `reviewCount` (integer ≥ 0). Admin create/update accept them (validation on range and type);
  every faculty read payload includes them.
- New public route `GET /api/faculty/catalogue?subject=&search=` (same router as the public faculty
  reads). Response:
  `{ teachers: [{ id, name, imageUrl, designation, subject, rating, reviewCount, coursesCount,
     mainCategories: [{ id, name, image }] }], subjects: [{ name, count }] }`
  - A teacher appears only with at least one **listable** course: a course in `faculties[]` (or legacy
    `facultyDetails`) matching the catalogue rule's `all` clauses plus the handler's common clauses
    (status 1, not old, not hidden APX). Reuse `catalogueClauses('all')`; do not restate the rule.
  - `coursesCount` counts those courses; `mainCategories` are their distinct main categories, ordered by
    main category priority.
  - Sort: rating desc (missing rating last), then reviewCount desc, then faculty `priority` desc, then name.
  - `subjects` = distinct non-empty `subject` values among the returned teachers, with counts, computed
    **before** the `subject` filter is applied; ordered by count desc then name.
  - `search` matches teacher name or subject, case-insensitive, regex-escaped (reuse `catalogueSearchText`).
  - Inactive teachers (status 0) are left out.
- No change to the course filter API. A teacher's courses are the existing
  `POST /api/courses/filter { facultyId, tab?, search? }`.

## Acceptance criteria

- [ ] Integration tests through the real route: teacher with no listable course absent; counts ignore old
      and status-0 courses; sort order with and without ratings; `subject` narrows `teachers` while
      `subjects` counts stay whole; search by name and by subject; `mainCategories` lists each group once;
      inactive teacher absent; a legacy `facultyDetails`-only course counts.
- [ ] Integration test: admin create/update accept the three fields, reject rating 5.1 and a negative
      reviewCount, and the public faculty read returns them.
- [ ] `NO NEW FAILURES` against `baseline-backend.txt`.

## User stories covered

- Teacher tab (PRD "Teacher tab" section): list, chips, rating sort, drill-down.
