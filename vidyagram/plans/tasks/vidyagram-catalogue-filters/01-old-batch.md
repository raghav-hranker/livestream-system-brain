# Old batch end to end

**Type**: AFK
**Blocked by**: None — can start immediately
**Repo**: backend + admin

## What to build

An admin ticks "Old batch" on a course; the course then appears only on the app's Old tab and nowhere
else in the catalogue, stays buyable, and buyers keep everything.

Backend:
- `Course.isOld` (boolean, default false) in the model and in the create and update validation. A body
  with `isOld: true` and `isLive: true` is rejected 400 naming the field. Every course read projection
  includes `isOld`.
- Create the **catalogue rule** module (pure, no Mongo): given a tab it returns the query clauses to add,
  and given a course it returns the tabs that may list it. Seed it with the Old rule and the existing New,
  Live, VOD and Free rules as they stand in the filter handler today (including "live implies not free").
  Old: `tab: 'old'` adds `isOld: true`; every other tab, and no tab, adds `isOld: { $ne: true }`.
- `POST /api/courses/filter` and `/batch-filter` accept an optional `tab` and apply the rule. In this task
  only `old` has to be a recognised value with its own behaviour; the other names may be accepted and
  behave like no tab (task 04 gives them their rules). `isOld` is **not** accepted as a body field.
- The admin picker mount (`/api/admin/courses/filter`) keeps old courses; it passes a flag the rule honours.
- `my-courses`, entitlement, playback and PDF paths are untouched by `isOld`.

Admin:
- Course form: an "Old batch" switch in the flags row next to Live Course / Is Free / Recorded Course /
  Show in New section. Turning it on turns Live Course off and disables it with a hint; loading a course
  with `isOld` shows the switch on; create and update payloads send it.
- Courses list (v1 and v2 pages): an "Old" badge in the title cell and an "Old" entry in the client-side
  flag filter, using the same helper pattern as the "New Section" badge.

## Acceptance criteria

- [ ] Unit tests on the catalogue rule: clauses per tab, and the tab set for an old course, a live course,
      a free course, a plain VOD course.
- [ ] Integration tests through the real route: an `isOld` course is returned for `tab: 'old'`, absent for
      every other tab name and for a request with no `tab`, present on the admin picker mount, still
      returned by my-courses for a buyer.
- [ ] Integration test: create or update with `isOld` and `isLive` both true returns 400 naming the field;
      sending `isOld` in the filter body returns 400 (strict schema).
- [ ] Integration test: the website-shaped request (`{isLive:true, isRecorded:false, showInBatchFilter:true, status:1}`)
      returns the same set as before minus old courses.
- [ ] Admin component tests: the switch turns Live off and disables it; the payload carries `isOld`;
      loading an old course shows it on; list badge and filter render.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 9, 11, 12, 17, 18, 19, 20, 21, 28, 32, 33
