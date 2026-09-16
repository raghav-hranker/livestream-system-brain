# Remove the admin `videoStatus` PATCH arm

**Type:** AFK  
**Status:** `needs-triage` (becomes `ready-for-agent` when 05 and 06 are done)  
**ADR:** [0007](../../../adr/0007-shorts-readiness-via-transcode-callback.md) decision 6  
**Blocked by:** 05 (acceptance passed), 06 (no admin caller left)

## Repo

`quicktricks-backend`, worktree off `origin/quicktricks-admin`. Files: `src/schemas/shortSchemas.ts`
(`attachShortVideoSchema` union), `src/controllers/shortController.ts` (`attachShortVideo`'s
`'videoStatus' in payload` branch), the shorts controller tests.

## What to build

- Collapse `attachShortVideoSchema` to the single `{ sourceKey }` object; delete the `videoStatus`
  branch and its 409. Update the route comment: readiness is written by
  `POST /api/shorts/transcode-complete` (transcoder secret) and the sweeper, never by an admin.
- The single writer principle is the point: an admin JWT can attach an upload, but cannot assert that
  bytes exist. A `{ videoStatus }` body now fails validation with 400.

## Acceptance criteria

- [ ] `PATCH /api/shorts/:id/video {videoStatus:'ready'}` ⇒ 400 validation error.
- [ ] `PATCH … {sourceKey}` behaviour unchanged, including `videoAttachedAt` set (task 01).
- [ ] `grep -rn "videoStatus" src/schemas src/routes` shows only the callback schema.
- [ ] Deployed to the prod box via push → pull; a probe confirms the 400.

## Do not

- Ship this before the test short is `ready` through the new path (05). After this lands the only
  way to fix a stuck short is re-upload, by design.
