# Live course by course reaudit

**Type**: HITL
**Blocked by**: 01, 03, 04, 05
**Status**: ready-for-human

## What to build

Re-read AppX course by course with a fresh session; the page updates as each course finishes. Needs the operator's AppX OTP login.

## Acceptance criteria

- [ ] Audit writes a result file per course plus a progress file; resumable
- [ ] Each finished course is pushed to the page immediately
- [ ] A 307 → /login marks the course incomplete and it is retried alone

## User stories covered

- Stories 3, 4, 9 (PRD numbering)
