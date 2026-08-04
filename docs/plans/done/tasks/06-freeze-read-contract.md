# Freeze the shared-Mongo read contract

**Type**: AFK
**Blocked by**: #01 — Pin the deployable branch pairing (soft: prefer after #03 so the projection shrink lands on the fallback-only read)
**Repos**: nodejs-server + livestream (cross-repo — same launch branch in both)
**Governing docs**: [PRD](../../prd-client-launch-v2.md) · [ADR-0003](../../../adr/0003-livestream-reads-class-via-shared-mongo.md) · [slice § Build 5–6](../../../../slices/client-launch-v2.md)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` in BOTH repos before reading or changing anything.
> Ignore `.claude/worktrees/*`.

## What to build

Freeze the livestream service's direct Mongo read of the LMS `classes` collection to the named
two-field contract (ADR-0003): `isPrivate` (routine, LMS-owned) and `streamStatus` (cold-start
fallback only). In livestream, shrink `classClient.getClass` to `.select('streamStatus isPrivate')` —
dropping the rejected fields (`teacherName`, `mp4Recordings`, `isChat`). In nodejs-server, add a
comment on the Class schema naming the livestream service as a direct-Mongo reader of exactly these
two fields, and a small contract test guarding their names/types so an LMS schema rename fails CI
instead of silently breaking the livestream service. End-to-end effect: the cross-repo read surface is
exactly two fields, guarded on the owner's side.

(The read-only DB grant for the livestream Mongo user on `classes` is an environment/provisioning act —
it lives in task 10 with the other production-surface steps.)

## Acceptance criteria

- [ ] `classClient.getClass` projects exactly `streamStatus` and `isPrivate`; test asserts the projection returns exactly the two contract fields
- [ ] Class schema in nodejs-server carries the comment naming livestream as direct-Mongo reader of the two fields, pointing at ADR-0003
- [ ] LMS-side contract test asserts the field names/types of the frozen contract (doubles as the regression guard)
- [ ] No remaining livestream consumer of the dropped fields (verify `teacherName`/`mp4Recordings`/`isChat` are consumed nowhere on the launch branch)

## User stories covered

- Story 14: direct Mongo reads frozen to a named two-field contract with an LMS-repo guardrail
