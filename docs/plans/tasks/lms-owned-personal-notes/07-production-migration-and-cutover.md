# Production migration and cutover

**Type:** HITL  
**Status:** `ready-for-human`  
**User stories:** 19–21, 33, 37, 46–50

## Parent

[PRD: LMS-Owned Personal Notes with Media Parity](../../prd-lms-owned-personal-notes.md)

## What to build

Run the coordinated production cutover from livestream-owned notes to LMS-owned notes. Verify private
notes-zone and signer configuration without exposing secrets, deploy the LMS capability before any
client repoint, audit and migrate the source data, perform a short controlled legacy-write freeze for
the final delta, deploy both viewer adapters, and reopen writes against the LMS.

Exercise text, image, and audio CRUD through both production viewer surfaces and reconcile the final
source/target counts and media samples. Keep old records and objects intact for the agreed rollback
window. Record the rollback trigger, migration evidence, deployment identifiers, and old-route traffic
observation needed to unblock retirement.

## Acceptance criteria

- [ ] A human verifies production LMS/B2/Bunny configuration and branch/deployment targets without placing credentials in task output or logs.
- [ ] The LMS canonical and compatibility routes are healthy before either viewer changes its notes base.
- [ ] Production audit evidence replaces the stale zero-data assumption and the approved migration completes with reconciled outcomes.
- [ ] A controlled final-delta procedure prevents writes from being lost between migration and frontend cutover.
- [ ] Both production viewer surfaces pass create/list/edit/delete acceptance for text, image, and audio notes using token-derived ownership.
- [ ] Signed media loads from the private notes zone, while unsigned/sibling access remains denied.
- [ ] Chat, polls, presence, sockets, playback, PDFs, and live HLS remain healthy and on their established service boundaries.
- [ ] Old Mongo records and media objects remain available for the documented rollback window; no destructive source cleanup occurs.
- [ ] Legacy socket notes traffic is observed at zero for the agreed period, and evidence is recorded to unblock task 08.

## Blocked by

- [Task 05: `ls` viewer notes parity](./05-ls-viewer-notes-parity.md)
- [Task 06: Idempotent legacy-note migration](./06-idempotent-legacy-note-migration.md)
