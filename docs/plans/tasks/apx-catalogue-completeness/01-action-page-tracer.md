# Action page tracer

**Type**: AFK
**Blocked by**: None — can start immediately
**Status**: done

**DONE 2026-09-29**: classifier `849ea45ba` on fork branch `feat/apx-catalogue-completeness`; page https://claude.ai/artifact/SufEmLaKcS84KEsifjpAcA seeded with 116 courses.

## What to build

Turn audit findings into one action per missing item and publish them to a private page, one record per course, busiest first, with a progress count and an Approve tick per row. Built from the 28 Sep audit data; no AppX session needed.

## Acceptance criteria

- [x] Pure classifier: Missing class → Import class, missing note/course PDF → Attach PDF (with PDF slot), unresolved AppX row → info
- [x] Deleted-in-AppX, DB-only and status mismatches never become rows
- [x] Page shows courses checked / total, counts per action, approved count
- [x] Approve ticks persist for Contributors and above; courses/meta writable only by editors
- [x] Tests pass with `node --test`

## User stories covered

- Stories 1–5, 32 (PRD numbering)
