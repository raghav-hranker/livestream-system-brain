# Delete the Room model, room routes, and in-repo viewer UI

**Type**: AFK
**Blocked by**: #01 — Pin the deployable branch pairing
**Repo**: livestream
**Governing docs**: [PRD](../../prd-client-launch-v2.md) · [ADR-0004](../../../adr/0004-architecture-ships-greenfield-per-client.md) · [slice § Delete](../../../../slices/client-launch-v2.md)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## What to delete

Remove the Room-era remnants on the launch branch. Greenfield policy (ADR-0004) means the new client
starts from a fresh DB with no Room documents — no migration or backfill applies, so the code can
simply go.

- `backend/routes/room.js` (unmounted) and the `Room` model + `roomSchema` in `backend/db/model.js`.
- The in-repo `ui/` viewer pages that bootstrap from `GET /api/v1/room/:roomId` — the in-repo `ui/`
  is outdated and unused; the production viewer is a separate UI repo already connected to the
  livestream backend.

**Constraint:** the livestream backend's socket surface must be unchanged — the production UI
(separate repo, out of scope) consumes it and must keep working without coordinated changes.

## Acceptance criteria

- [ ] `Room` model, `roomSchema`, room routes, and the in-repo `ui/` viewer are deleted; no remaining reference to the Room model or `GET /api/v1/room/:roomId` on the launch branch
- [ ] The socket surface (event names, payload shapes) is byte-for-byte unchanged — verified by diffing the socket handler signatures / existing socket tests, not by assumption
- [ ] Service boots and the existing test suite passes after the deletions
- [ ] No data migration or backfill added anywhere (fresh-DB greenfield per ADR-0004)

## User stories covered

- Story 15: Room model, routes deleted rather than left inert
- Story 17: fresh database, no legacy Room documents, no migration risk
- Story 19: socket surface unchanged for the production UI
