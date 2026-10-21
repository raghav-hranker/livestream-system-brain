# Deploy, prod check and app handoff

**Type**: HITL
**Blocked by**: 02, 03, 04, 05

PRD: `docs/plans/prd-course-class-tabs.md`.

## What to build

Ship the endpoint to production and hand it to the app team.

- Rebase on the fork's latest origin, full test suite, `tsc`, surgical dist build, push; box pull +
  pm2 restart of the quicktricks backend only (fork dist discipline).
- Prod read-only check on a real course (e.g. Prime Batch): each tab's membership, order, a
  multi-page Previous scroll, watch filters with a real student token, guest view.
- App guide in `reference/` (request/response examples, tab and filter semantics, cursor usage,
  guest behaviour, "cards = today's-classes cards + watchStatus/watchTime").
- Ask the app team: is session `duration` media seconds or wall-clock seconds?

## Acceptance criteria

- [ ] Live on prod with rollback noted; 0 new 5xx in the first minutes.
- [ ] Prod checks recorded.
- [ ] App guide written and sent.
- [ ] Duration-semantics answer recorded in the PRD's Further Notes.

## User stories covered

49 (and verification of all others)
