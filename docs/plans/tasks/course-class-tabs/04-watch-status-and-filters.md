# Watch status on cards and watch filters

**Type**: AFK
**Blocked by**: 01 — Previous tab; 03 — Today tab

PRD: `docs/plans/prd-course-class-tabs.md`. Glossary: `CONTEXT.md` → "Watch time", "Watch status".

## What to build

Every class-tabs card gains `watchStatus` (`watched | partial | not_watched`) and `watchTime`
(seconds), and `watch` (`all | watched | partial | not_watched`) filters Today and Previous
**before** paging.

- **Watch-status resolver** (pure + aggregation twin, agreeing on shared fixtures): for (user,
  Class, course), session watch seconds = client `duration` when > 0, else `userEndTime −
  userStartTime` in seconds (the dashboard's rule). Watch time = **max** session, capped at the
  Class's duration. Watched = any session `manualCompleted`, or watch time ≥ 90% of duration.
  Partial = watch time ≥ 60 s and not Watched. Not watched = else. No/zero duration → only manual
  completion makes it Watched. A Live card is never Watched. Thresholds are named constants.
- One grouped progress lookup per request for (user, course) — not per card.
- User comes only from the verified token (`optionalAuthenticateToken`). Guests: every card
  `not_watched`, `watchTime: 0`; `watch: 'watched'|'partial'` → empty list.
- Upcoming cards carry `watchStatus: 'not_watched'`, `watchTime: 0`; `watch` ignored there.

## Acceptance criteria

- [ ] Five sessions of 10 min on a 60-min class → watch time 600, Partial (max, not sum).
- [ ] A 55-min session on a 60-min class → Watched; 53 min → Partial; 59 s → Not watched.
- [ ] A manual completion → Watched; a Class with duration 0 and 30-min session → Partial.
- [ ] Progress recorded under course A does not affect the same Class in course B.
- [ ] `watch: 'not_watched'` on Previous pages through only unwatched placements, full pages, no duplicates.
- [ ] Guest and garbage-token requests get Not watched everywhere and empty lists for watched/partial; a body `userId` never changes watch status.
- [ ] Unit tests for the resolver edges; integration tests for filters, paging and isolation; resolver stage and pure function agree on the same fixtures; `npx tsc --noEmit` clean.

## User stories covered

20–37
