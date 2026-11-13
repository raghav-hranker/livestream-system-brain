# Thermo-nuclear review: Vidyagram media branches (2026-10-21)

Strict maintainability review of the two code lines behind Vidyagram's (781) per-client 1080p video. Review only:
no code was edited, committed, pushed or deployed. Both branches are already running in production or on a test
VM; this review is about what to fix before more work lands on them. The measured encoder numbers (NVENC cq 35,
x264 crf 29, 2.5 Mbps cap, live veryfast + lookahead) are taken as given and not re-argued.

| branch | range | size | tests |
|---|---|---|---|
| video-transcoder `feat/vg-upload-lane` | `5524809..f721759` | 31 files, +1,652 / −96 | `npm test` 482 / 482 pass |
| livestream `feat/vg-live-1080p` (local) | `6fb66fb..a41a16e` | 18 files, +899 / −108 | `npx jest` 45 suites, 654 / 654 pass |

Detail files, with the evidence, the commands that produced it, and worked code-judo proposals:

- [01_video-transcoder.md](01_video-transcoder.md): findings T1–T8
- [02_livestream.md](02_livestream.md): findings L1–L4

One reviewer read both diffs in full; no swarm was used, since together the diffs come to about 2,500 lines.

## Verdicts

**video-transcoder `feat/vg-upload-lane`: request changes.** No file crosses 1,000 lines and the 1080p rung itself
(`container/hls-ladder.js` plus the manager's one-line `HLS_MAX_HEIGHT`) is small and in the right layer. Three
presumptive blockers remain. The Vidyagram lane is a hand-copied second version of the secure lane, held together by
env vars that must equal constants (T1). The client tables exist twice and have already diverged, while the tests
check the copy the listener never runs (T3). And 781 can still be transcoded into quicktricks storage through the
shared hranker lane (T4). The last one is also a separation-rule problem, not just a style one.

**livestream `feat/vg-live-1080p`: request changes.** `liveLadder.js` is a real improvement: one rung table replaces
a 40-line hand-written ffmpeg string and five other hard-coded copies of the ladder. The blocker is how the 1080p
probe was fitted into stream lifecycle state (L1). A sentinel that used to exist for zero milliseconds now lasts up
to 8 seconds. A second map tracks who owns it. Only two of the seven places that read that state were taught about
it. This is the area the 2026-10-21 reconnect storm hit, and a41a16e had to patch.

## Findings, in priority order

### 1. Structural regressions

**L1 (livestream, 1080p rung + a41a16e): the transcoder slot has a new, long-lived state that most readers don't
know about.** `startFfmpegTranscoding` now holds the `'STARTING'` reservation in `ffmpegTranscoders` for the whole
1080p input probe (`lib/probeInputHeight.js:3`, 8 s cap), and a parallel `pendingProbes` map
(`lib/streamLifecycle.js:246`) records which start owns it. Only `lib/streamLifecycle.js:273`, `:325` and `:511` know
this state exists. `rtmpserver-2.js:203`, `:283`, `:361` and `:381` test `!x.killed && x.exitCode === null`, which
reads a probing start as "no process". On the reconnect path that happens to be right. On a connection loss during
the probe, it lets the probe go on to spawn FFmpeg against an input that has already gone. The function also now
returns three shapes (`ChildProcess | Promise | null`), and both callers ignore the result, so the promise floats.
Nothing traced so far is a confirmed production bug. The problem is that correctness depends on each reader's
private reading of a string sentinel. Remedy: a small `transcoderSlot` module that owns the map, stores a token
object as the reservation (so `pendingProbes` disappears and "superseded" becomes an identity check), exposes
`isRunning` / `isStarting` / `release`, and makes the start always async. Two new tests pin connection loss and
blocked-stream end during the probe. Details and the sketch are in 02 §L1.

**T1 (transcoder, CF_VIDYAGRAM lane): a second lane written as a copy, with configuration that cannot vary.**
`src/intake-routing.js:248-285` repeats the secure lane at `:205-246`: its own `required()`, the r2 check, origin
trimming and the same push shape. The two copies already validate API origins differently (`new URL()` vs string
equality). Five of its env vars (buckets, account id, endpoint, CDN, API origin; `:256`, `:263`, `:265`, `:269`) are
read and then rejected unless they equal a literal in the source. A value with exactly one legal setting is not
configuration, and the deployer has to supply it anyway. Remedy: secured lanes become descriptors with a `pinned`
block, built by one `securedLane()` function. Env keeps only the queue id and secrets. The Vidyagram lane shrinks to
about ten lines of data, and both lanes get the stricter origin check. 01 §T1.

### 2. Missed simplifications (code judo)

**T3 (transcoder, 781 mirror): the client tables exist twice, already disagree, and tests check the wrong copy.**
`CLIENT_PRIORITIES` and `callbackApiURls` live in both `src/index.ts` (`:88`, `:400`) and `src/intake-routing.js`
(`:20`, `:49`). The diff hand-edits both. Their 781 entries differ: the runtime copy honours `CALLBACK_API_URL_781`
(`src/index.ts:442`), and the module copy ignores it (`src/intake-routing.js:83`). `resolveIntakeRoute`, the module
copy's only reader, has no runtime caller, so `test/intake-routing.test.js` covers a table the listener never uses.
Remedy: `src/index.ts` already requires the module. Export the tables from there and delete the copies. 01 §T3.

**T2 (transcoder, 1080p rung): the job probes its source twice.** `init()` already probes once
(`container/index.js:526`, through `parseProbe`, which extracts height). The rung adds `getSourceHeight`
(`:185-209`), a second hand-rolled ffprobe spawn, called conditionally inside `processVideoToHls` (`:285-291`). That
makes four ffprobe wrappers in the repo. Remedy: move `displayedHeight` into `parseProbe` and pass the probe's height
into `processVideoToHls`. The second spawn, the flag-gated probe and the "not probed" state all go away. This touches
the frozen `container/`, so it ships with the next image build. 01 §T2.

**L2 (livestream, 195c0ea): "does this stream carry 1080p" is read from disk in more than one way.** `rungsOnDisk`
(`lib/liveLadder.js:80`) serves `hls.js` and `fileUpload.js`, while `decide1080p` builds the same path by hand
(`lib/streamLifecycle.js:342`). The record already moved once, from folder to playlist file, after the first real
class froze at one 1080p segment. The slice doc still describes the old record (`slices/hls-1080p.md:19`, `:40-41`).
Remedy: `rungsOnDisk` becomes the only reader, and the doc is fixed in the same change. 02 §L2.

### 3. Spaghetti and branching growth

**T4 (transcoder, 781 mirror + CF_VIDYAGRAM): isolation only works in one direction.** The dedicated lane refuses
every client except 781. The shared lanes, however, still accept 781: `vidyagramApiUrl` (`src/intake-routing.js:40`),
two `'781'` callback entries, and the hand list `['561', '472', '695', '781']` (`src/index.ts:756`).
`test/listener-compatibility.test.js:134` pins that a `781/…` key in `tempvideos-hranker` becomes an unsecured 781
job. A stray key there (for example the AppX remux fallback that CONTEXT.md describes) would put Vidyagram video in
quicktricks storage. Remedy: delete the unsecured 781 route, then make client ownership a lane property: a client
named by any lane's `securedClients` is refused on every other lane. The line-756 list becomes a field on the single
client table from T3. 01 §T4.

**T5 (transcoder, 1080p rung): every new per-client switch is another hand-written parse block.**
`resolveQueueProfile` (`src/intake-routing.js:392-421`) is strict about `HLS_1080P` but lenient about
`MP4_RENDITIONS`, and the boot-validation regex (`:434`) lists only two of the three fields. So a typo in the MP4 var
is silently ignored, while a typo in the 1080p var stops boot. Remedy: a `PROFILE_FIELDS` table that drives both
resolve and validate, with one fail-closed boolean parser. 01 §T5.

**L3 (livestream, a41a16e): "what kind of publish is this" is decided in four places.** `classifyPublish`
(`lib/publishDecision.js:32`) treats any `0/playlist.m3u8` on disk as a reconnect. That is safe only because earlier
checks in the handler (`rtmpserver-2.js:151-170`) reject ended classes, whose files stay on disk for 24 hours
(`lib/streamLifecycle.js:585-593`). The duplicate check at `:139` is a fourth rule. Remedy: one pure function that
returns `duplicate | ended | reconnect | new`, plus a test for the ended-with-files case that it currently leaves to
other code. 02 §L3.

### 4. Boundaries and type contracts

**T6 (transcoder, 1080p profile × existing container flags): the container has no notion of an "HLS-only" job.**
The 781 profile is the first secured job with MP4 turned off. `container/index.js:555` skips the MP4 pass, but `:574`
still reports an empty MP4 list, and `container/apis.js:284-286` sends it. That is the production FAILED/400 already
written up in `vidyagram/reports/vidyagram-1080p-recordings-400-2026-10-21.md`. The mirror on the same branch handles
the case correctly (`mirror-job.js` skips recordings when there is no MP4), so the concept now has two
implementations and one of them is wrong. Remedy: compute the job's output set once from the env and hand that value
to the reporter. Whatever the backend decides about `output.min(1)`, an empty report should not be sent. This rides
with T2's image build. 01 §T6.

**L1's return type** (see above) belongs here too: the fix makes the contract a single `Promise<ChildProcess|null>`.

### 5. File size

Neither branch pushes a file past 1,000 lines. `rtmpserver-2.js` was already 1,726 lines and grows by 9. Its
prePublish/donePublish handlers are where L1 and L3 tangle, and they deserve extraction. The file is shared lineage
with launch/quicktricks-v2, though, so a restructure on the Vidyagram branch would make every quicktricks fix harder
to merge in. Raise the extraction separately for the quicktricks side. On this branch, limit edits to that file to
the mechanical predicate swaps from L1. `container/index.js` (581 → 611) shrinks again with T2.

### 6. Modularity

**T7 (transcoder, all origins): half of `dist/` is tracked.** `.gitignore:8` ignores `dist`, yet `dist/index.js` and a
`dist/src/index.js` frozen at the init commit are tracked, while the `dist/intake-routing.js` it needs at runtime is
not. Today `dist/index.js` matches a fresh `tsc` build byte for byte, but every listener commit edits generated code
twice. Remedy: untrack both files. The box's release directory is the real artifact. 01 §T7.

**T8 (transcoder, 781 mirror): mirror instance modes are read piecemeal.** `addLevelFromEnv` is called in three places,
`mp4` is derived inline, `outputValue` branches on `CLIENT_ID === '472'` inside a shared resolver
(`apx-ingest-container/mirror-deps.js:57`), and `securedReportUrl` (`:140`) was rewritten instead of vendored like
its three test-guarded siblings. Remedy: resolve one instance config at boot and pass it down. Lower priority: this
path is tested, and the 781 mirror run is finished. 01 §T8.

### 7. Legibility

The docs have drifted. `CONTEXT.md:186` and `:203` still say "local" and "Deployment blocked". The slice doc describes
the old folder-4 record. `test/client-output.test.js` now tests the dedicated lane. `lib/streamLifecycle.js:69` still
logs "Quality folder 0". Rate mode is chosen by which fields are present, in both ladders (`container/hls-ladder.js:35`,
`lib/liveLadder.js:89`). That is fine at this size; make it explicit if a third kind of rung appears.

## Remediation sequence

Branch rule throughout: Vidyagram work stays on Vidyagram branches. Nothing below merges into launch/quicktricks-v2,
quicktricks-backend or quicktricks-admin. The transcoder listener is shared infrastructure with one deploy, so its
fixes ship from the Vidyagram branch line. Their only quicktricks-visible effect (T4: 781 keys refused on the legacy
lanes) is noted to the quicktricks side, not merged there.

Transcoder: listener-only steps first. They need no image rebuild, and `test/listener-compatibility.test.js` already
pins byte-identical legacy jobs.

1. **Subtract (T4).** Delete the unsecured 781 route and add lane ownership in `processIntakeMessage`. Smallest
   diff, closes the separation gap.
2. **One table (T3).** `src/index.ts` imports `CLIENT_PRIORITIES` / `callbackApiURls` from `intake-routing.js`. The
   line-756 list becomes a table field.
3. **Lane descriptors (T1).** One `securedLane()` builder. Env shrinks to the queue id and secrets. Rename
   `test/client-output.test.js`. Deploying this needs a listener release with a trimmed env file. Removing the now-unread
   vars is optional cleanup.
4. **Profile field table (T5).** Check the box env for malformed `MP4_RENDITIONS` values before making it strict.
5. **Untrack `dist/` (T7).**
6. **Container batch (T2 + T6)** with the next planned image build: one probe, an explicit output set, and the
   recordings 400 resolved alongside the backend decision.
7. **Mirror instance config (T8)** when the mirror is next touched.

Livestream (`feat/vg-live-1080p` only):

1. **Transcoder slot module (L1)** with token reservation and an always-async start. Write the two new tests first:
   the connection-loss one fails today. Edits to `rtmpserver-2.js` are limited to the four predicate swaps.
2. **Single ladder reader (L2)** and the slice doc fix.
3. **`decidePublish` (L3)** with the ended-with-files test.
4. Leave the `rtmpserver-2.js` extraction to a quicktricks-side decision (raise it there, don't do it here).

Each step is independently shippable and testable. Steps 1 of each list are the ones to do before any new feature
work lands on these branches.
