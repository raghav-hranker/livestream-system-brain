# Classes section, end to end (guest view)

**Type**: AFK
**Blocked by**: None — can start immediately

## What to build

The tracer bullet. `POST /api/search` returns a `classes` section, placed right after `courses`,
in the PRD's wire contract, with every searcher treated as a guest (owns nothing). Purchases arrive
in task 02, and placement-title matching in task 03.

- **Matching and ranking** (D5): the admin title-search module over `Class.title`, active classes
  only (`status: 1`). Ties go to the newest class. Top N applies *after* classes with no attached
  course are dropped, so over-fetch candidates.
- **Class result builder** (pure; PRD "Implementation Decisions"): given a class, its placements,
  their courses and an owned-course set, it returns a Class search result or nothing. Build it
  fully now, including the owned-course rules. This task always passes it an empty owned set, so
  in effect: active placements in active courses only; per-course `isFree` = placement ∨ course;
  `isPurchased: false`; `canPlay` = class free ∨ any attached course free; per-course `classTitle`
  (placement title → APX title → class title) and placement `startDate`/`endDate`; ordering
  purchased → free → course priority; no attached course → nothing.
- **Readiness** (D6): `streamStatus` + `hasPlayback` on every result. Never `Class.isLive`, never
  the asset.
- **Attached course fields**: the course search result's fields (reuse its mapper) plus
  `isActive`, `isFree`, `isPurchased`, `classTitle`, `startDate`, `endDate`.
- **Search plumbing** (D7): `classes` / `class` in the section and type maps; default order
  courses, classes, ebooks, …; a "Classes" capsule in `/api/search/collections`;
  `/api/search/click` accepts `class`; `/api/search/trending` includes `classes: []` and never
  hydrates classes; the search logger counts the new section.
- The class searcher implements the existing `Searcher` contract and is registered beside the
  declarative registry entries (it is not a single-collection regex). A failing class searcher
  degrades to an empty section, like every other section.
- Placements and courses load in batched queries per request, never one per class.

## Acceptance criteria

- [ ] `POST /api/search` with `class 44 mixture` returns the matching class in `classes`, ranked
      above looser matches; `2` matches `02` but not `12`; `alligation` finds `allegation`.
- [ ] The response has sections in the order courses, classes, ebooks, … and every other section
      is byte-identical to before for the same query.
- [ ] An inactive class, a deactivated placement, and a placement in an inactive course never
      appear. A class whose only placements are excluded is not returned at all.
- [ ] Each result matches the PRD wire contract; `isPurchased` is `false` everywhere; `canPlay`
      is true exactly when the class, a placement or a course is free.
- [ ] Upcoming (no asset), live, processing and recorded classes all appear with correct
      `streamStatus` / `hasPlayback`.
- [ ] Collections lists "Classes" after "Courses"; a click with `type: "class"` returns 204;
      trending returns `classes: []`.
- [ ] Unit tests for the result builder cover every rule as a table (prior art: the search
      mapper tests), including the owned-course cases task 02 will rely on.
- [ ] Integration test for the class searcher: word order, whole numbers, close spellings,
      newest-first tie-break, inactive excluded, top N after drops (prior art: the title-search
      integration test).
- [ ] Orchestrator tests still pass, plus a case where the class searcher throws and only that
      section is empty.

## User stories covered

- Stories 1–7: classes are searchable, placed after courses, have a capsule, and use ranked,
  typo-tolerant matching
- Story 9: attached courses listed
- Story 11: free marked
- Stories 18–24: every lifecycle stage, per-course dates and titles, dead content hidden
- Stories 25–28: clicks, recent searches, other sections unchanged, graceful degradation
- Stories 31–35: app-facing contract
