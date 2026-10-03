# SYSTEM — whole-system wiring

The piece each per-repo `MAP.md` cannot draw: the full arc across the three services and the contracts
between them. This file is **wiring + ownership only**; for the language of each side see `GLOSSARY.md`
(shared terms) and each repo's own `CONTEXT.md` (authoritative definitions).

## Services

| Service | Role | Key surfaces | Owns |
|---|---|---|---|
| **livestream** | The *live* transcoder. OBS/webcam → Node backend, GPU NVENC (`backend/classes/FfmpegPool.js`, `PubSubManager.js`) → live HLS → Live bucket (B2 + Bunny). The in-repo Next.js `ui/` is **outdated and unused** — the production viewer is the separate **ls** repo below. | `backend/` (live transcode + upload) | Producing live HLS; setting `hlsAsset` on stream **ended** |
| **video-transcoder** | The *recorded/VOD* transcoder. Intake listener → Redis → GPU job-manager → containers. Ops **1A** HLS conversion, **1B** MP4 renditions, **1C** HLS→MP4 retranscode. | `src/` (intake), `gpu-server/` (job-manager + workers), `container/` | Producing VOD HLS + MP4 renditions; reporting them |
| **nodejs-server** | *Video Content Protection* + *Document Content Protection*. Authorizes a viewer and mints short-lived signed CDN URLs. Holds `Class.hlsAsset` and `Pdf.pdfAsset`, validates Auth/Streamer tokens + entitlement. | `/playback`, `/stream-status`, recordings routes, PDF `/access` routes | `Class.hlsAsset` + `Pdf.pdfAsset` (single sources); minting **Playback URL tokens** + signed PDF access URLs |
| **admin-dashboard** | The admin control plane (Next.js). Admins author LMS content — Classes, Courses, PDFs — against nodejs-server's admin API (admin JWT). Browser side of the PDF upload contracts; consumer of the signed PDF `/access` mints for Preview/Download. Mints the **Streamer token** (`lib/jwt.ts`, `STREAMER_JWT_SECRET`) and hands off to **ls** for live hosting + viewing — the admin never plays video in-dashboard. **Talks only to nodejs-server** — the v2 line has no admin→livestream contact (the Room-era room-sync calls are removed; the livestream backend learns everything from `Class`, ADR-0003/0004). | `components/admin/`, `hooks/api/`, `app/api/` | Admin UX only — no server-authoritative state; everything persists in nodejs-server |
| **ls** | The production class-screen UI (Next.js) — today primarily the **teacher/streamer surface** (hosting, chat moderation, private mode); viewers enter the same screen via token. Entered via `/{userId}/{roomId}/?token=…`; presents the token (Streamer or Auth) to nodejs-server's `/playback` to mint a Signed playback URL, renders live + VOD HLS. Replaces livestream's dead in-repo `ui/`. The dedicated **student surface** is the client team's white-label site **thedhronas** (branch-per-customer; quicktricks = `quicktricksbysahilsir-new`, see `repos.manifest`): it consumes LMS APIs and connects its own socket — as of 2026-08-24 still legacy/anonymous (no realtime-token mint), which is why `REALTIME_AUTH_REQUIRED` stays off and student DM history is denied at the edge. | `app/[userId]/[roomId]/`, `lib/playback/`, `components/HLSVideoPlayer.tsx` | Viewer UX only — consumes `/playback` mints; no server-authoritative state |

### Quicktricks realtime topology (2026-09-10)

The dedicated GCP encoder and Hranker client socket servers are separate by design.
The production client socket endpoint is `https://socket.quicktricksbysahilsir.com`;
`https://quicktricksocket.multistreaming.site` is the GCP testing endpoint. Both
connect to the same Redis deployment. Runtime ownership and the shared namespace
contract live in [livestream CONTEXT.md](https://github.com/raghav-hranker/livestream/blob/bfc1512/CONTEXT.md#split-encoder-and-client-socket-deployment)
(section “Split encoder and client socket deployment”, source commit `bfc1512`).
The correction is deployed and cross-server delivery verified: see
[the socket mesh rollout record](reference/quicktricks-socket-mesh-rollout-2026-09-10.md).

### Deployment note — the LMS production fork (2026-08)

The **deployed** LMS is not the `nodejs-server` checkout but its fork **`quicktricks-backend`**
(`abhi092515/quicktricks-backend`, local `../quicktricks-backend`, branch `quicktricks-admin`): the client
team chose a separate cloned repo over a branch, and the 2026-08-13 merge folded our whole security /
content-protection line into it alongside their admin features. Everything this file says about
nodejs-server's role and contracts applies verbatim to the fork — `CONTEXT.md` and `docs/adr/` carried
over (caveat: the fork holds **two ADR series with colliding numbers** — match ADRs by title, not number).
Prod: `https://backend.quicktricksbysahilsir.com` → the shared Hranker box `webserver2-2`, pm2 `quicktricks-backend`
(corrected 2026-09-16; `quicktricks.multistreaming.site` on the test-uday box is a separate, non-production deploy).
Prod admin: `admin.quicktricksbysahilsir.com` on Vercel.
`nodejs-server` itself remains the upstream lineage and the phonetics standby deploy. The fork follows the
other team's branch discipline, **never** the slice branch (`repos.manifest` has the registry entry).
The client team's admin dashboard is likewise a separate cloned repo: **`quicktricks-admin`**
(`abhi092515/quicktricks-admin`, branch `quicktricks-admin`) — the deployed admin control plane for the
quicktricks line; our `admin-dashboard` repo is its upstream lineage, same relationship as the backend pair.

## The contracts between them (what the brain watches)

These are the boundaries a vertical slice crosses. **nodejs-server is the reader/owner of all of them;**
the writers are the two transcoders (video contracts) and admin-dashboard (PDF contracts).

| Contract | Wire | Writer(s) | Reader | Notes |
|---|---|---|---|---|
| **stream-status webhook** | `PUT /api/classes/{classId}/stream-status` + `X-Transcoder-Secret`, body `{streamStatus, hlsAsset:{bucket,key}}` | livestream (live `ended`) **and** video-transcoder (1A, secured) | nodejs-server | The **only** secured writer of `Class.hlsAsset`. Both transcoders use the *same* `ended` contract. Delivery is **at-least-once** (`docs/adr/0002`): producer retries latest-transition-per-class from Redis; LMS sweeps stale transient statuses. |
| **Recordings webhook** | secured `POST /api/classes/recordings-prerecorded` `{bucket,key}` + secret; unsecure `POST /recordings-prerecorded` `{url,quality,size}` | video-transcoder (1B, 1C) | nodejs-server | MP4 set only, no HLS. Replaces `mp4Recordings` wholesale. |
| **Class-link callback** | PHP `…/admin/api/update-online-class-link`; nodejs `PUT /classes/{classId}` `{class_link}` | video-transcoder (1A, **unsecure** only) | LMS | Replaced by the stream-status webhook for secured customers. |
| **Playback (mint)** | `GET /api/classes/{classId}/playback` (Auth or Streamer token) → signed CDN URL (`?token=…&expires=…`) | — | **ls** viewer (consumer) | nodejs-server signs from `Class.hlsAsset`. No `hlsAsset` ⇒ `/playback` 404s; `preparing`/`processing` ⇒ 425. |
| **Listing liveness (read)** | `streamStatus` + `hasPlayback` on the student class listings: `GET /api/courses/{courseId}/classes`, `GET /api/topics/{topicId}/classes?courseId=`, `POST /api/courses/{courseId}/todays-classes`, timetable | — | **thedhronas** / ls (consumers) | The only way a listing can say "live now". `streamStatus` is the transcoder-written runtime truth (`preparing/live/reconnecting/processing/ended`); `hasPlayback` = "`/playback` has an `hlsAsset` to sign" — the asset itself is never serialized. Replaces the v1 `class_link`+`isLive` write the old live backend did at first segment (gone on the v2 branch). Poll, not push: only as fresh as the refetch. Landed 2026-09-02 in the fork (`courseClassController.ts`, 4 projections) + upstream (3). |
| **Realtime token (mint)** | `GET /api/classes/{classId}/realtime-token` (Auth or Streamer token) → `{ token, expiresIn: 600 }`, an HS256 socket ticket (`REALTIME_TOKEN_SECRET`) | — | **ls** (exchanges before every socket connect; livestream verifies the ticket at the handshake) | Socket analogue of Playback (mint) — same `authenticateUserOrStreamer` + `authorizeClassAccess` seam, so chat and video entitlement cannot drift. Streamer token ⇒ `role:'host'` (own class only); every Auth token ⇒ `viewer`. TTL gates the handshake only. `REALTIME_AUTH_REQUIRED` on livestream = secured/unsecure axis (off ⇒ phase A dual-accept). See task 19 doc phase B. |
| **Private-mode write** | `PATCH /api/classes/{classId}/private-mode` + `X-Transcoder-Secret`, body `{isPrivate}` | livestream (host toggle via class-UI socket) | nodejs-server | `isPrivate` is LMS-owned but **dual-writable**: LMS admin UI writes it directly, livestream writes via this endpoint. LMS side landed on `launch/quicktricks-v2`; livestream's `classClient.setPrivateMode` repoint also landed there (regression-tested — the old note that it still targeted the dead `/api/internal/...` URL was stale, corrected 2026-08-21). Late-join bootstrap: `joinRoom` emits current `isPrivate` to the joining socket, and `userMsg` enforces it server-side (launch task 11). |
| **Chat-moderation write (host)** | `POST /api/classes/{classId}/chat-moderation` + `X-Transcoder-Secret`, body `{targetUserId, action: 'mute'\|'unmute', requestedBy}` | livestream (host command via class-UI socket) | nodejs-server | Host in-class mute/unmute persists through the LMS chat-moderation module (chat-moderation PRD task 04); response carries the authoritative post-mutation chat policy; durable `ChatModerationChanged` event via outbox → Redis Stream `chatmod:events:<tenant>`. Note: this widens the transcoder secret's blast radius to moderation writes — see `docs/plans/tasks/lms-owned-chat-moderation/contract-chat-policy-wire.md`. |
| **Transcoder secret** | header `X-Transcoder-Secret` ⇄ env `TRANSCODER_WEBHOOK_SECRET` | transcoders send | nodejs-server checks | **Per secured customer**, gates *both* webhooks. Never global. |
| **PDF access (mint)** | `GET /api/admin/pdfs/{pdfId}/access` (admin) · `GET /api/courses/{courseId}/pdfs/{pdfId}/access` · `GET /api/classes/{classId}/pdfs/{pdfId}/access` (entitled viewer) → signed Bunny URL | — | admin-dashboard + student clients (consumers) | nodejs-server signs from `Pdf.pdfAsset` (`documents` zone). PDF analogue of Playback (mint): no `pdfAsset` ⇒ nothing to sign. See `repos/nodejs-server/docs/adr/0002-documents-zone-and-exact-file-tokens.md`. |
| **Shorts upload (public lane)** | admin-signed multipart to the **public** intake `tempvideos-hranker` (lane enum, never a bucket name) → public transcode lane → `recordedvideos-hranker`; then `PATCH /api/shorts/{shortId}/video` + admin JWT, body `{sourceKey}` | admin-dashboard | nodejs-server | **The one video *read* contract OUTSIDE the content-protection seam.** No `/playback`, no token: the LMS derives `Short.videoAsset={bucket:'shorts',key}` from the staging key (the container's output prefix `{clientId}/{roomId}/hls` is deterministic) and serves `link` from `SHORTS_PUBLIC_BASE_URL`. The intake bucket chooses **storage/CDN only**; the reporting contract is a separate axis (the client's secured flag + the **Job profile**, ADR-0007) — the 2026-09-16 conflation made every secured client's short end `failed`. Readiness is **no longer the admin's**: it arrives via the Shorts transcode callback (next row); the `{videoStatus}` PATCH arm is removed. Decisions: `docs/adr/0006` (public objects) + `docs/adr/0007` (readiness, job profile); hops: `slices/public-shorts-video.md`, tasks `docs/plans/tasks/shorts-transcode-callback/`. |
| **Shorts transcode callback** | `POST /api/shorts/transcode-complete` + `X-Transcoder-Secret`, body `{jobId, clientId, roomId, status:'processed'\|'failed', outputs:{hls:{key}}, durationSec, error}` — **key only, no `bucket`** | video-transcoder (container, `REPORTING=callback` from the per-(queue, client) **Job profile**) | nodejs-server | The generic job-complete report; the LMS is the **single writer** of `Short.videoStatus`. Unknown `roomId` ⇒ 404 ⇒ job fails visibly; repeat ⇒ idempotent 200; `processed` overrules a sweeper `failed`. A rejected callback is **fatal to the job**, like stream-status. 24 h `SHORTS_TRANSCODE_DEADLINE_HOURS` sweeper only gives up, never promotes (ADR-0002 pattern). The profile also sets `mp4:false` so shorts skip MP4 renditions. Widens the transcoder secret to a shorts write (accepted). Decision: `docs/adr/0007-shorts-readiness-via-transcode-callback.md`. |
| **PDF write (single)** | `POST /api/pdfs` / `PUT /api/pdfs/{id}`, multipart, file field `uploadPdf` + admin JWT | admin-dashboard | nodejs-server | Being retargeted: bytes go to private B2 (`documents`), record gets `pdfAsset`, **no new public `uploadPdf` URL**. Metadata-only update keeps the current asset. PRD: `docs/plans/prd-secure-pdf-upload.md`; hops: `slices/secure-pdf-upload.md`. |
| **PDF upload session** | `POST /api/admin/pdf-upload-sessions` (+ per-file `upload-target` / `complete`; retry = fresh `upload-target`) + admin JWT; bytes go browser → B2 via short-lived **single-object** presigned `PUT` (15-min TTL) | admin-dashboard | nodejs-server | Bulk path — Node is control plane only, never relays bytes. Completion is server-verified (`HeadObject` + mandatory `%PDF-` range-read) and idempotent. Decision: `docs/adr/0005-bulk-pdf-uploads-use-presigned-put.md`; contract: `docs/plans/prd-secure-pdf-upload.md` + `slices/secure-pdf-upload.md`. |

## End-to-end arcs

```
LIVE
  OBS → livestream backend (GPU HLS) → Live bucket (B2+Bunny)
       └ on ENDED → stream-status webhook → nodejs-server sets Class.hlsAsset
  viewer → ls → GET /playback → nodejs-server signs hlsAsset → CDN → playback
  socket → ls → GET /realtime-token (Auth/Streamer in, 10-min ticket out)
           → socket.io handshake presents ticket → livestream verifies locally → room

RECORDED (source MP4 upload)
  upload → video-transcoder intake (src/) → Redis → job-manager → container/
     1A HLS  → secured: stream-status webhook (sets hlsAsset)   | unsecure: Class-link callback
     1B MP4  → Recordings webhook
  viewer path identical to live: GET /playback → sign hlsAsset → CDN

RETRANSCODE (existing HLS → MP4, op 1C)
  job pushed directly to Redis → hls-to-mp4 worker → Recordings webhook (MP4 only;
  hlsAsset already set by the live transcoder at ENDED, so 1C does NOT call stream-status)

  livestream is ENQUEUE-ONLY in this arc: it hands the worker its ingredients (signed input, ids)
  and drops out. MP4 reporting is video-transcoder → LMS direct — livestream is never a recordings
  relay. (Its legacy relay — POST /recording, classClient.attachRecording, CALLBACK_API_ENDPOINT —
  is dead code slated for deletion; the endpoint it forwards to never existed.)

SHORTS (admin upload → PUBLIC read) — the one video arc with no mint
  admin ShortVideoUploadDialog (lane:'shorts') → admin-signed multipart
     → tempvideos-hranker            ← the PUBLIC intake; the bucket selects STORAGE/CDN only
     → listener stamps job.config.profile = {reporting:callback, mp4:false}   (per queue+client, from env)
     → manager guard: REPORTING=callback + client's transcoder secret, no SECURED, MP4_RENDITIONS=false
     → GPU 1A only → recordedvideos-hranker/{clientId}/{shortId}/hls/master.m3u8
     → container POST /api/shorts/transcode-complete {roomId, status, outputs.hls.key}  (fatal if rejected)
  admin → PATCH /api/shorts/{id}/video {sourceKey} → LMS derives Short.videoAsset (callback also sets it if first)
  LMS   → videoStatus ready|failed   ← the ONLY writer; 24h sweeper gives up on never-reported shorts
  admin → polls GET /api/shorts/{id} for display only
  reader → GET /api/shorts → link = SHORTS_PUBLIC_BASE_URL/{videoAsset.key}
     → public CDN, NO token, no /playback, no entitlement check

PDF (admin upload → signed read)
  single: admin-dashboard PdfForm → POST /api/pdfs (multipart) → nodejs-server stores bytes in
     private B2 (documents zone) → Pdf.pdfAsset   (no new public uploadPdf URL)
  bulk: session create → per-file presigned B2 PUT (browser → B2 direct) → complete
     (nodejs-server verifies HeadObject + %PDF-) → Pdf.pdfAsset
  reader → GET …/pdfs/{pdfId}/access → nodejs-server signs pdfAsset → Bunny CDN
     (unsigned fetch of the documents zone ⇒ 403)
```

## Serving combos & trust boundary

The arcs above assume a **signed** combo: every fetch needs a **Playback URL token** that `/playback` mints.
Which combos exist, which is primary and which carry auth is defined once, in `GLOSSARY.md` →
"Storage & serving combos" (the **Media stack**: origin × CDN, plus the legacy unauthenticated Public-R2
combo). **Shorts are the deliberate exception:** public objects, no token, no `/playback` (ADR-0006).

A slice that touches playback auth **must** state which combo it targets — the `/playback`, Playback URL
token, and CDN-403 reasoning apply only to the signed combos.

## Where the per-repo maps pick up

- livestream (branch `launch/quicktricks-v2`; local checkouts sit on other branches): `Transcoding.md`
  (ffmpeg/NVENC), `CONTEXT.md`, `docs/adr/`
- video-transcoder: `repos/video-transcoder/MAP.md` (surfaces + 1A/1B/1C flows), `…/CONTEXT.md`
- nodejs-server: `repos/nodejs-server/CONTEXT.md` (token taxonomy), `…/docs/adr/`,
  `…/docs/plans/prd-secure-pdf-delivery.md` (PDF signing/serializers/migration)
- admin-dashboard: `../admin-dashboard/CONTEXT.md`; PDF surfaces live in
  `components/admin/{PdfForm,PdfsDashboard,BulkUploadPdfsSheet}.tsx`, `hooks/api/use-pdfs.ts`, `types/pdf.ts`
