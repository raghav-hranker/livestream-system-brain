# Playability storage check

**Type**: AFK
**Blocked by**: 05 — Playability, database check
**Status**: ready-for-agent

## What to build

For records that pass the database check, HEAD the HLS master and PDF object through the same signing path playback uses, busiest courses first, rate-limited.

## Acceptance criteria

- [ ] Injected fetcher; rate limit configurable
- [ ] Record present but object missing ⇒ Fix video / Fix PDF file
- [ ] Progress visible per course on the page
- [ ] No signed URLs written to any output

## User stories covered

- Stories 2, 19, 20 (PRD numbering)
