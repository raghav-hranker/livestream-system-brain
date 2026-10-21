# 03 — Record actual start and synchronize course assignments

State: ready-for-agent
Execution: implemented and verified locally; not deployed
Type: AFK

## Parent

[PRD](../../prd-class-blinking-and-assignment-times.md)

## What to build

Type: AFK. Blocked by: 02. User stories: 9–11, 13–15, 17.

Deliver first live receipt through durable actualStartedAt, assignment dates,
today's listings and reminder cancellation. Include assignments created after or
concurrently with the first live update: they inherit actual start rather than
getting a fresh placeholder. This keeps the schema, writer and its consumers in
one usable slice.

## Acceptance criteria

- [x] First live captures LMS time once in server-owned actualStartedAt; ordinary
      admin payloads cannot write it and placeholder dates cannot seed it.
- [x] Every assignment, including inactive ones, receives actual start without
      changing visibility/status. The class moves into its actual starting day.
- [x] Absent or expired provisional ends advance to that starting day's IST end;
      later provisional ends remain until actual end is known.
- [x] Reconnects and duplicates preserve actual start. Completed duplicate updates
      do not undo subsequent manual assignment-date overrides.
- [x] Late assignments inherit actual start; concurrent creation cannot miss the
      capture/propagation boundary.
- [x] Concurrent status calls and incomplete propagation retries preserve the
      original timestamp and converge without prematurely reporting success.
- [x] Actual-start propagation preserves sent notification history, cancels or
      suppresses obsolete paid/free reminders, and sends no reschedule/live-start
      notification. Ordinary future admin scheduling still works.
- [x] Handler/persistence and listing integration tests cover these cases, with
      explicit notification behavior tests and no producer delivery changes.

## Blocked by

[02-ist-assignment-window](02-ist-assignment-window.md)

## Implementation evidence

See [implementation report](implementation-report.md) for commits, tests, and remaining release coordination.
