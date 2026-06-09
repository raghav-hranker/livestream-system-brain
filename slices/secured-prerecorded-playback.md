# Slice: Secured pre-recorded playback

**Goal:** a pre-recorded class for a **Secured customer** — one that never went live — becomes streamable
in the player.

**Why it's a slice:** it crosses all three repos and hinges on the cross-repo subtlety flagged in
`repos/video-transcoder/CONTEXT.md` (handoff §8): the *recorded* transcoder must call the **stream-status
webhook**, even though an old handoff scoped that webhook to the live transcoder. Without it, `Class.hlsAsset`
is never set and `/playback` 404s.

Vocabulary: `GLOSSARY.md`. Wiring: `SYSTEM.md`. Branch: all repos on `ACTIVE_BRANCH` (see `BRANCHES.md`).

## The hops (in order)

1. **video-transcoder — produce VOD HLS and report it (op 1A, secured).**
   - Intake routing / secured storage: `repos/video-transcoder/src/index.ts` (`SECURED_B2_CLIENTS` → `recorded` store).
   - Secret injection / spawn gate: `repos/video-transcoder/gpu-server/job-manager/secured-guard.js`.
   - The report itself: `repos/video-transcoder/container/apis.js` → `updateHlsStreamStatusApi`
     (`PUT /api/classes/{classId}/stream-status`, `{streamStatus:'ended', hlsAsset:{bucket:'recorded', key}}`,
     header `X-Transcoder-Secret`).
   - 1B (MP4 renditions) reports separately via the Recordings webhook — independent of this slice.

2. **nodejs-server — accept the webhook and persist `hlsAsset`.**
   - The `stream-status` route is the **only** secured writer of `Class.hlsAsset`; it must accept the recorded
     transcoder's `ended` call exactly as it accepts the live transcoder's. Verify the `X-Transcoder-Secret`
     check uses the **per-customer** secret (`TRANSCODER_WEBHOOK_SECRET`), not a global one.
   - Definitions: `repos/nodejs-server/CONTEXT.md` (token/credential taxonomy).

3. **nodejs-server — sign on `/playback`.**
   - `PUT /api/classes/{classId}/playback` mints a **Playback URL token** from `Class.hlsAsset`. No `hlsAsset`
     ⇒ 404. A **Streamer token** bypasses the entitlement check; a student token must pass it.

4. **livestream `ui/` — play and refresh.**
   - The player calls `/playback`, then re-mints (proactive before expiry / reactive on CDN 403). This is
     *consumer* behaviour; no contract change here unless the playback response shape changes.

## The contract that must stay in sync
`hlsAsset = {bucket, key}` written in hop 1 must be exactly what hop 3 signs. `bucket` must be `recorded`
(not `live`). `classId` on the wire is the transcoder's `roomId` (= `Class._id`) — renamed at the edge, see
`GLOSSARY.md`.

## End-to-end test
1. Submit a secured-customer source MP4 through the recorded intake.
2. Confirm 1A finishes and `stream-status` is called with `hlsAsset.bucket = recorded`.
3. Confirm `Class.hlsAsset` is set in nodejs-server.
4. `PUT /playback` as an entitled viewer → expect a signed URL (not 404).
5. Fetch the signed URL from the CDN → 200; let the token expire → CDN 403 → player re-mints.

## Failure-surface cheatsheet (from nodejs-server CONTEXT)
- **404 on `/playback`** → `hlsAsset` never set → hop 1 didn't reach hop 2 (secret? bucket? wrong classId).
- **401 from the API** → Auth access token expired — not this slice.
- **403 from the CDN host** → Playback URL token expired — expected; re-mint.
