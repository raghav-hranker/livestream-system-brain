# Quicktricks 15:00 class stuck in `processing` — 2026-10-16 (recovered)

Class `6ac8ea244783067e4ff4f38d` "Day-2 || Direction & Distance (Part-2)", client 472, live 09:30:10–10:30:03 UTC
(15:00–16:00 IST), 899 segments × 4 renditions. Encoder: GCP `livestream-testing-raghav`, pm2 `quicktricks-livestream`,
checkout `/home/raghav/quicktricks-livestream/backend` at `bfc1512`. Context: the [GCP Redis cutover run log](quicktricks-gcp-redis-2026-10-16.md).

## Root cause: a serial reconcile that is slower than the cutover window, not the file watchers

Timeline (encoder log, UTC): OBS closed 10:30:02 → `reconnecting` + 660 s grace → `endStream` via Redis 10:30:27 →
grace cancelled, FFmpeg killed, finalize claim won, `processing` delivered, stream POST entered,
`[upload-mode] skipping end-of-stream bulk uploadDirectoryToS3` → **nothing more** until pm2 stopped the process at
10:34:33 for the Redis cutover.

After that log line, `routes/stream.js` runs `waitForPendingSegmentUploads` (≤15 s), then
`lib/segmentReconciler.js` `reconcileSegments`. That issues one `HeadObject` per referenced segment, **one at a time**,
across all four renditions, and only then calls `executeManifestFiles` + `uploadVodPlaylistsOnly`. At about 0.2 s per HEAD
from asia-south2 to R2, the end-of-class finalize takes 7–14 min on every real class. Measured from today's log
(time from the "skipping" line to "running executeManifestFiles"):

| Class | Segments/rendition | Reconcile |
|---|---:|---:|
| 6ad0f5ea… (09:00 IST) | 817 | 10 m 12 s |
| 6ad0f66a… | 1,076 | 14 m 27 s |
| 6ad0f8e8… / 6ad0f79d… | 527 | ~7 m 20 s |
| 6ad0f81b… (13:00 IST) | 879 | 11 m 39 s |
| 6ad0f837… | 900 | 13 m 16 s |
| demo 6ad1fdef… | 60 | 46 s |

The 15:00 class would have needed about 12 min. It got 4 min 6 s before the planned stop. The run log said the
13:00 class produced its VOD playlists "within ~45 s". That was wrong: only the 60-segment demo was that fast.

Why it stayed stuck after the restart: the finalize state lives only in the dead process. The NX finalize claim was
already taken, `recoverPending` replays only the last *delivered-status* transition (`processing`), and the VOD POST is
not persisted anywhere, so nothing re-runs it. The 24 h disk cleanup timer was never armed either, so the local files survive.

So nothing failed: no upload error, no watcher problem, no Redis error. A long-running, non-resumable finalize was
cut off by a restart. Any encoder restart or deploy within about 15 min of a class ending reproduces it.

## Recovery

Script: [`scripts/qt-vod-recover.cjs`](scripts/qt-vod-recover.cjs), copied to the encoder at
`/home/raghav/qt-vod-recover-20261016/`. It loads the deployed checkout's own modules and `.env` and replays the
upload-mode branch of `routes/stream.js`, then the `ended` write that `doStreamCleanup` makes. The only change is running
the existence checks 16 at a time. The ECS step is skipped; `POST_LIVE_TRANSCODE_ENABLED=false` on this box, so it is a no-op anyway.
The pm2 process is not touched.

- **Dry run (done 2026-10-16 ~10:5x UTC):** 3,596/3,596 segments present in `livestream-hranker-v2`, 0 missing,
  0 unusable, 0 errors, 44 s. `0..3/playlist-vod.m3u8` were built on disk with 899 segments each, `#EXT-X-PLAYLIST-TYPE:VOD`
  and `#EXT-X-ENDLIST`. `playlist-mpl-vod.m3u8` points at the four renditions (same bandwidths as live).
- **Commit (done 2026-10-16 10:57 UTC, user-approved):** the second pass found 3,596/3,596 segments present again (44 s, 0 repaired).
  All 5 VOD playlists were uploaded and HEAD-confirmed. `ended` was delivered synchronously, and the LMS now holds `streamStatus: ended`,
  `hlsAsset {bucket: live, key: 472/6ac8ea244783067e4ff4f38d/playlist-mpl-vod.m3u8}`, `actualEndedAt 10:30:27.656Z`
  (same shape as the 13:00 control class 6ad0f81b…). Command used:

  ```
  gcloud compute ssh livestream-testing-raghav --zone=asia-south2-c --command 'cd /home/raghav/qt-vod-recover-20261016 && $HOME/.nvm/versions/node/v24.15.0/bin/node qt-vod-recover.cjs 472 <classId> --commit'
  ```

  If it ever prints "queued for retry", the transition sits in `streamStatus:pending:quicktricks:<id>` and is delivered
  only on the encoder's next boot (`recoverPending`).
- **Playback (verified 11:0x UTC):** [`scripts/qt-playback-check.cjs`](scripts/qt-playback-check.cjs), run read-only from the LMS
  checkout on the box, signs the master exactly as `/playback` does (default CDN = cloudflare, `livev2.hranker.org/v/<token>/…`).
  Signed master 200 → 4 renditions 200, each 899 segments, 3,593 s (59:53), `#EXT-X-ENDLIST`. First, middle and last segment of
  every rendition 200, MPEG-TS sync byte present. The 13:00 class gives the same result (879 segments, 58:33). This checks the
  HTTP chain only; no player decode test was run in a real app.
- The local files on the encoder remain (`/home/ubuntu/shared/livestream-files/472/6ac8ea24…/`, ~1.3 GB). The 24 h cleanup
  timer was never armed for this class, so they need a manual `rm` whenever wanted.

## Fix (not done, livestream repo)

1. `reconcileSegments`: bounded concurrency (16 gives about 45 s for a 1-hour class), or one `ListObjectsV2` per rendition
   prefix in place of a HEAD per segment (about 4 requests instead of 3,600).
2. Make finalize resumable: persist "VOD POST pending for <path>" before the POST and clear it after `ended`, and have boot
   replay it the way `recoverPending` replays status. Until then: **no encoder restart within ~15 min of a class ending**.
   Check the log for `running executeManifestFiles` / `[VOD UPLOAD]` before stopping pm2.

## Side findings
- `routes/stream.js` on the encoder checkout has a hardcoded AWS access key pair in the (unused) `lambdaClient`. It
  should be rotated and removed from the repo. Values not reproduced here.
- The 2026-09-10 test class `6aa1d58706102a28cb20994f` was cut off the same way (restart "while the serial segment check
  was running", see memory quicktricks-live-topology). The same script recovers it if wanted.
