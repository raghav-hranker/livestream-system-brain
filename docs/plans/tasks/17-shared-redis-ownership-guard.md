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

- [x] Foreign-path `rtmp:endStream` event (no local session, no local resources): subscriber performs **zero** Redis writes, zero emits, zero `doStreamCleanup` — log-and-return
- [x] Legit split-server stop still works: instance holding the session reacts exactly as today
- [x] no-`sessionId` event with genuinely orphaned local resources: cleanup still runs (regression guard for the original orphan case)
- [x] `recoverPending` on a cluster seeded with own-namespace + foreign + legacy orphaned `streamStatus:pending:*` keys replays only its own, logs the count of ignored foreign/legacy keys
- [x] Pending-key namespace survives process restart (retry durability from task 02 preserved)
- [x] Shared-keyspace audit of the other `rtmp:*` / `streamStatus:*` keys recorded in execution notes
- [x] Jest tests (`jest tests/`, currently 118/118 — must stay green) covering the four behaviors above
- [x] No `REDIS_HOST`/env change, no deploy, no prod writes in this task

## User stories covered

- Two clients' livestream boxes share the Redis Cloud cluster; one client's teacher ends class and the other client's in-progress stream is untouched — no blocked reconnects, no ghost cleanups, no replayed statuses.

## Execution notes

Landed 2026-07-27 on `launch/quicktricks-v2` (livestream), on top of task 15 (`468199a`) and task 16 (`5582c6e`).

### Files

| File | Change |
|---|---|
| `backend/lib/remoteEndStream.js` | **new** — the `rtmp:endStream` handler, extracted out of `rtmpserver-2.js` so its three guards are unit-testable; carries the task-17 ownership guard |
| `backend/lib/streamStatusNamespace.js` | **new** — `resolveNamespace(env)`: the stable per-deployment key namespace |
| `backend/lib/streamStatusUpdater.js` | pending key + index namespaced; `auditForeignPending()` added to `recoverPending` |
| `backend/rtmpserver-2.js` | subscriber body replaced by a 1-line delegation to `handleEndStreamEvent`; `INSTANCE_ID` import dropped (only the subscriber used it) |
| `backend/tests/sharedRedisOwnership.test.js` | **new** — 17 tests for A |
| `backend/tests/streamStatusNamespace.test.js` | **new** — 8 tests for B's namespace derivation |
| `backend/tests/streamStatusUpdater.test.js` | key shapes updated; `describe('per-deployment namespace')` added (5 tests); mock Redis grew a `scan` |

Extraction rationale: the subscriber lived inline in a 1,200-line file that cannot be `require`d in a test (boot gate, NMS, sockets, Mongo). "Zero writes / zero emits / zero cleanup for a foreign event" is only assertable against a real unit, so the handler moved to `lib/` — the same shape task 16 used for `streamEndGuard.js`. The moved code is otherwise byte-identical to what was there.

### A — ownership guard

Guard order in `handleEndStreamEvent` (each returns early):
1. own-echo `originId === INSTANCE_ID` (task 14)
2. terminal-status `skipRedundantStop(classId)` (task 16)
3. **ownership** (this task)

Ownership = `context.sessions.get(sessionId)` **OR** a `streamWatchers` / `ffmpegTranscoders` / `activeProcesses` / `rtmpSessions` entry for that exact StreamPath. Non-owner ⇒ one log line, return: no `blockStreamReconnect`, no `cancelGracePeriod`, no `doStreamCleanup`, no `unregisterRtmpSession`, no emit.

**block/cancel: guarded, not dropped.** Verified the originator does both first — `rtmpserver-2.js` `socket.on("endStream")` calls `blockStreamReconnect` then `cancelGracePeriod` *before* `publishEndStreamEvent` on every branch (both the session-not-local branch and the no-sessionId branch). So the subscriber's copies are strictly redundant today and dropping them would be correct for every current publisher. They were kept behind the guard anyway because (a) acceptance criterion 2 is "the owning instance reacts exactly as today", and guarding is the only change with a provably empty behavioural delta for owners, and (b) an owner writing them is idempotent and cheap, whereas a *future* publisher that stops blocking first would silently lose the block. Foreign paths never reach them, which is the whole point.

Sub-case worth naming: **sessionId present, session not local, but local resources exist.** The box passes the guard (it genuinely hosts something for that path), writes block+cancel, logs `Session … not found on this server`, and returns without cleanup — exactly pre-guard behaviour. Session teardown stays with whoever holds the session.

The only Redis touch a foreign event still causes is guard 2's single **read** of `streamStatus:current:<classId>` (a miss). Ordering is per the task spec; moving ownership ahead of it would save one read but reorders the two landed guards for no behavioural gain.

### B — pending-store namespace

- Keys: `streamStatus:pending:<ns>:<classId>`, index `streamStatus:pendingIndex:<ns>`.
- `<ns>` = `STREAM_STATUS_NAMESPACE` if set, else the **host (with non-default port) of `LMS_BASE_URL`**, sanitised to `[a-z0-9._-]`; unparseable-but-set ⇒ 12 hex chars of its sha1; nothing at all ⇒ `default` (unreachable in practice — the ADR-0004 boot gate already refuses to boot without `LMS_BASE_URL`).
- Why `LMS_BASE_URL`: it is (1) already mandatory, so **no new env for existing deploys** and nothing to forget at the `REDIS_HOST` flip; (2) constant across restarts, unlike `rtmpRedisHelper.INSTANCE_ID`, a per-boot uuid that would strand every pending key on every restart and destroy task 02's durability guarantee; (3) shared by all boxes of one deployment, so the split websocket/transcoder pair — and a replacement box — can drain what a peer left behind; (4) semantically exactly right: a pending transition *is* "a `$set` owed to this LMS".
- `recoverPending` replays only `INDEX_KEY` (own namespace). `auditForeignPending()` then SCANs `streamStatus:pending:*`, classifies everything outside the own prefix as **foreign** (`<ns>:<classId>`) or **legacy** (bare `<classId>`), and logs `ignored N pending key(s) outside namespace '<ns>': X foreign, Y legacy … Sample: …`. Nothing is replayed or deleted. The scan is bounded (1,000 sweeps), skipped when the client has no `scan`, and wrapped so a failure logs and never blocks recovery of our own keys.

**Upgrade path for the un-namespaced keys already on the deployed box.** They are *not* adopted — deliberately. Adoption is unsafe by construction: `streamStatus:pending:<classId>` carries no owner, and the shared cluster is already known to hold orphans from earlier eras, so a booting box that adopted them would PUT another tenant's status into its own LMS — precisely the leak this task closes. Cost of not adopting is bounded and small: a pending key only exists while an LMS delivery is mid-retry, so the loss window is "an LMS outage that is still in progress at the exact moment of the upgrade restart", and even then the write-through `streamStatus:current:<classId>` copy is untouched (namespace-free, see below) and ADR-0002 layer 2 (LMS sweep of stale transient statuses) is the backstop. The first boot after deploy logs the exact count and a sample of the skipped keys, so if anything *is* stranded it is visible and can be replayed by hand. Deleting them is a cleanup-ledger item.

### C — shared-keyspace audit

Every key below is keyed by StreamPath (`/<clientId>/<classId>`) or `classId`, i.e. by `Class._id`. Cross-tenant confusion therefore requires an ObjectId collision across independent Mongo deployments (12 bytes: timestamp + 5 random + counter) — negligible, and it would already break far more than Redis. The real question per key is whether a *shared* keyspace is wanted or merely tolerated:

| Key | Writers → readers | Verdict |
|---|---|---|
| `rtmp:session:<StreamPath>` | `registerRtmpSession` on prePublish → `getRtmpSessionId` in the endStream socket handler when local memory misses | **Sharing is the feature.** This is how a websocket box learns the transcoder box's session id and publishes to the bus. Must stay un-namespaced within a deployment. 1h TTL. Safe. |
| `rtmp:blocked:<StreamPath>` | endStream handler + subscriber → `isStreamBlocked` at prePublish (`rtmpserver-2.js:108,:305`) and in `watchers.js:107,:323` | **Sharing wanted** — OBS must be refused whichever box it reconnects to. Only ever read for a path the reading box is being asked to publish. Safe. Note: no TTL and `unblockStreamReconnect` has **no callers**, so blocked keys accumulate forever (pre-existing, by design "indefinitely"); on a shared cluster that is unbounded growth — cleanup-ledger item, not a correctness bug. |
| `rtmp:grace:<StreamPath>` | `setGracePeriod` (EX 600, value = uuid token) → `isInGracePeriod` (reconnect path), `isGraceTokenActive` (timer path) | Safe. Task 14 already made the timer path token-scoped, so a timer only acts when the key still holds *its own* token — a foreign or superseded writer can never make someone else's timer fire. |
| `rtmp:finalize:<StreamPath>` | `claimStreamFinalize` SET NX EX 900, value `INSTANCE_ID` | **Sharing is the feature** — the run-once claim only works if all boxes of a deployment contend on one key. Must not be namespaced. Safe. |
| `streamStatus:current:<classId>` | `cacheCurrentStatus` on every reporter fire → `streamStatusHydration` (join hot path) and `streamEndGuard` (task 16) | Left un-namespaced **on purpose**: a Stop can land on any box of the deployment and must see the peer's write-through copy. Safe. Explicit comment added in `streamStatusUpdater.js` so a later reader does not "fix" it to match the pending store. |
| `streamStatus:pending:*` | this task | Namespaced — the one key here that is replayed *blind* at boot, hence the only one that had to be. |

**Finding beyond the listed keys (not fixed here, flagged for the flip).** `rtmpserver-2.js:66` calls `createAdapter(pubClient, subClient)` with no `key` option, so the socket.io Redis adapter uses its default `socket.io` keyspace. On a shared Redis every tenant's socket.io cluster merges into one adapter mesh: every broadcast is fanned out to every tenant's boxes, and `serverSideEmit`/`fetchSockets` cross tenants. Room names are `classId`s, so mis-delivery again needs an ObjectId collision, but the fan-out cost and the cross-tenant control traffic are real. Fix is one line — pass `{ key: 'socket.io:' + namespace }` as `createAdapter`'s third argument — but it is a coordinated restart (mixed-key servers cannot see each other) and belongs with the `REDIS_HOST` flip, not here.

### Tests

`cd backend && npx jest tests/` → **21 suites / 184 tests, all passing** (baseline before this task: 19 / 152; +2 suites, +32 tests). The pre-existing "worker process failed to exit gracefully" warning is unchanged from the baseline.

### Not verified

- No runtime/on-box verification: no deploy, no `REDIS_HOST` change, no prod Redis reads or writes (out of scope per the task). The multi-box behaviour is covered at the unit level only.
- The count of legacy `streamStatus:pending:<classId>` keys actually sitting on the deployed box was **not** measured (that would need a prod Redis read). The first boot after deploy logs it.

## Live verification (2026-07-27, box @ b2412ed)

Boot: namespace resolved `10.190.0.11-5100` from LMS_BASE_URL (no new env). Fabricated foreign
`rtmp:endStream` published on box Redis (`/999/000000000000000000000000`): subscriber logged
`Ignoring endStream event … no local session and no local resources` — zero writes, zero cleanup.
PASS (shared-cluster flip still pending, with the socket.io adapter key prefix).
