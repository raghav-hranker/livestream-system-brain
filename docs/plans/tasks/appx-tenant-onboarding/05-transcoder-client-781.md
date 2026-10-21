# 05 — Video transcoder: add Vidyagram (customer 781)

Status: `ready-for-agent`. Repo: `raghav-hranker/video-transcoder`, worktree to create from the deployed line (find
which branch is deployed: local checkout `~/Projects/system-brain/repos/video-transcoder` is on `launch/quicktricks-v2`
at 0a81389; check `origin/master` and the boxes' notes in system-brain `SYSTEM.md` / memory before choosing the base).
Plan: [../../appx-tenant-onboarding.md](../../appx-tenant-onboarding.md).

## Goal

Make the transcoder treat Vidyagram (customer / client id **781**) the way it treats Quicktricks (472) for APX
migration ingest, so Vidyagram's ingest jobs land under `781/<classId>/…` and call back to Vidyagram's backend.

## Where 472 is wired (verified 2026-10-13)

- `apx-ingest-container/upload-key.js:18` `APX_CLIENT_ID = '472'` (caller can override): make it come from the job or
  an env var so one container image serves both tenants; 472 stays the default.
- `gpu-server/job-manager/client-config.js:133` the `'472'` block (queue `critical`, per-client concurrency cap 2):
  add `'781'` with the same shape. Keep 472's cap; give 781 its own cap of 2.
- `src/index.ts:92` priority map `'472': 'critical'` and `:430` callback URL; plus the class-link callback map
  (commit 0a81389 added mrquant.in / customer 641 to `src/index.ts`, `src/intake-routing.js` and `dist/index.js`; follow
  the same pattern for 781).
- Callback base for 781: Vidyagram's backend. Its public HTTPS name `backend.vidyagramar.com` has no vhost/cert yet
  (pending, user). Put the URL in one place, default `https://backend.vidyagramar.com/api`, overridable by env, and
  flag in the report that callbacks fail until HTTPS is live.

## Tests

Whatever test harness the repo has for client-config / intake routing / upload keys: add 781 cases (key prefix,
priority, cap, callback URL) and keep 472's cases unchanged.

## Done when

Tests pass, build passes, `dist/` updated the way the repo's previous client-add commits did, commits local (not pushed,
not deployed). Report every file touched and the exact deploy steps (which boxes / containers need a restart or a new
image), but do not deploy.

## Deploy (revised 2026-10-13: Vidyagram ingest runs the mirror, not remux)

Branch `feat/client-781` tip `23fa3ec` (on top of `fb7d5cd`). Not deployed.

The mirror copies AppX's HLS rungs to B2 and reports straight to the LMS, so 781 ingest takes no GPU slot. Its class
callbacks had to change. The Vidyagram backend gates `PUT /api/classes/:id` with `requireAdmin` and
`POST /api/classes/recordings-prerecorded` with `requireTranscoderSecret` (its schema takes `{bucket,key}` only), so a
781 mirror instance reports through the secured contract (`MIRROR_REPORTING=secured`).

1. **Backend prerequisites (Vidyagram box, pm2 92).** Confirm these are set in `.env.development`. The setup script's
   shared-key regex copies them from quicktricks, but the local worktree env does not have them:
   `TRANSCODER_WEBHOOK_SECRET`, plus `BUNNY_RECORDED_CDN_BASE` and `BUNNY_RECORDED_SECURITY_KEY` for the zone over
   `recordedvideos-hranker-v2` (or the `RECORDED_CDN_PROVIDER` / `CF_*` set if recorded playback is on Cloudflare).
2. **Image.** Build `apx-ingest-container/` from `23fa3ec`. The 472 instance can stay on its current image, because
   unset `MIRROR_REPORTING` means unsecure, which is the old behaviour.
3. **New, separate container for Vidyagram.** Do not reuse the 472 instance. Env:
   - `LMS_BASE=https://backend.vidyagramar.com`
   - `API_URL=https://backend.vidyagramar.com/api`
   - `CLIENT_ID=781`
   - `MIRROR_CLIENTS=781`
   - `MIRROR_REPORTING=secured`
   - `TRANSCODER_SECRET=<the box's TRANSCODER_WEBHOOK_SECRET>`. Today this is the same value as Quicktricks'.
   - `STORAGE_PROVIDER=b2` with `B2_KEY_ID` and `B2_APPLICATION_KEY` (plus `B2_REGION` / `B2_S3_ENDPOINT`), the same
     as the 472 mirror instance. Leave `B2_BUCKET` unset, so the bucket defaults to `recordedvideos-hranker-v2`.
   - `OUTPUT_PUBLIC_BASE=https://recordedvideos-hranker-v2.b-cdn.net`
   - `CONCURRENCY=1` for the trial, then raise it. `MIRROR_CONCURRENCY` is the per-rung segment pool (default 4).
   - Leave unset: `APX_R2_MIRROR_ENABLED` (472 only), and `ACCESS_KEY_ID` / `SECRET_ACCESS_KEY` / `TEMP_BUCKET`
     (remux only).
4. **Trial before the full queue.** Run 1–2 jobs and check:
   - the claim's `sessionLink` has a `/480p/` directory and the `/240p/` and `/360p/` siblings exist. Otherwise the job
     fails loud and retries until it is dead.
   - the class gets `streamStatus: ended`, `hlsAsset {recorded, 781/<classId>/hls/master.m3u8}` and five
     `mp4Recordings`.
   - the class plays through the playback route, with picture. The 2026-10-13 sample marked the HLS strata
     `drm-blocked`. Mirror and remux both copy the bytes unchanged, so this risk is the same on either path.
5. **No longer needed for APX ingest:**
   - the `fb7d5cd` listener route and manager slot for 781,
   - `SECURED_CLIENTS=…,781` and `TRANSCODER_SECRET_781` on the manager.

   A mirror job never writes to tempvideos. Those pieces matter only for a remux fallback (for example, the direct-MP4
   items) or for Vidyagram uploads that enter the hranker intake under `781/`. Deploy them when one of those is
   actually used.
6. **Direct MP4 items (`mp4-pending`, about 300).** Neither path takes them today. The claim always mints a fresh
   link through `get_video_token`, and the mirror only reads HLS rungs. Each sampled MP4 returned a HEAD 404 (3 kaxa,
   1 classx). Check that the MP4 links are alive before building an MP4 ingest.
