# StreamStatusReporter: at-least-once retry

**Type**: AFK
**Blocked by**: #01 — Pin the deployable branch pairing
**Repo**: livestream
**Governing docs**: [PRD](../../prd-client-launch-v2.md) · [ADR-0002](../../../adr/0002-stream-status-at-least-once.md) · [slice § Build 1](../../../../slices/client-launch-v2.md)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## What to build

Turn the fire-and-forget stream-status webhook call into at-least-once delivery (ADR-0002 layer 1).
`backend/lib/streamStatusUpdater.js` becomes a deep module with a single report call that persists the
*latest* pending transition per class in Redis, retries with backoff until a 2xx, and drops only on
explicit 400/401/404. Last-write-wins per class is safe because the LMS write is a deterministic
`$set`, which also makes retries idempotent. End-to-end effect: a 40–60 second LMS outage mid-`ended`
no longer strands a class at `processing` — the retry lands the transition after the LMS restarts and
`/playback` transitions 425→200.

## Acceptance criteria

- [ ] A transition that gets a 5xx/network error is retried with backoff until acknowledged with 2xx
- [ ] A newer transition for the same class overwrites the pending one in Redis (latest-per-class, no event history)
- [ ] Explicit 400/401/404 responses drop the pending transition; nothing else does
- [ ] Pending transitions survive a livestream process restart (Redis-persisted, not in-memory)
- [ ] Tests extend the existing mocked-axios `streamStatusUpdater` unit tests on the v2 branch (not replaced); they cover retry-until-2xx, drop-on-4xx, and overwrite semantics through the module's public interface, mocking HTTP and Redis at the boundary

## User stories covered

- Story 1: recording becomes playable shortly after stream end, reliably
- Story 7: lifecycle transitions reported reliably through brief LMS downtime
- Story 13: one write path per fact — status goes only via the reporter
