# Config repoint + single-upload E2E

**Type**: HITL
**Blocked by**: #3, #4

## What to build

The last config seam plus the first full-arc proof through the real UI.

**Config repoint (admin-dashboard, this branch):** `LIVESTREAMING_BACKEND_API_URL` moves
off the toppers host (`socket.topperswisdom.com`) to the quicktricks livestream backend.
It gates three things (all verified in code): room-sync on class create/update, the
single-upload dialog's room status update, and the bulk flow's room-batch creation.
The admin's `.env` also gains the #2 module's B2 vars and `STREAMER_JWT_SECRET` +
`NEXT_PUBLIC_LIVESTREAM_UI_BASE_URL` if not already set from the streamer-auth port.

**Then the E2E:** from the running admin dashboard, upload one real MP4 through the
single-video dialog to an existing class and follow it with no manual assists:

upload (progress visible) → object in `tempvideos-recorded-v2` → webhook → secured 1A/1B
→ `hlsAsset` set → SSE flips the dashboard to processed → Go Live handoff opens the `ls`
viewer → `/playback` mints a signed URL → video plays.

## Acceptance criteria

- [x] No admin surface references the toppers livestream backend; rooms land in the quicktricks backend *(resolved as removal — v2 has no room API; see notes)*
- [x] Single-dialog upload completes with progress *(abort/retry not re-exercised this pass — mechanism unchanged from pre-slice code)*
- [x] Dashboard processing state flips via SSE without a manual refresh
- [x] The uploaded class plays in the `ls` viewer via a signed `/playback` URL (B2+Bunny combo)
- [x] Unsigned fetch of the same HLS master → 403
- [x] Browser leg verified like the PDF task-04 pattern: bytes go browser → B2 direct; no video bytes transit the Next server

## Execution notes — 2026-07-22: config repoint resolved as REMOVAL (design session w/ Raghav)

The task text says "repoint `LIVESTREAMING_BACKEND_API_URL` to the quicktricks livestream
backend" — that target will never exist. Grilling session outcome (shared decision):

- **v2 has no `/room` API.** On `livestream-v2`, `routes/room.js` is unmounted and the live
  paths run on `classClient` (ADR-0003). The three admin-dashboard room calls
  (`syncLivestreamRoom` on class create/update, `endLivestream` after single upload,
  `createRoomsInLivestreamingBackend` in bulk) can never succeed on this line → **removed
  outright**, not env-gated. Principle (Raghav): *the admin client talks only to the LMS;
  the livestream backend learns what it needs from `Class`.*
- **`endLivestream` has no replacement.** The client stamping `ended` at upload time was a
  lie; `Class.streamStatus` is transcoder-written truth (`processing` → webhook → `ended`),
  surfaced by the existing SSE polling. Dialog just auto-closes after upload.
- **No teacher/student side effects.** v2 message/private-message/polls run on socket role +
  `roomId` + Redis; `hostId === roomId` is an identity convention, not data. Verified in
  `livestream-v2` code (privateMode handler, privateMsg via `UserSessions`, roster by role).
- **Seams found and registered as launch tasks 11–12** (client-launch-v2 set): join-time
  `isPrivate` bootstrap emit + server-side `userMsg` enforcement (11); ls viewer drops its
  `/room` fetch/auto-create, derives `hostId = roomId` (12). Also pre-existing: livestream's
  `classClient` HTTP writers still target dead `/api/internal/*` URLs (launch tasks 05/07),
  and the `fix/roster-host-gate-rra` resilience fixes need folding into the v2 line when
  livestream joins the shared branch. `backend/ROOM_TO_CLASS_MIGRATION.md` +
  `backend/tests/classClient.test.js` are **untracked** in the webcam-livestream working
  tree — commit them before they're lost.
- Student surface: not yet built; will consume LMS APIs only (never `/room`). ls is today
  primarily the teacher/streamer surface. SYSTEM.md rows updated accordingly.

## Execution notes — 2026-07-22: room-call removal landed; single-upload E2E upload arc verified

**Removal implemented** (admin-dashboard `launch/quicktricks-v2`, per the design-session outcome above):
`syncLivestreamRoom` + the room-sync block in `ClassesDashboard.handleFormSubmit`, `endLivestream`
in `SingleVideoUploadDialog`, `createRoomsInLivestreamingBackend` in `videoUploadStore`, and the
`LIVESTREAMING_BACKEND_API_URL` export in `config.ts` — all deleted. Typecheck clean on touched
files (repo has unrelated pre-existing TS errors); suites green (vitest + node --test 99/99).
Env leg was already done (2026-07-21): four `B2_*` vars + `STREAMER_JWT_SECRET` +
`NEXT_PUBLIC_LIVESTREAM_UI_BASE_URL=http://localhost:3001` in `.env.local`.

**Single-upload E2E through the real UI** (dashboard :3000, tunnel :5100 → phonetics, browser-driven):

- [x] Class authored through the admin UI (title "E2E single-upload secured arc", classId
  `6a607929a831636a3d91a688`, db `quicktricks-launch-test`) — taxonomy fixtures (test main
  cat/cat/section/topic) already existed. No livestream-backend request fired on create
  (network log clean — removal verified live).
- [x] 8.45 MB MP4 uploaded via the single dialog: progress bar → 100% → dialog flipped to
  processing and auto-closed. Only localhost request was the `/api/multipart_uploads/…/completions`
  POST (201) — no video bytes transit the Next server; object landed as
  `b2:ObjectCreated:MultipartUpload` in `tempvideos-recorded-v2`.
- [x] Listener: `Secured routing: yes`; 1A → stream-status 200 → `hlsAsset={bucket:'recorded',
  key:'472/6a607929a831636a3d91a688/hls/master.m3u8'}`, `streamStatus=ended`; 1B → recordings
  200 → 4 renditions (240/360/480/720p) + `duration:45`. Job completed in 26.9 s.
- [x] ls viewer leg + unsigned-403: DONE (2026-07-22). Raghav enabled Token Authentication on
  the existing zone `recordedvideos-hranker-v2.b-cdn.net` (option a) and provided the key.
  Unsigned fetch of the HLS master → **403**; key verified directly against the CDN with a
  locally-signed directory-token URL → 200 before any env wiring. Phonetics got
  `BUNNY_RECORDED_SECURITY_KEY` + `BUNNY_RECORDED_CDN_BASE=https://recordedvideos-hranker-v2.b-cdn.net`;
  `/playback` mints 200 and the ls viewer plays the class (240p start, currentTime advancing,
  duration 45) with master/variant/segments all fetched signed (200s; one transient edge 503
  on first manifest hit, self-retried).

Quirks/notes: processing-state UI (`ProcessingVideos` + `useProcessingVideos`, 5 s polling)
mounts only in the **bulk** sheet — the single dialog's observable is the processing flip +
auto-close. ls viewer runs from `../ls` on branch `livestream-secure` with `LMS_BASE_URL`
locally repointed to `http://localhost:5100` (uncommitted E2E-only edit in
`config/BaseConstants.ts`); ls task 12 (/room drop) still pending on that repo.

Viewer-leg quirks (2026-07-22):
- **`STREAMER_JWT_SECRET` mismatch**: the dashboard's `.env.local` value differed from
  phonetics' — first Go Live handoff 401'd at `/playback` ("Invalid token", signature
  failure, not expiry). Fixed by syncing `.env.local` to the phonetics value (backup at
  `.env.local.bak-vidup05`) + dev-server restart. `.env.example` already warns the two must
  match byte-for-byte.
- **Phonetics env loading footgun**: `app.ts` does `dotenv.config({ path: '.env.testing' })`
  — appending the `BUNNY_RECORDED_*` vars to `~/.quicktricks-lms-secrets` / `.env.production`
  did nothing (signer 500 "Unable to sign playback URL"). The vars had to go into
  `~/quicktricks-lms/.env.testing` (where `BUNNY_DOCUMENTS_*` actually live). The secrets
  file's copies were left in place but are inert for this process.
- Go Live's `window.open(_blank)` lands outside the automated tab group — the browser leg was
  driven by minting an identical teacher token (same claims/recipe as `lib/jwt.ts`, synced
  secret) and navigating the ls tab directly; the dashboard handoff itself was separately
  observed to open ls with a well-formed token URL.

## User stories covered

- Story 1: uploaded video playable through the protected viewer
- Story 3: unchanged upload workflow, end to end
- Story 5: processing status without asking anyone
- Story 7: students reach it only via short-lived signed URLs
- Story 17: rooms sync to the quicktricks backend, not another tenant's
