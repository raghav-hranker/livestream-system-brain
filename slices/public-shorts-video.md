# Slice: Public shorts video

**Goal:** a video uploaded in the Shorts section rides the existing **public** transcode lane
and is served from `https://recordedvideos.hranker.org` with no token and no `/playback` mint. Course
classes keep the secure lane untouched.

**Why it's a slice:** it crosses the admin ⇄ LMS boundary (a new upload lane and a new Short shape),
it *removes* an accidental crossing into the secure transcoder lane, and — since 2026-09-16 night —
it crosses the transcoder ⇄ LMS boundary with a new **reporting contract** (the Shorts transcode
callback) carried by a new per-(queue, client) **Job profile** in video-transcoder. The earlier claim
that video-transcoder is not edited was wrong: see the status section below.

**Governing docs:** `docs/adr/0006-shorts-videos-are-public-objects.md` (public objects, stands) +
`docs/adr/0007-shorts-readiness-via-transcode-callback.md` (readiness + job profile; supersedes
0006 decisions 1 and 4). Tasks: `docs/plans/tasks/shorts-transcode-callback/`.

**Repos:** production LMS `../quicktricks-backend` branch `quicktricks-admin` · production admin
`../quicktricks-admin` branch `quicktricks-admin`. Both are deploy forks — NOT slice-branch-synced (see
`repos.manifest`). The local `quicktricks-admin` checkout is a stale scratch branch: land from a
worktree off `origin/quicktricks-admin`.

## The current (broken) path

```
ShortVideoUploadDialog  path = {customerId}/{shortId}
  → Uploader → /api/multipart_uploads → lib/video-storage.ts
  → tempvideos-recorded-v2                      ← the SECURE intake bucket
  → secured lane: [clientId, roomId] = [customerId, shortId]
  → GPU 1A+1B → PUT /api/classes/{shortId}/stream-status → 404
  → completions returns only { key }; getUploadLink() falls through
  → Short.link = "2/68c1.../clip.mp4"           ← not a URL
```

## The target path

```
ShortVideoUploadDialog  lane: 'public'
  → Uploader → /api/multipart_uploads (lane enum) → lib/s3.ts
  → tempvideos-hranker                           ← the PUBLIC intake bucket: selects STORAGE/CDN only
  → listener: job.config.profile = { reporting:{kind:'callback',url}, mp4:false }
              (from CF_HRANKER_REPORT_CALLBACK_URL_472 / CF_HRANKER_MP4_RENDITIONS_472; one generic
               resolver for every queue — a client with no env gets today's behaviour)
  → manager guard: REPORTING=callback + TRANSCODER_SECRET_472, never SECURED=true, MP4_RENDITIONS=false
  → GPU 1A only → recordedvideos-hranker/{customerId}/{shortId}/hls/master.m3u8
  → container: ONE POST /api/shorts/transcode-complete { roomId, status, outputs.hls.key, durationSec }
               (X-Transcoder-Secret; a 4xx is fatal to the job, like stream-status)

readiness: the LMS is the single writer of videoStatus
           callback processed → ready   |  callback failed → failed (+ error)
           no callback for 24h (never ran) → sweeper marks failed; a late 'processed' still wins
           admin dialog polls GET /api/shorts/{id} for display only; no status.json, no HEAD, no PATCH

read: GET /api/shorts → link = ${SHORTS_PUBLIC_BASE_URL}/${videoAsset.key}
      → public CDN, no token, relative segments resolve on the same host
```

## Status — 2026-09-16 night: readiness redesigned (ADR-0007), NOT yet implemented

The first real upload (short `6aaa7238…`, client 472) played publicly within 25 s **and** was recorded
`failed`, because "the unsecure lane" below is two decisions: the bucket selects storage/CDN, the
client's secured flag selects the reporting contract. 472 is (correctly) secured, so the container
reported `PUT /api/classes/{shortId}/stream-status` → 404 → fatal. Dropping the secret does not help:
the unsecure recordings POST hits `requireTranscoderSecret` on the fork → 401, also unwrapped.

Decided with the user (grill session; reasons and rejected options in ADR-0007):
- video-transcoder **is** edited, in three deploy units, but stays product-ignorant: a per-(intake
  queue, client) **job profile** from env, a third reporting contract `callback`, `mp4:false`.
- The LMS gains `POST /api/shorts/transcode-complete` and becomes the **single writer** of
  `videoStatus`; a 24 h sweeper only gives up. The admin dialog stops reading R2 and stops writing
  status; its `{videoStatus}` PATCH arm is removed after acceptance. Predecessor "Defect 2" (closed
  dialog ⇒ stuck `processing`) disappears rather than being patched.
- Rollout is **gated on auditing the listener box**: `launch/quicktricks-v2` is 5 commits ahead,
  unpushed (the secure R2 lane), and its shared dispatch was never qualified. Order: LMS → container
  image → manager → listener + env → admin → acceptance (re-upload the test short; one 472 class
  through the private lane) → remove the PATCH arm.

Execution state lives in `docs/plans/tasks/shorts-transcode-callback/README.md`. The test short is
fixed by **re-upload** once the lane lands (no admin JWT needed). The uncommitted admin read-side fix
in `~/Projects/worktrees/qt-admin-shorts` is superseded and is to be discarded.

The section below records the **shipped** state of hops 1–8 as of 2026-09-16 afternoon; its
readiness claims (status.json + HEAD, dialog writes `ready`) describe what is deployed *today*, not
the target.

## Status — hops 1–8 implemented AND DEPLOYED 2026-09-16

Landed on the production branch `quicktricks-admin` in both forks by fast-forward (rebased off
`origin/quicktricks-admin` first; the remote had moved 5 commits on the backend, 2 on the admin).

- **backend** `f5a0b4ab7` pushed → pulled on the prod box
  (`hranker@148.113.49.18:/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend`,
  key `~/.ssh/hranker-webserver2-2`) → `pm2 restart quicktricks-backend` (id 27, new PID).
  Rollback: `git reset --hard ff077ea48` on the box + restart.
  Verified live: `GET /api/shorts` → 200, all records still serialize `link`.
- **admin** `f54dfb8` pushed → Vercel production build auto-triggered and is **Ready**, holding
  `admin.quicktricksbysahilsir.com` (deployment `quicktricks-admin-djadsk2i2`).
  Rollback: promote `quicktricks-admin-5i51q5raa`.
  **Runtime env verified from outside**, which is stronger than reading the Vercel dashboard:
  `GET /api/shorts_transcode?sourceKey=472/<24hex>/probe.mp4` → `200`
  `{"state":"unknown","playable":false,"playlistUrl":"https://recordedvideos.hranker.org/..."}`.
  A 500 there would mean the env never loaded (`publicHlsUrlFor` throws outside the try block);
  `state:"unknown"` rather than an error means the deployed credential really did authenticate
  against the mirror bucket and find no `status.json` — not that it failed to reach it.

`dist/` is tracked, so the box needs only `git pull` — no build there. After the rebase, `npx tsc`
produced **no** dist drift (the committed build already matched) and reported only the two known
missing-dep errors from the borrowed `node_modules`. Shorts tests green post-rebase: backend 27/27,
admin lib 140/140.

| Hop | Commit | Note |
|---|---|---|
| 1–3 backend | `f707715b9` | + `dist/` (surgical `tsc`, 16 files — no full rebuild) |
| 4–6 admin | `aa13769` | |
| 7 migration | `6e92f3c` | dry-run by default, **not yet run** |
| 8 brain | this repo | |

Tests: backend 14 new (1450 pass / 28 fail = the same 28 that fail on a clean `origin/quicktricks-admin`);
admin 12 new in `lib/shorts-storage.test.ts` + 6 new contract tests (140 lib tests pass; the 5
`BannedUsersDashboard` vitest failures are pre-existing on the clean base). Typecheck: backend clean,
admin unchanged at 116 pre-existing errors.

### Two deliberate deviations from the hops below

1. **`lib/s3.ts` is not reused; `lib/shorts-storage.ts` is new** (user decision, 2026-09-16). ADR-0006
   decision 3 assumed `lib/s3.ts` was the "proven, untouched public client". In this checkout it is
   not: nothing imports its multipart functions any more, it references an **undefined identifier
   `PDF_BUCKET_REGION`** at three sites (surviving only because `next.config.mjs` sets
   `typescript.ignoreBuildErrors`), one of them inside `createMultipartUpload`'s `catch` — so a real S3
   error there throws a `ReferenceError` that masks it. `CLOUDFLARE_PUBLIC_URL` does not exist anywhere
   in the repo. And its bucket resolves through a 6-key fallback chain shared with PDFs and banners, so
   a missing `upload_bucket` would silently land shorts in the PDF bucket — for a lane selected *by*
   bucket, that is a silently different trust boundary. The new module is fail-closed with five
   single-purpose env vars. `lib/s3.ts` is untouched and still serves PDFs/banners.

2. **`completions` returns no `location`/`url`, on either lane.** Hop 4 below says to restore the old
   public contract so `getUploadLink()` works again. That would be wrong now: the completed object is
   the **source** MP4, and the playable address is the *derived* HLS master. Handing back a source URL
   is how a caller stores the pre-transcode upload as if it were the video — the same class of bug as
   the bare object key. `getUploadLink()` is gone; the dialog reports the staging key instead.

### Env (hop 6 was real work, not a confirmation) — DONE 2026-09-16, all 6 set

`upload_bucket` / `CLOUDFLARE_PUBLIC_URL` turned out not to exist in the admin repo at all. The values
below were read off the listener box (`/root/video-transcoder/.env`, `root@178.63.88.34`), which is the
only authority for them — both traps recorded after this table fired exactly as predicted.

**Set on Vercel production** (project `quicktricks-admin`), 2026-09-16:

| Var | Value |
|---|---|
| `SHORTS_UPLOAD_ENDPOINT` | `https://1ff6f2000c9aa34ca2ec88c066af092a.r2.cloudflarestorage.com` (mirror account id; the box sets no `CF_BACKUP_R2_ENDPOINT` override, so the derived host stands) |
| `SHORTS_UPLOAD_BUCKET` | `tempvideos-hranker` |
| `SHORTS_PUBLIC_BASE_URL` | `https://recordedvideos.hranker.org` — the listener's `CF_HRANKER_CDN_DOMAIN`, **not** the `.com` default |
| `SHORTS_OUTPUT_BUCKET` | `recordedvideos-hranker` (= the listener's `CF_HRANKER_UPLOAD_BUCKET`) |

| `SHORTS_UPLOAD_KEY_ID` / `SHORTS_UPLOAD_KEY_SECRET` | the listener's `CF_BACKUP_ACCESS_KEY_ID` / `CF_BACKUP_SECRET_ACCESS_KEY`, reused (user decision) |

**LMS prod box:** `SHORTS_PUBLIC_BASE_URL` set on `.env.development` (the live file) and restarted —
done by the operator 2026-09-16. Box `hranker@148.113.49.18`, key `~/.ssh/hranker-webserver2-2`; note
the ssh-agent's default `raghavsharma@hranker.com` key is **rejected** by that box, which also breaks
`git ls-remote box` and therefore the commit → push → pull deploy flow until it is loaded.

> **Credential decision + follow-up.** The mirror credential is the listener's own account-wide R2 key,
> not a scoped token. Accepted trade-off: Vercel now holds write on every bucket in the mirror account,
> including the public output bucket, and rotating it means touching the listener and Vercel together.
> Follow-up: replace with a token scoped to Object Read & Write on `tempvideos-hranker` +
> `recordedvideos-hranker`.

**Intake CORS — was missing, fixed 2026-09-16.** The mirror's `tempvideos-hranker` had **no CORS
configuration at all**, so every browser multipart PUT would have been blocked before a byte landed —
the failure `lib/Uploader.ts:23` is written to explain. Applied `PUT` / `AllowedHeaders:*` /
`ExposeHeaders:[ETag]` / 3600s for `admin.quicktricksbysahilsir.com`, `quicktricks.hrankerdesk.online`
and `http://localhost:3000`. Verified by preflight: `OPTIONS` → `204` with
`Access-Control-Allow-Methods: PUT`. The credential was also proven against the bucket
(`head-bucket` → `BucketRegion: APAC`), which is the direct confirmation that trap 1 is cleared.

> **Corrected 2026-09-16 after reading the listener source** (`repos/video-transcoder/src/intake-routing.js`,
> `src/index.ts`, `test/listener-compatibility.test.js`). Two values this slice previously stated
> loosely, and both are load-bearing:
>
> **1. Client 472's public lane is on the MIRROR R2 account, not the primary.** `tempvideos-hranker`
> exists in *both* accounts, each with its own queue. 472 is routed by the queue
> `CF_HRANKER_BACKUP_QUEUE_ID` (`0890629d0e5f42f6b9acee47ee3116cc`), which `assembleCloudflareQueues`
> attaches to the **backup/mirror** account — the source comment says so outright: "isolating client
> 472's storage". Mirror account `1ff6f2000c9aa34ca2ec88c066af092a`; primary is
> `025b7cddaf43305b7f846a9a51c125fb`. So `SHORTS_UPLOAD_ENDPOINT` must be the **mirror** R2 host, and
> the credential must be the mirror's. Writing to the *primary* account's identically-named
> `tempvideos-hranker` is the silent-failure mode: same bucket name, different account, different queue.
>
> **2. `SHORTS_PUBLIC_BASE_URL` is NOT `recordedvideos.hranker.com` — it is `.org`.** *(Settled
> 2026-09-16 by reading the listener box: `CF_HRANKER_CDN_DOMAIN=https://recordedvideos.hranker.org`.)* For lane-3 jobs (472's)
> the CDN is `route.cdnDomain || cloudfrontDomain` (`src/index.ts:204`), and `route.cdnDomain` is the
> deployed listener's **`CF_HRANKER_CDN_DOMAIN`**. `recordedvideos.hranker.com` is only the
> `cloudfrontDomains.default` fallback used when that env is unset — and the repo's own compatibility
> fixture sets it to `https://recordedvideos.hranker**.org**`. **Read the live value off the listener
> box before setting anything.** Guessing wrong gives a `link` that 404s while everything else looks
> healthy.

**Public-host CORS: verified 2026-09-16.** `https://recordedvideos.hranker.org` returns
`access-control-allow-origin: *` (so does `.com`, with `etag` exposed) — hls.js will work outside Safari.
Still unverified: the public **intake** bucket's CORS (`s3_put`, `etag` in `exposeHeaders`, this admin
origin) for the browser multipart PUTs; checking it needs the mirror credential.

## The hops (in order)

1. **quicktricks-backend — the Short record.** `src/models/Short.ts` + `src/schemas/shortSchemas.ts`.
   Add `source: 'youtube' | 'upload'`, `videoAsset: {bucket, key}` (`bucket` = zone alias), and
   `videoStatus: 'processing' | 'ready' | 'failed'` — distinct from the existing `status` publish flag.
   `link` stays optional and stays the YouTube field.

2. **quicktricks-backend — derive `link` on read.** `src/controllers/shortController.ts` — one
   serializer shared by `getShorts`, `getShortById` and the create/update responses: `videoAsset`
   present ⇒ `link = ${SHORTS_PUBLIC_BASE_URL}/${videoAsset.key}`. Every existing client keeps reading
   `link`. This is the hop that keeps a CDN move an env change.

3. **quicktricks-backend — record the video.** `PATCH /api/shorts/:id/video` (admin JWT): the admin
   reports the staging key and the derived output key; the LMS sets `videoAsset`, `source:'upload'`,
   `videoStatus`. Idempotent. Replacing a video deletes the previous HLS directory + staged source.

4. **quicktricks-admin — the lane enum.** `app/api/multipart_uploads/route.ts`,
   `[uploadId]/part_url/route.ts`, `[uploadId]/completions/route.ts`: accept `lane: 'class' | 'shorts'`
   and dispatch to `lib/video-storage.ts` (private, default) or `lib/s3.ts` (public). The public branch
   returns `location`/`url` again — which is the contract `ShortVideoUploadDialog.getUploadLink()` was
   already written against. Never accept a caller-supplied bucket **name**; the lane is an enum.

5. **quicktricks-admin — the dialog.** `components/admin/ShortVideoUploadDialog.tsx` passes
   `lane: 'shorts'`, then polls readiness (`status.json` via the existing `listUploadBucketFiles` /
   `uploads-sse` shape, then `HEAD` on `master.m3u8`) instead of claiming "Completed" when bytes land.
   `ShortsDashboard.tsx:97` stops writing `link` by hand and calls the new PATCH.
   The dialog must say plainly that this upload is **public**.

6. **Env.** Confirm `upload_bucket` (= `tempvideos-hranker`) and `CLOUDFLARE_PUBLIC_URL` are present on
   the admin's Vercel deploy — `lib/s3.ts` reads them through a long `getEnv(...)` fallback chain, so a
   missing value degrades rather than throwing. Confirm `SHORTS_PUBLIC_BASE_URL` on the LMS.

7. **Migration (one-off, operator-run).** Stranded shorts in `tempvideos-recorded-v2`: match
   `Short.link` against `^\d+/[0-9a-f]{24}/` → re-stage into `tempvideos-hranker` so the public lane
   transcodes them → delete the private original. While there: clean up the orphan secure-lane output
   and the failed `stream-status` attempts those uploads generated.

8. **Brain — record the boundary.** `SYSTEM.md` contracts table gains the shorts lane; `GLOSSARY.md`
   gains `videoAsset` and an explicit line that shorts are the one video class *outside* the
   content-protection seam.

## Acceptance

- Upload a short → it shows `processing`, then becomes playable; `link` is a plain
  `https://recordedvideos.hranker.org/…/master.m3u8` that plays in a fresh incognito window with no
  token and no login.
- The upload lands in `tempvideos-hranker`, **not** `tempvideos-recorded-v2`, and the job makes
  **exactly one** LMS call: `POST /api/shorts/transcode-complete`. No `stream-status`, no
  `recordings-prerecorded`, no class-link, no MP4 renditions. The job exits 0, `status.json` says
  `processed`, and client 472's `failed` counter does not move (ADR-0007).
- A short whose dialog was closed mid-transcode still becomes `ready`.
- A class video upload is byte-for-byte unaffected — same bucket, same lane, same `hlsAsset`.
- A YouTube-linked short created before this change is unchanged in the feed response.
- A failed transcode lands `videoStatus:'failed'` **through the callback**, with the container's error
  on the record, and the admin shows it rather than spinning forever. A job that never ran is marked
  `failed` by the 24 h sweeper.
- Replacing a short's video leaves no orphan HLS directory or staged source.
