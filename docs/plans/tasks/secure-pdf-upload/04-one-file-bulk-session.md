# One-file bulk happy path (session control plane)

**Type**: AFK
**Blocked by**: #1 — Secure single create · #3 — B2 presigned PUT + CORS spike

## What to build

The upload-session control plane, proven by one file traveling browser → B2 → verified `Pdf` record.
nodejs-server owns the session: `POST /api/admin/pdf-upload-sessions` (metadata only, per-file
`clientFileId` for reconciliation), `GET .../:sessionId`,
`POST .../:sessionId/files/:fileId/upload-target` (mints a fresh 15-minute single-object presigned
`PUT`, just in time), and `POST .../:sessionId/files/:fileId/complete`. The server generates every
`sessionId`, `fileId`, and object key; server file states are only verifiable facts
(`pending → target_issued → completed / failed / expired`). Completion is **mandatory-verified**:
load session file, check state/ownership, `HeadObject` the server-generated key (size + content type),
range-read the initial bytes to require `%PDF-` — only then create the `Pdf` with `pdfAsset` (via the
same contract as single create) and persist `pdfId` on the session file.

admin-dashboard gets the new bulk sheet (replacing — not extending — the URL-based
`BulkUploadPdfsSheet` / `app/api/pdfs/bulk-create/route.ts` flow) driving one file end to end: create
session → request target → XHR `PUT` to B2 → complete → link/preview the resulting record. Browser-only
states (`uploading`/`uploaded`/`finalizing`) are derived locally. Presigned URLs are never stored in
Mongo, React Query persistence, browser storage, analytics, or logs.

Contract names and shapes are pinned in this slice, once, before either leg implements — per
`slices/secure-pdf-upload.md`, behavior is already fixed.

## Acceptance criteria

- [ ] Session create validates metadata and admin ownership; server generates all IDs and object keys; browser can neither choose a bucket nor a key
- [ ] `upload-target` returns a presigned `PUT` scoped to one server-generated key with 15-minute TTL, requested just in time
- [ ] One-file happy path end to end: browser `PUT` direct to B2 (bytes never transit Node) → `complete` verifies `HeadObject` size/content-type **and** `%PDF-` range-read → `Pdf` created with valid `pdfAsset` → `pdfId` persisted on the session file
- [ ] Completion of a missing, wrong-size, or non-`%PDF-` object is rejected and the file is marked `failed` with an error code — no record created
- [ ] Completed record Previews via the existing admin `/access` mint; sanitized responses only
- [ ] Both repos test the same request/response examples and state/error vocabulary (shared-contract seam); drift fails a leg before merge
- [ ] Backend session tests use injected storage/session adapters; frontend coordinator tests use contract fakes

## User stories covered

- Story 10: select many PDFs for one bulk operation (session accepts the batch shape)
- Story 11: required catalogue metadata for every selected file
- Story 19: completed PDF identifiers returned per file
- Story 23: UI distinguishes browser upload, server finalization, completion
- Story 26: browser cannot target unrelated storage
- Story 27: narrow, short-lived upload credentials
- Story 28: B2 credentials server-only
- Story 29: backend verifies each direct upload before publishing
- Story 37: one cross-repository contract governing states and responses
