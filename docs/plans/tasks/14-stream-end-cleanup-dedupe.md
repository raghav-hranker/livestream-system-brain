# Stream-end cleanup dedupe: own-echo skip, tokenized grace timers, run-once finalization

**Type**: AFK
**Blocked by**: — (fix-before-prod gate for the quicktricks launch; see runbook "Phase-4 findings")
**Repo**: livestream
**Governing docs**: [launch runbook, OBS smoke-test findings #2](../launch-runbook-quicktricks-v2.md) · design decision: grilling session 2026-07-24 (scope A+B+C approved by user)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## Background (verified in the 2026-07-24 OBS smoke test)

One explicit stream end ran the full cleanup **four times** — 4 identical 1C GPU jobs, quadruple
`processing`/`ended` webhooks. End state stayed correct (idempotent same-key writes): this is a
cost/noise bug, not corruption. The count for "OBS closed → Stop clicked" is
**1 (real) + 1 (echo) + N (one per OBS disconnect in the trailing ~10 min, incl. the final close)**.
Three causes:

1. **Self-received bus echo.** The `endStream` socket handler cleans up locally AND publishes
   `rtmp:endStream` for other servers (`rtmpserver-2.js:962-1011`); Redis pub/sub delivers the
   message back to the publisher, whose subscriber (`rtmpserver-2.js:372-407`) has no own-message
   check. Fires only on the null-`sessionId` branch (OBS already disconnected at Stop time).
2. **Grace timers never cancelled on explicit stop.** Every disconnect arms a 10-min `setTimeout`
   (`lib/streamLifecycle.js:411-439`) plus a Redis key `rtmp:grace:<StreamPath>` (EX 600,
   `lib/rtmpRedisHelper.js:82-95`); `cancelGracePeriod` is called only on reconnect
   (`rtmpserver-2.js:138`), never by the explicit-end paths.
3. **Grace keys are anonymous** (value `'1'`): an *older* bounce's timer matches a *newer*
   disconnect's key (smoke test: the 11:23:07 timer fired at 11:33:07 against the 11:24:26 drop's
   key). The final drop's own timer vs its key's EX 600 is a race at the boundary.

## What to build

**A — originator skips its own bus event** (kills cause 1).
Generate a per-process `INSTANCE_ID` (`crypto.randomUUID()` at module load, in
`lib/rtmpRedisHelper.js`). `publishEndStreamEvent` adds `originId: INSTANCE_ID` to the payload;
the `rtmp:endStream` subscriber returns early when `originId === INSTANCE_ID`. Other instances
still react — multi-server semantics unchanged.

**B — tokenized grace periods + cancel on explicit end** (kills causes 2+3).
`setGracePeriod` writes a unique token (uuid) as the key **value** and returns it;
`startGracePeriod` captures the token and the timer fires cleanup only if the key still holds
*that exact token* (new helper, e.g. `isGraceTokenActive(StreamPath, token)`). Keep an
existence-style check for the reconnect path (`isInGracePeriod` → value non-null; used at
`rtmpserver-2.js:132-138`). Both explicit-end entry points — the `endStream` socket handler and
the Redis-event handler — call `cancelGracePeriod(StreamPath)` alongside their existing
`blockStreamReconnect` call, so all armed timers become no-ops the moment a stream is
intentionally stopped.

**C — run-once claim on global finalization** (bounds any trigger, incl. undiscovered ones —
e.g. a double Stop click re-enters the null-session branch and re-finalizes today).
Split `doStreamCleanup` (`lib/streamLifecycle.js:452-537`) into its two concerns:
- **Local teardown** (kill ffmpeg, stop recorder) — idempotent, always runs.
- **Global finalization** (`processing` emit/status, `POST /api/v1/stream/` = VOD build + 1C
  enqueue, `ended` emit/status+`hlsAsset` webhook) — gated behind an atomic
  `SET rtmp:finalize:<StreamPath> <INSTANCE_ID> NX EX 900`. Loser logs and returns.
Watcher closing stays inside the winner's post-POST block (watchers must stay alive for final
segment uploads; on a single instance the winner is the instance that owns them).
TTL 900s: spans the 10-min grace window; a legitimate later re-stream of the same path is
unaffected (blocked-key + streamStatus guards already make classes one-shot). Accepted trade-off
(user-approved): if the claim winner dies mid-finalization there is no retry until the TTL
lapses — same loss surface as today's log-and-drop.

## Acceptance criteria

- [ ] `endStream` with a live local session: exactly one finalization, no Redis publish (existing behavior preserved)
- [ ] `endStream` after OBS disconnect (null sessionId): publish happens, own echo is skipped, exactly one finalization
- [ ] A grace timer whose token was superseded (newer disconnect) or cancelled (explicit stop / reconnect) does nothing
- [ ] Grace key is deleted on both explicit-end paths; `rtmp:grace` reconnect check still works
- [ ] Second `doStreamCleanup` for the same StreamPath within the claim TTL: local teardown only, no `processing`/`ended` status writes, no VOD POST
- [ ] Jest tests (repo suite currently 103/103, `jest tests/`, `PubSubManager` mocked): originId in publish payload + subscriber skip; token round-trip incl. mismatch and cancellation; claim NX semantics (first wins, second skips, args include NX+EX)
- [ ] No change to the 1C payload, webhook contracts, or `storageProvider` routing — this task only dedupes *when* finalization runs

## User stories covered

- A teacher closes OBS, clicks Stop, and the class produces exactly one VOD job and one webhook sequence — no ghost cleanups ten minutes later, no duplicate GPU spend.
