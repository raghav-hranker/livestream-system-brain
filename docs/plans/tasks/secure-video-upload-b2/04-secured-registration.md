# Secured-customer registration (472)

**Type**: HITL
**Blocked by**: #1

## What to build

No code — env registration that flips quicktricks (472) onto the secured B2 lane, then
proof that the #1 tracer object rides it all the way to `Class.hlsAsset`.

**Intake listener env:**
- `SECURED_B2_CLIENTS` += `472`
- `SECURED_API_URL_472=https://quicktricks.multistreaming.site` — **scheme+host only.**
  Trap (verified in code): the container forms `${API_URL}/api/classes/{classId}/stream-status`;
  without this override the listener falls back to the client's callback base, which already
  ends in `/api`, producing a broken `/api/api/…` webhook URL.

**GPU job-manager env:**
- `SECURED_CLIENTS` += `472`
- `TRANSCODER_SECRET_472=<quicktricks secret>` — the guard refuses jobs loudly if a secured
  client has no secret, so set both together
- `hls-to-mp4-b2` image present on the quicktricks GPU box (`HLS_B2_IMAGE` if the tag differs)

**nodejs-server (quicktricks deploy):** `TRANSCODER_WEBHOOK_SECRET` = the same value.
(The livestream backend needs the same secret for the live arc — that's launch wiring, not
this task, but mint one value for both.)

Then re-fire (or re-upload) the #1 tracer object and follow it: secured 1A → stream-status
webhook sets `hlsAsset`; 1B → secured recordings webhook sets the MP4 set.

## Acceptance criteria

- [ ] Listener logs show `Secured routing: yes` for a `472/...` object and the secured LMS base (no `/api/api`)
- [ ] GPU guard injects `SECURED=true` + secret; no refusal logged
- [ ] nodejs-server accepts the stream-status webhook (200) and the class's `hlsAsset` is set to the B2 recorded bucket key
- [ ] Secured recordings webhook lands the MP4 rendition set
- [ ] Renditions live in `recordedvideos-hranker-v2`; unsigned CDN fetch of the HLS → 403
- [ ] Env deltas recorded here (names only, never values)

## User stories covered

- Story 1: an uploaded video becomes playable through the protected arc
- Story 9: HLS reported via the authenticated stream-status webhook
- Story 10: MP4 renditions reported via the secured recordings webhook
- Story 14: legacy R2 lane untouched — only new B2-intake objects take this path
