# Deploy in order + acceptance run

**Type:** HITL  
**Status:** `ready-for-human` — **deployed 2026-09-17, acceptance pending** (see "Deploy state")  
**ADR:** [0007](../../../adr/0007-shorts-readiness-via-transcode-callback.md) decision 9  
**Blocked by:** 00 (gate, done), 01–04 merged and green

> Rewritten 2026-09-17 against the real box topology found by task 00 (the original step 4 targeted
> `/root/video-transcoder`, which does not serve the shorts queue). Decisions D4–D7 and the two merge
> follow-ups are recorded in `docs/plans/secure-r2-deployment-staging-2026-09-10.md`.

## Topology this plan targets (one host, `root@178.63.88.34`)

| pm2 | role | code | touched by |
|---|---|---|---|
| 29 `video-listener` | the **only** poller of the shorts queue `hranker-backup-queue` (+ 561 + secure lane) | `/root/releases/<release>/dist/index.js`, env from that release's `listener-activation-*/listener.env` | step 4 (new release dir + repoint) |
| 20 `b2-secure-job-manager` | spawns every container | `/root/video-transcoder/gpu-server/job-manager/` (APX-line checkout, dirty, never `git`-operated by us) | step 3 (narrow file copy) |
| 22 `b2-video-listener` | 561 only, APX line, `.env.b2` | untouched | — |

The container image is pinned **per job** by the listener (`VIDEO_PROCESSOR_IMAGE` ⇒ `job.image`, which the
manager honours ahead of `client-config.js`). So a new image is selected in the listener env, never by
retagging `video-processor:latest` and never by a manager code change.

## Order (each step is safe alone: every new input is absent-means-today)

1. **LMS** (`quicktricks-backend`): push `57dbd03e0` to `origin/quicktricks-admin` → on the prod box
   (`hranker@148.113.49.18`) `git pull` → `npm run build` → `pm2 restart quicktricks-backend`.
   Probe: `POST /api/shorts/transcode-complete` with no header ⇒ **401** (proves the route is live and
   guarded; it is 404 until deployed). Confirm `TRANSCODER_WEBHOOK_SECRET` is set there (presence only).
2. **Container image** on the box from the pushed integration tip, tagged `video-processor:cf-<date>`
   (matches the `hls-to-mp4-*:cf-20260910` convention). Do **not** move a shared tag. Smoke: run the image
   with `REPORTING=callback REPORT_CALLBACK_URL=https://127.0.0.1:9/x TRANSCODER_SECRET=x` and a bogus key
   ⇒ it fails fast with a connection error, not a crash on env parsing.
3. **Manager**: narrow file copy into `/root/video-transcoder/gpu-server/job-manager/` of exactly the
   files that differ from the release (`client-config.js`, `hls-job-env.js`, `manager.js`,
   `redis-client.js`, `secured-guard.js`), rollback set kept in the release dir, restart pm2 20 only when
   no `video-processor*`/`hls-to-mp4*` container is running (dedupe-key window). Boot log must show the
   schedule limits and Docker connect. No `git` operation in that checkout — its untracked operator scripts
   and the APX drm-worker/mirror-progress drift are out of scope.
4. **Listener**: stage `/root/releases/shorts-callback-<sha>/` (tar of the pushed commit + `npm install`
   + the three untracked built files `dist/{mongo,intake-routing,intake-message}.js`), then a
   `listener-activation-<ts>/` with `listener.env` = pm2 29's current env plus
   ```
   VIDEO_PROCESSOR_IMAGE=<digest of the cf-<date> image>          # replaces the previous pin
   VIDEO_PROCESSOR_R2_IMAGE=<same>
   CF_HRANKER_REPORT_CALLBACK_URL_472=https://backend.quicktricksbysahilsir.com/api/shorts/transcode-complete
   CF_HRANKER_MP4_RENDITIONS_472=false
   ```
   Validate before activating: `validateQueueProfiles` passes and only the `CF_HRANKER` queue resolves a
   472 profile. Activate = `pm2 delete 29` + `pm2 start <activation>/ecosystem.config.cjs` + `pm2 save`
   (the 2026-09-11 pattern — `startOrRestart` keeps the old script path). Boot log: five queues, no lane
   errors.
5. **Admin** (task 06, `614de12`) to `origin/quicktricks-admin` of `quicktricks-admin` → Vercel production.

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
      staging doc. The new image also carries the download-resume fix — confirm `completion.json` is
      written (resume branch's completion guard).
- [ ] Any other tenant's job observed end-to-end unchanged (pick one from `queue:normal`).
- [ ] Record: image tag + digest, commit hashes per box, timestamps, in the staging doc.

## Rollback

Reverse order: re-activate the previous release's `ecosystem.config.cjs`
(`/root/releases/secure-r2-6af515c/listener-activation-1789064912152/`, pins the download-resume image;
shorts fail again, nothing else changes); manager: untar
`job-manager-rollback-origin-apx-1a660ac.tar.gz` from the release dir over the five files, delete
`hls-job-env.js`, restart pm2 20; the LMS route can stay.

## Deploy state (2026-09-17, times UTC from the box clocks)

| step | state | evidence |
|---|---|---|
| branch | **pushed** `integration/shorts-callback-on-apx` @ `5524809` (= `d95b4e1` + merge of box-only `fix/r2-download-resume`, 432/0, tsc clean) | `origin/integration/shorts-callback-on-apx` |
| 1 LMS | **DEPLOYED ~21:12** — `57dbd03e0` pushed (ff from `2916cc0d3`); box pulled to `2a052f451` (someone had merged the Q-Hub silent-broadcast backend `96bbd3d9a`+`50ebda333` in between, so that went live too), `npm run build` ok, pm2 27 `quicktricks-backend` restarted; `POST /api/shorts/transcode-complete` no header ⇒ **401** local + public. `TRANSCODER_WEBHOOK_SECRET` present in `.env.development`; `SHORTS_TRANSCODE_DEADLINE_HOURS` unset ⇒ 24 h. dist backup `deploy-backup/dist-before-shorts-callback-*.tar.gz` | box `/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend` |
| 2 image | **built ~20:58** `video-processor:cf-20260917` = `sha256:51147f403eb0816e088b05e1efd1d2b050e27b34829d21749b5814e8b5ee53e5`; smoke ⇒ `ECONNREFUSED 127.0.0.1:9`, exit 1, no env crash | `/root/releases/shorts-callback-5524809/worker-build.log` |
| 3 manager | **DEPLOYED ~21:02** — five files copied, pm2 20 restarted with no transcode container running; boot clean (limits 168→6, 472→8, Docker connected). Caveat: the pre-copy tar backup failed, so the rollback set is the `origin/feat/apx-passthrough-472` versions (`job-manager-rollback-origin-apx-1a660ac.tar.gz` in the release dir) — the only difference was the box's older dedupe (D1: superseded, accepted loss) | manager log |
| 4 listener | **ACTIVATED ~21:13** — pm2 **30** `video-listener` (id changed from 29, as 6→29 did on 09-11) running `/root/releases/shorts-callback-5524809/dist/index.js`, env `listener-activation-1789592564818/listener.env` (validated: 5 queues, only `CF_HRANKER` resolves the 472 profile). Logs are `video-listener-{out,error}-30.log`; 41 polls in the first 2 min, no lane errors. `pm2 save` done | `release-manifest.json` there |
| 5 admin | **pushed** `f19fec1` (= `614de12` rebased onto the moved tip `33f452f`; dialog conflict resolved keeping `86ca8ad`'s layout fix + the LMS-polling logic; shorts tests 11/11; the 3 tsc errors on the tip are pre-existing in files this commit does not touch). Vercel production `quicktricks-admin-dus5omo8w` **Ready ~21:26**, aliased to `admin.quicktricksbysahilsir.com` | `vercel ls --prod` |
| acceptance | **NOT RUN** — browser extension not connected, and the fallback (server-side CopyObject of the existing sources to new keys in `tempvideos-hranker` / `tempvideos-recorded-v2`, the 09-11 precedent) was refused by the auto-mode classifier as a shared-resource write. Script staged on the box: `/root/releases/shorts-callback-5524809/fire-acceptance.cjs` (copies `472/6aaa7238ce6606809fe2183d/…mp4` → `…/acceptance-20260917a.mp4` and Test 5's `472/6aa2f13d2d060186f8a415e6/automatic-intake-verification.mp4` → `…/acceptance-20260917a.mp4`). Note all 472 upload shorts are already `ready` (old admin PATCH arm), so the shorts callback on that short is the idempotent 200 path; a **fresh** short from the admin is the only way to see `processing → ready` end to end | — |

## Do not

- Fold in the Defect 3 fix (`SECURED_API_URL_472` / 472's `callbackApi` pointing at the standby).
  Raise it separately with its own approval.
- Run `git checkout`/`reset`/`stash` in `/root/video-transcoder` (untracked operator scripts, APX drift).
