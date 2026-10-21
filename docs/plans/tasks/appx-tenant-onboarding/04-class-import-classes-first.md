# 04 — Class import, classes first (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-class-import` (off
`feat/vg-catalog-planner` ccf56c201, which contains the mirror and the planner), worktree
`~/Projects/worktrees/vg-class-import`. Plan: [../../appx-tenant-onboarding.md](../../appx-tenant-onboarding.md).
Read tasks 01, 03 and 03b in this folder and `src/services/apx/apxCatalogPlanner.ts` first.

## Goal

Create every unique Vidyagram class (video and PDF) **once** on the platform from the planner's output, with **no
course placement** (no CourseClass rows), and queue each video for ingest. A class with no CourseClass is invisible to
students, so this can run before the operator approves the outline. Course creation and placement are a later task.

Decided 2026-10-13: start classes and video movement before outline approval, because video ingest is the long pole
(~9,700 unique assets).

## Reuse, don't re-derive

Study and reuse the fork's existing Build/port path rather than writing a parallel one:
`src/services/apx/apxPortingService.ts` (Class find-or-create keyed by asset key, `resolveNewTitle` " (2)" counter,
thumbnail re-hosting), `src/services/apx/apxProcessService.ts` + `ApxIngestJob` (one ingest job per Class),
`src/services/apx/apxRecordedAssets.ts`, `src/utils/apxAssetKey.ts` (now keys YouTube `/live/` as `yt:`), the unique
asset-key indexes (`migrate:apx-unique-indexes`). Find out exactly which Class fields are required and what the ingest
container (`video-transcoder/apx-ingest-container`, claim API `/api/apx-ingest-jobs/claim`) needs on a job.

## Behaviour

`src/scripts/apxCatalogImportClasses.ts --run full-2026-10-13 [--courses …] [--limit n] [--commit]`. Dry run by default:
prints what it would create (counts per kind, first 10 titles), writes nothing.

With `--commit`, per planned item, grouped by asset key (one Class per asset key across all courses):
- Find-or-create the Class by asset key (idempotent; a rerun creates nothing new).
- Title from the plan (title counter applied per course in the plan; for a shared asset use the first course's title).
- `status`/active from the plan: an item inactive in every course is created inactive.
- Faculty / teacher name "Vidyagram Team" (decided 2026-10-13). Never "Sahil Sir".
- `isFree` stays false on the Class; free/demo is a per-course placement attribute, applied in the placement task.
- No section/topic on the shared Class (course filing lives on CourseClass, rule 11). If the schema requires them,
  stop and report the field rather than inventing a holding section.
- Thumbnail re-host as the fork does today.
- Kinds: HLS / AppX video → ingest job; YouTube (`yt:`) → Class with the YouTube redirect fields, no ingest job;
  `VIDEO_MP4` → ingest job via the MP4 path if the ingest container supports a direct MP4 source, otherwise create the
  Class, queue nothing, and list them as `mp4-pending`; PDF → follow the fork's PDF port for the file (`apxPdfPort`,
  signing service) if it can run from this script, else create nothing for PDFs and report what is missing.
- Items with no usable link (200) are skipped and listed.
- Write an import ledger collection `apxcatalogimports {customerId, assetKey}` → classId, kind, ingestJobId, runId, so
  later tasks can place classes into courses without re-matching.

Connect with `{ dbName: DB_NAME }` and refuse a mismatched URI (reuse `src/services/apx/apxMirrorRuntime.ts` from branch
`fix/vg-commerce-mirror` if convenient, or the equivalent check in `apxCatalogCapture.ts`). Never log raw rows, links
with tokens, cookies or `pdf_encryption_key`.

## Tests

On mongodb-memory-server: one class per asset key across two courses; rerun is a no-op; inactive-everywhere → inactive;
YouTube → no ingest job; MP4 behaviour; no-link items skipped; teacher name; no CourseClass rows are created; dry run
writes nothing.

## Trial (allowed)

Dry run over all `done` courses (report the totals). Then `--commit` for **one small course** only (e.g. 151, 98 items)
into `vidyagramdb`, and report: classes created by kind, ingest jobs queued, ledger rows, skipped items, and confirm
`courseclasses` is still 0. Do not commit more than that one course.

## Done when

Tests pass, `tsc --noEmit` clean, the one-course trial is verified by re-reading the DB, commits local on
`feat/vg-class-import` (not pushed, no dist rebuild). Note: ingest jobs queued in the trial will only be claimed once the
video-transcoder knows customer 781 (task 05), so they stay queued.
