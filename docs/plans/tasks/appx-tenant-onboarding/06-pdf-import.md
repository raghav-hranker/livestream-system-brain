# 06 — PDF import: class notes attached, standalone PDFs unplaced (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend` fork, branch `feat/vg-pdf-import` (off
`feat/vg-class-import` 518ad1fc1), worktree `~/Projects/worktrees/vg-pdf-import`. Plan:
[../../appx-tenant-onboarding.md](../../appx-tenant-onboarding.md). Read tasks 01, 04 and 04b in this folder first: the
mirror shape (`apxcatalog*`), the classes-first import and its ledger `apxcatalogimports`.

## Boundary (agreed with the session that owns the class import)

New files only: `src/services/apx/apxCatalogPdfImport*.ts`, `src/scripts/apxCatalogImportPdfs.ts`, tests. Reuse
`apxPdfSigningService`, `apxPdfDecryptService`, `apxPdfUploadService`, `apxPdfAsset` unchanged where possible (a
small exported helper is fine; say so). Do not edit the class importer, its ledger, the capture or the planner. Read
`apxcatalogimports` (assetKey → classId) and `Class.apxAssetKey`; never write them.

## Scope (measured 2026-10-14 on 141 captured courses, visible rows only)

- **Class notes**: `pdf_link` / `pdf_link2` on video rows. 6,972 video rows carry notes (494 carry two); **5,002 unique
  files**; none flagged encrypted. Hosts mostly `appx-content-v2.classx.co.in`.
- **Standalone PDFs**: rows of type PDF in course folders. 10,455 placements, **4,375 unique files**, 159 rows flagged
  `is_pdf_encrypted`. Hosts: appx-content-v2.classx, appxcontent-mcdn.akamai, appxcontent.kaxa, appx-wsb-gcp(-mcdn).akamai,
  migration-contents-v2.classx, appxcontent.securevideo.

## Behaviour

1. **One Pdf per unique file**, keyed by a file asset key (reuse the APX PDF asset-key logic in `apxPdfAsset.ts`, or
   `url:<normalised link without query>`). Ledger `apxcatalogpdfimports` `{customerId, fileKey}` unique: `pdfId`,
   `kind` (`note` | `standalone`), `sources[]` (course, rowId, link field), `status`, `error`. Unique index on `Pdf.apxAssetKey`
   (or the field the 472 port used) created before the first write, `partialFilterExpression`, not sparse-compound.
2. **Fetch path = the 472 port's**: sign through the CMS (`get-static-file-token` or the signer the port uses) with the
   live Vidyagram `apxsessions` session re-read per call (never write it, never capture Set-Cookie), download with the
   PDF-web Referer, decrypt when `is_pdf_encrypted` / `pdf_encryption_key` say so (existing key-length logic), verify the
   bytes start with `%PDF`, upload to the private documents storage under this client's prefix (`781/…`, see
   `src/config/clientStorageKey.ts`), set `Pdf.pdfAsset {bucket:'documents', key, mimeType, sizeBytes}`.
3. **Class notes are attached at import**: for each video row with notes, derive the video's asset key the way the
   class importer does, find the Class (ledger or `Class.apxAssetKey`), and add the note to `Class.pdfAssignments` in the
   shape existing code reads (check the model and the 472 note port). Idempotent: never add the same pdfId twice. A note
   whose class does not exist yet is recorded `waiting-class` and attached on a rerun.
4. **Standalone PDFs are created unplaced**: no CoursePdf / course assignment. Same holding taxonomy as the class
   import (MainCategory "Vidyagram", Category "All Courses", Section "Vidyagram import (unplaced)"; read the class
   importer for exact names) so the admin can see them. Placement happens after the preview is approved (not this task).
5. Fields: title from the row (same no-title rule as the class import), `teacherName` "Vidyagram Team",
   `isDownloadable` true (platform default), status inactive when the row is disabled in AppX; skip rows under deleted
   folders and rows the capture marked hidden.
6. **Rate limits and resilience**: the signer is per account and was the 472 bottleneck. Bounded concurrency
   (default 2, flag), retry 5xx/timeouts with backoff, stop the run on a dead session, and on repeated signer
   throttling back off rather than fail rows. Resumable: rerun skips `done` ledger rows.
7. **Never log** signed URLs, encryption keys, cookies, the Mongo URI. Hosts, ids and counts only.

## CLI

`src/scripts/apxCatalogImportPdfs.ts --run full-2026-10-13 [--courses …] [--kind note|standalone] [--limit n]
[--concurrency n] [--out file] [--fetch-check n] [--commit]`

- Default dry run: plans units from the mirror (counts per kind, waiting-class count, encrypted count), writes nothing.
- `--fetch-check n`: dry run that also signs, downloads and decrypts `n` sampled files in memory and reports
  `%PDF` ok / failed with reasons. Nothing uploaded, nothing written to the DB.
- `--commit`: does the writes. Refuses unless DB name is `vidyagramdb` and the documents-storage env is present.

## Tests

mongodb-memory-server with injected signer/downloader/uploader: one Pdf per unique file across courses; note attached
to the right Class; second run is a no-op; note before its class exists → `waiting-class`, attached on rerun; encrypted
file decrypted; non-`%PDF` bytes fail the unit; disabled row → inactive; deleted/hidden rows skipped; standalone PDF
gets the holding taxonomy and no course assignment; session lost stops the run. Each test must fail without its rule.

## Run (allowed)

Local only: the plain dry run over all done courses, and `--fetch-check 10` on course 151 plus 10 more files sampled
across the standalone hosts (include encrypted rows). No `--commit`: this Mac has no documents-storage credentials and
the commit run belongs on the OCI bastion. Report counts, the fetch-check table per host, and the signer's behaviour.

## Done when

Tests pass, `tsc --noEmit` clean, dry run + fetch-check reported, commits local on `feat/vg-pdf-import` (not pushed),
and the exact bastion commit command written at the end of this file.

## Decisions 2026-10-14 (user)

- **Content-hash dedupe for the whole run**: sha256 of the decrypted bytes; same hash = one Pdf, attached wherever needed.
- **Notes that differ across a shared class's courses** (~153 classes / 339 files, mostly the same lecture reused in
  successive CHAMPIONS/VOD batches with the note re-uploaded per batch): download every variant; all identical → one Pdf
  attached. Otherwise (user, 2026-10-14, superseding "newest only") **attach every distinct version**, oldest first,
  titled "<class title> – Notes (<source course title>)", flagged `multiVersion` in the ledger and listed in
  `pdf-import-<runId>-multiversion.csv` for review. Nothing is superseded. Per-course note scoping (CourseClass has no PDF
  field today) is a possible later platform change.
  **Reconfirmed 2026-10-15 (user):** this stands. A later proposal to attach nothing to these classes and list them as
  `needs-decision` was considered and rejected; attach every distinct version, labelled by course.
- **Run CSV** `pdf-import-<runId>.csv` (+ summary json), appended as it goes, one row per source file per placement:
  run_id, timestamp, kind, apx_course_id, course_title, row_id, class_id, class_title, file_name (basename only), host,
  upload_date, sha256, size_bytes, encrypted, pdf_id, multi_version, version_label, action (created | reused_same_hash | attached | already_attached |
  waiting_class | skipped_hidden | failed), reason. Never a signed URL or key.
