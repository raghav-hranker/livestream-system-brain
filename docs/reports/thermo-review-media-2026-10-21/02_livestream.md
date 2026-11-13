# 02 — livestream `feat/vg-live-1080p` (detail)

Thermo-nuclear code-quality review, 2026-10-21. Review only: nothing was edited, committed or deployed.

- Repo: raghav-hranker/livestream, worktree `~/Projects/worktrees/livestream-1080p`, local branch
- Range: `6fb66fb..a41a16e` (base = launch/quicktricks-v2)
- Paths below are relative to `backend/`. Line numbers are at `a41a16e`.
- Branch rule: Vidyagram only. Never merges into launch/quicktricks-v2; quicktricks fixes may flow the other way.

## Scope

```sh
git log --oneline 6fb66fb..HEAD
# a41a16e fix(live): reconnect safely when a stalled publisher still holds the path
# 195c0ea fix(live): upload every rewrite of the 1080p playlist
# 2f0eba6 feat(config): SERVER_PORT and RTMP_PORT overrides for a second instance per host
# 303c2b3 feat(live): optional 1080p rung per client (LIVE_HLS_1080P_CLIENTS)
git diff --stat 6fb66fb..HEAD          # 18 files, +899 / -108
```

| file | base | head |
|---|---|---|
| rtmpserver-2.js | 1,726 | 1,735 |
| lib/streamLifecycle.js | 610 | 654 |
| lib/watchers.js | 412 | 417 |
| lib/hls.js | 201 | 192 |
| lib/liveLadder.js | new | 145 |
| lib/publishDecision.js | new | 37 |
| lib/probeInputHeight.js | new | 30 |

No file crosses 1,000 lines because of this branch; `rtmpserver-2.js` was already 1,726. Verification: `npx jest` → 45 suites, 654 tests pass (run 2026-10-21).

What is good and should stay: `liveLadder.js` is the right move. The 40-line hand-written ffmpeg string, four `mkdirSync` lines per watcher, four `processTSFiles` calls, the fallback master and the 1C quality list all now read one table, and `hls.js` got shorter. `TIMING_REFERENCE_FOLDER` names the "folder 0 = 720p" assumption instead of scattering `0`. `isDuplicatePublish` (a41a16e) is a small, pure, well-placed guard.

---

## L1. The 'STARTING' reservation now lasts up to 8 s, and only two of seven readers know (1080p rung + a41a16e) — presumptive blocker

**Evidence.** Before this branch, `ffmpegTranscoders` held `'STARTING'` only between two synchronous lines of `startFfmpegTranscoding`, so no other code could observe it. Now, for a listed client, the reservation is held across `probeInputHeight` (8 s cap, `lib/probeInputHeight.js:3`) and a second map, `pendingProbes` (`lib/streamLifecycle.js:246`), records which start owns it. The value type of the map is effectively `ChildProcess | 'STARTING'`, plus a parallel `Map<StreamPath, Symbol>`.

The code that was taught about the new state:
- `lib/streamLifecycle.js:273-281` (a reconnection supersedes a pending probe)
- `lib/streamLifecycle.js:325-330` (the probe continuation checks both maps)
- `lib/streamLifecycle.js:511-514` (cleanup drops the reservation)

The code that reads the same map and was not:
- `rtmpserver-2.js:203`, `:283`, `:361`, `:381` all test `x && !x.killed && x.exitCode === null`. For the string `'STARTING'`, `exitCode` is `undefined`, so every one reads a probing start as "no process". Traced paths: at `:203`/`:283` (reconnect) that reading is what lets the reconnection supersede the probe, so it is correct by accident. At `:361` (donePublish, blocked stream) the reservation is left in place and the stream is safe only because `doStreamCleanup` (`lib/streamLifecycle.js:511`) also runs for an ended class and drops it. At `:381` (connection loss during the probe) a grace period starts while the probe's continuation goes on to spawn a new-stream FFmpeg against an input that is gone; it exits quickly and its exit handler clears the slot. None of these is a confirmed production bug today. The problem is that each outcome depends on the reader's interpretation of a sentinel, and the next change to any of these sites has no type or helper telling it the state exists.
- `rtmpserver-2.js:333` logs `existingProcess.pid || 'STARTING'`.
- `lib/streamProcessManager.js:25` calls `'STARTING'.kill()` (throws before its `delete`). Unreachable today (`killStreamProcesses` is imported at `rtmpserver-2.js:50` but never called), so it is dead code that would misbehave if revived.

`startFfmpegTranscoding` now returns `ChildProcess | Promise<ChildProcess|null> | null` depending on the client (`lib/streamLifecycle.js:256-257`), and both callers (`rtmpserver-2.js:292`, `:302`) drop the return value, so the promise floats and an exception inside its `.then` (`spawnTranscoder`) is an unhandled rejection.

This is the "ad-hoc branch in a busy flow" pattern the review exists to stop: a 1080p-only state was added to a lifecycle shared by every stream, and correctness depends on each reader remembering a string sentinel. The 10-21 reconnect storm and the a41a16e race fix are what that costs.

**Code-judo.** One owner for the slot, and the reservation is a token in the one map:

```js
// lib/transcoderSlot.js  (new, Vidyagram branch only)
const slots = new Map();               // StreamPath -> { token } | ChildProcess

function reserve(path)   { const token = Symbol(path); slots.set(path, { token }); return token; }
function owns(path, t)   { return slots.get(path)?.token === t; }
function isRunning(path) { const s = slots.get(path); return !!s && !s.token && s.exitCode === null && !s.killed; }
function isStarting(path){ return !!slots.get(path)?.token; }
function release(path)   { const s = slots.get(path); if (s && !s.token) s.kill('SIGKILL'); slots.delete(path); }
```

- `pendingProbes` disappears: "superseded" is `!owns(path, token)`. A reconnection or cleanup supersedes simply by calling `reserve` or `release`.
- `startFfmpegTranscoding` becomes `async` for every client and returns `ChildProcess | null`. The unlisted path still execs synchronously inside it (no await before `spawnTranscoder`), so the pinned bfc1512 argv and timing are unchanged.
- The four `!x.killed && x.exitCode === null` sites in `rtmpserver-2.js` become `isRunning(path)`; the blocked/donePublish site calls `release(path)`, which also cancels a pending probe.
- The map stops being passed as a parameter through `startFfmpegTranscoding`, `doStreamCleanup` and `startGracePeriod`; one module owns it.

Add two tests: connection loss during the probe must not spawn FFmpeg (by the trace above this fails today: the continuation still owns the token and the slot still reads `'STARTING'`); donePublish on a blocked stream during the probe must not spawn FFmpeg even if `doStreamCleanup` has not run yet.

**Branch cost.** `rtmpserver-2.js` is shared lineage with launch/quicktricks-v2. Touching its four read sites on the Vidyagram branch adds merge friction for quicktricks fixes flowing in. Keep the edit to the four predicate swaps (mechanical), and do not reorganise the file on this branch.

## L2. "Does this stream carry 1080p" is read from disk three ways (1080p rung, 195c0ea)

**Evidence.** The fact lives on disk as `<stream>/4/playlist.m3u8`. It is read by `rungsOnDisk` (`lib/liveLadder.js:80-84`, used by `lib/hls.js:35` and `lib/fileUpload.js:233`) and separately, inline, by `decide1080p` (`lib/streamLifecycle.js:342-343`). Its representation already changed once: 303c2b3 used the folder, 195c0ea moved it to the playlist file after a frozen 1080p playlist in the first real class. The slice doc still describes the old record (`slices/hls-1080p.md:19`, `:40-41`: "the watchers make only 0..3, so 4/ on disk records that a stream carries the rung"), and the commit message lists the readers it had to chase.

**Remedy.** `rungsOnDisk(streamDir)` is the one reader; `decide1080p` asks `rungsOnDisk(dir).includes(RUNG_1080P)` instead of building the path. A later change of record (say, a `ladder.json` written at start) is then one function. Fix the slice doc lines with it.

## L3. The new/reconnect/reject decision is spread over the prePublish handler (a41a16e)

**Evidence.** `classifyPublish` (`lib/publishDecision.js:32-35`) returns `'reconnect'` whenever a grace period is open or `0/playlist.m3u8` exists. On its own that rule would also treat a class whose stream ended (files are kept for 24 h, `lib/streamLifecycle.js:585-593`) as a reconnection. It is correct only because two earlier checks in the handler reject ended classes first (`rtmpserver-2.js:151-170`: the Redis block key, then the DB status). The duplicate-publisher guard is a third rule at `:139`. So one decision, "what is this publish?", has four inputs read at three places in a 100-line handler, and the tests (`tests/publishDecision.test.js`) cover `classifyPublish` without the ended case it relies on others for.

**Remedy.** One pure function returning `'duplicate' | 'ended' | 'reconnect' | 'new'` from `{ publishers, sessionId, blocked, endedInDb, inGracePeriod, hasLiveMedia }`, with the I/O gathered before the call (keeping the synchronous duplicate check first). The handler becomes a `switch`. The ended-with-files case gets a test. Same branch-cost caution as L1: the handler is shared lineage, so on this branch keep the change to calling the function, not restructuring the handler.

## L4. Rate mode by field presence (1080p rung) — legibility

`rungArgs` (`lib/liveLadder.js:86-100`) picks CRF vs ABR on `r.crf !== undefined` (`:89`) and per-rung overrides on `if (r.profile)` / `r.preset` / `r.x264Params` (`:96-98`). The hls fallback master picks `r.bitrate || r.maxrate` (`lib/hls.js:176`) for the same reason. It works and is tested (the unlisted argv is pinned), but the rung's shape is implicit. An explicit `rate: { mode: 'abr', bitrate } | { mode: 'crf', crf }` plus an `overrides` object would make the two kinds of rung visible in the table. Low priority; do it only if a third rung kind appears.

## Smaller notes

- `lib/watchers.js:54` and `:173`: the same `mkdirSync` loop and the same four-line comment sit in `setupDiskWatchers` and `setupUploadWatchers`. That duplication predates the branch (it was four lines twice), but the branch rewrote both copies twice (303c2b3, 195c0ea). An `ensureRungFolders(folderPath)` in `liveLadder.js` would have made 195c0ea a one-line fix.
- `lib/streamLifecycle.js:69` still logs "Quality folder 0 not found" after the code moved to `TIMING_REFERENCE_FOLDER`.
- `LIVE_HLS_1080P_CLIENTS` is a per-client list on a VM that serves one client. Accepted: it keeps unlisted clients byte-identical (pinned by test) and costs one set lookup.
- `isLive1080pClient` re-parses the env on every start (`lib/liveLadder.js:71-73`). Harmless; boot validation (`config/validateBootConfig.js:161-163`) already catches malformed lists.
- 2f0eba6 (`SERVER_PORT` / `RTMP_PORT`) is clean, and it also removes the duplicate `port: 8937` key in `nmsConfig`.
