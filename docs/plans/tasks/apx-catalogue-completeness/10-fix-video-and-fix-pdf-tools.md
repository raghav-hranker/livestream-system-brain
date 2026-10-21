# Fix video and fix pdf tools

**Type**: HITL
**Blocked by**: 06, 02
**Status**: ready-for-human

## What to build

Re-enqueue the video ingest for Fix video rows and re-port PDF bytes for Fix PDF file rows, from the approved set.

## Acceptance criteria

- [ ] Dry-run default; commit only approved rows
- [ ] Idempotent re-runs
- [ ] Re-check shows the rows cleared

## User stories covered

- Stories 18, 19 (PRD numbering)
