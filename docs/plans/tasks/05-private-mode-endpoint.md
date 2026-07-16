# Private-mode endpoint + repoint the livestream client

**Type**: AFK
**Blocked by**: #01 — Pin the deployable branch pairing
**Repos**: nodejs-server + livestream (cross-repo — same launch branch in both)
**Governing docs**: [PRD](../prd-client-launch-v2.md) · [SYSTEM.md contract table, *Private-mode write* row](../../../SYSTEM.md) · [slice § Build 4](../../../slices/client-launch-v2.md)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` in BOTH repos before reading or changing anything.
> Ignore `.claude/worktrees/*`.

## What to build

Give the host's private-mode toggle a real, persisted write path. In nodejs-server, build
`PATCH /api/classes/:classId/private-mode` (body `{isPrivate}`) guarded by the existing
`requireTranscoderSecret` middleware — the secret is now the general service-to-LMS write credential,
not webhook-only. In livestream, repoint `classClient.setPrivateMode` at the new endpoint with the
`X-Transcoder-Secret` header, and remove the dead `/api/internal/...` URL and the second
(`x-internal-secret`) header. `isPrivate` stays dual-writable: the LMS admin UI writes it directly
(policy, before/after class); the class UI writes via this endpoint (live, mid-class). End-to-end
effect: a host toggling private mode from the class UI during a live class persists `Class.isPrivate`
and the room receives the broadcast.

## Acceptance criteria

- [ ] Endpoint rejects requests without or with a wrong transcoder secret; persists `isPrivate`; rejects malformed payloads (tests modeled on the existing stream-status webhook and playback controller tests in the LMS repo)
- [ ] `classClient.setPrivateMode` targets the new endpoint with the transcoder-secret header; the dead internal-API URL and second secret header are gone (test per PRD: setPrivateMode targets the new endpoint with the header)
- [ ] Toggling from the class UI flips `Class.isPrivate` in Mongo and emits the room broadcast; the restriction survives reconnects
- [ ] LMS-side direct writes to `isPrivate` remain untouched (dual-writable; enforced on next websocket firing, not broadcast — per GLOSSARY "LMS is not real-time")

## User stories covered

- Story 5: host toggles private mode from the class UI during a live class
- Story 6: the toggle persists on the class record
- Story 8: LMS admin sets privacy policy from the LMS UI
- Story 9: LMS-side changes enforced on next firing, not broadcast (documented boundary, unchanged)
- Story 13: one write path per fact — privacy via the private-mode endpoint
