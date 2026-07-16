# GLOSSARY — shared boundary vocabulary

Only terms that cross a repo boundary live here. Each entry points to its **authoritative** per-repo
definition; this file never restates it. If a term lives entirely inside one repo (e.g. *FfmpegPool*,
*proactive refresh*), it is **not** here — find it in that repo's `CONTEXT.md`.

| Term | One line | Authoritative def | Touched by |
|---|---|---|---|
| **`hlsAsset`** | `{bucket,key}` on the `Class` that `/playback` signs into a streamable URL. | `repos/nodejs-server/CONTEXT.md` (reader/owner) | written by livestream (live ended) + video-transcoder (1A secured) |
| **stream-status webhook** | `PUT /api/classes/{classId}/stream-status` — the only secured writer of `hlsAsset`. | `repos/video-transcoder/CONTEXT.md` + `MAP.md` | livestream, video-transcoder (writers); nodejs-server (reader) |
| **Recordings webhook** | Reports the MP4 rendition set (`recordings-prerecorded`). | `repos/video-transcoder/CONTEXT.md` | video-transcoder (writer); nodejs-server (reader) |
| **Class-link callback** | Unsecure-only HLS report (PHP / nodejs LMS variants). | `repos/video-transcoder/CONTEXT.md` | video-transcoder (writer) |
| **Transcoder secret** | `X-Transcoder-Secret` ⇄ `TRANSCODER_WEBHOOK_SECRET`; per secured customer. The general **service→LMS write credential**, not webhook-only: gates stream-status, recordings, and private-mode. | `repos/video-transcoder/CONTEXT.md` | video-transcoder + livestream (send), nodejs-server (checks) |
| **Class / `roomId` / `classId`** | The LMS `Class._id`. Transcoder wire field is `roomId` (historical); nodejs-server says `classId`. | `roomId`: `repos/video-transcoder/CONTEXT.md` · `classId`: `repos/nodejs-server/CONTEXT.md` | all three |
| **Secured vs Unsecure** | Customer security axis; decides webhook contracts + whether the secret is required. | `repos/video-transcoder/CONTEXT.md` | video-transcoder (routing), nodejs-server (enforcement) |
| **Playback URL token** | Short-lived signed CDN credential, scoped to one class's Token path. | `repos/nodejs-server/CONTEXT.md` | nodejs-server (mints), livestream ui (consumes) |
| **Auth access token** / **Streamer token** | JWT proving the viewer; Streamer token bypasses the entitlement check on one class. | `repos/nodejs-server/CONTEXT.md` | nodejs-server (issues/validates), livestream ui (presents) |
| **recorded bucket** | VOD MP4/HLS store (`recordedvideos-hranker-v2`), **B2 origin + Bunny CDN, signed** (Playback URL token). | `repos/video-transcoder/CONTEXT.md` | video-transcoder (writes), nodejs-server (signs) |
| **Live bucket** | Live-segment store, Bunny CDN + **signed**, distinct from `recorded`. Origin is env-pinned: B2 by default, or a **Bunny Storage** zone when the live backend's `LIVE_STORAGE_*`/`LIVE_S3_BUCKET_NAME` are set (decoupled from `STORAGE_*`/B2 so *only* the live origin moves). | `webcam-livestream/backend/lib/fileUpload.js` (`liveS3Client`) | livestream (writes), nodejs-server (signs) |
| **`BUNNY_LIVE_SECURITY_KEY` / `BUNNY_LIVE_CDN_BASE`** | The live pull-zone token-auth key + host. **Dual-consumed in two repos with two different token *forms*:** nodejs-server signs *playback* URLs (query-string `?token=…`); the live backend signs the *secured-1C transcoder input* (path-embedded `bcdn_token=…/`). Both `.env`s must match the live pull zone, or one path breaks while the other works. **Footgun:** a *stale* `BUNNY_LIVE_CDN_BASE` points the signer at a moved-away origin — the token still validates but the object **404s** (wrong origin), not 403; a key mismatch on the *right* host gives 403 instead. Two ways to land there: (1) the env is **explicitly set to the old host** (the actual 2026-06 incident — the old value happened to equal the code default `hranker-livestream-v2.b-cdn.net`), or (2) the env is **unset** and the signer falls back to that same default. Case (1) is the common one and an explicit env **overrides any code default**, so hardening `DEFAULT_CDN_BASE` does *not* fix it — the env value itself must move when the live origin moves. | `nodejs-server/src/services/bunnyAssetSigner.ts` + `webcam-livestream/backend/lib/bunnyAssetSigner.js` (CommonJS port; pinned to the same HMAC golden vector) | nodejs-server (playback sign), livestream (1C input sign) |
| **Secured-1C input signing** | At stream-end the live backend enqueues an HLS→MP4 job whose **input is the protected live HLS**; `maybeSignInputUrl` (gated on `BUNNY_LIVE_SECURITY_KEY` presence) mints a path-embedded directory token so ffmpeg's relative child/segment fetches inherit auth. Key unset ⇒ plain passthrough ⇒ **403 from the protected zone**. | `webcam-livestream/backend/lib/{ecs.js,bunnyAssetSigner.js}` | livestream (signs+enqueues), video-transcoder (GPU worker fetches input) |
| **R2 serving combo** (unauthenticated) | Alternative serving mode: object store **Cloudflare R2**, served from `R2_PUBLIC_DOMAIN` with **no signed URL and no Bunny security key** — publicly fetchable, content protection bypassed at the CDN. | `repos/livestream/backend/lib/ecs.js` (storage routing) + `repos/video-transcoder/MAP.md` (`storageProvider`) | livestream (routes `storageProvider:'r2'`), video-transcoder (`hls-to-mp4-container` R2 image), nodejs-server (**not** involved — no `/playback` mint) |

## Storage & serving combos (and which carry auth)

There is **more than one** storage/CDN combo, and they differ in their **trust boundary** — this is the single
biggest thing to get right when reasoning about playback, because `nodejs-server`'s whole premise (signed
short-lived URLs) only applies to one of them.

| Combo | Origin → edge | Auth at the CDN | `/playback` (nodejs-server) | Where |
|---|---|---|---|---|
| **B2 + Bunny** (signed) | B2 bucket → Bunny pull zone | **Yes** — Playback URL token (Bunny security key) gates every fetch | mints the Playback URL token from `hlsAsset` | the slice branch; `storageProvider:'b2'`, `hls-to-mp4-container-b2` |
| **R2** (unauthenticated) | R2 bucket → `R2_PUBLIC_DOMAIN` | **No** — files are public; no token, no security key | not in the path; nothing to sign | a separate branch; `storageProvider:'r2'`, `hls-to-mp4-container` |

Implications when a task crosses this boundary:
- A **403 from the CDN** diagnostic (Playback URL token expired → re-mint) only makes sense for the **B2 + Bunny**
  combo. In the **R2** combo there is no token, so there is no 403-on-expiry and no re-mint loop.
- The **Streamer token** / **Entitlement check** still gate *minting* on the API, but in the R2 combo there is
  no minted credential protecting the files — so those API gates do **not** protect the bytes. Don't assume
  "entitled-only access" holds under R2.
- Which combo is active is environment/branch-dependent (B2/Bunny env present ⇒ signed B2; otherwise the R2
  fallback). The brain does not hardcode the branch name — confirm the active combo from the deploy's env
  (`STORAGE_*` vs `R2_*`) before reasoning about auth.

## Cross-repo aliasing resolved here

- **The LMS is not real-time — by design.** nodejs-server is the system of record for class *policy*
  (`isPrivate`, `isChat`, schedule); the livestream service is the *real-time plane*. An LMS-side write
  (e.g. admin toggling `isPrivate` mid-class) is **enforced** on the next websocket firing but is **not
  broadcast** to in-room clients — only class-UI-initiated toggles notify the room. Mid-class changes
  belong in the class UI; the LMS UI sets policy for before/after class. Don't "fix" this by making the
  LMS push to livestream — the LMS must not know livestream exists.
- **"isLive" is three different things — none of them runtime truth.** `Class.isLive` is a stored
  **write-time snapshot**: the admin client computes it from `startDate`/`endDate` when constructing the
  class payload; the server stores it verbatim and the stream-status webhook never touches it. `Course.isLive`
  is a **product-type flag** (live-classes course vs recorded course). The only *runtime* liveness truth is
  `Class.streamStatus`, written by the transcoders. Don't gate anything real-time on either `isLive`.

- **`roomId` (transcoder) == `classId` (nodejs-server) == `Class._id`.** Same value, two wire names. When a
  slice crosses the webhook boundary, expect the field to be renamed at the edge — that is correct, not a bug.
- **"the secret" is per-customer, not global** — see the video-transcoder CONTEXT flag. A global secret would
  leak to unrelated customers' LMSes.
- **"the bucket combo" is not one thing.** B2 + Bunny is *signed* (Playback URL token); the R2 combo is
  *unauthenticated* (public R2 domain). They are different trust boundaries, not interchangeable storage
  backends — see "Storage & serving combos" above.
- **stream-status is NOT live-only.** The video-transcoder `CONTEXT.md` flags that an old handoff (§8) wrongly
  scoped `stream-status` to the live transcoder; the recorded 1A path must also call it for pre-recorded
  (never-live) classes, or their HLS is unreachable. This is the crux of the secured-prerecorded-playback slice.
