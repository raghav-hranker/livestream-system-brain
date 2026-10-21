# Per-student class state, from a verified token only

**Type**: AFK
**Blocked by**: 01 — Classes section, end to end (guest view)

## What to build

Class results gain the signed-in student's own state, exactly as the class tabs show it:
`watchStatus`, `watchTime`, `manualCompleted` and `videoPosition` (D10). The student is
identified **only** by the verified token. A body `userId` never reveals anything.

- Reuse the class-tabs watch-status stages and their one grouped progress lookup per request,
  for this course and this user. Apply them to every result the way Today/Previous compute them;
  a result whose `tab` is `upcoming` keeps the tab's pinned defaults (Not watched, resume 0).
- Reuse the resume-point loader once for the returned class ids (after the `limit` cut), with
  upcoming pinned to 0 as class tabs does.
- Guests, and requests with an invalid or expired token, keep task 01's defaults and make
  **no** progress lookup.

## Acceptance criteria

- [ ] With a valid token for a student who watched a class, that class's result has the same
      `watchStatus`, `watchTime`, `manualCompleted` and `videoPosition` as its class-tabs card.
- [ ] The same request with that student's id only in the body (no token) returns guest
      defaults.
- [ ] A garbage or expired token returns 200 with guest defaults, never 401.
- [ ] An upcoming class result has Not watched and `videoPosition: 0` even when progress rows
      exist.
- [ ] One progress lookup per signed-in request, none for a guest; one resume-point lookup for
      all returned classes (asserted by result, e.g. a large result set stays correct; no
      per-item reads).
- [ ] Controller tests for body-`userId`-only vs valid-token vs garbage-token (prior art: the
      global search viewer tests).

## User stories covered

- Stories 11–13: watched state, resume point, mark-complete state on class results
- Story 30: progress never revealed through a body user id
- Story 36: identity from the `Authorization` header the app already sends
- Story 39: per-student lookups batched per request
