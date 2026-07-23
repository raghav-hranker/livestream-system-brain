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

### Phase 1 status: MERGED LOCALLY 2026-07-23 — awaiting review, NOT pushed

Branch `merge/quicktricks-prod-x-launch-v2` @ `0a827dd6` (worktree
`system-brain/repos/.merge/nodejs-server-prodmerge`; the user's `quicktricks-prod` checkout at
`~/Projects/nodejs-server-quickstricks` untouched). `tsc --noEmit` clean, dist rebuilt.
Suite: 871 tests, 858 pass — the 13 failures (streak screen/journeys, notification redirection)
fail **identically on the prod baseline**: pre-existing, zero merge regressions.

Background: prod had carried an early cut of the video-protection slices and reverted them on
2026-05-07 (`8b5d972e` + 3 siblings); this merge re-lands the mature v2 form.

**Decisions made in the merge — review before push:**

1. **mp4Recordings union shape** — stored entries are secured `{bucket,key,quality}` (signed) OR
   legacy APX `{url,quality}` (served verbatim, R2-public). Secured webhook stays strict at the
   edge; `/playback`+`/downloads` filter to signable entries, so APX-only classes 404 on
   `/downloads` (they serve via `class_link`/prod listing instead).
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
- **Mongo guardrail (ADR-0003):** livestream's DB user read-only on `classes`; prove it — a write from
  that user must fail.
- **Fresh client DB (ADR-0004):** zero `Room` documents, no migration/backfill executed.

## Phase 3 — Lockstep deploy order

1. Env vars everywhere (Phase 2).
2. Transcoders (livestream, video-transcoder secured contract).
3. LMS (`quicktricks-prod` merged tip). Boot validation (launch task 09) fail-fasts on missing wiring —
   a refusal to boot here is the guardrail working, not a regression.
4. admin-dashboard + ls.

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
7. Record results; tick the acceptance boxes in brain task 10 and livestream tasks 06/11; commit the
   brain docs.

Failures → [`slices/client-launch-v2.md`](../../slices/client-launch-v2.md) failure-surface cheatsheet.

## Tracked in parallel (not gating the launch)

- **vidup task 07** (AFK, admin-dashboard): ProcessingVideos `/api/uploads` still reads
  `tempvideos-selectionway` — repoint to B2.
- **PDF phonetics deploy + browser E2E** (HITL, separate box) — the code side is fully merged.
- **ls `/room` callers:** `notes.ts` needs a new home; `app/demo/page.tsx` still calls
  `/api/v1/room*`. Post-launch cleanup.
- **Cleanup ledger:** `bulk_e2e_*` test classes, tracer objects, temporary firewall rule (see
  vidup tasks 04/06 notes).
