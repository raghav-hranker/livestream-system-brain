# Stream-end final-segment reconciliation: VOD playlist must never reference an unuploaded segment

**Type**: AFK (diagnosis on the box is read-only; prod repair is HITL)
**Blocked by**: — (found in the 2026-07-27 prod acceptance run; breaks VOD playback for real viewers)
**Repo**: livestream
**Governing docs**: [launch runbook, Phase-4 prod findings](../launch-runbook-quicktricks-v2.md) · upload-mode decision: livestream ADR 0001 (live watcher uploads; end-of-stream bulk upload skipped)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## Background (observed 2026-07-27, acceptance class `6a6709edd1058d4e2cdb61c9`)

VOD playback of the just-ended acceptance class dies in the ls player with
"Network error — could not load the stream": `playlist-vod.m3u8` returns 200 and lists segments
through `segment_85.ts`, segments 74–84 all return 200 (signed), but **`segment_85.ts` 404s** —
the player retries playlist+segment in a loop and gives up. The 404 (not 403) means the token is
fine; the object is simply **absent from the Live bucket**. This never happened in the room era.

Why it is new: the room era effectively ran **disk mode**, where `routes/stream.js` bulk-uploads
the whole stream directory at end (`uploadDirectoryToS3`) — every segment on disk lands in the
bucket, always. **Upload mode** (`config.liveUploadEnabled`, ADR 0001) skips that bulk upload
("segments already uploaded live") and trusts the live watcher to have uploaded everything. There
is no end-of-stream check that this is actually true.

Suspected mechanism (verify on the box — stream files persist 24h after end, so the acceptance
class's disk state and pm2 logs are inspectable today):

1. `doStreamCleanup` (`backend/lib/streamLifecycle.js:456`) SIGKILLs ffmpeg; the final segment
   ffmpeg completed (`segment_85.ts`, referenced by the live playlist) hit disk moments earlier.
2. The segment uploader is a chokidar `add` watcher (`backend/lib/watchers.js:174`,
   `setupUploadWatchers`) with `awaitWriteFinish` (500ms stability, 100ms polling) — the final
   segment's `add` event may not have fired, or its upload not finished, when the cleanup POST
   (`http://localhost:8082/api/v1/stream/`) runs.
3. The stream route (`backend/routes/stream.js`) immediately builds VOD playlists from the live
   playlists (`executeManifestFiles`, `backend/lib/hls.js`) — **verbatim, with no awareness of
   what was actually uploaded** — uploads only the playlists (`uploadVodPlaylistsOnly`), and
   enqueues 1C. Watchers are closed right after the POST returns
   (`streamLifecycle.js:515-524`). Nothing awaits `pendingSegmentUploads`
   (`watchers.js:171`) and nothing reconciles disk segments against the bucket.

Result: a VOD playlist that references a segment that will never exist in the bucket.

## What to build

**Diagnose first** (read-only; `gcloud compute ssh livestream-testing-raghav --zone=asia-south2-c`,
pm2 needs `PATH=$HOME/.nvm/versions/node/v24.15.0/bin:$PATH`, app `~/quicktricks-livestream`):
- Confirm `segment_85.ts` exists on disk (which quality folders, size vs neighbors — complete or
  truncated by the SIGKILL?).
- Grep pm2 logs for `[live-upload-timing]` on `segment_85` (uploaded late? failed? never
  attempted?) and for the chokidar/POST ordering around stream end.
- Record the confirmed root cause in the execution notes before writing the fix.

**Fix — end-of-stream segment reconciliation (upload mode only):**
In the stream POST's upload-mode branch (`routes/stream.js`), **before** `executeManifestFiles`:
1. Await any in-flight segment uploads for this StreamPath (expose/track
   `pendingSegmentUploads` per stream, or an equivalent handshake with the watcher layer).
2. Reconcile: enumerate `.ts` files on disk that the live playlists reference, check each exists
   in the bucket (HEAD, or a tracked uploaded-set), and upload any that are missing via the
   existing `uploadFileToS3`.
3. Only a segment that is genuinely unusable (still missing after reconciliation / zero-byte)
   may be dropped — and then it must also be **excluded from the generated VOD playlists** so
   the playlist never references a key that is absent from the bucket.
Disk mode (`liveUploadEnabled === false`) is untouched — the bulk upload already guarantees this.

**Prod repair (prepare, do NOT execute — user green-light required, prod is live):**
Exact commands to heal class `6a6709edd1058d4e2cdb61c9` — upload the missing `segment_85.ts`
from the box's disk to the Live bucket at the referenced key(s) (preferred), or, if the file is
unusable, rebuild + re-upload `playlist-vod.m3u8`/quality VOD playlists without it.

## Acceptance criteria

- [x] Root cause pinned with box evidence (disk state + `[live-upload-timing]` log lines), recorded in execution notes
- [x] Upload mode: stream end with a segment that missed live upload → reconciliation uploads it before VOD playlists are built; playlists reference it; 1C input is complete
- [x] Upload mode: a genuinely unusable final segment is excluded from every generated VOD playlist (no 404-able reference)
- [x] In-flight final-segment uploads are awaited before `executeManifestFiles` runs
- [x] Disk mode behavior unchanged (bulk `uploadDirectoryToS3` path untouched)
- [x] Jest tests beside the existing suites (`jest tests/`, currently 118/118 — must stay green): reconciliation uploads a missing referenced segment; drops an unusable one from the VOD playlist; awaits pending uploads
- [x] No change to the 1C payload shape, webhook contracts, or `storageProvider` routing
- [x] Prod repair commands for the acceptance class prepared and printed, **not executed**

## User stories covered

- A student opens the recording right after class and it plays to the end — the last seconds of the teacher's goodbye are not a fatal "Network error".

## Execution notes (2026-07-27)

**Confirmed root cause — two mechanisms, both "the VOD playlist is built from disk with
zero awareness of the bucket".** The suspected mechanism in the task body is half the story;
the fatal half is a *re-run*.

Box: `livestream-testing-raghav`, deployed at `6cff30e`. Stream dir
`/home/ubuntu/shared/livestream-files/472/6a6709edd1058d4e2cdb61c9`, log
`~/.pm2/logs/quicktricks-livestream-out.log`.

*Disk state* — `segment_85.ts` exists in **all four** quality folders and is a **complete,
usable** final segment, not a SIGKILL truncation: q0 = 256,056 B for `#EXTINF:1.251333` (the
neighbours are ~475 KB for 4.004 s — same ~1.6 Mbps). It is the last segment; there is no
`segment_86`.

*Timeline (all 2026-07-27 UTC)*

| Time | Event |
|---|---|
| 07:45:46.080 | ffmpeg writes `0/segment_84.ts` |
| 07:45:46.xx | `endStream triggered from frontend` → `Killing FFmpeg processes … keeping file watchers alive` → SIGKILL |
| 07:45:46.964 | ffmpeg's dying flush writes `segment_85.ts` (×4) **and** appends it to the live quality playlists (disk 7,543 B) |
| 07:45:46 | `POST /api/v1/stream/` → `running executeManifestFiles` — reads the live playlist **before** that append lands |
| 07:45:46–47 | last live-playlist upload is **7,457 B** (the pre-`segment_85` version); VOD playlists uploaded at **2,567 B** — 85 segments, ending at `segment_84`, **consistent with the bucket** |
| 07:45:47 | `Closing file watchers … after VOD generation` — chokidar `awaitWriteFinish` (500 ms) had **not** fired for `segment_85`, so its `add` never ran |
| 07:45:50 | `0/segment_84.ts` upload finally completes (`ms: 4006`) — **3 s after** the watchers were closed and after the VOD playlists were already uploaded |
| 08:06:46 | a **second** `endStream triggered from frontend`; `doStreamCleanup` runs again, wins the finalize claim again (the claim is per-end, not once-per-class-forever), and POSTs `/api/v1/stream/` again |
| 08:06:47 | `executeManifestFiles` re-reads the **disk** live playlist — which now *does* contain `segment_85` — and uploads VOD playlists of **2,596 B** referencing `segment_85.ts`, which was never uploaded and whose watchers had been closed 21 minutes earlier |

*Log evidence* — `grep '[live-upload-timing]' … | grep 6a6709edd1058d4e2cdb61c9` has **zero**
lines for `segment_85.ts` in any quality (4,640 log lines cover the whole session; the identical
grep for the 05:45 class `6a631202d6a9e3a87aae1790` does show all four `segment_85` uploads —
that stream ran on and the watcher caught up).

*Bucket evidence* — signed HEADs against `livestream-hranker-v2.b-cdn.net` (path-embedded
`bcdn_token`, `BUNNY_LIVE_SECURITY_KEY` from the box `.env`):

```
200  472/6a6709edd1058d4e2cdb61c9/0/segment_84.ts
404  472/6a6709edd1058d4e2cdb61c9/{0,1,2,3}/segment_85.ts     ← all four
200  472/6a6709edd1058d4e2cdb61c9/0/playlist-vod.m3u8         ← the 2,596 B one that references it
```

So the 07:45 build was self-consistent; **the 08:06 re-run is what published the 404-able
reference**. A fix that only tightened the watcher/close race would not have prevented this —
reconciliation against the bucket does, on both the first run and every re-run.

**Fix shipped** — livestream `468199a6`, branch `launch/quicktricks-v2`, 118 → **136/136** green.
`backend/lib/segmentReconciler.js` (new) proves every segment the live playlists reference exists
in the Live bucket, uploads the missing ones from disk, and reports only the genuinely unusable
ones (absent/zero-byte on disk, or repair upload failed) for exclusion; `objectExistsInS3`
(`lib/fileUpload.js`) returns true/false only on a definitive answer and re-throws anything else,
so a storage blip can never truncate a recording; `waitForPendingSegmentUploads`
(`lib/watchers.js`, bounded 15 s) settles in-flight uploads first; `executeManifestFiles`
(`lib/hls.js`) takes an optional exclusion set. Wired into the **upload-mode branch only** of
`routes/stream.js`, before `executeManifestFiles`, wrapped in try/catch so a reconciliation
failure degrades to today's behaviour. Disk mode, the 1C payload, `runEcsTask`, the webhooks and
`storageProvider` routing are untouched; `rtmpserver-2.js` is untouched.

**Not verified:** the fix is committed but **not deployed** — no end-to-end run on the box (prod
is live; deploy is the parent session's call). `[reconcile]` log lines therefore do not exist in
prod yet.

**Prod repair for `6a6709edd1058d4e2cdb61c9` — PREPARED, NOT EXECUTED.** `segment_85.ts` is
complete and on disk in all four qualities, so the correct repair is to upload it, not to rebuild
the playlists (the published VOD playlists already reference it and are otherwise correct). Files
are deleted 24 h after stream end (~07:45 on 2026-07-28) — repair before then or the segment is
gone. Commands are in the task-15 agent report.

## Live verification (2026-07-27, box @ b2412ed, class 6a6738d2b604444bc220fe81)

Real OBS run reproduced the race organically: final `segment_26` was still mid-upload at Stop
(`Waiting for 1 segment upload(s)…`); finalization awaited it, reconciler HEAD-verified all
references silently (no repairs needed), VOD playlists end at segment_26. External check: all 27
segments signed-200 (q0) + segment_26 200 in all 4 qualities; unsigned 403. PASS.
