# PRD: Course class tabs (Today / Upcoming / Previous) with watch-status filters

State: ready-for-agent
Date: 2026-09-25
Owning repo: `quicktricks-backend` (production LMS fork, branch `quicktricks-admin`). Single-repo
work — no contract boundary is crossed; the app team consumes the new endpoint.
Tasks: `docs/plans/tasks/course-class-tabs/`.
Glossary: `quicktricks-backend/CONTEXT.md` → "Class timing" (**Course class tabs**, **Today tab**,
**Upcoming tab**, **Previous tab**, **Live class**, **Watch time**, **Watch status**).

## Problem Statement

Inside a course, a student has no single place to answer "what is on now, what is coming, and
what did I miss?". The only per-course schedule view is today's classes, which covers today only,
cannot be paged, and cannot tell the student which classes they have already watched. Past classes
are reachable only through the topic-grouped course listing, which is ordered alphabetically by
topic rather than by when the class happened, so "the class from yesterday" is hard to find. The
existing "completed" flag is misleading: a class opened for five seconds counts as completed, and
marking a class uncomplete does not un-complete it. Cancelled classes can still appear in today's
classes because that listing ignores the cancellation flag other listings honour.

## Solution

A course screen with three top-level tabs — **Today**, **Upcoming**, **Previous** — and, on Today
and Previous, a second row of filters — **Not watched · All · Watched · Partially watched**.

- **Today** shows every class of this course scheduled today (IST): not yet started, live now, or
  finished. A class that is live right now is always here and always at the top, even if it was
  scheduled for another day. A late class stays here until the day ends.
- **Upcoming** shows classes scheduled on later days, soonest first, loading more as the student
  scrolls.
- **Previous** shows classes from earlier days that have something to play, newest first, loading
  more as the student scrolls. Classes that never took place, or have nothing playable, never appear.
- Every card carries its taxonomy (category, section, topic) so the student knows what the class
  covers, plus its watch status and how much they have watched.
- A class the admin cancels (deactivates) disappears from every tab.

## User Stories

1. As a student, I want a Today tab for my course, so that I can see everything scheduled for today in one place.
2. As a student, I want the class that is live right now at the top of Today, so that I can join it in one tap.
3. As a student, I want a live class shown in Today even if it was scheduled for yesterday and ran past midnight, so that a running class never disappears.
4. As a student, I want a class whose teacher is late to stay in Today, so that I can still find and join it when the stream starts.
5. As a student, I want finished classes from today to stay in Today in their time slot, so that I can see the whole day's timeline.
6. As a student, I want Today ordered by start time after the live class, so that it reads like a timetable.
7. As a student, I want an Upcoming tab listing classes on future days, so that I can plan my week.
8. As a student, I want Upcoming ordered soonest first, so that the next class is always at the top.
9. As a student, I want Upcoming to load more as I scroll, so that a long schedule does not slow the screen.
10. As a student, I want a Previous tab listing classes from earlier days, so that I can catch up on what I missed.
11. As a student, I want Previous ordered most recent first, so that yesterday's class is the first thing I see.
12. As a student, I want Previous to scroll indefinitely, so that I can reach old lectures in a large course.
13. As a student, I want Previous to show only classes I can actually play, so that I never open a dead card.
14. As a student, I want classes imported from the old platform to appear in Previous by their original dates, so that the course history is complete.
15. As a student, I want a class whose recording an admin uploaded after a failed stream to appear in Previous, so that rescued classes are not lost.
16. As a student, I want a class still preparing its recording to stay out of Previous until it is playable, so that I don't tap a class that won't play.
17. As a student, I want each card to show its category, section and topic, so that I know what the class covers before opening it.
18. As a student, I want each card to show its date, time, teacher and duration, so that I can decide what to watch.
19. As a student, I want each card to show whether the class is live, so that I can tell a live class from a recording.
20. As a student, I want a Not watched filter, so that I can find classes I have not started.
21. As a student, I want a Partially watched filter, so that I can resume classes I left midway.
22. As a student, I want a Watched filter, so that I can revisit classes I finished.
23. As a student, I want an All filter, so that I can see the whole tab again.
24. As a student, I want the watch filters on Today and Previous, so that I can track progress where it matters.
25. As a student, I want no watch filters on Upcoming, so that I am not offered filters that cannot apply.
26. As a student, I want a class counted as Watched once I have watched about 90% of it in one sitting, so that skipping the last few minutes still counts.
27. As a student, I want re-watching a class not to inflate my progress, so that watching a 10-minute stretch five times does not mark a full lecture watched.
28. As a student, I want a class I marked complete counted as Watched, so that my manual choice is respected.
29. As a student, I want a class I marked uncomplete counted as Not watched, so that uncomplete actually works.
30. As a student, I want opening a class for a few seconds not to count as Partially watched, so that accidental taps do not clutter my progress.
31. As a student, I want watch status tracked per course, so that my progress in one course does not leak into another that shares the class.
32. As a student, I want each card to carry my watch time, so that the app can show a progress bar.
33. As a student, I want a filtered tab to page through only matching classes, so that each scroll loads a full set of results.
34. As a student scrolling past midnight, I want no duplicated or skipped classes, so that infinite scroll stays reliable.
35. As a guest, I want to browse the tabs without signing in, so that I can explore a course before joining.
36. As a guest, I want every class shown as Not watched, so that the screen still makes sense without an account.
37. As a student, I want my watch history visible only to me, so that nobody can read it by guessing my user id.
38. As a student, I want a class the admin cancelled to vanish from every tab, so that I do not wait for a class that will not happen.
39. As a student, I want a cancelled class to vanish from today's classes too, so that both screens agree.
40. As a student, I want a class that was scheduled but never conducted to disappear after its day, so that Previous stays trustworthy.
41. As an administrator, I want to cancel a class by deactivating its placement, so that I use the control I already have.
42. As an administrator, I want deactivation to cancel the class's reminders as it does today, so that students are not notified about a cancelled class.
43. As an app developer, I want the cards in the same shape as today's classes, so that I reuse the existing card parser.
44. As an app developer, I want one endpoint with a tab parameter, so that the three tabs cannot drift apart.
45. As an app developer, I want a POST endpoint with a JSON body, so that it matches how the team already calls today's classes.
46. As an app developer, I want an opaque next-page cursor, so that I never compute offsets.
47. As an app developer, I want an invalid tab, filter or cursor rejected with a clear 400, so that mistakes surface in development.
48. As an app developer, I want a user id in the body ignored, so that an old habit cannot leak another user's progress.
49. As an app developer, I want today's classes left working as it is, so that shipped app builds keep working.
50. As an operator, I want the endpoint to use existing indexes and one progress lookup per request, so that it stays fast on large courses.

## Implementation Decisions

### Tab membership (Classify)

- A **placement** is eligible for any tab only when the placement is active, its status is 1, and
  the Class is active. Deactivated or status-0 placements (the admin's "cancel") appear nowhere.
- **Effective start** = the placement's start date, else the Class's start date (unchanged from
  today's classes). Placements with no effective start appear in no tab. APX-imported placements
  are believed to carry start dates already (the app shows them); no backfill is part of this PRD.
- Tabs split by the effective start's **IST calendar day**:
  - **Today**: effective start on the current IST day, **or** the Class is Live (whatever its day).
  - **Upcoming**: effective start on an IST day after today, and not Live.
  - **Previous**: effective start on an IST day before today, not Live, and **playable**.
- **Live** = the Class's stream status is `live` or `reconnecting`. Stream status alone decides it —
  never schedule dates or `isLive`. (Class blinking stays `live`-only; a reconnecting card is in
  Today but not blinking.)
- **Playable** = the existing listing `hasPlayback` rule (the Class has an HLS asset, or a YouTube
  link). Stream status is not required, so APX imports and admin rescue uploads are included; a
  class still `processing` with no asset is excluded until the asset lands.
- Build this as a **pure classifier** — (effective start, stream status, playable, now) → today |
  upcoming | previous | none — and a matching aggregation stage built from the same IST day bounds.
  The pure version is the spec; the stage must agree with it on the same fixtures.

### Watch status (Resolve)

- **Watch time** for (student, Class, course) = the **maximum** single-session watch seconds, capped
  at the Class's duration. Session watch seconds follow the rule the dashboard already uses:
  client-reported `duration` when greater than 0, else wall-clock end − start.
- **Watched** = manually marked complete, or Watch time ≥ 90% of the Class's duration.
  **Partially watched** = Watch time ≥ 60 s and not Watched. **Not watched** = everything else.
  A Class with no duration can only be Watched through manual completion. A Live card is never
  Watched.
- Scoped per course (progress rows are keyed by course).
- Build this as a **pure resolver** — (sessions, class duration) → { watchStatus, watchTime } — plus
  an aggregation twin (one grouped lookup on progress rows for this user and course, joined onto
  the page) that must agree with it on the same fixtures. Thresholds are named constants.
- **Mark uncomplete fix**: it must zero `duration` and clear the manual flag on **every** progress
  row for (user, Class, course), not only the first match. Accepted cost: those sessions no longer
  count toward dashboard watch-time totals.

### Paging (Cursor)

- Today is **unpaginated** (a whole day in one response). Upcoming and Previous use a **cursor**:
  opaque, encoding (effective start, placement id) as the tie-broken sort key. Default limit 20,
  maximum 50. `nextCursor` is null on the last page and always null on Today.
- Cursor paging (not page numbers) because the Previous tab shifts at midnight; a keyset cursor
  continues exactly where the student stopped.
- Watch-status filtering happens **before** paging, so every page is full of matching classes.
- Build the cursor as a small codec module (encode / decode / reject tampered or malformed input).

### Ordering

- Today: Live first, then effective start ascending, then placement id.
- Upcoming: effective start ascending, then placement id ascending.
- Previous: effective start descending, then placement id descending.

### API contract

- `POST /api/courses/:courseId/class-tabs`, optional authentication (the existing optional-auth
  middleware). The student is identified **only** by the verified token; any `userId` in the body
  is ignored. Guests get every card as Not watched; a guest request with `watch` = watched or
  partial returns an empty list.
- Body: `{ tab: 'today'|'upcoming'|'previous' (required), watch?: 'all'|'watched'|'partial'|'not_watched'
  (default 'all'; ignored on upcoming), cursor?: string (ignored on today), limit?: number }`.
- 400 for an invalid course id, tab, watch value, limit or cursor; 404 for an unknown course.
- Response (flat, same envelope style as today's classes):
  `{ state: 200, msg, data: { classes: [card…], nextCursor: string | null } }`.
- **Card** = exactly the today's-classes card (placement id, course, priority, effective start/end,
  isFree, isBlinking, title with course override, description, teacher, duration, isLive,
  isYoutubeRedirect, isShort, isChat, isTopper, image, link, class_link, streamStatus, hasPlayback,
  view counts, and taxonomy mainCategory / category / internalSection / topic with per-course
  overrides) **plus** `watchStatus` and `watchTime` (seconds), **minus** `isCompleted`. The card
  projection should be extracted into one shared builder used by both endpoints so they cannot
  drift. No `classToWatch`, no counts, no locking — the app owns the Locked badge.

### Modules

1. **Tab classifier** (pure + stage) — deep: all membership rules behind one call.
2. **Watch-status resolver** (pure + stage) — deep: thresholds, max-not-sum, manual, cap.
3. **Tab cursor codec** — encode/decode/validate.
4. **Course class card projection** — extracted from today's classes, shared.
5. **Class-tabs query service** — composes 1–4 into one aggregation for (course, tab, watch,
   cursor, limit, userId?) → { classes, nextCursor }.
6. **Controller + route** — thin: validate body, resolve user from token, call the service.
7. **Side fix** — mark-uncomplete updates every row.

### Unchanged

- Today's classes keeps its route, body and `classToWatch` for shipped app builds; the Today tab supersedes it over time.
- The timetable (cross-course, today) is untouched.

## Testing Decisions

- Tests assert external behaviour — which placements land in which tab, in which order, with which
  watch status, across which pages — never pipeline internals.
- **Unit (node:test)**: tab classifier (IST day boundaries at 23:59/00:00 IST, live-overrides-day,
  reconnecting, processing-without-asset, playable-without-stream-status, no date); watch-status
  resolver (max not sum, cap at duration, 90%/60 s edges, manual complete, zeroed after uncomplete,
  zero-duration class, live); cursor codec (round trip, tampered, malformed, wrong tab direction).
- **Integration (memory Mongo)**: the query service and controller end to end — tab membership and
  order; cancelled/deactivated hidden; Previous excludes unplayable; cursor pages across a simulated
  midnight without duplicates or gaps; filter-before-paging yields full pages; guest vs signed-in;
  body `userId` ignored; per-course progress isolation; stage and pure versions agree on shared
  fixtures.
- **Side fix**: mark-uncomplete zeroes every session row.
- Prior art: `src/tests/integration/progressReport.integration.test.ts` (memory Mongo, mocked
  req/res), `src/tests/courseClassListingLiveness.test.ts`, `src/tests/classActualTimes.test.ts`.

## Out of Scope

- Today's classes ignoring placement `status` (cancelled placements still show there) — deferred
  2026-09-25 as not the focal point; stories 39 and 42 are not delivered by this PRD.

- Locked badge / entitlement in the listing (the app already handles it).
- Counts on the filter chips.
- Topic-grouped responses.
- A first-class "Cancelled" state or cancelled cards; a class-level cancel action.
- Backfilling APX placement dates (believed done); writing APX `created_at` on future imports (only
  relevant if the stopped APX catch-up chains are resumed).
- Playback position tracking; changing how the app reports sessions.
- Changing the timetable or the topic-grouped course listing.
- Admin/ops visibility of classes whose stream ended without a recording.

## Further Notes

- **Open, app team:** is session `duration` media seconds or wall-clock seconds? At wall-clock, a
  student at 2× speed tops out near 50% and never reaches Watched; the fix would be lowering the
  threshold or asking the app to send media seconds.
- An app handoff note (request/response examples, filter semantics, cursor usage, guest behaviour)
  should ship with the deploy, like the other client guides in `reference/`.
- Deploy follows the fork's dist discipline (see memory: quicktricks backend dist deploy).
