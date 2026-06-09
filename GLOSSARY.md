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
| **Transcoder secret** | `X-Transcoder-Secret` ⇄ `TRANSCODER_WEBHOOK_SECRET`; per secured customer, gates both webhooks. | `repos/video-transcoder/CONTEXT.md` | video-transcoder (sends), nodejs-server (checks) |
| **Class / `roomId` / `classId`** | The LMS `Class._id`. Transcoder wire field is `roomId` (historical); nodejs-server says `classId`. | `roomId`: `repos/video-transcoder/CONTEXT.md` · `classId`: `repos/nodejs-server/CONTEXT.md` | all three |
| **Secured vs Unsecure** | Customer security axis; decides webhook contracts + whether the secret is required. | `repos/video-transcoder/CONTEXT.md` | video-transcoder (routing), nodejs-server (enforcement) |
| **Playback URL token** | Short-lived signed CDN credential, scoped to one class's Token path. | `repos/nodejs-server/CONTEXT.md` | nodejs-server (mints), livestream ui (consumes) |
| **Auth access token** / **Streamer token** | JWT proving the viewer; Streamer token bypasses the entitlement check on one class. | `repos/nodejs-server/CONTEXT.md` | nodejs-server (issues/validates), livestream ui (presents) |
| **recorded bucket** | VOD MP4/HLS store (`recordedvideos-hranker-v2`), **B2 origin + Bunny CDN, signed** (Playback URL token). | `repos/video-transcoder/CONTEXT.md` | video-transcoder (writes), nodejs-server (signs) |
| **Live bucket** | Live-segment store, **B2 origin + Bunny CDN, signed**, distinct from `recorded`. | `repos/livestream/docs/plans/` | livestream (writes), nodejs-server (signs) |
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
