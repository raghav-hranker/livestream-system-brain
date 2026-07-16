# Write-through status cache + socket-join hydration

**Type**: AFK
**Blocked by**: #02 — StreamStatusReporter: at-least-once retry
**Repo**: livestream
**Governing docs**: [PRD](../prd-client-launch-v2.md) · [ADR-0003](../../adr/0003-livestream-reads-class-via-shared-mongo.md) · [slice § Build 2](../../../slices/client-launch-v2.md)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## What to build

Serve the hot-path stream status from the livestream service's own write-through cache instead of a
cross-database round trip for data this service originated. Whenever the reporter fires
(`backend/lib/streamStatusUpdater.js`), stash the status in Redis; `joinRoom`'s `streamUpdate` emit
(`backend/rtmpserver-2.js`) reads the local copy. The LMS Mongo read of `streamStatus` is demoted to
cold-start fallback only (per ADR-0003 — the LMS remains the source only when the local copy doesn't
exist yet). End-to-end effect: a viewer joining a live class sees the current stream status immediately,
sourced locally.

## Acceptance criteria

- [ ] Every reporter fire write-through-populates the local Redis status copy
- [ ] `joinRoom` status hydration reads the local cache; the Mongo `getClass` read is hit only when the cache has no entry (cold start)
- [ ] A join during a live class shows the correct status with no LMS Mongo read on the hot path
- [ ] Tests cover write-through population and cold-start fallback through the public interface (per PRD testing decisions)

## User stories covered

- Story 4: joining student sees current stream status immediately
- Story 16: hot-path status served from the service's own write-through cache
