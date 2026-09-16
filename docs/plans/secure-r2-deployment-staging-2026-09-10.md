# Secure R2 deployment staging — 2026-09-10

Status: worker and application artifacts staged; secure intake infrastructure configured.
Manager/listeners were not activated. No production job, class, queue message, or
existing image tag was changed. No multipart or playback canary has run.

This follows the [investigation](secure-r2-deployment-investigation-2026-09-10.md).
Service behavior and configuration remain in the
[transcoder runbook](../../repos/video-transcoder/docs/plans/secure-r2-admin-video-cutover.md).

## Staged release

Host `178.63.88.34`, directory `/root/releases/secure-r2-6af515c` (0700).
Candidate archive SHA-256:
`cbab6931b06fb316ca0a935b9db71471f8a50eb950935cc0f7ac5cd9798e2648`.
All 34 payload files verified against the manifest before building.

Image `video-processor:secure-r2-6af515c`, immutable local image ID:
`sha256:eb43e9737662611537f74e6ecc071b00a83b39a94a937ad01ae8a6296869d5d1`.
Built from the staged container directory with revision label `6af515c85b92cc5797471b0ef1a30baf276cf695`.
No shared tag moved. Image smoke checks loaded all four runtime dependencies and
confirmed FFmpeg advertises NVENC encoders. This does not establish an actual GPU
encode or callback. Root and manager dependencies installed inside the staging
directory with `--omit=dev --ignore-scripts`; logs and generated lockfiles retained.

Server HEAD remains `d8bc18ab510e73989b9e6e28a5ccf9022e9e29e4`.
Hashes of deployed listener, manager, redis-client and client-config match the
previous reconciliation audit. Existing operational checkout was preserved.

## Cloudflare changes and readback

Account `1ff6f2000c9aa34ca2ec88c066af092a`.

- Created private `tempvideos-recorded-v2`, APAC, at 14:03:21 UTC.
  R2 managed public domain disabled; no custom domain. S3 listing returned zero
  objects and `IsTruncated=false` after configuration.
- Created `recordedvideos-hranker-v2-queue`, ID
  `b363bae7899f49b39f2c4f2e46cd93a3`.
- Renamed the previously unused duplicated-name DLQ in place to
  `recordedvideos-hranker-v2-dlq`; retained ID
  `ec58ab81516f4718b9ce3416872f35a1`. No queue deleted.
- HTTP-pull consumer `c8993008cf264ffeaafd42506666fce5`: batch 10, max retries 5,
  retry delay 3 seconds, visibility timeout 30 seconds, DLQ as above.
  Both queues retain messages for 345600 seconds.
- Notification rule `954da954-5be3-44aa-9674-84d8c5e0ba86`:
  `PutObject`, `CopyObject`, `CompleteMultipartUpload`; empty prefix/suffix.
  Queue readback has exactly one producer, the secure intake bucket.
- CORS: browser PUT from `https://admin.quicktricksbysahilsir.com` and
  `https://quicktricks.hrankerdesk.online`, all request headers, exposed ETag,
  max age 3600 seconds. PUT and GET readback succeeded.
- Existing mirror S3 credentials can list the new intake and secure output bucket.
  This is not verification of least-privilege upload credentials, GET/PUT output
  permission, or a live multipart upload.
- Public queues/notifications were not modified. Output bucket notification read
  returned no configuration before setup; no notification was added there.

The queue is new, so it has no pre-creation migration-event history. No queue pull
or acknowledgement was performed. No listener currently polls this secure queue.

API contracts checked against Cloudflare's official
[notification API](https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/event_notifications/methods/update/)
and [consumer API](https://developers.cloudflare.com/api/resources/queues/subresources/consumers/methods/create/).

Evidence: `/private/tmp/secure-r2-deployment-audit/provision-infra.jsonl`,
`cors-access.jsonl`, scripts in the same directory. No credential values included.

## Runtime and deployment discovery

Refreshed transcoder sample: 53 normal-priority jobs, four processing counters,
four local transcodes (one source, three 1C), six tracked processing IDs.
Two records belong to `drain-c19877f285ca-w1`; one was newly started, establishing
that external ownership cannot be dismissed as stale. User input requested for
worker location/owner. Shared manager restart remains gated on coordinated drain.

Production LMS reachable at `hranker@148.113.49.18`, checkout
`/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend`, HEAD
`bceb58c76f8b837b7ec0d4706197a28559621aa3`; PM2 `quicktricks-backend`, PID 433196,
entry `dist/src/app.js`. `.env.development` selects recorded Cloudflare with
`https://recordedvideosv2.hranker.org` and live Cloudflare; transcoder webhook
secret present. These are current file values, not proof of loaded process state
or successful canary playback. The older test-uday deployment description is not
an adequate production target for this rollout.

Vercel production admin: `dpl_2Xri1cM6qXkw11MMRqFogYGYfTno`, READY, created
13:09:33 UTC. Both production admin domains alias it. Inspect did not provide
Git revision metadata. Production env listing shows `R2_VIDEO_UPLOAD_BUCKET`;
the three other required R2 video variables were not listed. Verify shared/project
configuration before activation. No admin deployment or env mutation by this turn.

Admin worktree now clean at `fceddf5` following `b288aa1` (secure intake rebased
onto `db1f99c`), rather than handoff commit `b995ad2`. This pre-existing advancement
was preserved; do not deploy the old handoff revision over newer work.

## Remaining activation gates

1. Locate external drain worker, coordinate all producers, account for jobs/claims
   and drain before changing manager claim format. Do not kill active work.
2. Provision/verify bucket-scoped listener and separate admin credentials; install
   complete secure env and explicit worker pin. Current production env untouched.
3. Resolve existing B2 472 callback and 695 registry compatibility review items.
4. Capture activation-time private code/config/PM2 rollback snapshots and prior
   images; verify runtime source hashes again if another operator changes them.
5. Verify actual admin release and required env; deploy only after downstream ready.
6. Dedicated canary class requested from user. Run multipart → event → exactly one
   job → correct R2 outputs → authenticated callbacks → entitled playback/download
   and denial checks; include existing-lane and retained 1C-image canaries.
7. Reopen uploads only after acceptance. No B2 fallback or historical replay.

Final staged checks: listener and manager runtime dependencies resolve; both entry
files pass `node --check`. Declaration-only `@types/express` was excluded from
runtime entry-point resolution. Generated lockfile SHA-256 values:
- Root: `2c1437e1a51a2b924902dc7206f2d299d75b04e95dcedb81b2a4db3cbd8b9efd`.
- Manager: `c8f2004e49ffc998c250cc12ffc78da3fef15b9a2c39618c3bbdb1de9fb68228`.
Docker image has no registry RepoDigest; use the recorded local immutable image ID.

## Canary authorization and refreshed prerequisites

User designated class `6aa2bb3bf52a896b17a42060`. Production read confirms title
`test 4`, `isLive=false`, empty `mp4Recordings`, and no `hlsAsset` in the projected
record. No class mutation or upload performed.

Vercel production env listing now includes all four required `R2_VIDEO_UPLOAD_*`
variables (added outside this turn). Presence alone does not verify values or that
an existing deployment loaded them. This supersedes the missing-variable listing
above.

Next runtime sample still has 53 queued jobs (52 normal, one critical), four local
processing counters, and another new external-worker job
`job-1789038566639-168-139397`. Worker `drain-c19877f285ca-w1` must be located and
included in activation coordination. Canary class authorization does not resolve
the shared-manager drain gate.

## One-class canary completed — 14:29–14:30 UTC

User requested running only the designated class immediately and supplied
`/Users/raghav/Downloads/testing_0226_720p (1).mp4` (5,389,798 bytes, 33.045 seconds).
Uploaded using two-part S3 multipart completion to
`tempvideos-recorded-v2/472/6aa2bb3bf52a896b17a42060/testing_0226_720p_1.mp4`.

Ran one isolated GPU container from the pinned staged image:
`secure-r2-canary-6aa2bb3bf52a896b17a42060`, container ID
`c187a2183e8f4a87f7f5ec15557c359fa1bd74c15bbce198e8fda2b4bc308a9d`.
Started 14:29:26 UTC; exited 0 at 14:30:00 UTC. Resources bounded to four CPUs,
4 GiB RAM and one GPU. Existing secured-customer guard validated 472 and injected
its secret inside the host. No manager startup, shared Redis claim/counter
mutation, listener activation or shared service restart. No Redis result writer
configured for this standalone run. Retain exited container and logs as evidence.

Outputs reported successfully via authenticated callbacks: class is `ended`,
`hlsAsset` is `recorded:472/6aa2bb3bf52a896b17a42060/hls/master.m3u8`, four secured
MP4 recordings (240p/360p/480p/720p), stored duration 33 seconds.

Queue evidence contains the exact `CompleteMultipartUpload` event
`492a787271e514ad322d0360a73c9a97` plus three sibling status writes. After worker
success, acknowledged only these four exact source/status events to prevent a
later duplicate run. No other events acknowledged. This exercised notification
arrival but deliberately bypassed shared listener → Redis → manager dispatch;
it does not qualify normal admin intake as deployed.

Playback discovery corrects the callback/endpoint assumptions above:
- Old `quicktricks.multistreaming.site` accepts authenticated reports and returns
  the class, but mints Bunny playback (404 for this new R2-only HLS), even with
  `?cdn=cloudflare`. Do not use this host for production cutover validation.
- Production `backend.quicktricksbysahilsir.com` mints Cloudflare by default:
  playback API 200, master 200, child 200, segment range 206.
- All four MP4s return 206 using the deployed Cloudflare signer's own asset-scoped
  tokens. Reusing the HLS-folder token for an MP4 returned 403 as expected; the
  verification probe was corrected. This is CDN asset access verification, not
  a learner-authenticated `/downloads` API acceptance test.
- Unsigned media 403, wrong-scope media 403, unauthenticated playback mint 401.
- The admin worktree's `config.ts` points to the production backend hostname.

Evidence: `verify-canary-final.jsonl`, `probe-mints.cjs`, `canary-events.jsonl`,
`run-canary.cjs` in `/private/tmp/secure-r2-deployment-audit/`. Tokens and secrets
were never printed. Full admin browser upload flow and learner entitlement/download
endpoint remain separate deployment acceptance work. Update the staged secure
callback base to the verified production hostname before general activation;
no production env was changed by this canary.

---

## 2026-09-17 — Task 00 audit of the transcoder box (read-only)

Gate for [shorts-transcode-callback task 05](tasks/shorts-transcode-callback/05-deploy-and-acceptance.md).
Host `root@178.63.88.34` (Ubuntu 24.04), key `~/Documents/keys/mridulm`. Three read-only probe passes;
nothing restarted, no env changed, no branch pushed. Secret **values** were never printed — key names
only, plus the non-secret values task 00 names.

**The listener box and the "GPU box" are one host.** There is no second machine to audit: the manager,
the Docker images and the listeners all live here.

### Headline: the box is not on the slice branch, and is 37 commits *ahead* of it

`/root/video-transcoder` HEAD is `d8bc18ab` on **`feat/apx-passthrough-472`** — not
`launch/quicktricks-v2`. That commit is not in origin; `origin/feat/apx-passthrough-472` (`1a660ac`)
carries the same three subject lines at different SHAs, so the box committed locally and equivalent
commits were pushed separately.

```
origin/launch/quicktricks-v2 .. origin/feat/apx-passthrough-472  = 37 commits
origin/feat/apx-passthrough-472 .. origin/launch/quicktricks-v2  =  0 commits
merge-base = cf7723c (RALPH: time-of-day per-client concurrency)
```

`origin/launch/quicktricks-v2` is **fully contained** in the apx branch. The 37 extra commits are the
whole APX verbatim-mirror line (#17–#40), the DRM mirror worker, ADRs 0007–0009, and the per-client
day/night concurrency schedule. **Deploying `launch/quicktricks-v2` over this checkout would revert
all 37.** The slice branch is behind production here, not ahead of it.

Our own shorts work (13 commits, `9c6b2ef`…`e3c5938`) sits on `launch/quicktricks-v2` and is therefore
*not* on the apx line.

### File classification — box working copy vs refs

`(a)` = matches the branch the box is on · `(b)` = local edit on the box, in no branch ·
`(c)` = drift the other way (exists on the slice branch, not here)

| file | box sha256 (short) | origin/apx | class |
|---|---|---|---|
| `src/index.ts` | `7c40529…` | same | (a) |
| `src/intake-routing.js` | `2adb9cd…` | same | (a) |
| `src/intake-message.js` | **ABSENT** | absent | **(c)** — exists only on `launch/quicktricks-v2` |
| `gpu-server/job-manager/manager.js` | `84f2f84…` | same | (a) |
| `gpu-server/job-manager/secured-guard.js` | `25a1916…` | same | (a) |
| `gpu-server/job-manager/secured-clients.js` | `3e116da…` | same | identical on **every** ref |
| `gpu-server/job-manager/redis-client.js` | `ceb7274…` | `a6a1a26…` | **(b)** |
| `gpu-server/job-manager/client-config.js` | `67fa038…` | same | (a) |
| `dist/index.js` | `a338ed7…` | `442c783…` | **(b)** generated |
| `container/index.js` | `84369a8…` | same | (a) |
| `container/apis.js` | `40b2267…` | same | (a) |
| `container/reporter.js` | `50748cf…` | same | identical on **every** ref |

**Class-(b) — uncommitted work that exists in no branch:**

1. **`redis-client.js` +139/−68 — a whole job-dedupe feature.** A Lua `processing:dedupe` hash keyed
   on *source identity* (Class for `hls-to-mp4`, `client:provider:bucket:key` for uploaded sources)
   rather than job id, rejecting a repeat **before** the capacity check so duplicates at the queue head
   drain instead of consuming a GPU slot. 8 `processing:dedupe` references. Backup file
   `redis-client.js.pre-dedupe-20260820` dates it to 2026-08-20. Companion artefact
   `gpu-server/job-manager/dropped-dupes-134532.json`. **This is the single biggest deploy hazard:
   any checkout, reset or release-copy over `/root/video-transcoder` destroys it.**
2. `apx-ingest-container/mirror-deps.js` +43/−2.
3. `dist/index.js` +1 (generated, follows the above).
4. Untracked: `_cascade.mjs`, `_qdiag.mjs`, `_watch.mjs`, `gpu-server/job-manager/logs/`,
   `scripts/{apx-downloading.sh,check-apx-video.js,retranscode-missing.js,retranscode-videos.js}`.

### Running topology — and the 2026-09-10 "not activated" note is stale

| pm2 | name | status | script | `ENV_FILE` | polls |
|---|---|---|---|---|---|
| 22 | `b2-video-listener` | online 57 d | `/root/video-transcoder/dist/index.js` (**apx line**) | `.env.b2` | `client-561-queue` → Redis `queue:normal` |
| 29 | `video-listener` | online 2 d | **`/root/releases/secure-r2-6af515c/dist/index.js`** | release's `listener-activation-…/listener.env` | `client-561-queue` **+ `hranker-backup-queue`** |
| 20 | `b2-secure-job-manager` | online 36 d | `/root/video-transcoder/gpu-server/job-manager/manager.js` (**apx line**) | — (own `STORAGE_PROVIDER`) | Redis |
| 19 | `vid-transcoder-stats-server` | online 2 mo | `…/job-manager/stats-server.js` | — | — |
| 5 | `job-manager` | **stopped** (54 restarts) | same `manager.js` | — | — |
| 17 | `b2-job-manager` | **stopped** | `/root/video-transcoder-b2/…` | — | — |

Three consequences:

- **The shorts queue (`hranker-backup-queue`) is served by pm2 29 only**, and pm2 29 runs the staged
  secure-R2 release — i.e. **our own unpushed `6af515c`**. Its `src/index.ts` (`9da9806…`),
  `src/intake-routing.js` (`1c11cde…`) and `dist/index.js` (`7687d51…`) match `0ace725` byte for byte,
  and it **has** `src/intake-message.js`. The staging record above says "Manager/listeners were not
  activated"; that was true on 2026-09-10 and stopped being true on 2026-09-11 (see
  `reference/secure-r2-listener-activation-2026-09-11.md`). Part of the unpushed branch is already
  production.
- **Both listeners poll `client-561-queue`.** CF pull consumers lease messages, so this splits rather
  than duplicates — but which of two *different codebases* handles a given 561 message is
  nondeterministic.
- **The manager is on the apx line, the listener is not.** Task 03's manager change cannot ride the
  release-dir pattern that task 02's listener change can.

### Image the manager spawns

`video-processor:latest` — image id `156cbf90c834`, **built 2026-06-29**. Named at
`client-config.js` lines 12/32/52/72/92/129/152 and `manager.js:259`. `preflight-secured.js` names
`video-processor-b2`/`video-processor-b2:latest`. The staged `video-processor:secure-r2-6af515c`
(`eb43e973…`, 2026-09-10) exists but nothing on the standard path spawns it. Also present:
`video-processor:r2-download-resume-v1` (2026-09-14), `hls-to-mp4-{processor,b2-secure}:cf-20260910`.

### Defect 3 — recorded, untouched

Better than the predecessor handoff claimed, on the lane that matters:

- pm2 29's `listener.env`: `SECURED_API_URL_472="https://backend.quicktricksbysahilsir.com"` — **prod**.
- `/root/video-transcoder/.env.b2` (pm2 22): `SECURED_API_URL_472=http://34.126.210.209:5100`, a raw
  GCP IP — but that process has `SECURED_CLIENTS=695`, so 472 is not secured there.
- Tracked source still points the **unsecure** path at the standby:
  `src/intake-routing.js:60` → `'472': 'https://quicktricks.multistreaming.site/api'`. **Not changed.**
- `SECURED_CLIENTS`: `gpu-server/job-manager/.env` = `408,472`; `.env.b2` = `695`; the release listener
  uses `SECURED_R2_CLIENTS` instead.
- Confirmed non-secret values in the release `listener.env`: `STORAGE_PROVIDER="r2"`,
  `CF_HRANKER_CDN_DOMAIN="https://recordedvideos.hranker.org"` (matches the 2026-09-16 correction),
  `CF_HRANKER_UPLOAD_BUCKET="recordedvideos-hranker"`, `CF_SECURE_INTAKE_BUCKET="tempvideos-recorded-v2"`,
  `CF_SECURE_OUTPUT_BUCKET="recordedvideos-hranker-v2"`,
  `CF_SECURE_CDN_DOMAIN="https://recordedvideosv2.hranker.org"`.
- **`/root/video-transcoder/.env` has no `CF_SECURE_*` keys at all** — the secure lane is configured
  only in the release's `listener.env`.

### Owner decisions required before task 05

| # | Decision | Why it blocks |
|---|---|---|
| **D1** | The Lua dedupe in `redis-client.js` (+139/−68, unversioned since 2026-08-20): commit it to `feat/apx-passthrough-472` first, or accept losing it? | Task 03 deploys into that same checkout. Any git operation there destroys it. |
| **D2** | Same question for `apx-ingest-container/mirror-deps.js` (+43/−2). | Same checkout. |
| **D3** | Branch strategy: rebase the 4 shorts-callback commits onto `feat/apx-passthrough-472`, or merge apx into `launch/quicktricks-v2` and deploy that? | `launch/quicktricks-v2` is 37 commits behind production. Deploying it as-is is a 37-commit revert. |
| **D4** | Task 02's listener change deploys as a **new release dir + repoint pm2 29**, not into `/root/video-transcoder` — confirm. | The shorts queue is only served by pm2 29. Deploying into `/root/video-transcoder` would not affect shorts at all. |
| **D5** | Task 04's container image: build a new tag and change the manager's spawn tag, or retag `video-processor:latest` (which moves it for **every** client on that tag)? | `:latest` is 2026-06-29 and shared. |
| **D6** | The `client-561-queue` overlap between two listeners running different code — leave, or scope one out? | Not caused by this work, but task 05 restarts one of them. |
| **D7** | New env (`CF_HRANKER_REPORT_CALLBACK_URL_472`, `CF_HRANKER_MP4_RENDITIONS_472`) goes in the **release's `listener.env`**, not `/root/video-transcoder/.env` — confirm. | Wrong file = absent profile = today's behaviour, silently. |

Nothing above was acted on. The box is in exactly the state it was found in.
