# B2 multipart tracer spike

**Type**: HITL
**Blocked by**: None — can run parallel to #2

## What to build

A thin, disposable proof that the slice's riskiest assumption holds: a browser can drive a
**multi-part** S3 upload directly against the private `tempvideos-recorded-v2` bucket using
per-part presigned URLs, and the resulting object-created event reaches the transcoder
listener. The PDF spike (secure-pdf-upload #03) proved single-object PUT only — multipart
adds the one thing that spike never exercised: the uploader must **read each part's `ETag`
response header cross-origin** to complete the upload, so the CORS rule must expose it.

Steps, in order:

1. Mint the key per the settled scheme: `admin-tempvideos-recorded-v2-video-upload-<env>`,
   scoped to `tempvideos-recorded-v2`, capabilities `listFiles,readFiles,writeFiles` — no
   delete, no key/bucket management.
2. Set the bucket CORS rule for the explicitly-listed admin origins: `PUT` (parts) + the
   completion `POST`, required headers only, **`ETag` in exposed headers**. No `*`.
3. Wire B2 event notifications on the bucket → the listener's `POST /b2/webhook` for the
   target env; confirm the listener's webhook server is running (it only starts when B2
   creds are configured on the listener box).
4. Hand-drive one real MP4 through create → part PUTs (from a browser context, so CORS is
   actually exercised) → complete, keyed `472/<testClassId>/<file>.mp4`.
5. Watch the listener log receive the event and parse `clientId 472 / roomId <testClassId>`.
   (Secured routing itself is task #04 — here the event arriving is enough.)

## Acceptance criteria

- [ ] Key minted per scheme; key ID (not secret) recorded here; no delete capability
- [ ] CORS rule documented here verbatim, `ETag` exposed and read successfully by a browser part PUT
- [ ] Multipart complete succeeds from the browser context; object visible via `HeadObject`
- [ ] Unsigned/direct fetch of the uploaded object fails (bucket stays private)
- [ ] Listener `/b2/webhook` logs the object-created event with the expected key parse
- [ ] Recipe + quirks recorded here for #02/#03 to consume (endpoint, region, event-type strings seen)

## User stories covered

- Story 8: raw sources land in a private bucket
- Story 11: upload credential scoped to one bucket, no delete
- Story 16: webhook-auth deferral risk is visible (event arrives unauthenticated — note what the listener logs)

## Execution notes — 2026-07-21 (spike complete: all criteria verified)

All infra driven via the native B2 API from test-uday (account key never left that box), same
workflow as pdf-upload task 03. Bucket `tempvideos-recorded-v2` = bucketId
`32fbc3ec2d8e6d4e9be60819`, `allPrivate`, endpoint `s3.us-east-005.backblazeb2.com`, region
`us-east-005`.

**Key minted:** `admin-tempvideos-recorded-v2-video-upload` (no env suffix, per the 2026-07-20
one-key decision), keyId `0052b3cdedeb6890000000006`, scoped to `tempvideos-recorded-v2`, caps
`listFiles,readFiles,writeFiles` — no delete, no key/bucket management. Secret lives at
`test-uday:~/b2-vidup-key.json` (0600) until task 04/05 installs it into the admin-dashboard
server env; never committed anywhere.

**CORS rule applied** (bucket had no pre-existing rules; origin decision: `http://localhost:3000`
only, prod origin added at prod-deploy time like the PDF rule):

```json
[{
  "corsRuleName": "adminDashboardVideoPartPut",
  "allowedOrigins": ["http://localhost:3000"],
  "allowedOperations": ["s3_put"],
  "allowedHeaders": ["content-type"],
  "exposeHeaders": ["etag"],
  "maxAgeSeconds": 3600
}]
```

Only `s3_put` is needed: in the production Uploader flow, create/part-url/complete all go through
the app's `/api/multipart_uploads` routes server-side — the browser only PUTs part bytes to the
presigned URLs and reads each response's `ETag`.

**THE make-or-break finding — event notification rule did not cover multipart.** The bucket's
pre-existing rule `video-upload-b2-secure` (→ `https://b2-event.multistreaming.site/b2/webhook`)
only listed `b2:ObjectCreated:Upload` + `:Copy`. B2 emits a **distinct event type** for
multipart-completed objects: `b2:ObjectCreated:MultipartUpload`. Without adding it, multipart
uploads land silently and never reach the listener. Added via `b2_set_bucket_notification_rules`;
the spike event then arrived with `matchedRuleName: video-upload-b2-secure`,
`eventType: b2:ObjectCreated:MultipartUpload`. **Task 04 checklist: any new bucket/env must
include this event type.**

**Hand-driven run (2 parts: 5 MiB + 1.85 MiB, real 7,179,141-byte MP4):**

- CreateMultipartUpload + UploadPart presigning (15-min TTL) via `@aws-sdk/client-s3` +
  `@aws-sdk/s3-request-presigner` with the restricted key — same libs the routes use.
- Browser leg (Chrome page on `localhost:3000`): both part `PUT`s → **200 + readable `ETag`**
  (`xhr.getResponseHeader("ETag")` returned the quoted MD5s cross-origin); 42 XHR
  upload-progress events fired.
- CompleteMultipartUpload (server-side) → aggregate ETag `"…-2"`; `HeadObject` → 7,179,141
  bytes, `video/mp4`.
- Unsigned GET of the object → **401** on both `s3.us-east-005.backblazeb2.com` and
  `f005.backblazeb2.com/file/...`; bucket stays private.
- Listener log (`b2-video-listener` pm2 app on the transcoder box, root@178.63.88.34): raw
  payload logged, parsed `clientId: 472, roomId: UPLOADCHECK-vid-spike`, submitted
  `job-1784629341862-472-UPLOADCHECK-vid-spike`. 472 is not yet in `SECURED_B2_CLIENTS`, so the
  job ran under **default/unsecured routing** (expected until task 04) — the container processed
  the file and its `status.json` writes echoed back through the webhook (49→48→45-byte
  transitions), each correctly skipped by the status-file guard. So the whole intake→GPU arc is
  live for multipart objects.

**Quirks recorded for #02/#03:**

1. `b2:ObjectCreated:MultipartUpload` is its own event type (above) — the listener code's
   `startsWith('b2:ObjectCreated')` handles it, but bucket rules must list it explicitly.
2. Presigned part PUTs inherit the PDF-spike recipe: use `@aws-sdk/s3-request-presigner`
   (UNSIGNED-PAYLOAD hoisted into the query); do not hand-roll SigV4.
3. `content-type` stays unsigned but the browser sends it on part PUTs — keep it in
   `allowedHeaders`. Only `etag` needs exposing.
4. Webhook auth deferral (ADR 0004) confirmed live: the notification rule has
   `hmacSha256SigningSecret: null` and the listener accepts any POST — the event arrived
   unauthenticated.
5. Spike object left at `472/UPLOADCHECK-vid-spike/UPLOADCHECK-spike.mp4` (+ its
   `status.json`); the upload key has no delete capability, by design.
