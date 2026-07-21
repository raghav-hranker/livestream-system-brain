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
