# Pin the deployable branch pairing

**Type**: AFK
**Blocked by**: None — can start immediately
**Repos**: nodejs-server, livestream, video-transcoder, system-brain
**Governing docs**: [PRD](../prd-client-launch-v2.md) · [slice § Branch mechanics](../../../slices/client-launch-v2.md) · [BRANCHES.md](../../../BRANCHES.md)

## What to build

Make the deployable system data, not memory. Fast-forward `feature/secure-classes` in nodejs-server
onto the streaming-line tip (`claude/wonderful-napier` — it is a strict ancestor, 0 ahead / 25 behind,
pure `git merge --ff-only`), so the branch carries the stream-status webhook, transcoder-secret
middleware, and playback readiness gate. Then cut ONE shared launch branch across all three service
repos at their deployable tips (livestream `livestream-v2`, nodejs-server the fast-forwarded tip,
video-transcoder its secured-contract branch) via `./scripts/sync-branches.sh <launch-branch>`, which
rewrites `ACTIVE_BRANCH` in `repos.manifest`.

Note: the client's production LMS branch (`quicktricks-prod`) is NOT touched here — it receives the
full streaming line in task 10 at launch.

## Acceptance criteria

- [ ] `git merge --ff-only` completes in nodejs-server with no conflicts; the resulting tip serves `PUT /api/classes/:classId/stream-status` and the 425 playback gate
- [ ] `./scripts/sync-branches.sh status` shows all three repos on the same launch branch with no drift
- [ ] `repos.manifest` `ACTIVE_BRANCH` records the launch branch name
- [ ] No hand-edited branch names in prose anywhere in the brain

## User stories covered

- Story 12: deployable branch pairing recorded in the repo manifest
- Enables stories 1–3: the existing stream-status/playback contract becomes deployable

## Branch guard for all downstream tasks

Every subsequent task starts by verifying `git branch --show-current` in the target repo matches
`ACTIVE_BRANCH` in `system-brain/repos.manifest`. Several checkouts hold the old Room-based
architecture; an agent on the wrong checkout will confidently describe the wrong system. Ignore
`.claude/worktrees/*` duplicates when searching.
