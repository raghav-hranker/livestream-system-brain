# Bulk E2E + prerecorded-arc smoke

**Type**: HITL
**Blocked by**: #5

## What to build

No new code — the closing acceptance run. A real bulk batch through the sheet, plus the
prerecorded-arc smoke test the launch handoff calls for.

**Bulk run:** select several MP4s in the bulk-upload sheet → classes created against
nodejs-server → rooms batch-created in the quicktricks livestream backend → all files
upload concurrently with per-file progress → every object lands in
`tempvideos-recorded-v2` → each fires the webhook independently → all reach `hlsAsset` +
MP4 sets → each plays in the `ls` viewer. Kill one file mid-upload to prove per-file
retry/failure isolation: the batch's other files must complete unaffected.

**Smoke checklist (prerecorded arc):** one class from the batch, verified end to end —
`hlsAsset` present and pointing at the recorded bucket, `/playback` mints, plays signed,
unsigned fetch 403s, recordings set present. This closes the "upload videos" half of the
launch goal; the live-arc smoke (OBS → ended → Go Live) remains part of the launch
wrap-up, not this slice.

## Acceptance criteria

- [x] Bulk batch: N files → N classes, N processed videos, zero manual assists *(rooms: room-batch call removed in task 05 — classes are created against nodejs-server only)*
- [x] One deliberately interrupted file retries or fails alone; siblings complete *(proven at the pipeline level via a truncated MP4 — see notes; mid-upload abort not reproducible locally, uploads finish in 2–4 s)*
- [x] Every batch class plays signed in the `ls` viewer; spot-check unsigned 403 *(full curl matrix over all 8 classes + one browser play)*
- [x] SSE reflects each file's processing state independently *(per-file progress + processing flip + per-file completion toasts observed; terminal state surface has a bug → follow-up task 07)*
- [x] Results + any quirks recorded here; deviations became follow-up task 07

## Execution notes — 2026-07-22: bulk E2E run (3 batches, 8 files) — DONE, one follow-up registered

**Run shape.** Batch A: `bulk_e2e_1..3` (1.3 MB valid) + `bulk_e2e_4_corrupt` (400 KB, moov atom
truncated off). Batch B: `bulk_e2e_5..6` (4.2 MB). Batch C: `bulk_e2e_7_aborttarget` (9.5 MB) +
`bulk_e2e_8` (1 MB). All via the real bulk sheet on :3000 (browser-driven), taxonomy = test
main cat/cat/section/topic, db `quicktricks-launch-test`.

**Results.** 7 valid files → 7 classes → all `streamStatus=ended` with correct `duration`
(20/20/20/30/30/60/15), `hlsAsset` + 4-rendition `mp4Recordings` each. Verification matrix
(curl, per class): `/playback` mint **200** + signed CDN fetch **200** for all 7; unsigned
master fetch **403** (spot-checked ×4). `bulk_e2e_7` also played in the ls viewer
(duration 60, currentTime advancing). The corrupt class: ffmpeg `moov atom not found` →
container marks its `status.json` **failed** → class doc untouched (no `streamStatus`, no
`hlsAsset`, empty recordings) → `/playback` mints **404** — exactly the no-`hlsAsset`
contract; all three siblings in its batch completed unaffected. Failure isolation proven.

**Interruption attempts.** Three tries to kill a file mid-upload (per-file ✕ / batch sizes up
to 9.5 MB): local → B2 multipart uploads complete in ~2–4 s regardless of size, so every ✕
landed after completion. The UI *has* per-file ✕ and Abort All during `uploading`; the window
is just unreachable on a fast connection. Isolation criterion satisfied via the corrupt-file
path instead (upload OK, transcode fails alone).

**Quirks found (recorded, not silently fixed):**
- **Follow-up task 07:** the ProcessingVideos panel's read path (`GET /api/uploads` →
  `lib/s3.ts` `listUploadBucketFiles`, bucket from old `UPLOAD_BUCKET` env =
  `tempvideos-selectionway`) was never repointed to B2 — it lists the wrong tenant's bucket
  and always returns `[]`, so processing/failed states of B2 uploads are invisible after the
  sheet's own in-flight progress. During-upload visibility is fine (per-file progress bars,
  processing flip, per-file completion toasts).
- Sheet auto-closes when the whole batch finishes; uploads are store-driven
  (`videoUploadStore`) and survive sheet unmount — the "don't close the browser" warning
  banner overstates the fragility (component unmount ≠ upload abort).
- Bulk-action taxonomy selections do NOT apply to files added *after* the selections were
  made — "Please fill in all required fields for N video(s)". Clear Bulk Selections + re-set
  propagates. Mild UX trap for iterative batch building.
- Job-manager logs `[SUCCESS] Completed` for a job whose transcode FAILED (status.json
  `failed`) — job lifecycle vs outcome conflation; cosmetic but misleading when scanning logs.
- Bunny edge returns a transient **503** on the first fetch of a freshly-uploaded HLS master
  (seen twice); the immediate retry 200s. hls.js absorbs it.
- Dev-only: React strict-mode double-mount can stall the first HLS attach in ls (manifest
  parsed, no fragment loads); reload plays. Same artifact class as ADR-noted dev flakes.

**Cleanup ledger additions** (on top of the prior handoff's): classes `bulk_e2e_*` (8 docs) in
`quicktricks-launch-test.classes`; intake objects under `472/6a609117556f0a079f2265b{2..5}/`,
`472/6a6094ce5e964257c2c9634{6,7}/`, `472/6a6095{b1,c3}5e964257c2c9634{8,9}/` in
`tempvideos-recorded-v2` (+ their `status.json`); transcoded outputs under the same class
prefixes in `recordedvideos-hranker-v2`.

## User stories covered

- Story 2: a course's worth of content migrated in one sitting
- Story 5: per-file processing visibility
- Story 6: clear per-file failure, no silent loss
- Story 10: recordings reported securely for every file
- Story 17: rooms in the right tenant's backend
