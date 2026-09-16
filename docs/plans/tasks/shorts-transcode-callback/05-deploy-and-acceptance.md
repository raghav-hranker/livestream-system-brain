# Deploy in order + acceptance run

**Type:** HITL  
**Status:** `ready-for-human`  
**ADR:** [0007](../../../adr/0007-shorts-readiness-via-transcode-callback.md) decision 9  
**Blocked by:** 00 (gate), 01–04 merged and green

## Order (each step is safe alone: every new input is absent-means-today)

1. **LMS** (`quicktricks-backend`, `quicktricks-admin`): push → pull on the prod box → build → pm2
   restart. Probe: `POST /api/shorts/transcode-complete` with no header ⇒ 401 (proves the route is
   live and guarded). Confirm `TRANSCODER_WEBHOOK_SECRET` is set there (presence only).
2. **Container image** on the GPU box, from `launch/quicktricks-v2` at the merged tip, tagged like the
   `cf-20260910` set (e.g. `cf-<date>`). Do **not** move a shared tag. Smoke: run the image with
   `REPORTING=callback REPORT_CALLBACK_URL=https://127.0.0.1:9/x TRANSCODER_SECRET=x` and a bogus key
   ⇒ it fails fast with a connection error, not a crash on env parsing.
3. **Manager**: deploy `gpu-server/job-manager`, point `b2-secure-job-manager` (pm2 id 20) at the new
   image tag, restart. Watch one existing-lane job of any tenant complete unchanged.
4. **Listener**: push the branch (this publishes the 5 stacked commits), pull on
   `root@178.63.88.34:/root/video-transcoder`, add to `.env`:
   ```
   CF_HRANKER_REPORT_CALLBACK_URL_472=https://backend.quicktricksbysahilsir.com/api/shorts/transcode-complete
   CF_HRANKER_MP4_RENDITIONS_472=false
   ```
   restart. Boot log must show the profile validation passed (task 02) and no lane errors.
5. **Admin** (task 06) to Vercel production.

## Acceptance

- [ ] Re-upload the test short (`6aaa7238ce6606809fe2183d`, or a fresh one) from the admin.
      Container log: `REPORTING=callback`, no stream-status, no recordings POST, no MP4 renditions,
      one `POST …/transcode-complete` ⇒ 200. `status.json: processed`. Redis job `COMPLETED`,
      `videos` doc `completed`, client 472 `failed` counter **unchanged**.
- [ ] `GET https://backend.quicktricksbysahilsir.com/api/shorts/<id>` (unauthenticated) shows
      `videoStatus:'ready'`, `videoDurationSec` set, `link` = `https://recordedvideos.hranker.org/472/<id>/hls/master.m3u8`,
      which plays in a fresh incognito window.
- [ ] Close the dialog mid-transcode on a second upload; the short still becomes `ready` (Defect 2).
- [ ] **Regression**: upload one 472 class video through the admin's default `class` lane
      (`tempvideos-recorded-v2`). Container log shows the secured stream-status PUT ⇒ 200,
      `Class.hlsAsset` set, `/playback` mints, MP4 renditions produced and reported. This also
      qualifies the stacked secure-lane listener dispatch that 2026-09-10 left open; record it in the
      staging doc.
- [ ] Any other tenant's job observed end-to-end unchanged (pick one from `queue:normal`).
- [ ] Record: image tag, commit hashes per box, timestamps, in the slice's deploy-state section.

## Rollback

Reverse order: remove the two env vars + restart listener (jobs revert to today's behaviour, i.e.
shorts fail again but nothing else changes); repoint manager at the previous tag; the LMS route can
stay.

## Do not

- Fold in the Defect 3 fix (`SECURED_API_URL_472` / 472's `callbackApi` pointing at the standby).
  Raise it separately with its own approval.
- Deploy before task 00's table has an owner decision for every non-branch difference.
