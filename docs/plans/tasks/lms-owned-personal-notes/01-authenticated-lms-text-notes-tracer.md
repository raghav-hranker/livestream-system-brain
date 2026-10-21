# Authenticated LMS text-notes tracer

**Type:** AFK  
**Status:** `ready-for-agent`  
**User stories:** 1–4, 10–18, 22–26, 29–31, 36, 38, 49, 51, 54–55

## Parent

[PRD: LMS-Owned Personal Notes with Media Parity](../../prd-lms-owned-personal-notes.md)

## What to build

Deliver the first complete LMS-owned personal-notes path for text notes. An authenticated student can
create, list, edit, and delete their own class-scoped notes through the deployed LMS contract from the
existing student viewer. The LMS exposes both its canonical class/note resources and the legacy Room-
shaped aliases, but both route families use one notes domain module and one LMS persistence model.

The student viewer keeps its existing notes UI and call-site behavior. Its shared notes adapter points
only notes traffic at the LMS, attaches the existing Auth access token, and continues to understand the
legacy response envelopes. The LMS derives ownership exclusively from the validated token; legacy
`userId` input has no authority. Land the capability in both the upstream LMS lineage and the deployed
LMS fork, reconciling the isolated text-only task work with current production code rather than blindly
merging it.

## Acceptance criteria

- [ ] An authenticated student can create, list, edit, and delete text notes from the existing student class screen against the LMS.
- [ ] Canonical and compatibility routes exercise the same domain behavior while returning their documented response envelopes.
- [ ] Notes are scoped by LMS `Class`, sorted by `updatedAt` descending, and generate the existing automatic title when no title is supplied.
- [ ] Missing, invalid, expired, identityless, and terminated-session tokens are rejected consistently.
- [ ] A forged body/query `userId` cannot create for, list as, update, or delete as another user.
- [ ] The student notes adapter changes only notes traffic to the LMS and leaves chat, polls, presence, and socket traffic on livestream.
- [ ] Contract tests cover the real HTTP/auth chain and the existing viewer adapter; the API-envelope mismatch from the isolated task branch is resolved.
- [ ] The upstream LMS and deployed LMS fork carry equivalent tested contracts on their respective branches.

## Blocked by

None - can start immediately.
