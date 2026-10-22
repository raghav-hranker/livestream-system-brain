# Class feedback end to end

**Type**: AFK
**Blocked by**: None, can start immediately
**Repo**: backend + admin

## What to build

A logged-in student who can watch a class in a course rates it with stars, complaint tags (only at 1 to 3
stars) and a note, and can change it later. An admin with the new "Feedback" screen permission sees the
rows on a plain list page.

Backend:
- `Feedback` model (collection `feedbacks`) with the PRD's fields: `userId`, `target { kind, id }`,
  `parent { kind, id }`, `facultyIds`, `rating`, `tags`, `note`, `consumed`, `hiddenAt`, `hiddenBy`,
  timestamps. Declare the unique `{ userId, 'target.kind', 'target.id' }` index and the three read indexes
  in the schema (prod builds them by hand in task 12).
- `FeedbackTag` model (collection `feedbacktags`): `kind`, `code`, `label`, `order`, `active`, unique on
  `{ kind, code }`. An idempotent seed script under `scripts/` writes the starter tags for all six kinds
  from the PRD, matching on `{ kind, code }`, dry-run by default and `--commit` to write.
- The feedback registry module with the `class` entry only. `authorize` checks the class is placed in the
  `parent` course (`CourseClass`) and then calls `authorizeClassAccess`. `facultyIds` returns `[]` for now
  (task 05 fills it). `consumed` uses the `watchStatus` 90% rule over `ClassProgress`. Only
  `parent.kind: 'course'` is accepted in this task.
- App routes behind `authenticateToken`, user id from `req.user`, never the body:
  - `GET /api/feedback/tags?kind=` returns active tags for one kind, or every kind grouped when `kind` is
    absent, each with `code` and `label`, ordered.
  - `GET /api/feedback/mine?kind=&id=` returns the student's row or `null`.
  - `PUT /api/feedback` upserts on the unique key. 400 for a bad rating, unknown, wrong-kind or retired
    tag, any tag at 4 or 5 stars, a note over 1000 characters, a missing `parent`, or a kind the registry
    does not know. 403 when `authorize` refuses. 404 when `load` finds nothing.
- Admin route `GET /api/admin/feedback/` returning rows newest first, paged, with student name and mobile,
  behind admin auth and the "Feedback" screen permission.

Admin:
- "Feedback" sidebar entry and screen permission (follow how other screens register their permission;
  see the admin screen permission drift memory for the traps).
- A list page with student, mobile, item title, stars, tags (labels), note, consumed badge and date.

## Acceptance criteria

- [ ] Integration: a student with access rates a class; `mine` returns it; a second `PUT` changes it and
      the collection holds one row.
- [ ] Integration: a student without access gets 403 and nothing is written. A build order that grants the
      class's topic allows the write.
- [ ] Integration: a class sent without `parent`, or with a course it is not placed in, is refused.
- [ ] Integration: 2 stars with two class tags saves both; 4 stars with any tag returns 400; changing the
      2-star row to 5 stars with empty `tags` leaves no tags.
- [ ] Integration: unknown tag, PDF tag on a class, retired tag, rating 0, rating 6, a 1001-character note
      and `kind: 'faculty'` each return 400.
- [ ] Integration: `tags` with no `kind` returns all six kinds grouped; `kind=class` returns only class
      tags; a retired tag is in neither.
- [ ] Integration: `consumed` false before a 90% progress span, true after.
- [ ] Integration: the admin list returns the row with student name and mobile; a request without the
      screen permission is refused.
- [ ] Seed run twice (against the test database) leaves one row per `{ kind, code }`.
- [ ] Admin component test: the list renders a row with tag labels and the consumed badge.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 1 (class only), 2, 3, 4, 5, 6, 7, 8, 15, 16 (class only), 22, 23, 24, 25
