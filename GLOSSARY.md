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
| **recorded bucket** | VOD MP4/HLS store (`recordedvideos-hranker-v2`, Bunny "recorded" pull zone). | `repos/video-transcoder/CONTEXT.md` | video-transcoder (writes), nodejs-server (signs) |
| **Live bucket** | Live-segment store (B2 + Bunny), distinct from `recorded`. | `repos/livestream/docs/plans/` | livestream (writes), nodejs-server (signs) |

## Cross-repo aliasing resolved here

- **`roomId` (transcoder) == `classId` (nodejs-server) == `Class._id`.** Same value, two wire names. When a
  slice crosses the webhook boundary, expect the field to be renamed at the edge — that is correct, not a bug.
- **"the secret" is per-customer, not global** — see the video-transcoder CONTEXT flag. A global secret would
  leak to unrelated customers' LMSes.
- **stream-status is NOT live-only.** The video-transcoder `CONTEXT.md` flags that an old handoff (§8) wrongly
  scoped `stream-status` to the live transcoder; the recorded 1A path must also call it for pre-recorded
  (never-live) classes, or their HLS is unreachable. This is the crux of the secured-prerecorded-playback slice.
