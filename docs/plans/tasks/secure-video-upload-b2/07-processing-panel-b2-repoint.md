# Repoint the processing-state read path to B2

**Type**: AFK
**Blocked by**: — (follow-up found during #6's bulk E2E)
**Repo**: admin-dashboard (`launch/quicktricks-v2`)

## The defect

Task 02 swapped the upload **write** path to B2 (`lib/b2.ts`, `B2_VIDEO_UPLOAD_BUCKET =
tempvideos-recorded-v2`), but the processing-state **read** path was never repointed:

- `GET /api/uploads` (polled every 5 s by `useProcessingVideos` / the bulk sheet's
  `ProcessingVideos` panel) calls `listUploadBucketFiles` in `lib/s3.ts`.
- That module resolves its bucket from the old `UPLOAD_BUCKET`-family envs
  (`lib/s3.ts:81`), which still point at **`tempvideos-selectionway`** — the previous
  tenant's AWS-era bucket — with the old S3 client/credentials.
- Result: the endpoint always returns `[]` for customer 472. Per-file `processing` /
  `failed` states written to `status.json` in `tempvideos-recorded-v2` are invisible in
  the dashboard once the sheet's own in-flight progress is done. A failed transcode
  (e.g. the corrupt-file tracer from task 06) is silently absent rather than shown failed.

`deleteUploadBucketFile` (same module, used by the panel's dismiss action) has the same
wrong-bucket problem.

## What to build

Repoint the read path to the B2 intake bucket with the `lib/b2.ts` client/credentials —
list `472/{classId}/{file}/status.json` objects and map them to the panel's shape. Keep
the response contract identical so `useProcessingVideos` is untouched. Respect the
status.json semantics from task 04's notes (24 h skip guard lives listener-side, not
here). Delete/dismiss must target the same bucket.

## Acceptance criteria

- [ ] `GET /api/uploads?customerId=472` lists in-flight and failed uploads from
      `tempvideos-recorded-v2` status.json objects
- [ ] A failed transcode (truncated-MP4 tracer) shows as failed in the bulk sheet's
      ProcessingVideos panel without a manual refresh
- [ ] Dismiss removes the status object from the B2 bucket
- [ ] No reference to the `UPLOAD_BUCKET`/`tempvideos-selectionway` path remains in the
      uploads API route's call chain
