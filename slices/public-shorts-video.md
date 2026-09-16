# Slice: Public shorts video

**Goal:** a video uploaded in the Shorts section rides the existing **public/unsecure** transcode lane
and is served from `https://recordedvideos.hranker.com` with no token and no `/playback` mint. Course
classes keep the secure lane untouched.

**Why it's a slice:** it crosses the admin ⇄ LMS boundary (a new upload lane and a new Short shape) and
it *removes* an accidental crossing into the secure transcoder lane. **video-transcoder itself is not
edited** — the lane it needs already exists and other clients use it daily.

**Governing doc:** `docs/adr/0006-shorts-videos-are-public-objects.md`.

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
  → tempvideos-hranker                           ← the PUBLIC intake bucket
  → unsecure lane (existing, unchanged)
  → GPU 1A → recordedvideos-hranker/{customerId}/{shortId}/hls/master.m3u8
  → (updateClassLinkApi 404s on a shortId — accepted noise)

readiness: poll {sourceKey}/status.json in tempvideos-hranker
           processing → processed → HEAD master.m3u8 → ready
                      → failed   → videoStatus 'failed'

read: GET /api/shorts → link = ${SHORTS_PUBLIC_BASE_URL}/${videoAsset.key}
      → public CDN, no token, relative segments resolve on the same host
```

## Status — hops 1–8 implemented 2026-09-16 (not deployed)

Branch `feat/public-shorts-video` in both forks, off `origin/quicktricks-admin`, in worktrees
`../worktrees/qt-backend-shorts` and `../worktrees/qt-admin-shorts`. **Committed, not pushed.**

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

### Env still to set before this works (hop 6 is real work, not a confirmation)

`upload_bucket` / `CLOUDFLARE_PUBLIC_URL` turned out not to exist in the admin repo at all. What the
code now reads, none of it currently set anywhere:

- **admin (Vercel):** `SHORTS_UPLOAD_ENDPOINT`, `SHORTS_UPLOAD_BUCKET=tempvideos-hranker`,
  `SHORTS_UPLOAD_KEY_ID`, `SHORTS_UPLOAD_KEY_SECRET`, `SHORTS_PUBLIC_BASE_URL`,
  optional `SHORTS_OUTPUT_BUCKET=recordedvideos-hranker`
- **LMS (prod box):** `SHORTS_PUBLIC_BASE_URL` — **must match the admin's**, or the admin marks a short
  `ready` that the app cannot fetch

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
> **2. `SHORTS_PUBLIC_BASE_URL` is NOT reliably `recordedvideos.hranker.com`.** For lane-3 jobs (472's)
> the CDN is `route.cdnDomain || cloudfrontDomain` (`src/index.ts:204`), and `route.cdnDomain` is the
> deployed listener's **`CF_HRANKER_CDN_DOMAIN`**. `recordedvideos.hranker.com` is only the
> `cloudfrontDomains.default` fallback used when that env is unset — and the repo's own compatibility
> fixture sets it to `https://recordedvideos.hranker**.org**`. **Read the live value off the listener
> box before setting anything.** Guessing wrong gives a `link` that 404s while everything else looks
> healthy.

Also still unverified: the public intake bucket needs **CORS** (`s3_put`, `etag` in `exposeHeaders`,
this admin origin) for the browser multipart PUTs, and the public host needs
`Access-Control-Allow-Origin` on `.m3u8`/`.ts` — without it hls.js fails everywhere except Safari.

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
  `https://recordedvideos.hranker.com/…/master.m3u8` that plays in a fresh incognito window with no
  token and no login.
- The upload lands in `tempvideos-hranker`, **not** `tempvideos-recorded-v2`, and makes no
  `stream-status` call.
- A class video upload is byte-for-byte unaffected — same bucket, same lane, same `hlsAsset`.
- A YouTube-linked short created before this change is unchanged in the feed response.
- A failed transcode lands `videoStatus:'failed'` and the admin says so rather than spinning forever.
- Replacing a short's video leaves no orphan HLS directory or staged source.
