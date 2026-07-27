# Shared-Redis ownership guard: make the app plane safe on a shared Redis Cloud bus

**Type**: AFK (code + tests only; the `REDIS_HOST` flip itself is a HITL deploy step, NOT this task)
**Blocked by**: — (prerequisite for the scaling architecture; blocks the shared-Redis env flip)
**Repo**: livestream
**Governing docs**: [launch runbook](../launch-runbook-quicktricks-v2.md) · 2026-07-24 cross-tenant-leak finding (session notes / handoff-3 §4) · task 02 (pending-retry store), task 14 (echo/claim mechanics)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## Background

The scaling model needs the app plane on the **shared Redis Cloud** cluster (many boxes, one bus),
and the user's split-server design — a websocket instance and a transcoder instance per large
client — depends on the cross-server `rtmp:endStream` publish/subscribe continuing to work. But
flipping `REDIS_HOST` today re-opens the 2026-07-24 **cross-tenant leak**: every subscriber on the
shared bus reacts to every tenant's events.

Concrete hazards (all in `backend/rtmpserver-2.js` unless noted):

1. **Unconditional global writes before any ownership check.** The `rtmp:endStream` subscriber
   calls `blockStreamReconnect` + `cancelGracePeriod` (`:387-388`) for *whatever StreamPath is in
   the message* — an instance with no relationship to that stream still writes its block/grace
   keys. (Redundant even in the legit case: the originator already wrote both in its own handler.)
2. **The no-`sessionId` branch cleans up foreign paths unconditionally** (`:405-412`): it runs
   `doStreamCleanup` for any path "in case there are orphaned resources", touching status emits
   and the finalize claim for streams this instance never hosted. On a shared bus this is another
   tenant's class.
3. **`recoverPending` replays foreign/orphaned keys.** The boot-time retry recovery (task 02,
   `backend/lib/streamStatusUpdater.js`) scans `streamStatus:pending:*`; the shared cluster
   already holds **orphaned pre-existing keys** from earlier eras, and would hold other tenants'
   pending retries — a booting instance must never replay statuses it did not write.

## What to build

**A — subscriber acts only on streams it has a local stake in.**
Define ownership as: the instance holds the RTMP session (`context.sessions.get(sessionId)`), or
has local resources for the StreamPath (`streamWatchers` / `ffmpegTranscoders` /
`activeProcesses` / `rtmpSessions` entry). In the `rtmp:endStream` handler:
- Move `blockStreamReconnect`/`cancelGracePeriod` behind the ownership check (or drop them from
  the subscriber — the originator performs both before publishing; verify and document which).
- `sessionId` branch: unchanged when the session is local (this is the split-server case that
  must keep working); when it is not local, log and return — no writes.
- no-`sessionId` branch: run cleanup **only if** local orphaned resources for that exact
  StreamPath actually exist; otherwise log and return without touching Redis or emitting.

**B — namespace the pending-retry store per deployment.**
Scope `streamStatus:pending:*` (and `recoverPending`'s scan) with a stable per-deployment
namespace — an env-driven prefix (e.g. reuse the existing instance/deployment identity; it must
survive process restarts, so `INSTANCE_ID`-per-boot is NOT sufficient — design the key so retries
outlive a crash of the box that wrote them without becoming replayable by other tenants).
`recoverPending` replays only its own namespace; foreign and legacy orphaned keys are ignored
(count + log them, don't delete — cleanup-ledger item).

**C — audit the remaining shared keys for the same class of bug.** `rtmp:grace`, `rtmp:blocked`,
`rtmp:finalize`, `rtmp:session:*`, `streamStatus:current:*` are all keyed by StreamPath/classId,
which is globally unique (`Class._id`) — collisions across tenants shouldn't occur, but confirm
each consumer tolerates a shared keyspace and document the conclusion in the execution notes.

Out of scope: the `REDIS_HOST` env flip and box deploy (user-gated, staged separately); the
PubSubManager tenant-bus isolation (already landed, `dbda616`).

## Acceptance criteria

- [ ] Foreign-path `rtmp:endStream` event (no local session, no local resources): subscriber performs **zero** Redis writes, zero emits, zero `doStreamCleanup` — log-and-return
- [ ] Legit split-server stop still works: instance holding the session reacts exactly as today
- [ ] no-`sessionId` event with genuinely orphaned local resources: cleanup still runs (regression guard for the original orphan case)
- [ ] `recoverPending` on a cluster seeded with own-namespace + foreign + legacy orphaned `streamStatus:pending:*` keys replays only its own, logs the count of ignored foreign/legacy keys
- [ ] Pending-key namespace survives process restart (retry durability from task 02 preserved)
- [ ] Shared-keyspace audit of the other `rtmp:*` / `streamStatus:*` keys recorded in execution notes
- [ ] Jest tests (`jest tests/`, currently 118/118 — must stay green) covering the four behaviors above
- [ ] No `REDIS_HOST`/env change, no deploy, no prod writes in this task

## User stories covered

- Two clients' livestream boxes share the Redis Cloud cluster; one client's teacher ends class and the other client's in-progress stream is untouched — no blocked reconnects, no ghost cleanups, no replayed statuses.
