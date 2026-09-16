# Handoff — public shorts video upload (design agreed 2026-09-16)

> **SUPERSEDED 2026-09-16 — hops 1–8 are implemented and committed (not pushed, not deployed).**
> Read `slices/public-shorts-video.md` → "Status" first: it records the commits, the test results, the
> two deliberate deviations from the plan below, and the env that still has to be set. This file remains
> accurate as *orientation* — why shorts were broken, why the public lane is the answer — but its "where
> to start" and hop 4/6 details have been overtaken.

**Status at the time of writing: design agreed, nothing implemented.** No code in any repo had been touched. The two durable
documents are `docs/adr/0006-shorts-videos-are-public-objects.md` (the decision + rejected options) and
`slices/public-shorts-video.md` (the ordered hops + acceptance). Read both before starting; this file
is the orientation, not the spec.

## The ask, in one line

A video uploaded in the Shorts section must get a **public** link with no `/playback` flow. Course-class
video keeps the private/signed flow exactly as it is.

## The single most important finding

**The public lane already exists and other clients use it daily. Nothing new gets built in
video-transcoder.** Securedness is decided *per lane*, and the lane is selected by which intake bucket
fired the R2 event. So the bucket *is* the discriminator:

| | secure lane (shorts hit this today, wrongly) | public lane (shorts should hit this) |
|---|---|---|
| intake bucket | `tempvideos-recorded-v2` | `tempvideos-hranker` |
| output bucket | `recordedvideos-hranker-v2` | `recordedvideos-hranker` |
| CDN | signed, token required | `https://recordedvideos.hranker.com`, public |
| report | `stream-status` → `hlsAsset` → `/playback` | `updateClassLinkApi`, a plain public URL |
| admin module | `lib/video-storage.ts` (`R2_VIDEO_UPLOAD_*`) | `lib/s3.ts` (`upload_bucket`, `CLOUDFLARE_PUBLIC_URL`) |

Earlier drafts of this design invented a shorts intake bucket, a Cloudflare Queue, an `IntakeQueue`
lane, a `target:'short'` job flag and a new secured report endpoint. **All of that was discarded** once
the existing public lane was found. If a future session finds itself designing new transcoder
plumbing, it has lost the thread.

## Why shorts are broken right now

`ShortVideoUploadDialog.tsx` calls the shared `Uploader` with `path = {customerId}/{shortId}` and no
bucket, so bytes land in the **secure** intake bucket. Two consequences:

1. The secured lane parses the key as `[clientId, roomId, ...filename]` (`src/intake-message.js:45`),
   so every shorts upload spawns a GPU **class** job whose `roomId` is a `shortId`. It transcodes, then
   reports to `PUT /api/classes/{shortId}/stream-status` and 404s. Wasted GPU, every time.
2. The private lane has no public URL, so `completions/route.ts` returns only `{ key }`. The dialog's
   `getUploadLink()` (line 51) was written against the **pre-`8272f73` public contract**
   (`location`/`url`), so it falls through to the bare object key. That key is written into
   `Short.link` (`ShortsDashboard.tsx:97`) and later passed to `window.open()` — a string that is not
   a URL.

The dialog did not choose the private lane. Commits `8272f73` then `b288aa1` flipped the shared
multipart routes from public to private underneath it. This work restores the lane it was written for.

## Agreed decisions (all settled with the user)

1. **Reuse the public lane as-is.** Zero video-transcoder changes.
2. **The admin signs the upload**, reusing `lib/s3.ts` behind an explicit `lane` enum on
   `/api/multipart_uploads`. The user explicitly chose this over LMS-owned presigned sessions after
   seeing that the browser never receives a bucket key either way — it is a consistency choice, not a
   security one, and the public-lane code is already proven. **Do not re-litigate this.** (The
   LMS-owned variant is recorded as deferred in the ADR.)
3. **Readiness comes from `status.json`**, which the user pointed out already exists.
4. **`Short.videoAsset` is stored; `link` is derived on read.** Clients keep reading `link` unchanged.
5. **The existing rendition ladder is accepted.** It scales by height, so a 1080x1920 vertical source
   tops out at 405x720. The user has tested real clips on it and is satisfied. A shorts-specific ladder
   would affect every other client on the lane. Revisit only on quality complaints.
6. **Stranded shorts get migrated** (re-staged into the public lane), not abandoned.

## The `status.json` wrinkle — read this before wiring readiness

`container/utils.js:206` writes `{sourceKey}/status.json` into the **intake** bucket with
`{status, timestamp}`. Lifecycle: `processing` at job start (`container/index.js:475`) → `processed`
→ `failed` on error (`:543`).

**But on the HLS path `processed` is written at `container/index.js:374` — inside the ffmpeg close
handler, after `resolve()` and before `uploadHlsDirectory()` runs.** It means "encoding finished", not
"playlist is fetchable". There is a real (small, segment-upload-sized) window where `status.json` says
`processed` and the master playlist 404s.

So the readiness rule is: **poll `status.json` for the state machine, then confirm with a `HEAD` on
`master.m3u8` before marking a short ready.** `status.json` is what supplies `failed`, which a bare
`HEAD` cannot distinguish from "not transcoded yet". The admin already has the reading half of this:
`listUploadBucketFiles` merges `status.json` into a `processed` flag, and `app/api/multipart_uploads/
uploads-sse/route.ts` streams it on a 5s poll.

## The output key is deterministic — no callback needed for the URL

`container/index.js:417` builds the HLS prefix as `{CLIENT_ID}/{ROOM_ID}/hls`, so the master playlist
always lands at `{clientId}/{shortId}/hls/master.m3u8` and is public at
`https://recordedvideos.hranker.com/{clientId}/{shortId}/hls/master.m3u8`. The LMS knows the final URL
the moment it knows the staging key. Nothing has to be reported back for the URL itself — only
readiness is unknown, and `status.json` answers that.

## Where to start

Hops are ordered in `slices/public-shorts-video.md`. Backend first (hops 1–3: model, serializer,
`PATCH /api/shorts/:id/video`), then admin (hops 4–5: lane enum, dialog), then env (6), migration (7),
brain docs (8).

## Repo / branch traps (these have bitten before)

- Both repos are **deploy forks** on the client team's `quicktricks-admin` branch. They are NOT
  slice-branch-synced and `sync-branches.sh` must not be pointed at them (`repos.manifest`).
- The local `../quicktricks-admin` checkout is a **stale scratch branch**, ahead with nav hacks and far
  behind origin. Land from a worktree off `origin/quicktricks-admin`. The remote moves fast — always
  fetch + rebase + dry-run before pushing.
- Prod for this line is the Hranker box `backend.quicktricksbysahilsir.com`; **test-uday is not prod**.
  Backend flow is commit → push → pull on the box, not deploy-by-patch. `dist/` is tracked by client
  convention.
- Commit as `raghavsharma@hranker.com`, never the personal Gmail — Vercel has blocked a build over the
  author before. No Claude co-author trailers in the client-facing fork repos.

## Open / deferred (not blocking)

- LMS-owned presigned sessions instead of admin-signed — deferred, revisit if a second public-upload
  surface appears.
- The unsecure lane still fires `updateClassLinkApi` → `PUT {base}/classes/{shortId}`, a harmless 404.
  Removing it requires shorts to masquerade as a separate transcoder client; not worth it.
- `tempvideos-hranker` is a **public** intake bucket, so the raw source MP4 is fetchable too, not just
  the renditions. Pre-existing for every client on that lane, not introduced by shorts — but if it ever
  becomes unacceptable it is a lane-wide problem.
- Confirm the public host serves `.m3u8`/`.ts` with CORS: hls.js fetches segments by XHR, so a missing
  `Access-Control-Allow-Origin` plays on Safari and fails everywhere else. Other clients already play
  from this host, so expect this to be a verify step, not work.
