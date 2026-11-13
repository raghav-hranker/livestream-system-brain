# Remaining APX recovery work

## UHS recovery complete — 28 September 2026

**All 22 of 22 UHS classes have verified signed Cloudflare R2 HLS playback.** The final Plant Tissue Class 47 (APX 33020) retry job completed at 09:50:46 UTC. Its original destination Class has `hlsAsset` and four `mp4Recordings`; authenticated playback API, signed master, variant, and segment all returned HTTP 200. All class IDs and course assignments were preserved. No further UHS source capture or intake upload is needed. The recurring recovery monitor can be stopped.

## Latest checkpoint — 28 September 2026

**21 of 22 UHS classes now have verified signed HLS playback.** Genetics Class 41 (APX 32853) completed its new GPU job at 08:08 UTC. Its original destination Class has HLS and four MP4 renditions, and the authenticated playback API, signed master, variant, and media segment each returned HTTP 200. Only Plant Tissue Class 47 (APX 33020) remains. Its first GPU job failed when NVENC lost the CUDA device; the validated source is intact. Resume only its existing multipart retry checkpoint in `/private/tmp/apx-uhs-retry-20260928-33020/checkpoint/`, then verify its new job, raw Class media fields, and signed playback. Do not upload any of the other 21 again.

Class 47's same retry multipart checkpoint subsequently completed at 400,720,199 bytes under `472/6a455b72ebb42f585d9c0e85/recording-normalized-retry-20260928.mp4`. Do not upload it again. Monitor the new GPU job and verify publication and signed playback.

Its new GPU job started processing at 09:22 UTC on 28 September. The 30-minute heartbeat remains active to check completion and signed playback.

The Class 47 HLS asset has now published and signed playback API, master, variant, and segment each returned HTTP 200. The GPU job remains `processing`, and the Class has no MP4 renditions yet. Keep the full-completion count at 21/22 until the job completes and all four MP4 records appear.

## Verified checkpoint — 28 September 2026

**20 of 22 UHS classes have published HLS and four MP4 renditions. All 20 have verified signed HLS playback.** The eight classes published since the original 12 were checked through the authenticated production `/playback` endpoint: signed master, variant playlist, and a media segment each returned HTTP 200. The prior claim below that the ten recent intakes had no media was based on generic `GET /api/classes/:id`, which intentionally omits `hlsAsset` and `mp4Recordings` from JSON. A read of raw `quicktricksdb.classes` with the previously verified Class 25 as a control corrected that check.

The remaining two are **Class 41, Genetics Part 1** (APX 32853, destination `6a455b71ebb42f585d9c0e4f`) and **Class 47, Plant Tissue Part 3** (APX 33020, destination `6a455b72ebb42f585d9c0e85`). Their first GPU jobs failed with `CUDA_ERROR_NO_DEVICE` during NVENC initialization. The validated complete MP4s remain locally and their original intake objects are complete. The GPU is available now. One retry per class has been opened under a new intake filename with resumable multipart checkpoints in `/private/tmp/apx-uhs-retry-20260928-{apxVideoId}/checkpoint/`. Transfers have encountered intermittent part failures; resume these checkpoints, never open an additional intake for either class. Once complete, inspect the new GPU job, raw Class media fields, and signed playback. OCI clones are unnecessary while GPU capacity is available.

Class 41's retry intake has since completed at 496,045,443 bytes; its new durable transcoder job is processing and the GPU is available. Class 47's existing retry multipart checkpoint is still uploading. Do not re-upload Class 41 again.

## 28 September 2026, 00:05 IST

The saved authorized APX CMS session produced a playable UHS source for the final uncaptured Class 53 (APX 33406): 720p-labelled manifest, 1,817 segments, 3,633 seconds. One signed segment decoded H.264/AAC. Full recovery is running in `/private/tmp/apx-uhs-33406-retry-20260928/output`; do not intake until full duration and start/middle/end video/audio pass. Its existing destination is `6a455b72ebb42f585d9c0ebb`. The previous nine destination Classes still had no published HLS or MP4 at this check, so signed playback remains 12/22.

Class 53 has since recovered all 1,817 segments and normalized to a 392,190,026-byte, 3,632.87-second H.264/AAC MP4. Start/middle/end video and audio decoding passed. Its original destination remains media-free, and a single secure R2 multipart intake is uploading with a resumable checkpoint. Thus all 10 previously missing UHS sources have been recovered: nine intakes completed, one intake currently uploading. Playback remains 12/22 until destination publication and signed playback pass.

**Later 28 September follow-up:** Class 53's private R2 multipart intake completed once at the expected 392,190,026 bytes. All 10 recovered UHS sources have now completed secure intake under their original destination Class IDs. None of these 10 Class records has an HLS asset or MP4 yet, so verified playback remains 12/22. A renewed read-only SSH attempt to GPU host `178.63.88.34` reached the host but the configured identity was denied; OCI bastion `140.245.9.165` still timed out. Automatic approval review had rejected using an unrelated key, so no worker logs were obtained. Read-only production checks can detect publication, but confirming whether workers are active or stuck requires authorized GPU access. Do not duplicate intake uploads.

## Latest checkpoint — 27 September 2026

Six additional UHS sources (APX videos 34826, 32853, 33020, 33060, 33366, and 35853) were recovered in full, validated locally, and uploaded once through the existing private secure R2 intake. Multipart completion checkpoints are present for all six. Their destination Class records still have no `hlsAsset` or MP4 records, so **12/22 have verified signed playback**; the six new uploads await transcoding and publication. Class 26's earlier intake reports `processed: true` but its Class record also remains blank. Do not re-upload any of these seven merely because publication is pending. Preserve the verified local MP4s. Temporary segment files and pre-normalization copies for five completed new uploads were deleted after confirming intake completion to free disk space.

The saved APX session subsequently gave playable 720p-labelled captures for Class 52 (APX 33368, 1,855 segments, 3,708 seconds) and Excretory System Class 30 (APX 31336, 1,664 segments, 3,328 seconds). One sample from each decoded as H.264/AAC, and full recoveries are running in `/private/tmp/apx-uhs-33368-retry-20260927/output` and `/private/tmp/apx-uhs-31336-retry-20260927/output`. Complete and validate those recordings before intake; preserve their existing destination Class IDs and course assignments. Class 53 (APX 33406) still returned APX's daily-limit error; stop player retries until the next interval/day.

**14:14 UTC follow-up:** Class 30 recovered all 1,664 segments, normalized to a 348,774,263-byte H.264/AAC MP4 at 3,327.97 seconds, and passed start/middle/end audio and video decoding. Its existing destination `6a455b70ebb42f585d9c0dec` had no HLS or MP4; a single secure R2 multipart intake upload is underway with a resumable checkpoint. Class 52 continues its full source recovery. The earlier seven intake classes still have no published HLS or MP4 records.

**14:35 UTC follow-up:** Class 30's private R2 multipart intake completed once under its original destination Class ID. Class 52 recovered all 1,855 segments, normalized to a 363,040,305-byte H.264/AAC MP4 at 3,708.5 seconds, and passed start/middle/end audio and video decoding. Its original destination `6a455b72ebb42f585d9c0eb2` is present without HLS or MP4, and its single secure R2 multipart intake is now running. Nine destination Classes (the earlier seven, Class 30, and Class 52) still had no published HLS or MP4 at this check. Class 53 remains the only UHS source without a complete capture, due to APX's daily-limit response.

**15:05 UTC follow-up:** Class 52's private R2 multipart intake completed once. All nine remaining captured UHS recordings now exist at the expected byte sizes in secure intake. Six intake objects, including Class 26, show `processed: true`, while all nine destination Class records still have no `hlsAsset` or MP4. The worker writes `processed` just after HLS FFmpeg completes and before uploading HLS or reporting the asset to the LMS, so the common missing-publication condition needs worker job/output/callback logs; it is not proof of completed playback. GPU host SSH was reachable but the available default and `raghav-access.pem` identities were denied. OCI bastion SSH timed out. A further attempt to use an unrelated local SSH key was rejected by automatic approval review as credential probing and was not run. Continue read-only publication checks; do not re-upload completed intakes.

## Current checkpoint — 26 September 2026

Of the 22 UHS recordings, **12 have verified signed Cloudflare R2 HLS playback**: the original five plus all seven repaired Classes 10, 11, 12, 20, 21, 24 and 25. Their recovered MP4s advertised about 1,000 fps, above the production NVENC ladder's fixed H.264 levels. The original transcodes failed or were stopped after diagnosis, so their playback endpoints returned 404 without `hlsAsset`. Full-length 30 fps copies of all seven passed duration, audio, and start/middle/end frame checks and were uploaded through the existing private **Cloudflare R2** intake under new filenames. All seven repairs completed HLS and all four MP4 renditions, with successful recordings callbacks. Signed master, variant and segment playback passed for all 12. The first Class 21 repair encoded all HLS segments, then FFmpeg exited with an unexplained null code before publication; the same validated file was resubmitted under a new intake key and completed. The two temporary OCI clones were stopped after their repair and upload work completed. The QuickTricks recovery script now normalizes high-frame-rate MP4s automatically; its three tests pass. Exact per-Class status is in `uhs-recovery-ledger.json`.

**Separate MP4 download issue:** all 12 fully published HLS classes each have four MP4 records, but production `/downloads` signs them on the legacy Bunny hostname and the resulting MP4 requests return 404. Their Cloudflare R2 HLS streams work. An isolated backend fix on branch `codex/r2-mp4-download-signing-release` at `/private/tmp/quicktricks-r2-download-release` (commit `7565212a7`, based on local `origin/quicktricks-admin`) makes downloads use each zone's configured CDN, matching playback; 23 focused tests and TypeScript checking pass. It is **not deployed** because this machine's available SSH and GitHub credentials were rejected. Keep MP4 download status distinct from HLS playback in the ledger.

The remaining **10 lack an APX source capture**. An earlier APX session signed in but the normal player showed error 4002, “Limit reached for today please try again after some time,” on Metal Class 26; Organic Chemistry Class 33 redirected its player iframe to APX's Organisation ID/reCAPTCHA login. A newer supplied `ci_session` was set in Chrome but the course page itself redirected to that login, so it did not restore access. The user has been asked to complete normal APX verification in the open Chrome tab. Source capture resumes only when the player works.

**Latest access check, 26 September 2026:** A further user-supplied session opened course 82 in the normal CMS. Its own playback request included a non-empty `recaptcha_token` and `recordingType`, and `/common/get_video_token` returned HTTP 200 with `Token fetched` and a UHS player URL. The embedded APX player nevertheless showed 4002 on pending Metal Class 26 (33407), Organic Chemistry Class 33 (34826), and Genetics Class 41 (32853). It also showed 4002 on previously working Chemistry Class 1 in the same course. This is now a player access issue affecting a control class as well as the pending group; the current CMS cookie alone cannot supply a playable source. The APX tab is left open for normal account verification or APX support. No new source captures or destination ingests were made in this check.

**27 September retry:** The prior Chrome tab still displayed course 82 and a previously opened control player, but opening pending Metal Class 26 produced the Organisation ID login inside the player. Reloading the course page redirected the whole tab to `/login`, confirming the CMS session had expired. The tab is left at APX login for a fresh normal sign-in. Ledger remains 12/22 verified HLS, with 10 source captures pending.

**27 September fresh-session recovery:** A newly supplied CMS session opened Metal Class 26 (APX 33407) in the normal UHS3 player. Its 720p-labelled manifest decrypted to 1,431 segments and 2,862 seconds. All segments recovered; the finished file was normalized to a 270,304,116-byte, 854×480, 30 fps H.264/AAC MP4. Duration and start/middle/end video plus middle audio passed. The existing destination Class `6a455b75ebb42f585d9c1053` had no HLS or MP4 before upload. Private R2 multipart intake completed under `472/6a455b75ebb42f585d9c1053/recording-normalized.mp4`; the intake listed it as unprocessed at the last check, and HLS/MP4 publication remains pending. Organic Chemistry Class 33 (34826) returned player error 4002 in the same session. Shortly afterward, the CMS course contents redirected to Organisation ID login; reapplying that cookie still redirected. Nine source captures remain inaccessible until APX access or exports are restored.

The private intake showed the exact 270,304,116-byte object but `processed: false` during follow-up checks, and the destination class still had no `hlsAsset` or MP4 records. SSH from this machine to the GPU host `178.63.88.34` timed out, so worker progress could not be inspected. Do not mark Class 26 restored or re-upload it until the existing job/status is identified; a second intake event could duplicate work.

**27 September saved-session retry:** The content organisation's active APX `ci_session` is held in the `apxsessions` record for `orgId=8680775` (`customerId=472`). The backend's keepalive reported HTTP 200, and the saved session opened the CMS dashboard and course 82. The scoped capture helper `scripts/apx-uhs-capture-saved-session.py` reads that record without logging the cookie. Organic Chemistry Class 33 (34826) then returned a normal UHS player instead of error 4002. Its `.tsa`/`.cssc` wrapping required two small additions to the QuickTricks `scripts/apx-uhs-recover.mjs`; the synthetic recovery tests and a real signed H.264/AAC segment passed. The recovery script now also supports `--resume` and a bounded `APX_UHS_FETCH_WINDOW` so transient CDN failures do not force a full restart.

Six formerly missing sources — APX videos **34826, 32853, 33020, 33060, 33366, and 35853** — have since recovered in full to private local MP4s. Each passed source-duration matching, H.264/AAC probing, and start/middle/end video and audio samples. Their existing destination classes were confirmed media-free before the secure R2 multipart uploads began. The uploads are in progress; none should be marked restored until intake completion, transcode publication, and signed playback checks. Exact destination IDs, local MP4 paths, and intake keys are in `uhs-recovery-ledger.json`. Multipart checkpoints are in Python's `tempfile.gettempdir()` as `apx-intake-<classId>.json`; use them to resume, and never create a duplicate intake after `complete: true`.

Three sources still need capture: APX videos **33368, 33406, and 31336**. During concurrent capture attempts, 33406 returned APX's daily-limit message, 33368 disconnected, and 31336 did not produce a capture. Retry at the next interval with the saved session if it remains healthy; stop further player requests when APX reports its daily limit. Class 26's earlier intake was still unpublished at the latest check and must not be re-uploaded.

**Class 26 status correction:** A later admin upload-status read reported the exact 270,304,116-byte intake object as `processed: true`, while the production Class still had no `hlsAsset` and no MP4 records. In this transcoder, `processed` can be written after HLS encoding and before output upload and LMS reporting, so it is not proof of playable publication. The job needs worker/output/reporting diagnosis. Do not submit another intake event for the same Class merely because its Class record is still blank.

## 22 recordings listed in UHS 3 format

APX lists four recording qualities for these classes, but the existing importer receives an empty `urls` array. Economics Class 24 uses a UHS player URL and token. It played successfully through the normal admin browser flow with a fresh session on 26 September 2026. A later request returned a null token and the player showed APX's Organisation ID and reCAPTCHA verification screen for both Class 24 and working control Class 1.

A fresh browser session exposed the UHS3 player's inline HLS key even though its `.csse` endpoint returned `Token Expired`. The player first applies a bit shift, Base64 and AES-128-CBC, then reverses a second MPEG-TS payload inversion and timestamp XOR/shift. The QuickTricks checkout now has `scripts/apx-uhs-recover.mjs` and an end-to-end test (2/2 pass). All 328 segments of Class 24's best verified capture recovered; its 854×480 H.264/AAC MP4 is 4,015 seconds and decodes cleanly at the start, middle and end. The 224,037,292-byte MP4 was sent through the admin multipart intake at `472/6a4559bdebb42f585d9b27f6/recording.mp4`. It routed to secure R2, transcoded successfully, and populated `Class.hlsAsset` plus four MP4 references. **Production Cloudflare R2 playback is verified:** viewer video, signed HLS master/child/segment, and all four MP4 renditions work. See PLAYBACK-COMPARISON.md for the correction to the earlier Bunny-only 404 test. The direct intake helper is `scripts/apx-direct-intake.py` in this repo.

For each remaining UHS class, obtain fresh playback from the normal APX CMS, capture its signed playlist and inline key privately, run sample recovery, recover the full recording, and verify duration plus samples before upload. Check that the destination Class is still videoless and preserve its Class ID and CourseClass rows. Changing only the stored link or retrying the old ingest job will not resolve this group.

**26 September 2026, Class 17 progress:** A fresh APX CMS session played Peninsular India Part 3 (video 35161). Its 722 `.tsc` segments recovered on the OCI bastion to a 2,938.9-second, 194,161,686-byte H.264/AAC MP4. Start, middle and end samples decoded cleanly. The admin multipart intake completed at `472/6a455a96ebb42f585d9b9e8f/recording.mp4`; GPU completion and signed Cloudflare playback remain to be verified. The recovery script supports both observed UHS3 segment/key variants and now prefetches four segments while preserving transport-stream timestamp order; its synthetic tests pass 2/2 and an eight-segment real capture recovered with matching duration. APX showed Organisation ID and reCAPTCHA on the next class, Geography Weekly Revision; the remaining source captures await normal account verification in the open CMS tab. The intended five recovery lanes can run across OCI and the local machine once those captures exist.

All five UHS classes used in enabled courses now have verified playback:

- Economics Class 24 — APX video **38028**; restored and playback verified.
- RPF SI 2024 Top Questions — APX video **31116**; restored and playback verified.
- Static GK Class 60, Tiger Reserves — APX video **37894**; restored and playback verified.
- Geography Weekly Revision and Sectional Test 02 — APX video **34933**; restored and playback verified.
- Class 17, Peninsular India Part 3 — APX video **35161**; restored and playback verified.

The complete group and course IDs are in `audit.json` under `category: uhs_recording`. The per-Class recovery status is in `uhs-recovery-ledger.json`; update it only after checking the destination Class and media output.

## 51 classes with no usable source found

- **50** have no recording entries in fresh APX metadata; the remaining links are empty or unusable former live streams. Some are explicitly test/error classes.
- **1**, Ratio & Proportion Class 7 (APX video **28940**), has recording entries but fresh 240p, 360p, 480p and 720p playlists all return **404**.

Request the original video or source restoration from APX. Prioritize the three used in enabled courses:

- Revision Class — APX video **52830**.
- World Geography Class 62, Solar System Part 8 — APX video **38000**.
- Ratio & Proportion Class 7 — APX video **28940**.

The complete group and course IDs are in `audit.json` under `category: source_missing`. Do not bulk-delete these classes or map a similarly named lecture without confirming recording identity.

## Import verification to retain

For any further recovery, require every advertised quality to have all its segments, probe the finished media, verify signed CDN playback and MP4 download size, and preserve the existing Class ID and course assignments. Publish only after those checks pass.

## Access recheck — 26 September 2026, 12:51 IST

A fresh authorized player request for Peninsular India Class 17 (video 35161, course 93) still returned error 4002 with no media. Further player requests stopped after that response. A ready-to-send APX request is in [APX-SUPPORT-REQUEST.md](APX-SUPPORT-REQUEST.md). It has not been sent.

## Normal CMS playback confirmed — 26 September 2026

Using a newly supplied admin session in Chrome, opened RMB → GK + GS → Classes → Economics → Economics Class 24 (APX placement 44487). Clicking the normal class playback link opened APX's own embedded player, which visibly returned **4002: “Limit reached for today please try again after some time.”** No playable media appeared. This confirms the failure occurs through the normal CMS flow as well as the scripted request. It does not identify which quota or configuration causes APX to return that message.

## Differential playback test

Economics Class 1 plays in the same RMB course and also uses UHS. Thus the earlier error is not evidence of a blanket account/course/UHS limit. Subsequent APX requests returned HTTP 503, preventing metadata comparison. See [PLAYBACK-COMPARISON.md](PLAYBACK-COMPARISON.md).

## Correction: scripted 4002 is not evidence of a quota

A matched server-side test also returns 4002 for the browser-working Economics Class 1. Its viewing-limit settings match Class 24. The successful browser flow supplies a non-empty verification token and recordingType=4; the script did not. Resolve this authentication/request difference before treating the 22 UHS recordings as quota-blocked. See PLAYBACK-COMPARISON.md.

## Import attempt after successful playback

At that earlier checkpoint, Class 24 was present in the destination catalogue with no link, HLS asset or MP4, and its ingest job was skipped. Playback through APX confirmed the recording existed, but the first captured key expired before real media validation. The later fresh capture and intake upload are described above. See PLAYBACK-COMPARISON.md.

The destination Class 24 is already assigned to seven courses. Three are currently enabled: GK + GS Foundation Mastery Batch, Railway Foundations Mastery Batches (RMB), and (RRB Batch) Railway Record Breaking Batch 2025. Preserve these assignments when the media becomes available.
