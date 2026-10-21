# Classes section, end to end (guest view)

**Type**: AFK
**Blocked by**: None — can start immediately

## What to build

The tracer bullet. `POST /api/courses/:courseId/search` exists and returns the PRD's envelope
`{ classes, coursePdfs, tests }`. `classes` works fully for a guest. `coursePdfs` and `tests` are
`[]` for now; tasks 03 and 04 fill them. Per-student class state arrives in task 02, so every
class result carries the guest defaults exactly as `POST /courses/:id/class-tabs` gives a guest.

- **Course search service** (PRD "Implementation Decisions"): one entry point, course id + raw
  query + `{ limit, userId }` → the three sections. It owns the minimum length (D8, trimmed
  query ≥ 2, otherwise a validation error), the `limit` clamp (default 10, 1–50), running the
  sections in parallel, turning a throwing section into `[]` with a log line, and writing
  nothing to the global search log (D4). Build the three-section fan-out now, with the PDF and
  test sections as stubs returning `[]`.
- **Class section** (D6, D7, D9), built on the class-tabs internals, not a copy of them: the
  eligible placement stages (active placement, active class), the tab classifier's aggregation
  twin, the card projection and the class PDF attachment.
  - Match and rank with the title search on one **effective display title** field (placement
    `title` → `apxTitle` → `Class.title`), the same expression the card uses for `title`, defined
    once.
  - `tab` = the classifier's value, with `none` → `null`. Include `none` rows (no start date;
    past with nothing to play).
  - Sort by rank, then placement `priority`, then placement id. Cut at `limit`, **then** attach
    class PDFs, so PDFs are loaded only for returned rows.
  - Spelling vocabulary from the title search's cache, scoped to this course's class titles.
- **Route/controller**: `POST /api/courses/:courseId/search`, optional authentication, a
  request schema for `{ query, limit? }`. 400 for a malformed course id or a short query; 404
  for an unknown course; **an inactive course is searched normally** (D11). The user id is read
  only from the verified token (unused until task 02); body fields other than `query`/`limit`
  are ignored.

## Acceptance criteria

- [ ] `percentage 12` finds "Percentage Class 12" ranked above looser matches; `class 2`
      matches "Class-02" but not "Class-12"; `alligation` finds "Allegation".
- [ ] A class renamed in this course (placement `title` or `apxTitle`) is found by that name,
      and its result shows that name; its other name is not what the card shows.
- [ ] Results carry `tab`: `today`, `upcoming`, `previous`, and `null` for a no-date class and a
      past class with nothing to play. All four cases are findable.
- [ ] A deactivated placement and an inactive class never appear; a class placed only in
      another course never appears.
- [ ] Equal-rank matches come back in placement `priority` order.
- [ ] Each class item equals the class-tabs card for the same placement (same keys and values
      for a guest), plus `tab`; `classPdf` is filled.
- [ ] `coursePdfs` and `tests` are present as `[]`.
- [ ] 400 for a bad id and for `query: "a"`; 404 for an unknown course; 200 for an inactive
      course; `limit: 500` returns at most 50 per section; no `limit` returns at most 10.
- [ ] Nothing is written to the search log collection.
- [ ] Unit tests for the service with stubbed sections: length rule, clamp, all three keys
      present, one throwing section degrades to `[]` (prior art: the global search orchestrator
      tests).
- [ ] Integration test (`npm run test:integration`, in-memory Mongo) for the class section
      covering the cases above (prior art: the class-tab classifier fixtures and the title-search
      tests).

## User stories covered

- Stories 1–3: in-course search box, course-scoped, three sections
- Stories 4–9: typo-tolerant, ranked matching on the displayed title, course order for ties
- Story 10: class results carry class PDFs
- Stories 14–18: upcoming, live, past-without-recording and undated classes findable; removed ones not
- Stories 25–27: empty sections, a failed section degrades, short-query message
- Story 29: guests can search
- Story 31: kept out of global trending and recent searches
- Stories 33–35: `tab` on each class, all keys present, global search's limits
