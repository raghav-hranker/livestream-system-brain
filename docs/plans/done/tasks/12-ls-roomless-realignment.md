# ls viewer: room-less realignment

**Type**: AFK
**Blocked by**: #08 — Delete the Room model + room routes; #11 — join bootstrap (consumes its emit)
**Repo**: ls
**Governing docs**: [PRD](../../prd-client-launch-v2.md) · [ADR-0004](../../../adr/0004-architecture-ships-greenfield-per-client.md) · ls repo ADR 0003 (render driven by LMS)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## What to build

The v2 livestream backend mounts no `/room` REST routes, but the ls viewer still calls them.
Remove the dependence; every replacement already exists:

- **Drop** the `GET /api/v1/room/:roomId` fetch and the 404→`POST /room` auto-create
  (`app/[userId]/[roomId]/page.tsx`) and the `ClassConfig` private-mode read.
- **`hostId`**: derive as `roomId` (v2 invariant — the backend identifies the host by
  `socket.role`, teachers already enter with `userId = roomId`). Chat's private-message
  routing (`recipientUserId = hostId`) keeps working with zero backend calls.
- **`isPrivate` bootstrap**: consume the join-time emit from launch task 11 instead of the
  Room field.
- **Pinned message**: already served over the socket on v2 — delete the Room-field read.
- **`streamKey`**: keep the existing `roomId` fallback (OBS panel).
- Playback, statuses, render decisions: already LMS-driven (ls ADR 0003) — untouched.

## Acceptance criteria

- [ ] No request to any `/api/v1/room*` path from the viewer (network-verified during a live class and a VOD class)
- [ ] Student→teacher private messages work with no Room anywhere (recipient = roomId)
- [ ] Late joiner lands in the correct private/public chat mode via the join-time emit
- [ ] Pinned message, OBS stream key, live-control chrome all behave as before
- [ ] Live + VOD playback unchanged (was already LMS-driven)

## User stories covered

- Teacher hosts and moderates; students join, chat, and DM the teacher — on a backend with no Room API.
