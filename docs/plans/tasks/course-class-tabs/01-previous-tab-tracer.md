# Previous tab, end to end (tracer bullet)

**Type**: AFK
**Blocked by**: None — can start immediately

PRD: `docs/plans/prd-course-class-tabs.md`. Glossary: `CONTEXT.md` → "Class timing"
(Course class tabs, Previous tab, Live class).

## What to build

The tracer bullet. `POST /api/courses/:courseId/class-tabs` with `tab: 'previous'` returns a flat,
cursor-paginated list of this course's past, playable classes, newest first, in the same card shape
as `POST /api/courses/:courseId/todays-classes`. Upcoming (task 02), Today (task 03) and watch status
(task 04) come later — but build the shared pieces so they slot in without rework.

- **Card projection** (shared): extract the today's-classes card projection (taxonomy lookups with
  per-course overrides, effective start/end, `streamStatus`, `hasPlayback`, `isBlinking`, title
  override, etc.) into one builder used by **both** today's classes and the new endpoint. Today's
  classes must return byte-identical cards afterwards (its `isCompleted` and `classToWatch` stay).
  The new endpoint's card omits `isCompleted`.
- **Tab classifier** (pure + aggregation stage): (effective start, stream status, playable, now) →
  `today | upcoming | previous | none`, using IST calendar days. Build all three tabs' rules now
  (Live = `live|reconnecting` → today whatever its day; previous requires playable; no effective
  start → none) even though only `previous` is wired. The stage must agree with the pure function
  on shared fixtures.
- **Eligibility**: placement `isActive: true` and `status: 1`, Class `status: 1`. Deactivated /
  status-0 placements never appear (this is how an admin cancels).
- **Playable** = the existing listing `hasPlayback` rule (HLS asset, or YouTube link). Stream status
  not required.
- **Cursor codec**: opaque encode/decode of (effective start, placement id); rejects malformed or
  tampered input with 400. Keyset paging: Previous sorts effective start desc, placement id desc.
  `limit` default 20, max 50. `nextCursor: null` on the last page.
- **Controller/route**: zod-validated body `{ tab, watch?, cursor?, limit? }` (accept `watch` now,
  default `'all'`, it is a no-op until task 04); `optionalAuthenticateToken`; any body `userId` is
  ignored; 400 invalid course id / tab / limit / cursor; 404 unknown course. Response
  `{ state: 200, msg, data: { classes, nextCursor } }`. Requests for `tab: 'upcoming' | 'today'`
  return 400 "not yet supported" until their tasks land (or implement them if trivially covered —
  but tasks 02/03 own their acceptance).

## Acceptance criteria

- [ ] Previous returns only placements whose effective start is on an IST day before today, not Live, and playable.
- [ ] A class `processing` without an asset is excluded; an APX-style class with an asset and no stream status is included; a stream `ended` with an admin-uploaded asset is included.
- [ ] Deactivated and status-0 placements, and status-0 Classes, never appear.
- [ ] Placements with no effective start never appear.
- [ ] Order is effective start desc, then placement id desc; paging with the cursor returns every eligible placement exactly once, including when "now" moves past IST midnight between pages.
- [ ] Malformed/tampered cursor, bad tab, bad limit, bad course id → 400; unknown course → 404.
- [ ] A body `userId` has no effect on the response.
- [ ] Today's classes responses are unchanged (regression test on its cards).
- [ ] Unit tests for the classifier (IST 23:59/00:00 boundaries, live overrides day, reconnecting, processing, no date) and cursor codec; integration test (memory Mongo) for the endpoint; `npx tsc --noEmit` clean.

## User stories covered

10–19, 38, 40, 43–48, 50
