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

- [x] Session create validates metadata and admin ownership; server generates all IDs and object keys; browser can neither choose a bucket nor a key
- [x] `upload-target` returns a presigned `PUT` scoped to one server-generated key with 15-minute TTL, requested just in time
- [x] One-file happy path end to end: browser `PUT` direct to B2 (bytes never transit Node) → `complete` verifies `HeadObject` size/content-type **and** `%PDF-` range-read → `Pdf` created with valid `pdfAsset` → `pdfId` persisted on the session file
- [x] Completion of a missing, wrong-size, or non-`%PDF-` object is rejected and the file is marked `failed` with an error code — no record created
- [x] Completed record Previews via the existing admin `/access` mint; sanitized responses only
- [x] Both repos test the same request/response examples and state/error vocabulary (shared-contract seam); drift fails a leg before merge
- [x] Backend session tests use injected storage/session adapters; frontend coordinator tests use contract fakes

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

## Execution notes — 2026-07-20 (task 04 complete)

**Status: merged, reviewed, review-fixed, deployed, and verified — server 40/40 on phonetics + browser leg E2E from the real dashboard.**

### Deployed state
- **nodejs-server** `launch/quicktricks-v2` @ `c6100a6a` (phonetics deployed at this rev). Leg merge `6c8693a9` + two review fixes:
  - `cc49b958` — `mongoSessionStore.markTargetIssued` rewritten with `$elemMatch`: a dot-notation array filter could bind the positional `$` to the **wrong file** in a multi-file session. Invisible to the seam tests because the in-memory fake targets by `fileId`. Acceptance §5 gained a regression row that targets the **3rd** file first.
  - `c6100a6a` — B2 answers `HeadObject` on a **missing key with 403 (error name `'403'`), not 404**, under the prefix-scoped upload key; the adapter now maps 403/Forbidden/AccessDenied → `object_missing`. Without it, never-uploaded completes returned 502 `storage_failed` instead of 422 `object_missing`. Trade-off: a genuine credential outage would also be labelled `object_missing` — acceptable, documented. Suite 469/469.
- **admin-dashboard** `launch/quicktricks-v2` @ `bcbb417`. Leg `d291eea` + merge + conformance fix `bcbb417`.
- **Box acceptance** `~/quicktricks-lms/upload-accept-checks.js` extended with §4–5 (bulk E2E, all rejection rows, idempotent complete, 409s, 401, no-key/no-URL, `$elemMatch` regression) → **40/40 passed** on deploy `c6100a6`.

### Contract drift — the key process lesson
The two agent legs **drifted on the shared contract**. nodejs-server's `src/contracts/pdfUploadSession.ts` is the **pinned** side; the frontend was rewritten in `bcbb417` to mirror it verbatim (flat single-create metadata, `url` + ISO `expiresAt`, `invalid_signature`/`storage_failed`, session state `active`, complete success = 2xx `{fileId,state,pdfId}`, rejection = non-2xx `{message,code}` surfaced via `SessionTransportError.code`; sheet maps `isActive`→numeric `status`, `topic` required). **For tasks 05–08: tell each admin-dashboard leg explicitly to conform to `src/contracts/pdfUploadSession.ts`.**

### Browser leg — verified E2E (localhost:3000 dashboard → phonetics backend via the 5100 tunnel)
Admin `uday@admin.com`. Bulk sheet: set Main Category / Category / Section, attach a real `%PDF-` file, Start Upload → **COMPLETED**; Preview rendered the PDF.

- **Global/per-file topic discrepancy (UX note, not a blocker):** the global Filters banner says *"Topic is optional"* and requires only main-category/category/section, but the **per-file card blocks** with *"Main category, category, section and topic are required"* until a Topic is chosen. Worth reconciling in a later polish pass.
- **Full request sequence** — the Chrome extension's network-capture buffer only reliably retained the final `/complete`; `performance.getEntriesByType('resource')` on the page shows all four hops for each of two uploads:
  1. `POST /api/admin/pdf-upload-sessions` (fetch) — session create
  2. `POST .../files/{fileId}/upload-target` (fetch) — mint presigned PUT, one per file, after create
  3. **`PUT https://s3.us-east-005.backblazeb2.com/hranker-private-assets/pdfs/{64-hex}.pdf?…` — `initiatorType: xmlhttprequest`** — the browser XHR PUT goes **directly to B2** (~1.46 s). No multipart POST to Node anywhere; the only `localhost:5100` calls are JSON control-plane. **Bytes never transit Node — proven in the real browser.**
  4. `POST .../files/{fileId}/complete` (fetch) → 200 → server `HeadObject` + `%PDF-` verify + `Pdf` created.
- **Preview:** `GET /api/admin/pdfs/{pdfId}/access?intent=preview` → 200 → opened the signed Bunny URL `https://hranker-private-assets.b-cdn.net/pdfs/{same-key}.pdf?token=HS256-…&expires=…` → **PDF rendered** (200, not 403); content matched the uploaded file. **Same server-generated key across PUT → complete → access** confirms one object; the browser chose neither bucket nor key.
- `complete=200` is itself end-to-end proof — the server returns 200 only after HeadObject-ing the B2 key, range-reading `%PDF-`, and creating the `Pdf`; a never-uploaded key returns 422 `object_missing`.

### Deferred (recorded, not blocking task 04)
- **Task 06**: concurrent double-complete can orphan one `Pdf` (loser calls `createPdf` before losing the conditional `markCompleted`); session state stays correct.
- **Task 08**: wrong-size / non-`%PDF-` rejects leave orphan B2 objects at their keys (expected) — the cleanup sweep of abandoned objects per PRD retention lives here.

### Env
User's dirty admin-dashboard files (incl. `config.ts` → `localhost:5100`, `package.json`, `lib/pdf-access-link.ts`) preserved untouched. `stash@{0}` (tsconfig `allowImportingTsExtensions` edit) is subsumed by the merge — safe to `git stash drop`.
