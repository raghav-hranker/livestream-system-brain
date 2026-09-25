# Purchases on class results, from a verified token only

**Type**: AFK
**Blocked by**: #01 — Classes section, end to end (guest view)

## What to build

Class results reflect what the signed-in student bought (D2–D4, D8), and search and playback
share one definition of "bought".

- **Owned courses, extracted from the Entitlement check.** One function from (orders, enforce
  expiry, now) to the set of course ids the user bought. The Entitlement check's order matching
  is rewritten on top of it, so the two cannot drift. The order loader stays as is: successful
  orders, `courseId`, `latestCourseId`, and active-plan course grants. Expiry is enforced exactly
  as the `ENFORCE_ORDER_EXPIRY` flag decides for playback.
- **Viewer.** Searcher options gain an optional viewer: a lazily evaluated, memoised owned-course
  lookup, plus a guest viewer that owns nothing. The orchestrator passes it through; other
  searchers ignore it. The class searcher asks for owned courses once some candidate has an
  attached course (every attached course needs `isPurchased`, D4), and the viewer memoises it,
  so at most one orders lookup per request and none for a guest.
- **Identity.** Optional authentication on `POST /api/search`: a valid Bearer token sets the user,
  and a missing, invalid or expired token means guest (never a rejection). The controller builds
  the viewer **only** from the verified token's user. The body `userId` keeps its existing jobs
  (the 400 when absent, test attempt counts, logging) and never builds a viewer.
- The result builder from task 01 now receives the real owned set: `isPurchased` set per course,
  an inactive course attached only when bought, `canPlay` counts bought courses, and purchased
  courses sort first.

## Acceptance criteria

- [ ] With a valid token for a student who bought course A (directly, via `latestCourseId`, or
      via an active plan), a class in A shows A with `isPurchased: true`, first in `courses`, and
      `canPlay: true`.
- [ ] A bought **inactive** course appears on its classes with `isActive: false`; an unbought
      inactive course never appears.
- [ ] With `ENFORCE_ORDER_EXPIRY` on, an expired order counts as not bought (the inactive course
      disappears, `isPurchased` is false); with it off, the order still counts, same as playback.
- [ ] A request with only a body `userId` (no token) for the same student gets the guest view:
      no `isPurchased: true`, no inactive courses. The same holds for an invalid or expired token,
      which also must not error.
- [ ] A signed-in search performs at most one orders lookup, and none when no candidate has an
      attached course; a guest never performs one (asserted through a counting fake viewer).
      *Corrected 2026-09-25: the first draft said "no lookup unless an inactive course is
      returned", which contradicts D4 and the first criterion. The agent flagged it.*
- [ ] Unit tests for the owned-courses function: direct, latest, active-plan grant, inactive plan
      ignored, expiry on/off, null expiry (prior art: the class access authz tests). The existing
      Entitlement check tests pass unchanged.
- [ ] Controller/route tests for the guest-vs-token cases above.

## User stories covered

- Stories 10, 12, 13: bought courses marked and first; can-play signal; buy options for the locked
- Stories 14–17: bought inactive batch kept, unbought hidden, expiry, plan grants
- Stories 29, 30: privacy against a spoofed body user id; guests still served
- Stories 36, 37: one ownership definition; orders loaded only when needed
