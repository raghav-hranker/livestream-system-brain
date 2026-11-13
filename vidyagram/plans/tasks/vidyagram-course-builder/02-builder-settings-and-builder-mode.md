# Builder settings and Builder mode

**Type**: AFK
**Blocked by**: None — can start immediately
**Repos**: backend and admin

## What to build

An admin opens Assign Classes for a course, switches **Builder mode** on, sets the course's Course
Builder settings and each chapter's weight or custom price, and saves. Reloading shows what was saved.
The mockup (https://claude.ai/artifact/QzLTCVVUE9arNE6r34yWwA) shows the target layout; match the
existing Assign Classes look, not the mockup's styling.

**Backend.** Store an embedded `builder` object on the course:
`{ enabled, minPrice, maxPrice, mrp?, chapters: [{ topicId, weight, customPrice? }],
extras: { notes: { offered, value, defaultOn }, tests: { offered, value, defaultOn } },
revisionOnly: { offered, discount }, version }`. `version` increments on every save (task 04 snapshots it).

Admin-only endpoints (existing admin auth middleware, user from the token): read and replace a course's
builder settings. Validation on save, each failure a clear 400 message:
- weights sum to exactly 100, in steps of 0.5; each weight ≥ 0;
- `0 < minPrice ≤ maxPrice`; every value, discount and custom price ≥ 0;
- Notes value + Tests value + revision discount (only those offered) ≤ `maxPrice − minPrice`;
- every `topicId` is a topic in this course's outline, with no duplicates;
- `enabled: true` is refused while any active class placement in the course has no topic (PRD question 8).

Chapter price is not stored. It is `customPrice` if set, else `maxPrice × weight / 100`.

**Admin.** On the Assign Classes screen:
- A **Builder mode** switch in the toolbar. It is a view switch only and changes nothing about selling.
  It may be remembered per browser.
- With it on: a settings strip (Sell as Course Builder switch, min, max, struck-out price, Notes and
  Tests value with offered / default-on, Revision-only discount with offered), the running weights total
  and Save (no Normalise action: dropped 2026-10-19, admin 86645f1). A derived line shows the whole course with Notes and Tests
  off. The custom price field says it is the price with Notes and Tests on.
- Topic rows gain Weight %, Custom ₹ and Chapter price. Section rows show their weight and price totals.
- Classes outside any chapter are flagged, and the Sell switch explains why it cannot be turned on.
- Save sends the settings; backend validation messages are shown as returned.
- With Builder mode off the screen is exactly as today.

Not in this task: revision toggle on class rows (08a), price preview drawer (10).

## Acceptance criteria

- [ ] Backend integration tests for each validation rule above and for a valid round trip (save, read
      back equal, `version` incremented).
- [ ] Non-admin and unauthenticated requests are rejected.
- [ ] Admin tests for: Builder mode off renders today's columns; weights total; Save
      disabled while the total is not 100; a backend error message is shown.
- [ ] Both suites `NO NEW FAILURES` against their baselines.
- [ ] Report says plainly that nothing was checked in a browser, if it was not.

## User stories covered

- Story 25, 26, 27, 28, 29, 30, 31, 32, 38
