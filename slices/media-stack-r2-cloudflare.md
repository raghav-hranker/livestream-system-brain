# Slice — Media stack: R2 + Cloudflare as the default live/recorded stack

Decision record: livestream `docs/adr/0002-media-stack-r2-cloudflare-default.md` (live side) +
quicktricks-backend `docs/adr/0020-single-r2-origin-dual-cdn.md` (LMS side, owns the cutover runbook).
Vocabulary: GLOSSARY → **Media stack**, **Storage dialect**, "Storage & serving combos".

Contract crossed: **Secured-1C input signing** (livestream → video-transcoder worker via the CDN),
**Playback (mint)** for the `live` zone (LMS), **Recordings webhook** payload (unchanged shape, new origin).

## Ordered hops

1. **Cloudflare dashboard (owner)** — handoff: livestream `docs/cloudflare-live-host-dashboard-handoff-2026-09-10.md`. Live host (`livev2.hranker.org`) on the R2 live bucket:
   class WAF rule (`/472/`, prefix 30), **notes WAF rule** (`/notes/`, prefix 57), cache rule
   (playlists ~2 s, segments long, query ignored), own `CF_LIVE_HMAC_SECRET`.
   **Complete — confirmed by the user on 2026-09-10.** This supersedes the earlier
   partial dashboard handoff's HTTP 400 blocker. End-to-end deployment verification
   below remains separate from dashboard setup.
2. **livestream** (`launch/quicktricks-v2`) — execution handoff: `docs/plans/tasks/13-media-stack-cloudflare-signer.md`
   - `backend/lib/cloudflareFolderSigner.js` — CommonJS port of the LMS signer, golden-vector test.
   - `backend/lib/bunnyAssetSigner.js` — drop `DEFAULT_CDN_BASE` + presence gate; `maybeSignInputUrl`
     becomes `signInputUrl(provider)`.
   - `backend/config/validateBootConfig.js` — `LIVE_CDN_PROVIDER` (default `cloudflare`) + the selected
     provider's host/secret required.
   - `backend/lib/notesMediaSigner.js` — select signer by provider (same secret/host as 1C).
   - `backend/lib/fileUpload.js` — `CacheControl: max-age=2` on `.m3u8` PUTs if hop 1 reports the Pro plan
     refused a 2 s edge TTL override (then the cache rule is "respect origin").
   - `backend/lib/ecs.js` — one job branch: `storageProvider` from `STORAGE_PROVIDER`, always send
     endpoint/region/bucket/credentials; delete the `R2_ACCOUNT_ID`/`R2_PUBLIC_DOMAIN` branch and the
     `livestream-selectionway` default.
   - `CONTEXT.md` — Media stack, Live bucket, notes rule (done 2026-09-10).
3. **video-transcoder** — normalise legacy and one-shape 1C jobs at the job-manager edge.
   **Revised 2026-09-10: retain both images and select by storage dialect.** Implementation
   and compatibility requirements: [MAP → Retranscode containers](../repos/video-transcoder/MAP.md);
   vocabulary: [Storage dialect](../repos/video-transcoder/CONTEXT.md#storage-routing).
   Hop 3 committed locally as `54f26cd` on 2026-09-10 after resuming Claude session
   `06fef412-7b48-4104-9010-097e698cf6fd` in Codex. Validation: 187 tests passed,
   2 skipped. No image build, push, or deployment; cutover requirements remain in
   [video-transcoder task 05](../repos/video-transcoder/docs/plans/tasks/05-production-cutover.md).
   **2026-09-10 (MP4 resume audit):** the workers' class-id parser did not strip the Cloudflare `/v/<token>/` prefix — fixed in
   `0ace725` (both 1C workers + tests, 222/222); images `hls-to-mp4-b2-secure:cf-20260910` / `hls-to-mp4-processor:cf-20260910`
   built on the GPU box, activation + pilot pending the operator (classifier-blocked). The deployed pre-normalizer manager already
   maps the one-shape **b2** job, so no manager deploy for this resume; MP4 output stays on B2 + Bunny (LMS downloads signer is
   Bunny-only). Record: [reference/quicktricks-mp4-resume-2026-09-10.md](../reference/quicktricks-mp4-resume-2026-09-10.md).
4. **quicktricks-backend** — live provider flag + Cloudflare signer branch for `bucket:'live'`
   in `playbackController.ts` (ADR 0020 "new code in this repo"); `CF_LIVE_*` env.
   Hop 4 committed locally as `25ea491e` on 2026-09-10, fork branch
   `feat/cloudflare-live-cdn` based on `feat/cloudflare-vod-cdn`; isolated worktree
   `/private/tmp/quicktricks-hop4-live-cdn`. Runtime contract and rollout checks:
   `docs/plans/cloudflare-live-playback-hop4.md` in that commit. Bunny stays the LMS
   default until explicit cutover. Typecheck and 71 focused tests pass; full suite
   has 1,351 passes and 6 failures reproduced on the unchanged baseline. Not pushed
   or deployed; edge and player verification remains open.
5. **Box env, no-class window (owner runbook, ADR 0020 §4)** — livestream: `LIVE_STORAGE_*` → R2,
   `STORAGE_*` + `STORAGE_PROVIDER=r2`, `LIVE_CDN_PROVIDER=cloudflare`, `CF_LIVE_*`; LMS: live provider
   flag; GPU box: `HLS_R2_IMAGE` unset or current build.

## Verify
- Host + viewer mint for a live class plays through the Cloudflare host; 403 without token, 403 with
  another class's token.
- Stream end enqueues a 1C job whose input URL is `/v/<token>/472/<classId>/…`; the worker fetches
  master, child playlist and segments (200) and reports `{bucket:'recorded', key}`.
- Note image/audio URLs are `/v/<token>/notes/<classId>/<userId>/…` and load; another user's token 403s.
- Boot with `LIVE_CDN_PROVIDER=cloudflare` and no `CF_LIVE_HMAC_SECRET` refuses to start.

## Follow-ups (not in this slice)
- LMS-minted 1C input URL behind `X-Transcoder-Secret` (removes the CDN secret from livestream).
- Bunny-over-R2 cell (needs Bunny S3 origin auth verified against R2 `auto`).
- Notes feature moves to the LMS (`docs/plans/prd-lms-owned-personal-notes.md`).
