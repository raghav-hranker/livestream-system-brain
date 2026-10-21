# 04 — Record actual finish and inherit completed stream times

State: ready-for-agent
Execution: implemented and verified locally; not deployed
Type: AFK

## Parent

[PRD](../../prd-class-blinking-and-assignment-times.md)

## What to build

Type: AFK. Blocked by: 03. User stories: 3, 12–16.

Deliver first processing receipt through durable actualEndedAt, every assignment's
end date, and new assignments created during/after finalization. Reuse the
consistency mechanism established for actual start and verify the complete live
to processing to ended path.

## Acceptance criteria

- [x] First processing captures LMS time once as server-owned actualEndedAt and
      updates every assignment end without altering actual start or visibility.
- [x] New assignments inherit captured actual start/end independently; each
      missing actual timestamp uses its PRD-defined provisional default.
- [x] Concurrent assignment creation/finalization and partial failure retries
      converge using the original end time. Completed duplicates preserve later
      manual overrides.
- [x] Ended never replaces end or invents missing actual timestamps, including
      prerecorded ended reports; existing asset handling remains compatible.
- [x] Live → reconnecting → live → processing → ended integration demonstrates
      stable start, actual finish, correct returned dates and continued playback.
- [x] Existing historical assignments are not migrated. Skipped intermediate
      statuses remain the explicitly accepted delivery limitation.

## Blocked by

[03-actual-start](03-actual-start.md)

## Implementation evidence

See [implementation report](implementation-report.md) for commits, tests, and remaining release coordination.
