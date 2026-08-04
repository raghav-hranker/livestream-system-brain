# Delete the recordings relay and dead setStreamStatus

**Type**: AFK
**Blocked by**: #01 — Pin the deployable branch pairing
**Repo**: livestream
**Governing docs**: [PRD](../../prd-client-launch-v2.md) · [SYSTEM.md, RETRANSCODE arc](../../../../SYSTEM.md) · [slice § Delete](../../../../slices/client-launch-v2.md)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## What to delete

Remove the contract halves whose other half never existed, so the next session cannot mistake dead
code for a live contract. MP4 reporting is video-transcoder → LMS direct; the livestream service is
enqueue-only in the retranscode arc and must never be a recordings relay hop.

- The recordings relay: `POST /recording` + the legacy GET in `backend/routes/recording.js`,
  `classClient.attachRecording`, and the `CALLBACK_API_ENDPOINT` plumbing in `backend/lib/ecs.js`
  (the endpoint it forwards to never existed).
- `classClient.setStreamStatus` — superseded by `streamStatusUpdater`; targets a URL that never existed.

## Acceptance criteria

- [ ] All listed routes, methods, and plumbing are deleted (not commented out or left inert)
- [ ] No remaining reference to `attachRecording`, `setStreamStatus`, or `CALLBACK_API_ENDPOINT` anywhere on the launch branch
- [ ] Livestream remains enqueue-only in the retranscode arc: it still hands the worker its ingredients (signed input, ids) and drops out — the 1C enqueue path is untouched
- [ ] Service boots and the existing test suite passes after the deletions

## User stories covered

- Story 13: one write path per fact — recordings via the transcoder directly
- Story 15: dead contract halves deleted rather than left inert
- Story 20: MP4 renditions reported by video-transcoder directly; livestream never a relay hop
