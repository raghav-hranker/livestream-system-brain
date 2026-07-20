# Slice: Secure PDF upload (single + bulk)

**Goal:** every newly created/replaced PDF lands in the private B2 `documents` zone as `Pdf.pdfAsset`,
readable only via the signed `/access` routes; bulk upload works browser → B2 direct (presigned `PUT`),
never as one giant multipart request through Node.

**Why it's a slice:** it crosses the admin-dashboard ⇄ nodejs-server boundary twice — the single-create
multipart contract (field `uploadPdf` keeps its *name* but stops meaning a public URL) and the new
upload-session API. The subtlety that bites: the browser is **never** the source of truth — the server
generates every key, verifies every completion, and never hands out credentials, only **short-lived,
single-object** presigned `PUT`s (not literally single-use: replayable until expiry; idempotent verified
completion is what protects publication). The signed-*read* architecture (ADR 0002, read PRD) is already
done — upload work must not touch it.

**Governing docs:** `docs/plans/prd-secure-pdf-upload.md` (this feature's PRD — full decisions, user
stories, testing seams) + `docs/adr/0005-bulk-pdf-uploads-use-presigned-put.md` (the direct-to-B2
decision and rejected alternatives). Vocabulary: `GLOSSARY.md` (`pdfAsset`, `documents` zone, PDF upload
session). Wiring: `SYSTEM.md` → PDF arc. Read-side rationale:
`repos/nodejs-server/docs/plans/prd-secure-pdf-delivery.md` + `docs/adr/0002-documents-zone-and-exact-file-tokens.md`.

**Base branches (per repo):** nodejs-server `launch/quicktricks-v2` · admin-dashboard
`launch/quicktricks-v2` (its worktree carries unrelated APX changes — preserve them). Issues run as
coordinated backend + frontend legs off these bases; a slice is done only when the integrated
acceptance scenario passes end to end.

## The hops (in order)

### Single create / replace
1. **admin-dashboard — submit the file.** `components/admin/PdfForm.tsx` + `hooks/api/use-pdfs.ts` +
   `types/pdf.ts`. Keep multipart field `uploadPdf: File`; split write/form types from catalogue/read types
   (responses no longer carry `uploadPdf: string`); drop the URL-decoding follow-up mutation; metadata-only
   edit sends no file.
2. **nodejs-server — store privately, persist `pdfAsset`.** `POST /api/pdfs` / `PUT /api/pdfs/:id`
   (admin JWT). Order: require admin → validate metadata → validate file (size, MIME, `%PDF-` signature —
   browser MIME alone is untrustworthy) → `storePdf()` (deep storage module owning B2 client, key
   generation, normalized errors) → write record with `pdfAsset`, **no new `uploadPdf` URL**. Replacement
   swaps `pdfAsset` atomically and never synchronously deletes the old object (objects may be shared;
   cleanup is reference-aware GC later). DB-write failure after upload leaves an orphan for GC — safer
   than deleting.
3. **nodejs-server — serve.** Existing signed access routes mint from `pdfAsset` — unchanged by this
   slice: `GET /api/admin/pdfs/:pdfId/access` (admin) · `GET /api/courses/:courseId/pdfs/:pdfId/access` ·
   `GET /api/classes/:classId/pdfs/:pdfId/access` (entitled viewer).
4. **admin-dashboard — render.** Show derived `state` from the sanitized response; refetch the catalogue.

### Bulk (upload sessions)
1. **admin-dashboard — create a session with metadata, not bytes.** Replace the URL-based
   `BulkUploadPdfsSheet` / `app/api/pdfs/bulk-create/route.ts` flow (deprecate; don't extend).
2. **nodejs-server — control plane.** Session model/routes: validate metadata + limits, generate every
   `sessionId`/`fileId`/object key server-side, issue short-TTL presigned B2 `PUT`s just in time.
3. **admin-dashboard — upload direct to B2.** `PUT` per file (XHR for progress/cancel), bounded
   concurrency (start at 3), per-file retry only, presigned URLs never logged/persisted.
4. **nodejs-server — verified idempotent completion.** `HeadObject` the server-generated key, check size +
   content type, **and range-read the initial bytes to require `%PDF-` (mandatory, not optional)** — only
   then create the `Pdf` with `pdfAsset` and store `pdfId` on the session file. Repeat completion returns
   the same `pdfId`. Partial success is preserved.
5. **admin-dashboard — resume.** Session state is server-persisted, so refresh reloads progress.

## The contract that must stay in sync

Persisted asset (Mongoose must enforce the same invariants):

```ts
interface PdfAssetRef {
  bucket: 'documents'            // literal zone alias — NOT the physical bucket, NOT a union
  key: string                    // opaque, server-generated; never infer hashes from migrated keys
  mimeType: 'application/pdf'
  sizeBytes: number              // required whenever pdfAsset exists
  sha256?: string                // 64 lowercase hex, checksum of file bytes only; optional (bulk v1 omits)
}
uploadPdf?: string               // legacy-only; kept for rollback, never populated for new uploads
```

Never persist provider, physical bucket name, CDN host, signed URL, expiry, or entitlement in `pdfAsset`.
`state` stays derived from asset existence.

Session API (names adjustable **once, before either side implements**; behavior is fixed):

```http
POST /api/admin/pdf-upload-sessions                                  # metadata only (CreatePdfUploadSessionInput)
GET  /api/admin/pdf-upload-sessions/:sessionId
POST /api/admin/pdf-upload-sessions/:sessionId/files/:fileId/upload-target   # returns/refreshes presigned PUT
POST /api/admin/pdf-upload-sessions/:sessionId/files/:fileId/complete        # idempotent
```

There is **no separate retry command**: retrying a pending or retryable-failed file just requests a fresh
`upload-target` (which also covers expired credentials).

Per-file **server** state records only facts the server can verify:

```ts
type UploadFileState = 'pending' | 'target_issued' | 'completed' | 'failed' | 'expired'
// session file: { fileId, clientFileId, objectKey, expectedSizeBytes, metadata, state, pdfId?, errorCode? }
```

`uploading` / `uploaded` / `finalizing` are **browser-derived presentation states only** — the server
never claims an object is uploaded until completion verifies it.

Settled operational values (server-configurable, per the PRD): presigned `PUT` TTL **15 min**, requested
just in time; limits **100 files / 50 MiB per file / 2 GiB declared total** per session, rejected before
any target is issued; incomplete sessions accept work for **24 h**, completed history queryable **7 days**,
then cleanup removes abandoned objects not referenced by any PDF record.

Do not store presigned URLs server-side. Unique constraint on session + file identity. B2 CORS scoped to
the real admin origins, `PUT`, required headers only. No B2 secrets in `NEXT_PUBLIC_*`, ever.

**Out of scope here:** covers/thumbnails/banners stay on public R2 (they're public marketing assets);
`Pdf.courseBanner` cleanup is a separate decision; no URL-import path (would need SSRF-protected
server-side ingestion).

## Decision status
The formerly open decisions are now settled in `docs/plans/prd-secure-pdf-upload.md`: limits
(100 / 50 MiB / 2 GiB) and retention (24 h / 7 days) as above; `Pdf.courseBanner` removal and
content-hash dedup are explicitly **out of scope** (dedup, if ever added, must never trust a
browser-supplied hash). Don't reopen these silently — amend the PRD/ADR first.

## End-to-end test
1. Single create with a real PDF → B2 object exists in `hranker-private-assets`; Mongo has
   `pdfAsset.bucket === 'documents'`; **no** new `uploadPdf` URL.
2. Unsigned Bunny fetch of the object → 403. Admin `GET /api/admin/pdfs/:pdfId/access` → 200 signed URL
   that fetches.
3. Metadata-only edit → asset untouched. Replacement on a legacy record → moves to `ready`.
4. Mixed bulk batch (valid + invalid + interrupted + duplicate-retry): failures don't restart successes,
   retry is per-file, refresh resumes, every completed record Previews via the existing admin signer.
5. Non-PDF / spoofed-MIME / oversized files fail **before** record creation; completion of a
   missing/wrong-size object is rejected; repeated complete doesn't duplicate records.
6. Public serializers still leak no URL/key.

## Failure-surface cheatsheet
- **Signed access 200 but new upload unreadable** → hop 2 wrote the wrong zone/key shape — check
  `pdfAsset.bucket` is the literal `documents`, not a physical bucket name.
- **Browser `PUT` to B2 fails with CORS** → B2 CORS rules don't cover the admin origin/`PUT`/headers.
- **`PUT` 403 from B2** → presigned URL expired before use — the frontend is pre-fetching targets instead
  of requesting them just in time; refresh via `upload-target`.
- **Complete rejected** → object missing or size mismatch at the server-generated key — browser claimed
  success the server can't verify; that rejection is the contract working, not a bug.
- **Duplicate PDF records from one file** → completion idempotency broken — check the session+file unique
  constraint before blaming the frontend retry loop.
- **New records still carry `uploadPdf` URLs** → hop 2 regression; that field is legacy read-only.
- **Every B2 upload from a deployed box dies ETIMEDOUT while `curl` to the S3 endpoint works** →
  Node ≥20 happy-eyeballs gives each connect attempt 250ms; the B2 us-east handshake takes ~290ms
  from India. Fixed in the document-storage client (`autoSelectFamilyAttemptTimeout: 5000`); any
  *other* Node process talking to B2 needs the same agent option.
- **Read-side mint breaks after a phonetics redeploy** (`BUNNY_DOCUMENTS_*` gone) → the deploy script
  regenerates `.env.production` from `~/nodejs-server/.env` + `~/.quicktricks-lms-secrets`; vars added
  only to the generated file are wiped. Persist box-specific env in `~/.quicktricks-lms-secrets`.
