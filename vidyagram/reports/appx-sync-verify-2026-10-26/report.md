# Vidyagram AppX sync and backup verification — 26 October 2026

**Overall: FAIL — the migration is progressing, but is not completely synchronized or completely copied. Independent backups are UNVERIFIED.** Production operations were read-only. No imports, retries, repairs, restarts, database mutations or Quicktricks changes were performed.

Verified on 26 October 2026, approximately **17:56–18:03 IST**. The production database snapshot began at 17:56:58 IST. A fresh full AppX CMS course list was obtained at 18:00:16 IST. Content comparisons below use each course's latest completed mirror, not a new full live crawl. Evidence is retained in this directory.

| Track | Verdict | Verified result | Evidence |
|---|---|---|---|
| AppX access | PASS, bounded | Fresh CMS list returned all 146 courses; course 85 root also succeeded. | `live-course-list.json`, `nightly-audit.md` |
| Catalog freshness | FAIL | 145 live courses captured today; course 96 last completed October 22. Mirror retains two courses absent from today's live list. | `apxcatalogcourses.capture`, `live-course-list.json` |
| Daily delta execution | FAIL | Latest run ended `done-with-failures`; repeated class/PDF failures and failed course 96 capture. Scheduler remains active. | `apxnightlysyncruns`, `nightly-audit.md` |
| Video copying | FAIL | 9,251 done / 183 dead; two further current assets never acquired jobs or placements. | `media-backup-audit.md`, `apxingestjobs`, `current-asset-coverage.json` |
| PDF copying/attachments | FAIL | 10,724 done / 12 failed / 5 pending file entries; nine note-source attachments pending. | `apxcatalogpdfimports`, `media-pdf-summary.json` |
| Copied object availability | PASS, sampled | 12 videos, 46 rendition playlists, 92 boundary segments passed; 12 PDFs passed existence, size and header checks. | `media-r2-sample.json`, `pdf-b2-sample.json` |
| Placements/taxonomy | FAIL | All ledger-backed pairs exist, but source replacement gaps and title/status/free/filing/order discrepancies remain. | `placement-fresh-audit.md`, `placement-fresh-audit.json` |
| Independent backup/recovery | UNVERIFIED | Primary video/PDF storage checked; no verified second copy, retention inventory, recovery point or restore test. | `media-backup-audit.md` |
| Buyers, tests and learner history | UNVERIFIED | This pass does not establish end-to-end commerce, test-answer or learner-progress parity with live AppX. | Scope limits below |

## Bulk media and daily deltas

The OCI video worker is running for customer 781, targeting `recordedvideos-vidyagram`, with concurrency four and 1080p addition enabled. It has recorded recent successes. This establishes active copying, not a fully backed-up source. There are **9,434 video jobs: 9,251 done and 183 dead**, with no queued or in-progress jobs. Terminal failures are **131 no-playable-URL and 52 upstream HTTP 404**. Latest success was **today at 06:25:30 IST**. These counts exclude two current assets that failed before job registration. Source: `apxingestjobs.status/error`, `oci-worker-state.txt`, `media-pdf-summary.json`.

There are 1,700 Classes without `hlsAsset`: 1,215 YouTube, 300 external/deferred URL assets, 183 dead jobs and two untracked replacement assets. These categories must not be conflated. External playback links are not evidence of an owned media backup. Source: `classes.apxAssetKey/hlsAsset`, `media-backup-audit.md`.

The current PDF ledger has **10,741 file entries** and **8,666 distinct destination Pdf documents**. Shared content hashes can resolve to one Pdf. All 10,724 done ledger entries resolve to a Pdf document. The remaining 12 failed entries include ten old missing-note-source failures and two current decrypted-PDF validity failures. Five pending entries were last updated October 19 and cover nine note-source attachments. Source: `apxcatalogpdfimports.status/pdfId/sources`, `pdfs._id`, `media-pdf-summary.json:pdfLedger.outstanding`.

Concrete unresolved PDF examples: pending ledger `6ad1da42c9735682f0e8a6dd` covers course 53 row 175477, course 59 row 40556 and course 103 row 44155. Pending ledger `6ad1ed33c9735682f0efbf9c` includes course 95 row 189655. Current invalid-PDF entries are `6ad94017c9735682f0130807` and `6ad94018c9735682f013080e`. Resolve source/class associations and investigate decryption validity before any controlled retry; do not accept invalid bytes to make a counter green. Full identifiers remain in the evidence files.

Storage samples were selected from oldest, newest and quartile positions, rather than just one recent success. All twelve video masters loaded; all 46 distinct rendition playlists ended correctly; all 92 first/last segment objects existed. All twelve PDF object sizes matched `pdfAsset.sizeBytes` and their initial bytes were `%PDF-`. This is stronger than a database-only check, but does not verify every middle segment, full-file hash, decodability, student access or complete bucket inventory. Source: `media-r2-sample.json`, `pdf-b2-sample.json`.

No independent backup copy was demonstrated. The verified R2/B2 destinations are the primary owned media copies. A setting or credential named “backup” does not establish replication or recoverability. Recovery-point age and restore capability remain unknown. Source: `media-backup-audit.md:Independent backup`.

## Daily runner and live source freshness

The GCP timer is active and next scheduled for **27 October at 02:30 IST**. Today's run operated from roughly 02:30 to 06:24 IST and exited with failures. The last retained exit-zero run was October 21, but that run still paused its PDF stage after session loss and failed to capture course 96. Therefore no retained run proves every source item completed successfully. Source: `apxnightlysyncruns.state/steps`, `nightly-log-summaries.jsonl`, `nightly-audit.md`.

Today's capture completed 145 courses and failed course 96 after upstream HTTP 502. Its authoritative capture remains `daily-2026-10-22`. The deployed promotion guard preserved the previous completed view instead of replacing it with a failed attempt. This safeguard addresses the failed-capture overwrite incident from October 18; it also means course 96 is knowingly stale. Source: `apxcatalogcourses.capture/captureAttempt`, deployed `apxCatalogCapture.ts:1020–1048`, `nightly-audit.md`.

A fresh full AppX listing contains **146 courses**. The mirror has 148: **148 and 149 are absent from the live list**, and their retained captures date to October 23. Their platform Courses are off-sale but still retain three active lesson placements in total. Absence from a list does not alone distinguish deletion from visibility/access changes; review the source decision before removing retained content. Source: `live-course-list.json:courses`, `apxcatalogcourses.capture`, `courses.apxCourseId/status`, `courseclasses.isActive`.

The source session currently reports active/HTTP 200, and actual read requests succeeded. This proves basic access at the observation time, not a full current tree or media comparison for every course. Source: `apxsessions.lastCheckedAt/lastHttpStatus`, `nightly-audit.md:Current bounded upstream probe`.

## Current placement defects and October 19 baseline

The snapshot contains **153 Courses**, including **132 AppX-linked Courses**, **10,955 Classes**, **34,250 placements**, and **10,949 class-ledger records**. All **33,828 reconstructed ledger-backed course/Class pairs** exist. The other 422 placements belong to a manual Course; none belongs to the 20 original unlinked placeholders. All 20 placeholders remain present and have zero placements. These are reassuring presence checks, not proof that the ledger matches today's source assets. Source: `placement-fresh-audit.json:counts`, `courses.apxCourseId/apxUnlinked`, `courseclasses`.

| Finding | October 19 baseline → current state | Proposed next step |
|---|---|---|
| Stale lesson titles | Of the original 16 rows, 14 still disagree with the current mirrored tree; two old Geometry occurrences are now gone from that tree. Four additional current-tree title differences bring the current comparable total to 18. | Review current course-specific tree titles and refresh source/title precedence after approval. |
| Duplicate Geometry entries | Older YouTube and recorded Classes remain active in both courses 160 and 161. The current recorded Class has moved to new source-row identities, while obsolete old placements stay active. | Reconcile asset replacements and obsolete placement activation together. |
| Taxonomy case collisions | Physics/PHYSICS and Boat & Stream/BOAT & STREAM still affect the original 14 inactive placements. New Cause and Effect and President case pairs also exist. | Review and merge canonical nodes with references and snapshots; normalize resolver lookup. |
| Source exceptions | The same 73 planned video occurrences lack usable links: 42:1, 74:5, 77:22, 95:22, 96:23. Seventy-two have AppX-unavailable markers. | Obtain usable source media or resolve source availability; keep exceptions explicit. |
| Provenance discrepancy | All 33,828 linked placements still omit `apxClassIds`, `apxFreeFlag`, `apxScheduledAt`, `apxViewCount`. | Decide whether Quicktricks-style source metadata parity is required; no explicit omission decision was found. |

Source: `placement-fresh-audit.json:baselineTitles/taxonomy/issues`, `placement-fresh-audit.md`, October 19 `outputs/vidyagram-import-verify-2026-10-19/report.md`.

**Highest-priority source gap: two replacement assets affect four course occurrences.** Geometry 03 uses current asset `vid:armaths-data:4656486-1792746126` at course 160 row 193547 and course 161 row 193541. Geometry 04 uses `vid:armaths-data:4657426-1792753322` at course 160 row 193550 and course 161 row 193549. The two Classes were created October 24, but have no import ledger, ingest job, placement or `hlsAsset`. Existing older assets claim the source row IDs, so row-only completeness falsely passes. The nightly repeatedly hits the unique job index `apxCourseId_1_apxClassId_1`. Reconcile the old/new source-job identity and complete the intended replacement; do not drop the unique index or blindly create more Classes. Source: `current-asset-coverage.json`, `nightly-audit.md`, `classes`, `apxcatalogimports`, `apxingestjobs`.

**Nine obsolete placements remain active/status 1** where the latest mirror reconstruction expects inactive/status 0: courses 71,77,95,105,120,151,154,160,161. **One free flag differs**: course 114 row 184309 is stored paid while the current source plan is free. These are discrepancies; snapshots alone cannot prove whether an admin deliberately overrode the source. Review the listed rows before changing them. Source: `placement-fresh-audit.json:issues.active/status/free`.

**Filing and ordering also drifted.** There are 50 path differences across 13 courses: 24 case-only, 26 substantive. Examples include President content still filed under DPSP and course 160 science content retaining earlier GK/GS › Science filing instead of the current Science › Chemistry. There are 6,933 numeric priority differences across 47 courses; numeric shifts alone are not proof of wrong order. More concretely, six adjacent within-group inversions occur across courses 74,133,147,151 and160. Example: course 133 source row 194608 precedes 187034, but stored priorities 73 and63 reverse them. Source: `placement-fresh-audit.json:issues.filing/priority`, `topicOrdering`.

The current placement step appends missing `(course,class)` rows and skips existing ones (`apxCatalogCourseImport.ts:529–537`). Thus a “placement done” state cannot certify current title, filing, status or order parity. Preserve intentional admin edits, but define an explicit source-reconciliation policy so stale imported values are not silently treated as current.

## Quicktricks failure modes checked

| Documented lesson | Vidyagram result |
|---|---|
| A listing or done counter is not proof of playable/copied bytes. | Sampled real video playlists/segments and PDFs successfully; full-object parity remains unverified. |
| Changed/cross-listed source identity can hide gaps or cause duplication. | FAIL: two replacement assets/four occurrences missing; old Geometry entries remain active. |
| Per-course taxonomy and names must not come from shared Class filing. | Placement references, parent relationships and snapshots are internally consistent; current source filing differs on 50 rows. |
| Case duplicates and stale canonical spellings return without normalized lookup. | FAIL: original case collisions persist, two more populated topic case pairs appeared. Six additional exact Section-name duplicate candidates also exist; other-content usage must be inspected before merging. |
| Both note slots and variant attachments must be represented. | Current planner explicitly handles `pdf_link` and `pdf_link2` (`apxCatalogPdfImport.ts:248–263`); attachment failures/pending sources remain. Full fresh live note-to-storage parity is not established. |
| Failed captures must not overwrite the last good snapshot. | PASS for course96's observed failure; retained source is deliberately stale rather than falsely fresh. |
| Disabled/gone rows and free flags need course-specific reconciliation. | FAIL against current mirror: nine active/status mismatches, one free mismatch. |
| Buyers, access and history need separate comparisons. | UNVERIFIED; a catalog/media pass does not establish those migrations. |

References: `docs/plans/prd-apx-catalogue-completeness.md`, `docs/plans/prd-sections-topics-reconciliation.md`, `vidyagram/plans/appx-tenant-onboarding.md`, and the October 19 Quicktricks ADR/reference comparison. Quicktricks itself was not changed or re-audited.

## Limits and next steps

1. Resolve the two source-asset/job identity conflicts, then verify all four source occurrences reach playable storage and the correct placements.
2. Investigate course96's upstream failure and refresh its capture safely. Review why148/149 disappeared before deciding retained-course behavior.
3. Classify the183 dead media jobs and73 no-link occurrences without double-counting overlapping source problems. Resolve the two invalid PDFs and old note associations; verify attachments after recovery.
4. Review nine obsolete active placements, eighteen current title differences, one free flag, fifty filing differences and six within-group order inversions against admin intent. Then define reconciliation rules and a reviewed repair. No repair was authorized as part of this audit.
5. Review taxonomy merges and source-normalized lookup; preserve unrelated test/question-bank references and student history.
6. Establish an independent backup inventory, retention/recovery-point policy and restore test. The present evidence supports primary-copy availability for samples, not disaster-recovery completeness.
7. For a claim that *all source data* is synced, perform separate buyer/access, users, tests, attempts and learner-history comparisons. Legacy migration checkpoints found here do not establish completion: user raw checkpoint lastRunAt October15; orders state last updated October21; transactions October19. Those may be historical backfill markers, so they are evidence gaps rather than proof that all current user/order deltas stopped.

No full fresh AppX tree crawl, complete bucket inventory, all-segment/full-hash comparison, authenticated student playback, full current note inventory, database backup schedule inspection or restore was performed. Admin edit intent was not reconstructed. Evidence files are point-in-time reads, not a single transactionally atomic snapshot.

Detailed track reports: [nightly](nightly-audit.md), [media/PDF/backup](media-backup-audit.md), [placement/taxonomy](placement-fresh-audit.md). Supporting JSON contains full mismatch identifiers and sampled object checks. Credential values are not included in these reports.
