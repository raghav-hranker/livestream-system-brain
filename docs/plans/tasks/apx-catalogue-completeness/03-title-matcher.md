# Title matcher

**Type**: AFK
**Blocked by**: 01 — Action page tracer
**Status**: done

**DONE 2026-09-29**: fork commit on `feat/apx-catalogue-completeness`; page reloaded. On the 28 Sep data: 1,276 AppX rows matched by title (unique pairs + covered by count), 275 Review match (AppX has more copies of a title than the platform; 250 in course 143), 511 leftovers (no video link in AppX, no title on the platform). No new Attach PDF rows. **Deviation from the grilled rule:** a duplicate title where the platform has at least as many rows counts as matched by count instead of Review match (removed 300 note rows of noise); approved by the operator? — flagged in chat.

## What to build

Pair the AppX rows that have no video link with platform rows by title within the same course and kind. Unique↔unique titles match; duplicate titles are tried by folder position, and anything still uncertain becomes Review match. A leftover note whose class matched by title becomes Attach PDF. The page shows matched-by-title counts and the new rows.

## Acceptance criteria

- [x] Pure matcher: case/whitespace folded; unique pair matches; duplicates → position if available, else ambiguous
- [x] Classes and notes never cross-match
- [x] Ambiguous AppX rows become Review match rows with candidate counts
- [x] Leftover AppX notes under a title-matched class become Attach PDF
- [x] Page republished with per-course matched counts; tests pass

## User stories covered

- Stories 14–17 (PRD numbering)
