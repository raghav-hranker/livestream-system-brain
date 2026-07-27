# Post-stop re-finalization guard: a Stop on an already-ended class must not re-run finalization

**Type**: AFK
**Blocked by**: 14 (landed — this closes the residual gap its 900s claim TTL leaves open)
**Repo**: livestream
**Governing docs**: [launch runbook, Phase-4 prod findings](../launch-runbook-quicktricks-v2.md) · [task 14](./14-stream-end-cleanup-dedupe.md) (run-once claim design)

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

- [ ] Stop clicked after the finalize-claim TTL on an `ended` class: no VOD POST, no 1C job, no `processing`/`ended` webhooks, no session/ffmpeg action
- [ ] That same Stop still emits `streamUpdate` with the cached status to the room and acks `streamEnded` to the caller
- [ ] Redis-event path with cached `ended` status: cleanup skipped
- [ ] First/normal stream end unchanged (cache reads `live` or is absent → full path runs exactly once, task 14 semantics intact)
- [ ] Cache-miss behaves as today (no new hard dependency on the key existing)
- [ ] Jest tests beside the task-14 `streamEndDedupe*` suites (`jest tests/`, currently 118/118 — must stay green): terminal-status skip + re-emit; non-terminal passthrough; cache-miss passthrough
- [ ] No change to webhook contracts or the task-14 claim/echo/grace mechanics

## User stories covered

- A teacher with a stale tab clicks Stop on a class that ended twenty minutes ago: nothing re-runs, no duplicate GPU job is billed, and their tab immediately converges to "ended".
