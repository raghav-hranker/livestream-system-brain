# Vidyagram remaining PDF recovery — 16 October 2026

User approved recovering the remaining catalogue after the first student-token batch.

## Starting state

- 10,214 planned file identities; 7,198 imported; 3,016 missing.
- Four additional student accounts cover 701 missing files through courses 112, 41, 28 and 117. Sessions were generated and cached through the existing authorized migration flow.
- 2,110 further files have no coverage in the stored student purchase records.
- The previous batch had 205 failures: 149 missing student API metadata, 37 missing mirrored student-tree rows, 12 HTTP 403 responses, 7 returned-link mismatches.
- All 15 encrypted-flagged missing files are standalone PDFs.

## Recovery sequence

Supervisor `/home/opc/vidyagram/recovery2.sh`, PID `3509523`, runs detached under the existing PDF-import lock:

1. Student import for courses 112, 41, 28 and 117: 701 unfinished files.
2. Admin-only import of whatever unencrypted files remain, including the first batch's failures. The admin signer successfully recovered a previously HTTP-403 file during the preflight.
3. Attachment-only reconciliation of already-saved PDFs, retaining the all-variants rule for shared class notes.

The runner is [vidyagram-student-pdf.cjs](../../reference/scripts/vidyagram-student-pdf.cjs).
Student signing is paced at 1.5 seconds; admin signing at 2.5 seconds. Existing PDF records are skipped. The live sheet transport is paced separately and has a larger queue and retry budget. No automatic token refresh or repeated OTP generation is enabled.

Remote log: `/home/opc/vidyagram/logs/pdf-recovery2/run.log`.
CSV and final-summary directories:

- `/home/opc/vidyagram/logs/pdf-recovery2-student`
- `/home/opc/vidyagram/logs/pdf-recovery2-admin`
- `/home/opc/vidyagram/logs/pdf-recovery2-attachments`

## Preflight and plaintext metadata defect

- Student preflight: 4/4 downloads valid, covering notes and standalone PDFs.
- Admin preflight: 3 valid ordinary downloads, one encrypted-flagged file rejected by the existing decrypt/validate step.
- Reproduced that failure on course 27, row 20291. The downloaded original is a structurally complete `%PDF-1.7` file, including an object dictionary, `startxref` and terminal `%%EOF`. Its metadata incorrectly says encryption version 1. Applying XOR decryption corrupts its already-clear prefix.
- Added a three-line guard to `src/services/apx/apxCatalogPdfImportRun.ts` in both the local PDF worktree and the isolated bastion migration checkout: an encrypted-flagged download already passing `isValidApxPdf` is preserved; all other downloads follow the existing decryption path.
- Regression tests first reproduced the failure, then passed for preserving valid plaintext, decrypting genuine version-1 ciphertext, and rejecting a truncated PDF header. Tests: [vidyagram-pdf-plaintext.test.cjs](../../reference/scripts/vidyagram-pdf-plaintext.test.cjs).
- Worktree TypeScript check passed with no emitted files. The production backend deployment was not changed.
- Re-ran the live check over all 15 encrypted-flagged missing files: **15/15 passed**, with no signer throttling or session loss.
- Queued `/home/opc/vidyagram/recovery2-encrypted.sh`, PID `3511416`, to acquire the same import lock after the active recovery. It imports the 15 encrypted-flagged files, then runs a final attachment-only reconciliation. Log: `/home/opc/vidyagram/logs/pdf-recovery2/encrypted-queue.log`; result directories: `pdf-recovery2-encrypted` and `pdf-recovery2-final-attachments` under `/home/opc/vidyagram/logs`.

Initial read-back for this recovery: **7,297 file identities imported**, up 99 from the starting state. Student-pass progress was about 100/701 attempted at that snapshot. These are running counts, not a final result.

## Prior sheet backlog

[vidyagram-pdf-sheet-reconcile.cjs](../../reference/scripts/vidyagram-pdf-sheet-reconcile.cjs) compared full CSV event rows against the sheet as a multiset. It appended exactly **450 missing PDF-import rows** from the first recovery. No multiversion rows were missing. Existing sheet rows and non-PDF tabs were preserved.

This record describes a running recovery. Coverage and selected-file counts are not successful-download counts; use the ledger and final summaries for the outcome.

## User-requested parallel admin pass

The user subsequently requested admin recovery in parallel with the active student worker.

- Preserved student worker PID `3509526`. Stopped only its old Bash serial supervisor `3509524` and the waiting encrypted queue `3511416`, after checking each process identity. The old serial admin and attachment commands therefore will not start later.
- Started parallel admin supervisor PID `3514729`, using its own lock at `/home/opc/vidyagram/pdf-admin-parallel.lock` and `--admin --exclude-courses 112,41,28,117`. Excluding any file with a placement in those courses keeps its file scope disjoint from the active 701-file student batch.
- Actual admin selection: **2,315 files** (1,685 standalone, 630 notes), including all **15 encrypted-flagged files** validated above. First progress confirmed 10/2,315 attempted.
- Admin output directory: `/home/opc/vidyagram/logs/pdf-recovery2-admin-parallel`; console log: `run.log` in that directory.
- Added an optional PDF-prefixed summary tab to the isolated migration sheet module. The admin worker writes `PDF admin summary`; student progress remains in `PDF summary`. Both append their sanitized event history to the existing PDF tabs. Admin sheet requests are paced at 3.5 seconds; the existing student worker retains its original pacing. All 16 sheet-module tests passed.
- Finalizer PID `3515003`, script `/home/opc/vidyagram/recovery2-finalize.sh`, waits for both student and admin workers, acquires the shared import lock, retries remaining files once via admin, then runs attachment-only reconciliation. Log: `/home/opc/vidyagram/logs/pdf-recovery2/finalize.log`. The final retry and attachment outputs are `pdf-recovery2-admin-final-retry` and `pdf-recovery2-final-attachments` under the logs directory.

This parallel setup supersedes the earlier serial supervisor and separate encrypted queue described above.

## Alternate-cookie recovery

After both workers and their final retry stopped, the ledger held 8,333 imported source identities, leaving 1,881. The admin pass had saved 448/2,315 before throttling; its final retry fetched no additional file. Attachment reconciliation checked the 8,333 existing file identities without new downloads.

The user requested trying the next admin cookie. The saved `/home/opc/vidyagram/apx-signer-session` is structurally valid and differs from Vidyagram's maintained database session. Tested it on an unfinished file: signing succeeded, and the 2,840,907-byte download had a valid `%PDF-` header. No cookie or signed URL was printed or written to this report.

Added the existing `APX_SIGNER_SESSION_FILE` convention to the operational runner's admin mode. It reads the saved cookie once and passes it explicitly to `createHttpSigner`; the maintained `apxsessions` document remains untouched. Six student-path checks and JavaScript syntax validation passed.

Started detached supervisor PID `3522188`, script `/home/opc/vidyagram/recovery3.sh`, under the shared import lock. It retries unfinished files using the alternate cookie at the existing 2.5-second signing gap, then reconciles attachments. It retains the bounded throttle backoff/stop rules.

- Console log: `/home/opc/vidyagram/logs/pdf-recovery3/run.log`
- Admin CSV, coverage and final summary: `/home/opc/vidyagram/logs/pdf-recovery3-admin`
- Attachment results: `/home/opc/vidyagram/logs/pdf-recovery3-attachments`
- Live summary tab: `PDF admin summary`; its counters describe this new pass and restart from zero.
