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

- [ ] Root cause pinned with box evidence (disk state + `[live-upload-timing]` log lines), recorded in execution notes
- [ ] Upload mode: stream end with a segment that missed live upload → reconciliation uploads it before VOD playlists are built; playlists reference it; 1C input is complete
- [ ] Upload mode: a genuinely unusable final segment is excluded from every generated VOD playlist (no 404-able reference)
- [ ] In-flight final-segment uploads are awaited before `executeManifestFiles` runs
- [ ] Disk mode behavior unchanged (bulk `uploadDirectoryToS3` path untouched)
- [ ] Jest tests beside the existing suites (`jest tests/`, currently 118/118 — must stay green): reconciliation uploads a missing referenced segment; drops an unusable one from the VOD playlist; awaits pending uploads
- [ ] No change to the 1C payload shape, webhook contracts, or `storageProvider` routing
- [ ] Prod repair commands for the acceptance class prepared and printed, **not executed**

## User stories covered

- A student opens the recording right after class and it plays to the end — the last seconds of the teacher's goodbye are not a fatal "Network error".
