# Xlsx and approval reader

**Type**: AFK
**Blocked by**: 01 — Action page tracer
**Status**: ready-for-agent

## What to build

Export the action list as an xlsx with an Approve column, and a reader that merges page ticks with xlsx Approve cells into one approved set (union), keyed by the stable row id.

## Acceptance criteria

- [ ] xlsx has one row per action with the row id, course, title, action, AppX state and an Approve column
- [ ] Reader returns the union of page and xlsx approvals; an untick on one side doesn't remove the other
- [ ] Unknown row ids in the xlsx are reported, not silently dropped
- [ ] Tests cover union semantics and stable ids

## User stories covered

- Stories 6, 7 (PRD numbering)
