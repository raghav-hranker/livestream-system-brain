# Targeted importer add existing

**Type**: HITL
**Blocked by**: 04, 02
**Status**: done

**DONE 2026-09-30**: `apxTargetedImport` (fork c0517cffd) — 34 placements added on existing classes (exact asset key), inactive.

## What to build

New targeted importer: link an existing platform class to the course for approved Add existing class to course rows, status from AppX state.

## Acceptance criteria

- [ ] Dry-run default; --commit writes
- [ ] No new Class documents created
- [ ] Takes no catch-up lock; stop locks untouched

## User stories covered

- Stories 21, 24 (PRD numbering)
