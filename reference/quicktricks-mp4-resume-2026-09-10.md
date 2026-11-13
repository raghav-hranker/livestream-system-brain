# Quicktricks post-live MP4 resume — audit done, operator steps pending

Written 2026-09-10 (~15:30 UTC). Owning-repo record with the full evidence table:
[video-transcoder `docs/plans/1c-cloudflare-input-compat-2026-09-10.md`](../repos/video-transcoder/docs/plans/1c-cloudflare-input-compat-2026-09-10.md)
(commit `0ace725` on `launch/quicktricks-v2`). Producer side and the `POST_LIVE_TRANSCODE_ENABLED`
semantics: livestream `docs/plans/live-only-cloudflare-test-2026-09-10.md`. Hops: `slices/media-stack-r2-cloudflare.md`.

## Findings that changed the plan

- **1C worker bug (fixed in source, images built, not yet activated):** both HLS→MP4 workers only
  stripped the Bunny `bcdn_token=` segment; under the Cloudflare `/v/<token>/` input every rendition
  would have uploaded as `<token>/output_<q>.mp4`. Built `hls-to-mp4-b2-secure:cf-20260910` and
  `hls-to-mp4-processor:cf-20260910` on the GPU box from the fixed source; verified in-image.
- **Encoder reports to the wrong LMS:** `LMS_PUBLIC_BASE_URL` still names the phonetics standby
  (`34.126.210.209:5100`) and wins over `LMS_BASE_URL`; earlier 1C reports landed only because that
  box shares `quicktricksdb`. Must point at `https://backend.quicktricksbysahilsir.com`.
- **No GPU manager deploy needed for this resume:** the deployed (pre-normalizer) manager already maps
  the one-shape **b2** job. R2 output would need the `54f26cd` manager or the dialect-aware r2 image.
- **Output origin stays B2 + Bunny for MP4s:** the LMS downloads signer is Bunny-only and 472's
  recorded assets are on the recorded B2 zone; R2-only MP4s would not be downloadable. Input is
  R2 + Cloudflare. Moving MP4 output to R2 = ADR 0020 recorded cutover (LMS downloads signer or
  Bunny zone re-point, R2 recorded credentials on the encoder, `STORAGE_PROVIDER=r2`).
- Secret parity GPU↔encoder confirmed by hash; production LMS gate answers 401 from the GPU box;
  signed Cloudflare master/variant/segments fetch 200 from the GPU box, unsigned and cross-class 403.

## Operator steps (blocked for the agent by the auto-mode classifier)

Scripts staged: GPU `/root/hls-1c-cf-20260910/{activate,rollback}-b2-image.sh`; encoder
`/home/raghav/mp4-resume-20260910/{fix-lms-url.sh,submit-pilot.js,enable-auto-mp4.sh}`.
Order: activate image → fix LMS URL → submit pilot (`6aa2aa32a78da7100fe9b7ff`) → verify → enable flag
(between classes). `POST_LIVE_TRANSCODE_ENABLED` is still `false` on the box.

## Acceptance evidence

_Pending the operator steps._

## Still separate

- Deferred class `6aa1d58706102a28cb20994f` (interrupted finalizer; `hlsAsset` points at the live
  `playlist.m3u8`, status `processing`). Not a pilot candidate.
- Backfill of skipped-while-disabled recordings: submit deliberately per class with `submit-pilot.js <classId>`
  only after checking the class has a finalized `playlist-mpl-vod.m3u8`.
- Serial segment existence checks before enqueue (6m24s for 400 segments) remain a performance item.
