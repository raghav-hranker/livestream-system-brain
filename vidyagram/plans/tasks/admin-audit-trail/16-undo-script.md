# Undo script

**Type**: AFK
**Blocked by**: 10, 12
**Repo**: backend (script runner) + system-brain (wrapper and docs)

## What to build

Restore a record from a history row's "before" copy with one command, safely.

- **`vidyagram-audit-undo --row <changeRowId>`**:
  - Delete row: re-insert the record from `before`.
  - Update row: set back only the fields that changed between `before` and `after`, leaving any other field as it
    is now.
  - Insert row: refuses. Use a delete for that.
- **Preview by default.** It prints the record now, what it will become, and the fields it will touch. It writes only
  with `--commit`.
- **Refuses** when the record has changed since that row: any later change row for the same target, or the current
  record differs from `after` in the fields involved. `--force` overrides this, and its use is recorded.
- **Recorded.** It runs as `script:audit-undo` through the task 12 label, so the restore leaves its own change row.
  That means it runs inside the backend codebase (a `src/scripts` runner) with a thin system-brain wrapper that
  invokes it on the box. Document how in `reference/scripts/README.md`.
- **Bulk rows** (a sample of 200) can't be undone with this. It says so, and points to the lookup's `--request`
  listing.

## Acceptance criteria

- [ ] Integration: undoing a delete row re-inserts the record exactly as `before` (same `_id`).
- [ ] Integration: undoing an update row reverts only the changed fields.
- [ ] Integration: without `--commit` nothing is written. With it, the record is restored and a `script:audit-undo`
      change row appears.
- [ ] Integration: a record changed again since the row is refused without `--force`.
- [ ] A bulk row is refused with the message.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 19, 20, 21
