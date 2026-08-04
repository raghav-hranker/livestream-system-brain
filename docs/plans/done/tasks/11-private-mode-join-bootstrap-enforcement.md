# Private-mode join bootstrap + server-side enforcement

**Type**: AFK
**Blocked by**: #05 — Private-mode endpoint + repoint the livestream client
**Repo**: livestream
**Governing docs**: [PRD](../../prd-client-launch-v2.md) · [SYSTEM.md contract table, *Private-mode write* row](../../../../SYSTEM.md) · decision record: grilling session 2026-07-22 (vidup task 05 execution notes)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## What to build

Close the two seams left open after the private-mode write path (task 05):

**Late-join bootstrap.** The `privateModeUpdate` broadcast only reaches sockets already connected.
`joinRoom` must emit the **current** `isPrivate` to the joining socket (alongside the task-03 status
hydration), sourced the same way the toggle handler reads it (`classClient.getClass` /
write-through cache). Decision (2026-07-22): backend emits on join — the enforcement point and the
truth-read already live there; do NOT widen the LMS viewer serializer for this.

**Server-side enforcement.** `userMsg` currently broadcasts unconditionally — a tampered client can
post publicly during private mode. When `isPrivate` is true, `userMsg` from a non-host must be
rejected (or rerouted as a private message to the host); the host's own messages stay unaffected.
Read `isPrivate` from the local cached copy, not an LMS round trip per message.

## Acceptance criteria

- [ ] A socket joining after a private-mode toggle receives the current `isPrivate` in the join flow (no `/room` read, no LMS call from the client)
- [ ] With private mode ON, a forged public `userMsg` from a student socket is not broadcast to the room; the sender receives an error/reroute
- [ ] Host messages and normal-mode messaging are unchanged; enforcement adds no LMS read on the hot path
- [ ] Tests cover: late-join bootstrap value, forged-message rejection, toggle-then-join race (join lands mid-toggle)

## User stories covered

- Host runs a private Q&A: students who join late are restricted immediately, and no client trickery can post publicly.
