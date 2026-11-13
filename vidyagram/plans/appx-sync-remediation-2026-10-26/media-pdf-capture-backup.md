# Vidyagram PDF, capture and backup action map

**Plan only. Production writes: 0. In-flight production writes: 0. Deployments/imports/captures applied: 0.** The human requested the complete survey and plan before any application. A remote source update was also rejected by automatic approval review; it was not retried or handed to another executor.

## Final source supplement —19:38–19:39IST

A separately authorized temporary session successfully read the full146-course CMS list, both course43 PDF metadata rows and course96 detail. Both PDFs are still enabled,not-deleted and flagged encrypted, supporting the validated clear-source guard cause. Course96 full pc4 returned502 after about29seconds even with this valid session;58 folder results hadmore=true and do not establish completeness. Local public student-root returned403. See [live-source-survey.md](live-source-survey.md). The temporary handoff was deleted; production `apxsessions` and all captures remain unchanged. CAPTURE-1 below concerns the maintained production session, not this completed temporary authentication. CAPTURE-2 additionally requires isolating/resolving the persistent full-listing failure; renewing authentication alone is insufficient. No capture, deployment or recovery was applied.

## Verified findings

- Two current standalone files are valid, already-clear PDFs despite AppX encrypted metadata. Full strict parser, text extraction and all-page Poppler render pass: 5 and 8 pages. Both sources were read unsigned with the official PDF referer; full hashes match the earlier reads.
- Local guard regression: one genuine failure before the patch, all four tests pass after. The actual deployed source was downloaded and preserved; its extra `export findRow` remains in the reviewed patched copy. No deployed file was changed.
- The rebuilt current PDF plan contains 10,403 files. Only the two new standalone failures are current eligible exceptions. Ten historical failed files match 17 file/row occurrences across 16 unique rows, all item-disabled and excluded now. Five historical pending files and all nine old source attachments are also excluded now.
- For the last two pending files, current replacements are already done and attached to their Classes. The other seven pending source occurrences are item-disabled. Do not blindly retry, reactivate, append or delete them.
- Current CMS session is inactive: last HTTP 307; real CMS list read fails; public student root still works. Earlier successful course96 probes are historical evidence, not proof it can capture now.
- Primary video/PDF object samples passed earlier. Independent backup inventory/retention is not established: R2 config reads returned 403. No independent restore test was run.

## Proposed actions (ordered by dependencies)

### PDF-1 — Deploy tested complete-clear-PDF guard

**Cause:** AppX encryption flag is stale on two already-clear valid PDF1.7 files; forced XOR corrupts the header.

**Exact scope:** ["GCP nightly src/services/apx/apxCatalogPdfImportRun.ts verifyPdfBytes only"]

**Before → after:** Encrypted=true forces decrypt even when complete source is already clear. → Structurally valid complete source bytes are kept exact; otherwise existing decryption and structural validation run unchanged.

**Dependencies:** Complete plan reviewed and production actions authorized in this chat; Idle nightly and source SHA guard.

**Source/admin protection:** Preserve current deployed export findRow and all unrelated code. This data-validity rule does not rename/admin-reclassify content.

**Deduplication:** No database writes in this action.

**Risk:** Accepting header-only/truncated bytes would publish invalid data; regression explicitly rejects both. Existing structural gate is heuristic, not a full parser; the two recovery files additionally passed strict parser/render.

**Rollback:** Restore exact deployed source backup only if current file still matches the new SHA; no restart required for CLI source loaded next run.

**Acceptance:** Regression red before/4 green after; True ciphertext remains accepted only after valid decryption; Wrong-key, HTML, header-only and truncated input rejected; Remote source hash matches reviewed patched file.

### PDF-2 — Recover exactly two eligible standalone PDF file units

**Cause:** PDF-1 failure; source bytes valid and currently readable unsigned with official PDF referer.

**Exact scope:** ["6ad94017c9735682f0130807", "6ad94018c9735682f013080e"]

**Before → after:** Both ledger statuses failed; no pdfId; no hash twins found in audit snapshot. → Both entries done, error null, valid pdfId/hash/size; at most two new PDF docs/objects or reuse by SHA.

**Dependencies:** PDF-1; Refresh source/current plan and assert same hashes and course43 row32909/32910 references; Private before snapshot of both ledger docs and any existing hash/key twins; HEAD deterministic B2 target keys.

**Source/admin protection:** Use ordinary import taxonomy/metadata path and source titles. These are standalone library files; existing importer intentionally creates no CoursePdf placement. Do not claim new student course visibility or invent placements.

**Deduplication:** Re-read tenant781 ledger fileKey/pdfId and sha256 twin before upload; exact 2-file scope and no noteTargets; idempotent rerun must write zero.

**Risk:** Partial upload/ledger failure; overwrite collision; published bytes differ from preview; accidental broad note attachment. Stop on target-key preexistence with mismatched hash/size, changed source/ledger or shared admin edits.

**Rollback:** Version-guard restore the 2 before ledger docs; remove only newly-created PDF docs and B2 keys after proving no references and matching recorded IDs/hash; never delete reused existing objects. Keep source-handler rollback separate.

**Acceptance:** Exact source full hashes match full-pdf-validation.json; B2 full GET sha256 equals validated source and recorded metadata; Both ledger records done with existing Pdf; No Class/Pdf notes or Course/CourseClass/CoursePdf unrelated changes; Second scoped dry run no-op.

### PDF-3 — Classify historical failed/pending notes; do not retry or attach inactive/superseded files

**Cause:** Old ledger status survived changes in current AppX visibility/links. Multi-version importer intentionally holds a whole slot until every eligible variant is fetched.

**Exact scope:** {"failedFiles": 10, "failedFileRowOccurrences": 17, "uniqueDisabledRows": 16, "pendingFiles": 5, "pendingHistoricalSources": 9, "ledgerIds": ["6ad1e05bc9735682f0ead25e", "6ad1e05cc9735682f0ead281", "6ad1dcabc9735682f0ea6b3f", "6ad1da42c9735682f0e8a6dd", "6ad1da41c9735682f0e8a6c6", "6ad1da44c9735682f0e8a6e1", "6ad1dae5c9735682f0e8b126", "6ad1dae3c9735682f0e8b107", "6ad1dae6c9735682f0e8c2d4", "6ad1dca5c9735682f0ea6aec", "6ad1dcaac9735682f0ea6b28", "6ad1dca7c9735682f0ea6afe", "6ad1dca8c9735682f0ea6b0e", "6ad1e449c9735682f0ebd409", "6ad1ed33c9735682f0efbf9c"]}

**Before → after:** Raw ledger status alone suggests 15 remaining active failures/pending files. → Actionable backlog reports zero current eligible units from these 15; historical statuses preserved and explicitly labelled disabled/superseded.

**Dependencies:** Current daily plan and raw visibility check before any future retry; Source/admin ownership review if visibility later changes.

**Source/admin protection:** Seven pending source occurrences are item-disabled; two old source URLs disappeared and current versions already exist/are attached. Do not activate hidden content, replace manual assignments or delete historical PDFs.

**Deduplication:** Shared Class notes are global; preserve pdfIds/pdfAssignments, append once per distinct Pdf only if a later approved active current target requires it.

**Risk:** Blind retry could reactivate hidden notes or append obsolete variants.

**Rollback:** No production write proposed. If report/monitor classification is added, revert report/query logic only.

**Acceptance:** All 10 failed files absent from current plan; all 17 file/row matches item disabled; All 5 pending files absent from current plan; Two current replacement Pdfs already present in both Class pdfIds and pdfAssignments; Every historical ID/source retained in plan JSON.

### CAPTURE-1 — Renew maintained CMS session through normal Vidyagram admin login

**Cause:** Current session isActive=false,lastHttpStatus307; CMS listing rejects SessionLost while public student root works.

**Exact scope:** "Vidyagram customer781/AppX org2177599 apxsessions only"

**Before → after:** Global CMS listing/signing blocked as of13:46:53Z. → Bounded CMS list read succeeds, exactly one correct tenant/org active session, keepalive200.

**Dependencies:** Human logs into cms.appx.co.in with the Vidyagram account through approved secret-safe path; Complete action plan reviewed; session mutation separately authorized.

**Source/admin protection:** Do not use another tenant account or paste cookies in chat. Existing reference/scripts/vidyagram-set-apx-session.cjs prompts hidden input and validates CMS dashboard before updating one tenant session.

**Deduplication:** One active session for781/org2177599; preserve previous doc privately for rollback.

**Risk:** Wrong organisation cookie, account throttling, exposing secret.

**Rollback:** Restore prior tenant session doc only if version unchanged; never touch Quicktricks.

**Acceptance:** Real CMS listing returns rows; Public student root still works; No secret in logs/evidence.

### CAPTURE-2 — Isolated fresh capture of course96, promote only after existing completeness gate passes

**Cause:** Earlier capture attempts failed upstream; last good capture was retained (latest successful daily2026-10-22). Four source calls succeeded12:44Z, but current CMS session is now inactive.

**Exact scope:** "Only apxcatalogcourses course96, its raw rows/tree pages and referenced content bodies under a new repair run ID; no Class, CourseClass, Course, PDF or ingest import"

**Before → after:** Readers use last successful course96 capture; failed attempt remains diagnostic. → Either unchanged successful pointer with bounded failed-attempt evidence, or new complete run pointer after all completeness invariants pass.

**Dependencies:** CAPTURE-1; Idle shared nightly/exclusive lock; Private before snapshot of course96 capture+attempt/detail/listRow/folder paths, all its rows/tree pages and all referenced shared content docs; inventory newly-created docs for rollback.

**Source/admin protection:** Do not force promotion, reuse stale attempt as fresh, clear completeness warnings, or execute broad nightly import. Content bodies may be shared by other courses; preserve/guard all shared references.

**Deduplication:** Use existing staged attempt/runView/promotion implementation with fresh=true and exact courseIds=[96]. No student-visible content import in this action.

**Risk:** Upstream timeouts, long listing, partial promotion, shared-body updates; requires snapshot and new-run version guard.

**Rollback:** Only if capture still points to repair run: restore exact96before docs/pointer and changed shared bodies; delete only newly-created96docs recorded in manifest; preserve old run views and avoid unrelated concurrent writes.

**Acceptance:** capture.status done and completeness.ok true; No unexplained/truncated/count mismatch; AppX raw row/tree counts reconcile; Rebuild only96plan and send diff to root for review before any import; No student-visible records changed.

### BACKUP-1 — Obtain independent-copy inventory and retention evidence before restore testing

**Cause:** Only primary R2 video and B2 document objects demonstrated; R2 replication/versioning/lifecycle requests denied403.

**Exact scope:** "Read-only inventory for Vidyagram-specific second destination and scheduled backup jobs/manifests, plus source-to-copy hashes/size/sample coverage for bulk and daily delta"

**Before → after:** No independently verified backup, recovery point or retention policy. Primary object existence is verified only by bounded samples. → Either documented independent bulk/delta coverage and retention, or explicit unresolved missing-backup decision. Do not infer absence solely from403.

**Dependencies:** Correct read-only backup control-plane capability or operator-provided inventory/retention evidence; Named separate destination, tenant scope and latest successful backup manifest.

**Source/admin protection:** Quicktricks mirror-deps optional secondary target is customer472-only and does not prove781 replication. CF_BACKUP credential naming is not a second copy.

**Deduplication:** Compare asset identity and object hashes, not job-running counts. Retention/versioning in the same failure domain is not automatically independent DR.

**Risk:** Cross-tenant inventory or interpreting primary copies as backups. No production restore allowed.

**Rollback:** Read-only inventory needs no rollback.

**Acceptance:** Separate destination identified with intended tenant prefix; Bulk manifest counts and daily delta coverage/freshness verified; Retention and source deletion behavior documented; Permission errors and unverified portions clearly stated.

### BACKUP-2 — Conditional isolated restore test from an actually independent copy

**Cause:** Recoverability cannot be established by primary HEAD samples.

**Exact scope:** "Small representative old/new video+PDF sample restored to a private local/scratch target only; never overwrite production"

**Before → after:** No restore test executed. → Independent sample restored, hashes agree with manifest/source, PDF parser/render and video playlist/segment/decode checks pass, timings recorded.

**Dependencies:** BACKUP-1 confirms independent copy; Reviewed restore target/sampling plan and read-only source access.

**Source/admin protection:** Do not describe downloading primary R2/B2 again as independent backup restore. No changes to production URLs, permissions or objects.

**Deduplication:** Scratch outputs isolated by run ID; preserve manifest references.

**Risk:** Accidentally testing primary instead of backup or restoring over prod.

**Rollback:** Remove scratch outputs only after evidence saved.

**Acceptance:** Independent-copy provenance; Full-file/object hash checks; PDF parser/render and video playable rendition checks; RPO/RTO evidence and known full-coverage limits.

### VERIFY-1 — Verify bounded recovery convergence and observe the next scheduled nightly after approved application

**Cause:** Manual patch success alone does not establish recurring importer stability.

**Exact scope:** "Exact2PDF recovery no-op; course96 read-only plan; next scheduled nightly02:30IST2026-10-27 and its per-step outcomes"

**Before → after:** No approved production repair applied in this track. → Bounded reruns make no duplicates and next real scheduled run preserves results, or explicitly report scheduled verification pending.

**Dependencies:** Approved relevant actions applied; Global CMS session healthy.

**Source/admin protection:** Do not run full nightly manually or modify other tracks while they own Class/placement writes.

**Deduplication:** Same tenant file/hash/run guards; no blanket historical retries.

**Risk:** Claiming future run success without evidence.

**Rollback:** Validation is read-only; repair rollback remains action-specific.

**Acceptance:** No duplicate Pdf or extra attachments; Actionable current backlog exactly reconciles; Next scheduled run actual evidence or pending label.

## Historical failed notes: preserve, do not retry current-inactive sources

| Ledger file | Current raw course:row matches | Current eligibility |
|---|---|---|
| 6ad1e05bc9735682f0ead25e | 63:39862 | All item-disabled; absent from current plan |
| 6ad1e05cc9735682f0ead281 | 63:39862 | All item-disabled; absent from current plan |
| 6ad1dcabc9735682f0ea6b3f | 59:39868 | All item-disabled; absent from current plan |
| 6ad1da41c9735682f0e8a6c6 | 48:177635, 52:44487, 55:45165, 56:45270, 67:40555 | All item-disabled; absent from current plan |
| 6ad1da44c9735682f0e8a6e1 | 74:40554 | All item-disabled; absent from current plan |
| 6ad1dae3c9735682f0e8b107 | 52:44464, 56:175667, 67:43326 | All item-disabled; absent from current plan |
| 6ad1dae6c9735682f0e8c2d4 | 74:43325 | All item-disabled; absent from current plan |
| 6ad1dca5c9735682f0ea6aec | 59:176705 | All item-disabled; absent from current plan |
| 6ad1dca7c9735682f0ea6afe | 67:176704 | All item-disabled; absent from current plan |
| 6ad1dca8c9735682f0ea6b0e | 105:190331, 74:176703 | All item-disabled; absent from current plan |

## All nine pending historical attachments (five files)

| Ledger file | Course:row | Class | Classification |
|---|---|---|---|
| 6ad1da42c9735682f0e8a6dd | 53:175477 | 6ace9aac8752d955968b72af | Item-disabled; excluded from current plan |
| 6ad1da42c9735682f0e8a6dd | 59:40556 | 6ace9aac8752d955968b72af | Item-disabled; excluded from current plan |
| 6ad1da42c9735682f0e8a6dd | 103:44155 | 6ace9aac8752d955968b72af | Item-disabled; excluded from current plan |
| 6ad1dae5c9735682f0e8b126 | 55:175572 | 6ace9b3d8752d955968b7915 | Item-disabled; excluded from current plan |
| 6ad1dae5c9735682f0e8b126 | 59:43327 | 6ace9b3d8752d955968b7915 | Item-disabled; excluded from current plan |
| 6ad1dae5c9735682f0e8b126 | 103:44207 | 6ace9b3d8752d955968b7915 | Item-disabled; excluded from current plan |
| 6ad1dcaac9735682f0ea6b28 | 92:176702 | 6ace9c8b8752d955968b7c2c | Item-disabled; excluded from current plan |
| 6ad1e449c9735682f0ebd409 | 94:188859 | 6acea23f8752d955968b8bb7 | Old link superseded; current replacement already attached |
| 6ad1ed33c9735682f0efbf9c | 95:189655 | 6ad1e3ddb520d957233cc16b | Old link superseded; current replacement already attached |

## Evidence and remaining decisions

Detailed source IDs, all before/current note assignments, complete file hashes, parser outputs, session observations and each action are in `media-pdf-capture-backup.json`. Supporting artifacts are under `vidyagram/reports/appx-sync-repair-2026-10-26/pdf-capture-backup/`.

A complete plan review must determine whether and when the guarded production actions should run. Course96 additionally needs the maintained Vidyagram CMS login renewed without putting cookies in chat. Backup work additionally needs a named independent destination and read-only inventory/retention capability; no copy is assumed. Standalone PDF recovery does not invent CoursePdf placements; student-facing standalone placement is a separate product decision if requested. Video dead-job classification/recovery belongs to the parallel media-video plan.
