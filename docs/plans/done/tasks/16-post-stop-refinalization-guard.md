# Post-stop re-finalization guard: a Stop on an already-ended class must not re-run finalization

**Type**: AFK
**Blocked by**: 14 (landed — this closes the residual gap its 900s claim TTL leaves open)
**Repo**: livestream
**Governing docs**: [launch runbook, Phase-4 prod findings](../../launch-runbook-quicktricks-v2.md) · [task 14](./14-stream-end-cleanup-dedupe.md) (run-once claim design)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## Background (observed 2026-07-27, prod acceptance run)

The user clicked Stop again **21 minutes** after the class ended. The frontend `endStream` socket
handler (`backend/rtmpserver-2.js:972`) calls `doStreamCleanup` unconditionally on every branch;
the only run-once gate on this path is task 14's `rtmp:finalize` claim (`SET NX EX 900`), which
had **expired**. Result: full re-finalization — VOD playlist re-upload, a duplicate 1C GPU job
(`hls-1785139607814…`, SUCCESS 104s), duplicate `processing`/`ended` webhooks. End state was
verified byte-identical (idempotent same-key writes), so this is cost/noise, not corruption —
but it is real GPU spend and webhook noise any stale tab or double-click can trigger forever.

The no-TTL `rtmp:blocked` guard does **not** cover this: it is only consulted by
prePublish/donePublish and the Redis-event paths, never by the frontend socket path.

## What to build

Consult the box's own **write-through status cache** before finalizing. `streamStatusUpdater.js`
already maintains `streamStatus:current:<classId>` (`CURRENT_PREFIX`,
`backend/lib/streamStatusUpdater.js:41`) — it is written on every transition and readable even
during an LMS outage, which is why it (and not a `classClient.getClass` call) is the guard.

In the `endStream` socket handler (`rtmpserver-2.js:972`), before blocking/stopping anything:

1. Read `streamStatus:current:<classId>`.
2. If it is `ended` (or `processing`): **skip finalization entirely** — no `blockStreamReconnect`
   re-write needed beyond what exists, no session stop, no Redis publish, no `doStreamCleanup`.
3. Still **re-emit the current status** to the room (`io.to(classId).emit("streamUpdate", <cached>)`)
   and ack the socket (`streamEnded`) — this also converges stale "LIVE" tabs whose owner is
   clicking Stop precisely because their UI never caught the `ended` broadcast.
4. Apply the same early-exit to the `rtmp:endStream` Redis-subscriber handler
   (`rtmpserver-2.js:370`) — its no-`sessionId` branch re-enters `doStreamCleanup` the same way
   and its claim has the same TTL hole. (No room re-emit needed there beyond what exists; the
   originator handles the socket side.)

A cache **miss** (no key — e.g. box restarted and Redis flushed) must behave exactly as today:
proceed with the normal end path. The guard only short-circuits on a positive terminal status.

## Acceptance criteria

- [x] Stop clicked after the finalize-claim TTL on an `ended` class: no VOD POST, no 1C job, no `processing`/`ended` webhooks, no session/ffmpeg action
- [x] That same Stop still emits `streamUpdate` with the cached status to the room and acks `streamEnded` to the caller
- [x] Redis-event path with cached `ended` status: cleanup skipped
- [x] First/normal stream end unchanged (cache reads `live` or is absent → full path runs exactly once, task 14 semantics intact)
- [x] Cache-miss behaves as today (no new hard dependency on the key existing)
- [x] Jest tests beside the task-14 `streamEndDedupe*` suites (`jest tests/`, currently 118/118 — must stay green): terminal-status skip + re-emit; non-terminal passthrough; cache-miss passthrough
- [x] No change to webhook contracts or the task-14 claim/echo/grace mechanics

## User stories covered

- A teacher with a stale tab clicks Stop on a class that ended twenty minutes ago: nothing re-runs, no duplicate GPU job is billed, and their tab immediately converges to "ended".

## Execution notes

**Landed** on `launch/quicktricks-v2` in `livestream` as `5582c6e`
(`fix(rtmp): guard stream end against re-finalizing an already-ended class`), on top of task 15's
`468199a`. Suite went 136/136 → **152/152** (16 new). No pushes, no deploys, no prod writes.

### What was built

- **New `backend/lib/streamEndGuard.js`** — the guard, extracted as its own module rather than inlined
  in `rtmpserver-2.js`, following the `lib/streamStatusHydration.js` precedent (same shape: a small
  cache-reading resolver for an `rtmpserver-2.js` concern, unit-tested at its public interface, since
  `rtmpserver-2.js` itself boots a whole server on require and is not loadable under Jest). Exports:
  - `getFinalizedStatus(classId)` — reads `getCachedStatus` (`streamStatus:current:<classId>`,
    `CURRENT_PREFIX`) and returns the value **only if terminal**, else `null`.
  - `skipRedundantStop(classId, { io, socket })` — returns `true` when the caller must skip the end
    path; on skip it re-emits `io.to(classId).emit("streamUpdate", <cached>)` and acks
    `socket.emit("streamEnded", { success: true })`. Both collaborators optional.
  - `TERMINAL_STATUSES = new Set(['processing', 'ended'])`.
- **`backend/rtmpserver-2.js`** — 18 added lines, no deletions, in exactly two places:
  - **frontend `endStream` socket handler**: the check sits immediately after `StreamPath` is computed
    and **before** `blockStreamReconnect` / `cancelGracePeriod` / the `try` block — so on a skip nothing
    is blocked, no session is stopped, no Redis event is published and `doStreamCleanup` is never
    reached. Called with `{ io, socket }` so the room converges and the caller is acked.
  - **`rtmp:endStream` Redis-subscriber handler**: the check sits immediately after the task-14
    own-echo `originId` skip and before `blockStreamReconnect`. Called with **no `io`/`socket`** —
    per spec, the originating box owns the room broadcast and the socket ack, so re-emitting from every
    subscribing box would only duplicate it.

### Deviations / judgement calls

- **New file, not an inline guard.** The spec described the logic sitting "at the top of the handler";
  the logic *is* invoked there, but lives in `lib/streamEndGuard.js`. Reason: testability — the
  acceptance criteria demand Jest coverage of the re-emit and ack, which is unreachable if the code is
  inline in an un-requireable server file. Same trade already made for `resolveStreamStatus`.
- **Fails open on a Redis error**, not just on a missing key. The spec only called out cache *miss*;
  a read *failure* is treated identically (logged, returns `null`, normal end path proceeds). The guard
  may only short-circuit on a positive terminal status, never on absence of information — otherwise a
  Redis hiccup would leave a box unable to end a stream at all. Covered by two tests.
- **Task-15 and task-17 surfaces untouched**, as instructed: no edits to `routes/stream.js`,
  `lib/hls.js`, `lib/segmentReconciler.js`, `lib/watchers.js`, or the pending-retry/recovery machinery
  in `streamStatusUpdater.js` (imported read-only via `getCachedStatus`). The subscriber diff is the
  early-exit only — task 17's ownership-logic edit lands on a clean adjacent region.

### Test coverage (`backend/tests/streamEndGuard.test.js`, 16 tests)

Mocking follows the task-14 / hydration convention (`jest.mock('../lib/streamStatusUpdater')`; no
Redis, no network). Cases: `ended`/`processing` terminal; `live`/`preparing`/`reconnecting` non-terminal;
cache miss; Redis read failure; socket-path skip asserting both the `streamUpdate` re-emit and the
`streamEnded` ack; socket-path passthrough asserting **nothing** is emitted; Redis-path skip and
passthrough with no collaborators.

### Not verified here

- **Runtime/prod behaviour.** Verification is unit-level only — no deploy, no box run, no second-Stop
  replay against a real class. The end-to-end criterion ("no VOD POST, no 1C job, no webhooks") is
  established by construction (the guard returns before `doStreamCleanup` is reached, and
  `doStreamCleanup` is the sole caller of all three) plus the task-14 lifecycle suite, not by observation.
- **`streamStatus:current:<classId>` is actually populated at the moment of a real second Stop.** The
  guard depends on `updateStreamStatus(classId, 'ended')` having write-through-cached before the second
  click. That holds by code inspection (`cacheCurrentStatus` fires on every reporter fire, independent of
  LMS delivery success) but was not confirmed against the prod Redis for the 2026-07-27 incident class.
- **Cross-box skip under a real Redis adapter** — the subscriber early-exit is unit-tested, not
  exercised with two live instances.

## Live verification (2026-07-27, box @ b2412ed, class 6a6738d2b604444bc220fe81)

`rtmp:finalize` key deleted manually to strip the task-14 claim, then two real Stop clicks
(11:11:01, 11:11:24): both logged `Skipping stream end … already finalized (cached status: ended)`,
finalize key never re-created, no VOD rebuild, no webhooks, GPU manager shows exactly 1 job for
the class. PASS.
