# PRD: Secure PDF Upload — Single and Bulk

## Problem Statement

Admins need to create, replace, and bulk-upload study PDFs without reintroducing the permanent public
URLs that secure PDF delivery was built to eliminate. Today, normal PDF create/update uploads the PDF
to public R2 and stores a required `uploadPdf` URL. The existing bulk workflow creates records from
URLs rather than transferring protected files. It cannot provide trustworthy per-file progress,
partial success, retry, or refresh recovery, and sending a large batch through the current
memory-buffered Node route would risk excessive memory use and request timeouts.

The platform already has a private B2 `documents` zone, exact-file signed reads, entitlement-aware
access endpoints, and sanitized listings. The missing write side must guarantee that every newly
created or replaced PDF enters that secure delivery path immediately, whether an admin uploads one
file or a large batch.

## Solution

Give admins two coordinated secure upload paths. Single create and replacement remain familiar
multipart operations through nodejs-server, which validates the file, stores it in private B2, and
persists a complete `pdfAsset`. Bulk upload uses server-owned upload sessions: the admin dashboard
sends metadata to nodejs-server, obtains a short-lived presigned `PUT` credential for one
server-generated object key at a time, uploads bytes directly to B2 with bounded concurrency, and asks
the server to verify and complete each file independently. The server—not the browser—owns session
state and decides when a PDF record exists.

Both paths return sanitized PDF records, never new permanent file URLs. Successful files become
immediately available through the existing signed Preview/Download flow. Failed files remain
independently retryable, completed files are never repeated, and an admin can reload a bulk session
without losing server-confirmed progress.

## User Stories

1. As an admin, I want to upload a PDF from the create form, so that it is available to assign and preview.
2. As an admin, I want every newly uploaded PDF stored privately, so that creating content never bypasses paid-content protection.
3. As an admin, I want a newly created PDF to show as ready immediately, so that I know the upload and database write both completed.
4. As an admin, I want to preview a newly uploaded PDF through the existing signed-access flow, so that I verify the same protected object students will receive.
5. As an admin, I want to edit PDF metadata without selecting the file again, so that small corrections do not trigger unnecessary uploads.
6. As an admin, I want to replace the file on an existing PDF, so that I can publish a corrected edition without creating a second catalogue item.
7. As an admin replacing a legacy PDF, I want the record to become ready on private storage, so that ordinary editing can finish the migration naturally.
8. As an admin, I want invalid PDF files rejected before a record is published, so that students never receive corrupt or disguised content.
9. As an admin, I want clear validation errors for file type, file size, and metadata, so that I can correct the exact problem.
10. As an admin, I want to select many PDFs for one bulk operation, so that adding a collection does not require repeating the single-file form.
11. As an admin, I want to supply required catalogue metadata for every selected file, so that completed uploads are usable records rather than anonymous objects.
12. As an admin, I want the bulk screen to report aggregate and per-file progress, so that I understand how a large operation is advancing.
13. As an admin, I want only a small number of files uploading concurrently, so that the browser and network remain responsive.
14. As an admin, I want one failed file to leave successful files untouched, so that a large batch does not become all-or-nothing.
15. As an admin, I want to retry only a failed file, so that I do not retransmit completed PDFs.
16. As an admin, I want retries to be idempotent, so that a delayed response or double click cannot create duplicate PDF records.
17. As an admin, I want an expired upload credential refreshed automatically when I retry, so that temporary credentials do not force me to recreate the batch.
18. As an admin, I want to reload an in-progress bulk session, so that a browser refresh does not erase server-confirmed completion state.
19. As an admin, I want completed PDF identifiers returned per file, so that the UI can link to or preview each resulting record.
20. As an admin, I want an explicit final summary of completed, failed, and expired files, so that I can reconcile the batch.
21. As an admin, I want oversized batches rejected before uploading begins, so that I do not spend bandwidth on an operation the server cannot accept.
22. As an admin, I want abandoned sessions to expire predictably, so that stale uploads do not remain indefinitely actionable.
23. As an admin, I want the upload UI to distinguish browser upload, server finalization, and completion, so that a failure message identifies the correct stage.
24. As an admin, I want public cover images to continue loading normally, so that securing PDF bytes does not degrade catalogue presentation.
25. As the business, I want no new PDF record to depend solely on a public `uploadPdf` URL, so that secure delivery cannot regress through authoring tools.
26. As the business, I want the browser unable to choose a bucket or arbitrary object key, so that an admin upload credential cannot target unrelated storage.
27. As the business, I want browser upload credentials limited to one method, one object, and a short time, so that a leaked credential has narrow impact.
28. As the business, I want B2 account credentials to remain server-only, so that frontend code and browser configuration never expose durable storage authority.
29. As the business, I want the backend to verify each direct upload before publishing it, so that a browser claim cannot create a record for a missing or mismatched object.
30. As the business, I want unsigned reads of newly uploaded PDFs to remain forbidden, so that the write path preserves the existing delivery guarantee.
31. As a support engineer, I want per-file error codes and persisted session state, so that interrupted bulk operations can be diagnosed without reconstructing browser state.
32. As an operations engineer, I want abandoned uploaded objects cleaned after a defined retention window, so that incomplete sessions do not create unbounded storage waste.
33. As an operations engineer, I want upload limits and credential lifetimes configurable, so that production tuning does not require a code change.
34. As a developer, I want single and bulk uploads to converge on the same `pdfAsset` contract, so that signed delivery does not care how the object arrived.
35. As a developer, I want B2 key generation, upload, verification, and error normalization behind one storage module, so that controllers and frontend contracts do not absorb provider details.
36. As a developer, I want frontend form types separated from backend read models, so that a multipart `File` is never confused with a permanent URL.
37. As a developer, I want one cross-repository contract governing session states and responses, so that frontend and backend sandbox legs cannot silently diverge.
38. As a future maintainer, I want the direct-to-B2 bulk decision and rejected alternatives recorded, so that the system is not “simplified” back into a giant memory-buffered request.

## Implementation Decisions

- **One cross-repository feature.** The admin dashboard and nodejs-server implement one vertical
  capability governed by this PRD and ADR 0005. Repository-specific work is executed as coordinated
  legs, but a slice is complete only when its user-visible path works end to end.
- **Existing signed reads remain unchanged.** Completed records use the current admin, class, and
  course access mints. Listings continue to expose metadata and derived asset state without a
  fetchable URL or raw storage reference.
- **Storage classification.** PDF bytes are private documents. PDF covers/thumbnails and ordinary
  course banners remain public marketing assets on the existing public path. This feature does not
  move or sign public images.
- **Asset reference invariant.** A ready PDF has a `pdfAsset` whose logical bucket is exactly
  `documents`, key is opaque, MIME type is `application/pdf`, and size is present. SHA-256 is optional;
  if present it is exactly the lowercase 64-hex checksum of the file bytes. Provider names, physical
  bucket names, CDN hosts, URLs, expiry, and entitlement are not persisted in the reference.
- **Legacy URL transition.** `uploadPdf` becomes optional and legacy-only. Existing values remain for
  rollback confidence, but normal create/replacement never populates a new permanent URL. Public and
  admin serializers continue to omit the legacy URL.
- **Single create.** Normal create remains an admin-authenticated multipart request. The existing
  multipart field name `uploadPdf` now means a required PDF file, not a URL. Pasted external URLs are
  not accepted by normal create.
- **Single update.** Metadata-only update sends no file and preserves the current asset. Supplying a
  replacement file stores a new private object and atomically swaps the reference. Replacing a legacy
  record moves it to ready. The previous object is not synchronously deleted because assets may be
  shared; reference-aware garbage collection is separate work.
- **Validation ordering.** The backend validates admin identity, metadata, relationships, declared
  size/type, actual `%PDF-` signature, and limits before publishing a record. A storage object written
  before a failed database write may remain as an orphan for later cleanup; the request must never
  delete an object that another record could reference.
- **Document storage module.** B2 configuration, object-key generation, backend-proxied upload,
  presigning, object inspection, and normalized storage errors live behind a small server-side
  interface. Controllers do not know credentials, physical bucket names, endpoint rules, or signing
  implementation.
- **Bulk uses upload sessions.** Per ADR 0005, bulk metadata goes to nodejs-server and bytes go directly
  from browser to private B2 through presigned S3 `PUT`. Node does not receive one giant multipart
  request and never gives the browser durable B2 credentials.
- **Server-owned identity.** The backend generates every session ID, file ID, object key, and bucket
  selection. The client supplies a stable client-file ID only to reconcile its local selection with
  server state. Bulk v1 uses opaque server-generated keys and does not depend on client-supplied hashes.
- **Short-lived targets.** A target authorizes `PUT` for one server-generated object key and expires
  after 15 minutes. Targets are requested just in time and may be refreshed for an incomplete,
  retryable file. A target is not described as literally single-use because it can technically be
  replayed until expiry; server verification and idempotent completion protect publication.
- **B2 CORS.** The private bucket allows `PUT` from explicitly configured admin-dashboard origins with
  only required headers. It does not become publicly readable or expose list/delete capability to the
  browser.
- **Completion verification is mandatory.** The server loads the session file, verifies state and
  ownership, performs object metadata inspection for key/size/content type, and range-reads the initial
  bytes to require `%PDF-`. Only then may it create the PDF record and persist the resulting PDF ID.
- **Idempotent completion.** Session-file identity is uniquely constrained. Repeating completion after
  success returns the same PDF ID. Concurrent completion attempts cannot create duplicate records.
- **Partial success.** Files finalize independently. A failed file never rolls back or retransmits a
  completed file. Batch completion is a summary, not a transaction spanning every PDF.
- **Server and browser states differ deliberately.** The server persists only facts it can know:
  `pending`, `target_issued`, `completed`, `failed`, or `expired`. Browser-only transient presentation
  states such as `uploading`, `uploaded`, and `finalizing` are derived locally. The server does not
  claim an object is uploaded until completion verifies it.
- **Retry interface.** Retrying a pending or retryable failed file requests a fresh upload target. A
  separate command whose only behavior is “retry” is unnecessary unless implementation uncovers a
  distinct server transition.
- **Persisted session recovery.** Reloading a session returns server-authoritative file metadata,
  state, errors, and completed PDF IDs. The frontend reconciles its local files; it never reconstructs
  completion from browser storage. A partially transmitted plain `PUT` restarts, while completed files
  remain complete.
- **Concurrency.** The browser uploads at most three files concurrently by default. The value may be
  tuned in frontend configuration without changing the server contract.
- **Limits.** Initial server-configurable limits are 100 files per session, 50 MiB per file, and 2 GiB
  total declared bytes per session. Validation rejects the session before issuing upload targets when
  limits are exceeded.
- **Retention.** An incomplete session accepts uploads/finalization for 24 hours. Completed session
  history remains queryable for seven days. A cleanup process expires stale files/sessions and removes
  objects that belong to abandoned sessions and are not referenced by a PDF record.
- **Response safety.** Single and bulk completion return sanitized admin PDF representations and
  operational state, not permanent URLs or B2 credentials. Presigned upload URLs are returned only by
  the upload-target command and are never stored in Mongo, React Query persistence, browser storage,
  analytics, or logs.
- **Legacy bulk deprecation.** The URL-based bulk-create behavior is not extended. It is deprecated and
  removed only after checking for remaining callers; no new frontend uses it.
- **Cross-repository execution.** Sandboxed implementation uses one vertical issue with coordinated
  backend and frontend legs. Both legs share this PRD, ADR 0005, and the secure-upload slice. Neither
  repository half is considered complete without the slice's integrated acceptance scenario.

## Testing Decisions

- A good test asserts externally visible behavior at the highest stable seam: accepted/rejected HTTP
  requests, persisted session/PDF outcomes, generated upload authority, UI-observable progress and
  retry, and signed-read behavior. Tests do not pin internal helper call order or private state.
- **Backend HTTP seam:** exercise single create/update and session commands with injected in-memory
  storage/session adapters. Assert authorization, validation, state transitions, idempotency, limits,
  sanitized responses, and PDF records—not implementation calls.
- **Document-storage seam:** test deterministic object targeting, presigned method/key/TTL restrictions,
  metadata verification, signature-range verification, and normalized provider failures through the
  module interface. A small real-B2 test validates S3 endpoint and CORS assumptions outside ordinary CI.
- **Frontend upload-coordinator seam:** test queueing, concurrency of three, progress, cancellation,
  target refresh, finalization, partial success, retry, and session reconciliation using contract fakes
  for nodejs-server and controllable fake upload requests.
- **Shared contract seam:** both repositories test the same request/response examples and state/error
  vocabulary from the governing task. Contract drift must fail one of the coordinated legs before
  merge.
- **Signed-delivery regression seam:** existing signer golden vectors, access-module tests, controller
  tests, and serializer leak tests continue to prove that ready records mint correctly and listings
  contain no fetchable URL/key.
- **Browser/live seam:** run narrow acceptance against the test nodejs-server, test Mongo, private B2,
  Bunny documents zone, and admin dashboard after each major tracer: secure single create, one-file
  bulk, multi-file partial success, and expiry/cleanup.
- Single-create tests cover valid PDF, missing file, spoofed MIME/signature, oversized file, invalid
  relationships, storage failure, database failure, and sanitized success.
- Update tests cover metadata-only preservation, ready replacement, legacy-to-ready replacement,
  concurrent update behavior, and the invariant that the previous object is not blindly deleted.
- Session tests cover creation limits, admin ownership, target refresh, wrong state, wrong/missing/size-
  mismatched object, invalid signature, concurrent/repeated completion, partial success, expiry, and
  cleanup of only unreferenced abandoned objects.
- Frontend tests cover no dependency on `uploadPdf: string`, per-file stage/error presentation, bounded
  concurrency, refresh recovery, and absence of presigned URLs from persistent state/logging.
- Prior art on the backend is the existing injected-dependency PDF access module, signer golden-vector
  suite, thin-controller tests, admin-gate tests, and reusable serializer leakage assertions. Prior art
  on the frontend is the existing authenticated React Query hook pattern and long-running APX migration
  progress UI; extend established test conventions rather than creating implementation-coupled suites.

## Out of Scope

- Changes to class/course/admin signed PDF access, entitlement, exact-file Bunny signing, or URL TTL.
- Moving, protecting, or redesigning PDF covers, thumbnails, or course banners; they remain public
  presentation assets.
- Deciding whether the legacy `courseBanner` field belongs on the PDF model.
- Accepting pasted external PDF URLs. A future URL-import feature requires separate SSRF-protected
  server-side ingestion.
- Content-hash deduplication for bulk v1, visual duplicate detection, or assuming an object key is a
  checksum.
- Immediate deletion of replaced/shared PDF objects or the full reference-aware asset garbage
  collector beyond abandoned-session cleanup.
- Removing legacy `uploadPdf` values or deleting public R2 originals before rollback confidence.
- Changing admin forced-download semantics or adding CDN Content-Disposition signing.
- Watermarking, DRM, malware scanning beyond PDF type/signature validation, or content moderation.
- Merging the APX/product branch or deploying production branches unless separately authorized.

## Further Notes

- Governing architecture decision: `docs/adr/0005-bulk-pdf-uploads-use-presigned-put.md`.
- Cross-repository wiring map and failure cheatsheet: `slices/secure-pdf-upload.md`. The slice should be
  aligned with this PRD before issue generation: use per-repository base branches, the implemented
  `/api/admin/pdfs/:pdfId/access` route, “short-lived single-object” rather than “single-use” upload
  credentials, mandatory direct-upload signature verification, and the simplified server state model.
- Existing secure-delivery rationale remains in the nodejs-server secure PDF PRD and documents-zone ADR;
  this PRD extends only the write side.
- Issue generation should produce thin cross-repository tracer bullets, each with coordinated backend
  and frontend sandbox legs plus an integrated acceptance gate. Start with secure single create, then
  replacement, one-file bulk, multi-file partial success, retry/idempotency, refresh recovery, and
  expiry/cleanup.
