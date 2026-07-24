# Launch runbook — quicktricks v2 streaming line

**One campaign merging the three open HITL gates:** brain [task 10](./tasks/10-launch-acceptance-run.md)
(launch acceptance) + livestream repo tasks
[06](../../repos/livestream/docs/plans/tasks/06-deploy-coordination-and-smoke-test.md) (lockstep deploy)
and [11](../../repos/livestream/docs/plans/tasks/11-deploy-smoke-test-upload-mode.md) (live-upload smoke).
All AFK code slices are merged (launch tasks 02–09, 11, 12; livestream Phase-3 07–10); what remains is
push → prod-shape merge → env → deploy → prove it live.

State audited 2026-07-22 from the actual checkouts (`sync-branches.sh status` clean, all five repos on
`launch/quicktricks-v2`).

## Phase 0 — Push the slice branches (blocker for deploy phases)

> **ON HOLD (2026-07-22, user decision):** no pushes yet — other devs must not pull these branches
> into their work before the launch window. Phase 1 proceeds on a **local** merge branch; Phase 0
> executes immediately before Phase 3 when the user green-lights it.

| Repo | State vs remote | Action |
|---|---|---|
| nodejs-server | in sync with `origin/launch/quicktricks-v2` | none |
| video-transcoder | in sync | none |
| livestream | **ahead 2** (task-11 merge: private-mode bootstrap + `userMsg` enforcement) | push |
| admin-dashboard | **ahead 5** (vidup 02/03 B2 flip + room-sync removal) | push |
| ls | branch **absent on remote** (remote is named `livestream-secure`, not `origin`; local carries task 12) | `git push livestream-secure launch/quicktricks-v2` |

No co-author trailers on any commit.

## Phase 1 — Give `quicktricks-prod` the secure shape (nodejs-server)

⚠️ **The slice file's "pure `git merge --ff-only`" note is stale.** `launch/quicktricks-v2` and
`origin/quicktricks-prod` have **diverged: 69 / 220** — prod carries ~220 commits of live work (APX
drain, caching, course/progress fixes) absent from the slice branch. This is a real merge:

1. `git merge launch/quicktricks-v2` into a local `quicktricks-prod`; expect conflicts in shared
   surfaces (`Class` model, `classRoutes`, `app.ts` cron wiring, `dist/` builds — rebuild `dist`
   rather than hand-merging it).
2. Run the full suite (509 tests green on the slice branch is the baseline) before pushing.
3. Verify the merged tip serves: `PUT /stream-status` + secret middleware, 425 playback gate,
   `PATCH /private-mode`, `staleStreamSweepCron`, PDF `/access` + upload-session routes.

This merge **also lands the pending PDF-delivery and PDF-upload prod merge** — one merge closes both
ledgers.

### Phase 1 status: PUSHED + PHONETICS-VERIFIED 2026-07-24 (prod still untouched)

Branch pushed to origin @ `3cf02720` = `274272f3` + a lockfile fix (the merge had taken prod's
v2 `package-lock.json`, which lacks chokidar's optional `fsevents` entry — box `npm ci` refused;
regenerated from the slice branch's v3 lock against the merged `package.json`). Deployed to the
**phonetics test box** (user decision: phonetics first, test-uday/prod later) via
`~/deploy-quicktricks-lms.sh` (now takes a `BRANCH=` override). All box verification green on the
merged tip: cutover-checks 11/11, upload-accept-checks all-pass, merged cron union scheduled, all
8 `pdfs` indexes present, stream-status/private-mode secret middleware (401 without / passes
with), fixture class `processing`→425 then `ended`+`hlsAsset`→200 signed recorded-zone URL.
`quicktricks-prod` itself not fast-forwarded yet; the six merge decisions below still await
formal sign-off (decisions 5–6 unvalidated by targeted tests).

### Phase 1 history: MERGED LOCALLY 2026-07-23

Branch `merge/quicktricks-prod-x-launch-v2` @ `0a827dd6` (worktree
`system-brain/repos/.merge/nodejs-server-prodmerge`; the user's `quicktricks-prod` checkout at
`~/Projects/nodejs-server-quickstricks` untouched). `tsc --noEmit` clean, dist rebuilt.
Suite: 871 tests, 858 pass — the 13 failures (streak screen/journeys, notification redirection)
fail **identically on the prod baseline**: pre-existing, zero merge regressions.

Background: prod had carried an early cut of the video-protection slices and reverted them on
2026-05-07 (`8b5d972e` + 3 siblings); this merge re-lands the mature v2 form.

**Decisions made in the merge — review before push:**

1. **mp4Recordings union shape — TRANSITIONAL, not a permanent category (reworded 2026-07-24).**
   Stored entries are secured `{bucket,key,quality}` (signed) or url-shaped `{url,quality}`
   (served verbatim). Secured webhook stays strict at the edge; `/playback`+`/downloads` filter
   to signable entries. **Greenfield framing:** quicktricks has no "legacy" data — the url shape
   is our own APX-ingest interim write, and the bytes already sit on the recorded **B2** zone
   (`recordedvideos-hranker-v2.b-cdn.net`; verified 2026-07-24 in prod Mongo `quicktricksdb` +
   unsigned CDN probe — video-transcoder ADR-0003/0004's "R2 interim" record is stale, corrected
   there). The union tolerance exists only until the Phase-1.5 backfill enriches every entry to
   bucket+key; end-state = every non-YouTube class signable (YouTube redirects are the one
   sanctioned no-video category). The backfill strips the url fields outright (pre-launch, no
   consumers — user decision 2026-07-24); after it commits, the union tolerance itself is
   removable (cleanup ledger: tighten `Mp4RecordingSubSchema` back to bucket+key-only).
2. **Class serializer** — v2's hlsAsset/mp4Recordings stripping restored, but stored APX
   `class_link` wins over the `link` alias.
3. **Admin-writable `streamStatus`** — kept (APX/backfill needs it) but constrained to the
   lifecycle enum; secured webhook remains the authoritative writer.
4. **`/users/refresh-token`** — v2's expiry-tolerant handler kept and prod's `authenticateToken`
   mount dropped (it rejected the expired tokens the route exists to refresh; session-liveness
   check gates instead).
5. **Nullable PDF topic** (prod) threaded through v2's create/update/upload-session seams.
6. Cron roster is the union; `Pdf.createIndexes()` on boot retained (autoIndex is broken on the
   deploy box — proven during pdf-upload).

## Phase 1.5 — APX video-asset metadata backfill (added 2026-07-24)

**Discovery:** all APX renditions already live on the recorded B2 zone
(`recordedvideos-hranker-v2.b-cdn.net`, keys `472/<classId>/{hls/master.m3u8,mp4/<q>.mp4}`) —
only the Mongo shape is ingest-era (`{url}` entries + `link`, no `hlsAsset`, no `{bucket,key}`).
The old "/downloads options (a/b/c)" question dissolves: no bytes move, this is a **pure metadata
backfill**.

- **Script:** `src/scripts/backfillApxVideoAssets.ts` (nodejs-server, on the merge branch).
  Dry-run by default, `--commit` to persist, idempotent. It rewrites straight to the **clean
  final shape** (user decision 2026-07-24: pre-launch, nobody consumes the url path, so no
  transition period): entries become `{bucket:'recorded', key, quality, size}` — `url` and
  ingest-era subdoc `_id` dropped, aliased duplicates deduped with quality re-derived from the
  filename (the APX ladder pointed `144p`→`240p.mp4`, `720p`→`480p.mp4`) — and `hlsAsset` is set
  from the link. It does **not** write `streamStatus` (undefined falls through `/playback`'s
  readiness gate; only `preparing`/`processing` 425) — `streamStatus` stays webhook-owned.
- **Dry-run vs prod (`quicktricksdb`) 2026-07-24:** scanned 7,514 · planned 7,083 (all get
  `hlsAsset`; 7,055 also mp4-rewrite, 35,275 entries → 21,165 deduped = 3 real files/class;
  the 28 hls-only classes get playback but no downloads) · 322 YouTube skipped · 109 anomalies
  (no hls link — titles are largely "(Internet Error)" / "(Class with Error)" / test entries,
  broken at the APX source) · **zero wrong-host or unparseable URLs**.
- **Execution:** runs in Phase 3 after the LMS deploy (needs the merged tip live to verify mints).
- **Anomaly triage (parallel, non-gating):** the 109 no-link classes — decide
  dead/re-ingest/delete per batch.
- **Success criterion:** zero url-shaped fields remain; every non-YouTube video class carries
  `hlsAsset` + clean bucket+key recordings.

## Phase 2 — Environment prerequisites (before the LMS deploy)

The LMS starts rejecting unauthenticated transcoder writes the moment Phase 1 deploys, so these come first:

- **Both transcoders, every environment:** `LMS_BASE_URL` + per-customer `TRANSCODER_WEBHOOK_SECRET`
  matching the LMS value (livestream task 06).
- **livestream:** `LIVE_UPLOAD_ENABLED` unset/`true`; `S3_BUCKET_NAME` + `STORAGE_*` +
  `STORAGE_PUBLIC_URL` for the Live B2 bucket; confirm the IPv4 upload fix host note in
  `fileUpload.js` (livestream task 11 prereqs).
- **Bunny key pairing (GLOSSARY footgun):** `BUNNY_LIVE_SECURITY_KEY` + `BUNNY_LIVE_CDN_BASE` must
  match the live pull zone in **both** livestream and nodejs-server `.env`s — a stale CDN base 404s
  with a valid token; a key mismatch 403s.
- **Recorded-zone pairing (added 2026-07-24):** `BUNNY_RECORDED_SECURITY_KEY` +
  `BUNNY_RECORDED_CDN_BASE` in the LMS env must pair with the `recordedvideos-hranker-v2` pull
  zone — it's what `/downloads` and backfilled APX `/playback` sign against. Same footgun class
  as the live pairing above.
- **Mongo guardrail (ADR-0003):** livestream's DB user read-only on `classes`; prove it — a write from
  that user must fail.
- **Fresh client DB (ADR-0004):** zero `Room` documents, no migration/backfill executed.

## Phase 3 — Lockstep deploy order

1. Env vars everywhere (Phase 2).
2. Transcoders (livestream, video-transcoder secured contract).
3. LMS (`quicktricks-prod` merged tip). Boot validation (launch task 09) fail-fasts on missing wiring —
   a refusal to boot here is the guardrail working, not a regression.
4. admin-dashboard + ls.
5. **APX backfill (Phase 1.5 script, added 2026-07-24):** dry-run once more against the live tip,
   then `--commit`; verify counts (success criterion: zero url-shaped fields remain; every
   non-YouTube video class carries `hlsAsset` + clean bucket+key recordings) and spot-check one
   backfilled class end-to-end — `/playback` 200 with a signed URL that plays, `/downloads` 200
   with signed renditions. Then flip the recorded zone (Phase 5).

## Phase 4 — Acceptance run (merged checklist)

Against a test class, in order:

1. **OBS in** → `preparing`→`live`; segments/playlists appear in the Live bucket **during** the
   stream; `live` PUT carries `hlsAsset` and fires only after the first segment lands; `/playback`
   transitions 425→200 with a signed live URL that plays; unsigned fetch of the same URL 403s.
2. **Reconnect:** bounce OBS mid-stream → `reconnecting`→`live` round-trips with the same
   `hlsAsset.key`, uploads resume.
3. **OBS stop** → `processing` (`/playback` 425) → `ended` with the VOD key
   (`playlist-mpl-vod.m3u8`); **no bulk directory re-upload** in logs (upload mode); `/playback`
   200 + signed VOD URL that plays.
4. **Retry layer:** kill nodejs-server ~60 s mid-`ended` → producer retry lands the transition after
   restart; class reaches `ended`, no stuck `processing`, sweep stays quiet.
5. **Private mode:** toggle from the class UI → LMS `Class.isPrivate` flips, room receives
   `privateModeUpdate`; a **late joiner** receives current `isPrivate` on join; a forged `userMsg`
   during private mode is rejected server-side (launch task 11 checks).
6. **Fallback:** `LIVE_UPLOAD_ENABLED=false`, restart, disk-serving works; revert to upload mode.
7. **APX spot-check (added 2026-07-24):** from a real client, one backfilled APX class plays via
   the token path and its downloads mint + fetch.
8. Record results; tick the acceptance boxes in brain task 10 and livestream tasks 06/11; commit the
   brain docs.

Failures → [`slices/client-launch-v2.md`](../../slices/client-launch-v2.md) failure-surface cheatsheet.

## Phase 5 — Recorded-zone token-auth cutover (added 2026-07-24; part of the launch tail)

Enabling token auth on the `recordedvideos-hranker-v2` pull zone is what actually closes the APX
protection gap — today the zone is **open** (unsigned fetch = 200, probed 2026-07-24).

**Re-scoped 2026-07-24 (user decision):** quicktricks is pre-launch with no consumers on the
unsigned url path, so there is no client-migration gate and no deferral. Flip the zone **after
Phase 3 step 5 (backfill committed + verified) and before/with the Phase 4 acceptance run**, so
the acceptance's APX spot-check (Phase 4 step 7) proves playback + downloads against the locked
zone. Only ordering constraint that remains: backfill first — flipping earlier leaves nothing
signable for APX classes and `/playback` 404s them.

## Tracked in parallel (not gating the launch)

- **vidup task 07** (AFK, admin-dashboard): ProcessingVideos `/api/uploads` still reads
  `tempvideos-selectionway` — repoint to B2.
- **PDF phonetics deploy + browser E2E** (HITL, separate box) — the code side is fully merged.
- **ls `/room` callers:** `notes.ts` needs a new home; `app/demo/page.tsx` still calls
  `/api/v1/room*`. Post-launch cleanup.
- **Cleanup ledger:** `bulk_e2e_*` test classes, tracer objects, temporary firewall rule (see
  vidup tasks 04/06 notes).
- **APX anomaly triage (2026-07-24):** 109 no-link classes (source-broken/test entries) + 28
  hls-only (no MP4s) — dead / re-ingest / delete per batch. See Phase 1.5.
- **Schema tighten post-backfill (2026-07-24):** once the backfill commits and its success
  criterion holds, remove the transitional url tolerance — `Mp4RecordingSubSchema` back to
  bucket+key-required, drop `LegacyMp4RecordingRef`/the `pre('validate')` either-or guard, and
  the `isSignableMp4Recording` filters become invariant checks.
