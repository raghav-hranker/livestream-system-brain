# Secure single create, end to end

**Type**: AFK
**Blocked by**: None — can start immediately

## What to build

An admin uploads a PDF from the create form and it lands in the private B2 `documents` zone, never on
public R2. `components/admin/PdfForm.tsx` submits multipart with `uploadPdf: File` (the field keeps its
name but stops meaning a URL) → `POST /api/pdfs` validates in order (admin JWT → metadata/relationships →
declared size/MIME → actual `%PDF-` signature) → a new server-side document-storage module (B2 client,
server-generated opaque key, backend-proxied upload, normalized storage errors) stores the bytes → the
record is persisted with a complete `pdfAsset` (`bucket:'documents'`, opaque `key`,
`mimeType:'application/pdf'`, `sizeBytes`) and **no new `uploadPdf` URL**. The dashboard renders the
derived `state` from the sanitized response and the new PDF Previews via the existing admin
`GET /api/admin/pdfs/:pdfId/access` mint — the signed-read side is untouched.

This slice also lands the frontend write/read type split (`types/pdf.ts`): form/write types carry a
`File`, catalogue/read types never carry `uploadPdf: string`; the URL-decoding follow-up mutation in
`hooks/api/use-pdfs.ts` is dropped.

Legs: nodejs-server (storage module + create route) + admin-dashboard (form, hooks, types), off the
per-repo base branches in `slices/secure-pdf-upload.md`. Done only when the integrated scenario passes.

## Acceptance criteria

- [ ] Valid create: B2 object exists in `hranker-private-assets`; Mongo record has `pdfAsset.bucket === 'documents'`, opaque key, correct `sizeBytes`; no new `uploadPdf` URL
- [ ] Unsigned Bunny fetch of the new object → 403; admin `/access` mint → 200 signed URL that fetches the bytes
- [ ] Missing file, spoofed MIME/signature (non-`%PDF-` bytes), oversized file, and invalid relationships are rejected **before** any record is published, with clear per-cause validation errors
- [ ] Storage failure and DB-write failure paths: no record published; an orphaned object may remain (never deleted synchronously)
- [ ] Sanitized response only — no permanent URL, key, or provider detail; public/admin serializer leak tests still pass
- [ ] Frontend read types have no `uploadPdf: string` dependency; dashboard shows derived `state` and refetches the catalogue
- [ ] Backend HTTP-seam tests use injected in-memory storage adapter; storage-module seam tests cover key generation, verification, and normalized provider failures

## User stories covered

- Story 1: upload a PDF from the create form
- Story 2: every newly uploaded PDF stored privately
- Story 3: newly created PDF shows as ready immediately
- Story 4: preview through the existing signed-access flow
- Story 8: invalid PDF files rejected before a record is published
- Story 9: clear validation errors for type, size, metadata
- Story 24: public cover images continue loading normally
- Story 25: no new PDF record depends solely on a public `uploadPdf` URL
- Story 28: B2 account credentials remain server-only
- Story 30: unsigned reads of newly uploaded PDFs remain forbidden
- Story 34: single and bulk converge on the same `pdfAsset` contract
- Story 35: storage details behind one document-storage module
- Story 36: frontend form types separated from backend read models
## Execution notes — 2026-07-20

Merged in both repos (nodejs-server merge `5734c53a` + follow-ups `bc8ec52d`, `7476308c`;
admin-dashboard `95f2594` + `ec94094`). Verification so far:

- Code review of the nodejs-server diff (`94c206d3..`): **safe to build on** — no credential leaks
  (keys never logged/serialized; provider failures normalized detail-free and test-pinned), contract
  faithful (`pdfAsset.bucket` is the logical `documents` alias, asserted ≠ physical bucket; no
  fetchable URL in the 201 response or persisted doc), failure ordering per PRD (storage failure ⇒
  502 + **no record inserted**; DB failure after PUT ⇒ documented orphan). No commit touches `dist/`.
- Review finding M1 fixed in `7476308c`: shared `pdfUpload` middleware was built at module eval,
  binding the multer byte limit before dotenv ran — now lazy, with a regression test. Minor accepted
  findings: create-handler 500 catch still echoes raw non-storage error messages (pre-existing
  pattern, never credentials); title uniqueness remains check-then-act (pre-existing).
- Suites green post-merge: nodejs-server 419/419 (node:test), admin-dashboard vitest + 36/36 node:test.
- **Deployed integrated acceptance still NOT run** — blocked on the restricted B2 upload key
  (see `03-b2-presigned-put-cors-spike.md` execution notes); phonetics has read/sign env only.
