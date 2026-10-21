# 02 — Create assignments with an IST day window

State: ready-for-agent
Execution: implemented and verified locally; not deployed
Type: AFK

## Parent

[PRD](../../prd-class-blinking-and-assignment-times.md)

## What to build

Type: AFK. Blocked by: none. User stories: 6–8, 15–16.

Deliver new regular assignment creation through today's listing: start defaults
to now, end to the current IST day's final millisecond, and course today's classes
uses IST consistently with the timetable. This slice establishes provisional
defaults; actual-time inheritance is added with the corresponding lifecycle slices.

## Acceptance criteria

- [x] Regular new assignments use now through 23:59:59.999 Asia/Kolkata.
- [x] Calendar behavior is independent of server timezone and correct on both
      sides of IST midnight; course today and timetable agree on day boundaries.
- [x] Existing assignments, reactivations, and historical APX import defaults
      are unchanged; there is no backfill.
- [x] Start-day membership remains unchanged for overnight classes.
- [x] Assignment creation and listing integration tests prove these behaviors;
      entitled playback still works after assignment end.

## Blocked by

None — can start immediately

## Implementation evidence

See [implementation report](implementation-report.md) for commits, tests, and remaining release coordination.
