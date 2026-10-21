# 05 — Sample Vidyagram's AppX videos: seamless vs obfuscated

Status: `ready-for-agent`. Read-only against our DB; small, bounded AppX reads. Repos: the tenant backend worktree
`~/Projects/worktrees/vg-catalog-mirror` (branch `feat/vg-catalog-mirror`, mirror collections in `vidyagramdb`) and
`~/Projects/system-brain/repos/video-transcoder` (`apx-ingest-container/`, read its `verify-drm.js` first).
Plan: [../../appx-tenant-onboarding.md](../../appx-tenant-onboarding.md).

## Question

Before building the class import, which of Vidyagram's ~30,400 visible AppX videos will move with the plain 472
ingest (signed URL + Referer, `ffmpeg -c copy` remux), which need the 472 "secure-player" path (AES-128 ClearKey on
`.tsa` segments via `hls-ck-container.classx.co.in`, plus the extra XOR layer on TS bytes 4–97 and scrambled PTS that
force a re-encode), which are link-only (YouTube), which are direct MP4, and which are dead?

## Mirror breakdown already measured (2026-10-13, visible non-PDF rows of run `full-2026-10-13`)

Video rows 30,443. By link host: `appx-recordings-mcdn.akamai.net.in` m3u8 8,394; `transcoded-videos-v2.classx.co.in`
m3u8 8,220 (+4,269 LIVE_STREAM recordings); `appx-transcoded-videos-mcdn.akamai.net.in` m3u8 6,381 (+128 live);
YouTube 1,454; `migrationvideos.kaxa.in` mp4 1,047; `cloud-front.in` hosts ~110; CloudFront `d3al0zym7ecdqp` m3u8 58
(`drm_enabled=1` on 55); other CloudFront m3u8 ~54; `migration-contents-v2.classx.co.in` mp4 39; empty link (live) 198;
zoom 1. Fields present: `encrypted_links` 27,429, `drm_mp4_url` 27,429, `recordings` 28,476, `webdrm_links` 850,
`hls_clear_key_urls` 334, `drm_enabled=1` 55. `enc_type` is 1 on every row, so it does not discriminate.

## Method

1. **Strata.** Group visible video rows by (link host, `drm_enabled`, presence of `webdrm_links` / `hls_clear_key_urls`,
   created year before/after 2025-02-01, VIDEO vs LIVE_STREAM recording). Sample **3 per stratum** (cap ~80 total),
   preferring rows from different courses. Record the sample list before probing.
2. **Resolve the playable URL the way production would.** Read how the fork mints a class's signed session link
   (`src/services/apx/apxVideoTokenService.ts`, the ingest job's `tokenInputs`) and how `verify-drm.js` is fed. Use the
   live Vidyagram session read from `apxsessions` (re-read per call; never write it; never capture Set-Cookie). If a
   mint counts against an AppX view cap (472 hit a 4002 cap), keep the sample small and report the cap behaviour.
   For direct-host rows (MP4, plain m3u8) also try the raw `link` with the `Referer: <origin>/` rule.
3. **Classify each sample without writing anything:**
   - master/media playlist fetch status; renditions and resolutions;
   - `#EXT-X-KEY` method (NONE / AES-128 / SAMPLE-AES) and key URI host; segment extension (`.ts` / `.tsa` / other);
   - fetch the first and one middle segment; for AES-128 decrypt with the given key/IV; check MPEG-TS sync (0x47 every
     188 bytes) and run `ffprobe` (and a 10 s `ffmpeg -v error -f null` decode) to count audio/video decode errors;
   - detect the XOR layer: TS sync valid but PES payloads undecodable → try the 472 inverse (XOR bytes 4–97 with 0xFF on
     full PES-continuation packets) and say whether it fixes the decode;
   - for YouTube: just confirm the id parses (`yt:`), no fetch; for MP4: HEAD + `ffprobe` on the first MB;
   - verdict: `seamless-remux` / `needs-reencode` (decryptable but obfuscated or PTS-scrambled) / `drm-blocked` /
     `youtube-link` / `mp4-direct` / `dead` (4xx/5xx/empty) / `unknown`.
4. **Extrapolate.** Map verdicts back to strata counts to estimate how many of the 30,443 fall in each verdict, with the
   confidence (sample size per stratum).

## Output

`~/Projects/system-brain/outputs/vidyagram-video-sample-<date>/` with `sample.json` (one record per probed row: course,
rowId, stratum, verdict, evidence: statuses, key method, segment ext, decode errors, XOR result) and
`summary.md` (verdict table per stratum + extrapolated totals + the cheapest ingest path per verdict). Never write
signed URLs, keys, tokens or cookies to the output or logs: hosts and ids only.

## Rules

No DB writes. No uploads, no ingest jobs, no transcodes beyond the in-memory/`/dev/null` decode checks; temp segment
files go in a scratch dir and are deleted. Use IPv4 for AppX from the Mac. Stop if the session goes inactive.

## Done when

The summary exists with every stratum sampled (or the reason it could not be), the extrapolated table, and any
reusable probe code committed locally on a new branch `feat/vg-video-sample` off `feat/vg-catalog-mirror` (not pushed).
