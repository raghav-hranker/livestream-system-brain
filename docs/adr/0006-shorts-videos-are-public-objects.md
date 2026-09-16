---
status: accepted
---

# Shorts ride the existing public transcode lane

Shorts are promotional / discovery content: short vertical videos meant to be opened, shared and
scraped. They are the one video class in the system that must **not** sit behind the content-protection
seam — no token, no `/playback` mint, no entitlement check.

The system already has exactly this lane. It is the **unsecure/public lane** other clients use every
day. Shorts reuse it as-is rather than getting anything new.

## What is broken today

A shorts upload currently squats in the *secure class* lane, which the admin repo flipped from public
to private underneath it:

- `ShortVideoUploadDialog.tsx` calls the shared `Uploader` with `path = {customerId}/{shortId}` and no
  bucket, so bytes land in the private secure intake bucket (`tempvideos-recorded-v2`).
- That bucket feeds the **secured** lane. `intake-message.js` parses the key as
  `[clientId, roomId, ...filename]`, so every shorts upload spawns a GPU class job whose `roomId` is a
  `shortId`, which transcodes, reports to `PUT /api/classes/{shortId}/stream-status`, and 404s.
- `completions/route.ts` returns only the object key (the private lane has no public URL). The dialog's
  `getUploadLink()` was written against the pre-`8272f73` **public** contract (`location`/`url`), so it
  falls through to the bare key, which is written into `Short.link` and later passed to `window.open()`
  — a string that is not a URL.

So the shorts dialog did not choose the private lane. The lane was flipped out from under it, and the
fix is to give shorts back the lane they were written for.

## The two lanes

| | secure lane (what shorts hit today) | public lane (what shorts should hit) |
|---|---|---|
| intake bucket | `tempvideos-recorded-v2` | `tempvideos-hranker` |
| output bucket | `recordedvideos-hranker-v2` | `recordedvideos-hranker` |
| CDN | signed, token required | `https://recordedvideos.hranker.com`, public |
| report | `stream-status` → `hlsAsset` → `/playback` | `updateClassLinkApi`, a plain public URL |
| admin env | `R2_VIDEO_UPLOAD_*` (`lib/video-storage.ts`) | `upload_bucket` + `CLOUDFLARE_PUBLIC_URL` (`lib/s3.ts`) |

## Decisions

1. **Reuse the public lane; change nothing in video-transcoder.** Securedness is decided **per lane**,
   and the lane is selected by which intake bucket fired the event. An upload to `tempvideos-hranker`
   under the same client id fires the unsecure queue and routes to the public output bucket. **The
   bucket is the discriminator, and it already exists** — no key prefix, no new queue, no `target`
   flag, no new report contract, no new bucket.

2. **The output key is deterministic, so the URL needs no callback.** `container/index.js:417` builds
   `{clientId}/{roomId}/hls/master.m3u8`. The moment the LMS knows the staging key it knows the final
   public URL. Nothing has to be reported back for the URL itself.

3. **The admin signs the upload.** `/api/multipart_uploads` gains an explicit **`lane` enum**
   choosing between the private class intake and the public shorts intake. The browser never receives a
   bucket key in either lane; it receives per-part signed URLs. So admin-signs-vs-LMS-signs is a
   consistency choice, not a security one. `Uploader`'s caller-supplied `bucket?` option is **removed**
   in favour of the lane — a bucket name off the wire is how a private bucket becomes writable by the
   caller's choice.

   **Amended 2026-09-16 (implementation).** This decision originally said to reuse `lib/s3.ts`, "the
   pre-flip public client… untouched and proven on other clients". Reading it during implementation,
   that premise did not hold in this repo: nothing imports its multipart functions any more, it
   references an **undefined identifier `PDF_BUCKET_REGION`** at three sites — surviving only because
   `next.config.mjs` sets `typescript.ignoreBuildErrors`, and one of them sits in
   `createMultipartUpload`'s `catch`, where a real S3 error becomes a `ReferenceError` that hides it —
   `CLOUDFLARE_PUBLIC_URL` appears nowhere in the repo, and its bucket resolves through a **six-key
   fallback chain shared with PDFs and banners**. That last point is the decisive one: on a lane
   selected *by bucket*, a bucket that falls back is a trust boundary that falls back. So the shorts
   lane got its own fail-closed module, `lib/shorts-storage.ts`, modelled on the private
   `lib/video-storage.ts`, with five single-purpose required env vars. `lib/s3.ts` is untouched and
   still serves PDFs and banners. The *shape* of decision 3 — the admin signs, behind a lane enum — is
   unchanged; only "which module" moved.

4. **Readiness comes from `status.json`, confirmed by a `HEAD`.** The container already writes
   `{sourceKey}/status.json` — `{status, timestamp}` — into the *intake* bucket at
   `processing` / `processed` / `failed`, and the admin already reads it (`listUploadBucketFiles`, the
   `uploads-sse` route). **Caveat:** on the HLS path `processed` is written at
   `container/index.js:374`, inside the ffmpeg close handler *after* `resolve()` and *before*
   `uploadHlsDirectory` runs. It therefore means "encoding finished", not "playlist is fetchable". The
   admin confirms with a `HEAD` on `master.m3u8` before marking a short ready. `status.json` supplies
   the `failed` state that a bare `HEAD` cannot distinguish from "not yet".

5. **The record stores an asset; the URL is derived.** `Short.videoAsset = {bucket, key}` where
   `bucket` is a **logical zone alias**, exactly as `pdfAsset` uses `documents`. `link` is computed on
   read from the zone's configured public base. A CDN move is then an env change, not a rewrite of
   every `Short` row — the failure mode `GLOSSARY.md` records for a stale `BUNNY_LIVE_CDN_BASE`.

6. **A short has a video lifecycle.** `videoStatus: processing | ready | failed`, distinct from the
   existing `status` field (publish state, `1` = published). Transcoding is asynchronous, so "uploaded"
   and "playable" are different moments.

7. **YouTube links keep working unchanged.** `source: 'youtube' | 'upload'`. A YouTube short writes
   `link` as today and has no `videoAsset`. Clients keep reading `link` either way and need no change.

8. **The existing rendition ladder is accepted as-is.** `container/index.js:250` scales by height, so a
   1080x1920 vertical source tops out at 405x720. This tested fine on real clips and a shorts-specific
   ladder would affect every other client on the lane. Revisit only if quality complaints appear.

## Considered options

- **A dedicated shorts staging bucket + R2 event notification + Cloudflare Queue + lane — rejected.**
  Everything it would provide already exists on the public lane. The `intakeBucket` guard it would buy
  is redundant when the two lanes are already separate buckets.
- **A reserved key prefix (`shorts-472/...`) on the secure intake bucket — rejected.** Needed only if
  both kinds of upload shared one bucket. They don't.
- **A shorts-aware transcoder callback — rejected for now.** The transcoder picks its callback URL from
  a per-client lookup table, so shorts would have to masquerade as a separate client to get a different
  callback. `status.json` already answers the question with no transcoder change.
- **LMS-owned presigned sessions (the ADR-0005 PDF pattern) — deferred, not rejected.** It would keep
  one upload pattern and one credential location, but it means giving the LMS a bucket credential it
  does not have and rebuilding a lane that already works. Revisit if a second public-upload surface
  appears.
- **Serve the raw uploaded MP4 with no transcode — rejected.** It ships whatever the teacher's phone
  produced: no ABR, arbitrary bitrate, trailing `moov` atom that stalls first-frame on mobile.
- **Keep the bytes private and mint a short-lived URL — rejected.** Shorts are meant to be shareable; a
  token breaks every share, embed and crawler.
- **Store the full public URL in `link` and change nothing else — rejected.** Cheapest today, but it
  bakes the CDN host into every row and makes an origin move a data migration.
- **Return the completed upload's URL from `/completions` and store that — rejected (2026-09-16).**
  This is what the pre-flip public contract did, and restoring it looked like the cheap way to make the
  dialog's `getUploadLink()` work again. But the completed object is the **source** MP4; the playable
  address is the *derived* HLS master the lane produces minutes later. Handing back a source URL is how
  a caller stores the pre-transcode upload as if it were the video — the same class of bug as the bare
  object key this ADR exists to fix, just better disguised. `/completions` now returns no URL on either
  lane, and the dialog reports the staging key instead.

## Consequences

- A shorts URL, once out, is permanent, hotlinkable and scrapeable. The admin surface must say plainly
  that this upload is public, and must not become a convenient place to put a paid recording.
- The **raw source MP4 is publicly fetchable too** — `tempvideos-hranker` is the public lane's intake.
  This is pre-existing behaviour for every client on that lane, not something shorts introduce, but it
  is worth knowing: the teacher's original, not just the renditions, is reachable by anyone with the
  key. If that becomes unacceptable, it is a lane-wide problem, not a shorts problem.
- The public host needs **CORS** for `.m3u8`/`.ts`: hls.js fetches segments by XHR, so a missing
  `Access-Control-Allow-Origin` plays on Safari (native HLS) and fails everywhere else — a failure that
  looks browser-specific rather than like a config problem. Other clients on this lane already play
  from it, so this is a verify step, not expected work.
- The unsecure lane still fires `updateClassLinkApi` → `PUT {base}/classes/{shortId}`, which 404s
  harmlessly. Accepted noise; removing it needs the masquerading-client trick.
- Shorts consume GPU queue capacity alongside class recordings.
- Object lifecycle is the LMS's job: replacing a short's video or deleting the `Short` should delete
  the previous HLS directory and the staged source.
