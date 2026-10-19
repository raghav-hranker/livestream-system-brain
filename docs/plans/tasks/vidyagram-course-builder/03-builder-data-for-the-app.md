# Builder data for the app

**Type**: AFK
**Blocked by**: #02 — Builder settings and Builder mode

## What to build

A student-facing endpoint for one course that returns everything the Course Builder screen needs and
everything the app needs to run the pricing rule locally: sections in outline order, each with its
chapters (topic id, name, weight, chapter price, class count, revision class count (placements with `isRevision: true`, the field task 08a adds; count 0 while it is absent), hours where class
duration is known), the min, max and struck-out prices, the Notes and Tests settings, and the
Revision-only setting. Returns 404 when the course has no enabled builder. No user data in the response.

## Acceptance criteria

- [ ] Integration test against a seeded course: order and numbers match the stored settings.
- [ ] Disabled builder → 404; unknown course → 404.
- [ ] Inactive placements are not counted.
- [ ] Suites `NO NEW FAILURES`.

## User stories covered

- Story 1, 2, 3, 9
