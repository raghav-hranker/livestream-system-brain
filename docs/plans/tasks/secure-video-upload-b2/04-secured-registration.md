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

## Execution notes — 2026-07-21 (5/6 criteria verified; CDN token-auth gap found)

**Env deltas applied** (names only; backups `*.bak-20260721` beside each file), transcoder box
`root@178.63.88.34`:

- `/root/video-transcoder/.env.b2` — loaded via `ENV_FILE` by pm2 app **`b2-video-listener`**
  (nginx: `b2-event.multistreaming.site` → :3011 → this app; the `.env`/:3003 `video-listener`
  instance is a separate lane, untouched): `SECURED_B2_CLIENTS=695,472`,
  `SECURED_API_URL_472=http://34.126.210.209:5100`.
- `/root/video-transcoder/gpu-server/job-manager/.env` — plain dotenv, pm2 app
  **`b2-secure-job-manager`**: `SECURED_CLIENTS=408,472`, `TRANSCODER_SECRET_472=<set>`
  (value = phonetics `TRANSCODER_WEBHOOK_SECRET`, piped box-to-box, never displayed).
  `HLS_B2_IMAGE=hls-to-mp4-b2-secure:latest` was already set; image present.
- Both apps pm2-restarted; listener `/health` OK.

**Why not the task-spec URL:** `quicktricks.multistreaming.site` still serves the OLD backend
(pm2 `quicktricks-backend` on test-uday — no stream-status route, probes 404). The new deploy is
phonetics pm2 app `quicktricks-lms`, port 5100, GCP-firewalled. User decision: direct IP + GCP
firewall rule `allow-transcoder-to-phonetics-5100` (tcp:5100, source `178.63.88.34/32`, target
tag `lms-webhook-test` on instance `phonetics`). **At prod cutover:** flip `SECURED_API_URL_472`
to the prod domain, delete the rule + tag.

**Tracer verified** (test class `6a5f5f177dc29fdade4e0e2a`, "UPLOADCHECK vid-secured tracer",
db `quicktricks-launch-test`):

- [x] Listener: `Secured routing: yes`, callback `http://34.126.210.209:5100`, upload bucket
  `recordedvideos-hranker-v2`; no `/api/api`.
- [x] GPU guard: "Secured client — injected transcoder secret (value redacted)"; no refusal.
- [x] stream-status webhook 200 → `hlsAsset={bucket:'recorded', key:'472/<classId>/hls/master.m3u8'}`,
  `streamStatus=ended`.
- [x] Recordings webhook 200 → `mp4Recordings` = 4 renditions (240/360/480/720p, with sizes) +
  `duration:45`.
- [x] Renditions + 65-file HLS set live in `recordedvideos-hranker-v2`.
- [ ] **FAILED — pre-existing gap, not caused by this slice:** unsigned CDN fetch of the HLS and
  MP4s returns **200**, not 403. Pull zone `recordedvideos-hranker-v2.b-cdn.net` (id 5927231)
  has Token Authentication effectively OFF. Additionally the phonetics LMS has **no**
  `BUNNY_RECORDED_SECURITY_KEY`/`BUNNY_RECORDED_CDN_BASE` (only `BUNNY_DOCUMENTS_*`), so it
  cannot mint recorded-zone playback URLs either — task 05's viewer E2E needs both fixed.
  Decision pending (see below).

**Quirks found (consume in later tasks):**

1. `checkIfProcessedB2` skips any object whose sibling `status.json` is <1 day old — **any**
   status, including `failed`. Re-firing a failed object needs a new filename (or >24h wait).
2. `setMp4Recordings` does a full-document `classItem.save()` → whole-doc Mongoose validation.
   Hand-inserted/legacy class docs missing required fields (`topic/section/category/mainCategory`
   = ObjectId refs, `teacherName`) → recordings webhook 500s, while stream-status (targeted
   update) succeeds on the same doc. Real admin-authored classes are unaffected.
3. The phonetics LMS connects with `dbName: DB_NAME` (`quicktricks-launch-test`); the MONGO_URI
   default db (`adminPanelDB`, the old backend's data) is a different database. Test fixtures
   must go in `DB_NAME`'s db.
4. phonetics error log is flooded with Redis `ECONNREFUSED 127.0.0.1:6379` — unrelated to the
   webhooks (neither handler touches Redis); flagged separately.

**Open decision — recorded-zone token auth.** Enabling Token Authentication on pull zone
`recordedvideos-hranker-v2` would protect the bytes but **break unsecured clients** whose
recordings URLs point at this same zone unsigned (the unsecured-b2 default CDN domain is this
zone). Options: (a) enable + migrate/accept breakage, (b) new token-authed pull zone on the same
B2 origin for secured customers, `BUNNY_RECORDED_CDN_BASE` → new zone, unsecured zone untouched,
(c) defer past test phase. Cleanup ledger (test class doc, tracer objects, firewall rule) lives
in the 2026-07-21 handoff.
