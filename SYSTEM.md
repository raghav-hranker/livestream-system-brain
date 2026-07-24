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
| **ls** | The production class-screen UI (Next.js) — today primarily the **teacher/streamer surface** (hosting, chat moderation, private mode); viewers enter the same screen via token. Entered via `/{userId}/{roomId}/?token=…`; presents the token (Streamer or Auth) to nodejs-server's `/playback` to mint a Signed playback URL, renders live + VOD HLS. Replaces livestream's dead in-repo `ui/`. A dedicated **student surface is not yet built** — it will consume LMS APIs (`Class.streamStatus`, `/playback`), never `/room`. | `app/[userId]/[roomId]/`, `lib/playback/`, `components/HLSVideoPlayer.tsx` | Viewer UX only — consumes `/playback` mints; no server-authoritative state |

## The contracts between them (what the brain watches)

These are the boundaries a vertical slice crosses. **nodejs-server is the reader/owner of all of them;**
the writers are the two transcoders (video contracts) and admin-dashboard (PDF contracts).

| Contract | Wire | Writer(s) | Reader | Notes |
|---|---|---|---|---|
| **stream-status webhook** | `PUT /api/classes/{classId}/stream-status` + `X-Transcoder-Secret`, body `{streamStatus, hlsAsset:{bucket,key}}` | livestream (live `ended`) **and** video-transcoder (1A, secured) | nodejs-server | The **only** secured writer of `Class.hlsAsset`. Both transcoders use the *same* `ended` contract. Delivery is **at-least-once** (`docs/adr/0002`): producer retries latest-transition-per-class from Redis; LMS sweeps stale transient statuses. |
| **Recordings webhook** | secured `POST /api/classes/recordings-prerecorded` `{bucket,key}` + secret; unsecure `POST /recordings-prerecorded` `{url,quality,size}` | video-transcoder (1B, 1C) | nodejs-server | MP4 set only, no HLS. Replaces `mp4Recordings` wholesale. |
| **Class-link callback** | PHP `…/admin/api/update-online-class-link`; nodejs `PUT /classes/{classId}` `{class_link}` | video-transcoder (1A, **unsecure** only) | LMS | Replaced by the stream-status webhook for secured customers. |
| **Playback (mint)** | `GET /api/classes/{classId}/playback` (Auth or Streamer token) → signed CDN URL (`?token=…&expires=…`) | — | **ls** viewer (consumer) | nodejs-server signs from `Class.hlsAsset`. No `hlsAsset` ⇒ `/playback` 404s; `preparing`/`processing` ⇒ 425. |
| **Private-mode write** | `PATCH /api/classes/{classId}/private-mode` + `X-Transcoder-Secret`, body `{isPrivate}` | livestream (host toggle via class-UI socket) | nodejs-server | `isPrivate` is LMS-owned but **dual-writable**: LMS admin UI writes it directly, livestream writes via this endpoint. LMS side landed on `launch/quicktricks-v2`; livestream's `classClient.setPrivateMode` still targets the dead `/api/internal/...` URL — repoint is launch task 05. Late-join bootstrap: `joinRoom` emits current `isPrivate` to the joining socket, and `userMsg` enforces it server-side (launch task 11). |
| **Transcoder secret** | header `X-Transcoder-Secret` ⇄ env `TRANSCODER_WEBHOOK_SECRET` | transcoders send | nodejs-server checks | **Per secured customer**, gates *both* webhooks. Never global. |
| **PDF access (mint)** | `GET /api/admin/pdfs/{pdfId}/access` (admin) · `GET /api/courses/{courseId}/pdfs/{pdfId}/access` · `GET /api/classes/{classId}/pdfs/{pdfId}/access` (entitled viewer) → signed Bunny URL | — | admin-dashboard + student clients (consumers) | nodejs-server signs from `Pdf.pdfAsset` (`documents` zone). PDF analogue of Playback (mint): no `pdfAsset` ⇒ nothing to sign. See `repos/nodejs-server/docs/adr/0002-documents-zone-and-exact-file-tokens.md`. |
| **PDF write (single)** | `POST /api/pdfs` / `PUT /api/pdfs/{id}`, multipart, file field `uploadPdf` + admin JWT | admin-dashboard | nodejs-server | Being retargeted: bytes go to private B2 (`documents`), record gets `pdfAsset`, **no new public `uploadPdf` URL**. Metadata-only update keeps the current asset. PRD: `docs/plans/prd-secure-pdf-upload.md`; hops: `slices/secure-pdf-upload.md`. |
| **PDF upload session** *(planned)* | `POST /api/admin/pdf-upload-sessions` (+ per-file `upload-target` / `complete`; retry = fresh `upload-target`) + admin JWT; bytes go browser → B2 via short-lived **single-object** presigned `PUT` (15-min TTL) | admin-dashboard | nodejs-server | Bulk path — Node is control plane only, never relays bytes. Completion is server-verified (`HeadObject` + mandatory `%PDF-` range-read) and idempotent. Decision: `docs/adr/0005-bulk-pdf-uploads-use-presigned-put.md`; contract: `docs/plans/prd-secure-pdf-upload.md` + `slices/secure-pdf-upload.md`. |

## End-to-end arcs

```
LIVE
  OBS → livestream backend (GPU HLS) → Live bucket (B2+Bunny)
       └ on ENDED → stream-status webhook → nodejs-server sets Class.hlsAsset
  viewer → ls → GET /playback → nodejs-server signs hlsAsset → CDN → playback

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

PDF (admin upload → signed read)
  single: admin-dashboard PdfForm → POST /api/pdfs (multipart) → nodejs-server stores bytes in
     private B2 (documents zone) → Pdf.pdfAsset   (no new public uploadPdf URL)
  bulk (planned): session create → per-file presigned B2 PUT (browser → B2 direct) → complete
     (nodejs-server verifies HeadObject + %PDF-) → Pdf.pdfAsset
  reader → GET …/pdfs/{pdfId}/access → nodejs-server signs pdfAsset → Bunny CDN
     (unsigned fetch of the documents zone ⇒ 403)
```

## Serving combos & trust boundary

The arcs above assume the **signed** combo. There are two, and they differ in whether playback is protected
at the CDN — see `GLOSSARY.md` → "Storage & serving combos" for the full table.

- **B2 + Bunny (signed):** every fetch needs a **Playback URL token**; `nodejs-server`/`/playback` is in the
  path. `storageProvider:'b2'` (live transcoder routing) / `hls-to-mp4-container-b2` (recorded retranscode).
- **R2 (unauthenticated):** files served from `R2_PUBLIC_DOMAIN`, no token, no `/playback` — content
  protection is bypassed at the CDN. `storageProvider:'r2'` / `hls-to-mp4-container`. Lives on a separate
  branch; which combo is live is env-driven (`STORAGE_*` present ⇒ signed B2, else R2 fallback).

A slice that touches playback auth **must** state which combo it targets — the `/playback`, Playback URL
token, and CDN-403 reasoning only apply to B2 + Bunny.

## Where the per-repo maps pick up

- livestream: `repos/livestream/Transcoding.md` (ffmpeg/NVENC), `repos/livestream/docs/plans/` (phases)
- video-transcoder: `repos/video-transcoder/MAP.md` (surfaces + 1A/1B/1C flows), `…/CONTEXT.md`
- nodejs-server: `repos/nodejs-server/CONTEXT.md` (token taxonomy), `…/docs/adr/`,
  `…/docs/plans/prd-secure-pdf-delivery.md` (PDF signing/serializers/migration)
- admin-dashboard: `../admin-dashboard/CONTEXT.md`; PDF surfaces live in
  `components/admin/{PdfForm,PdfsDashboard,BulkUploadPdfsSheet}.tsx`, `hooks/api/use-pdfs.ts`, `types/pdf.ts`
