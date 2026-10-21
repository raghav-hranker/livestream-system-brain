# 04b — Class import: the commit path (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-class-import` (tip 2adf00cbf),
worktree `~/Projects/worktrees/vg-class-import`. Builds on [04-class-import-classes-first.md](04-class-import-classes-first.md);
read it and `src/services/apx/apxCatalogClassImport.ts` first.

## Decisions (user, 2026-10-13)

- **Taxonomy for imported classes:** one MainCategory **"Vidyagram"**, one Category **"All Courses"** under it, and one
  holding Section **"Vidyagram import (unplaced)"**. Find-or-create each by exact name (customer 781), idempotent. Every
  imported Class uses these until the approved outline places it; placement (a later task) sets the real section.
  If Class also needs a topic or anything else, use a holding topic of the same name and report it.
- **Titles:** Class titles are globally unique. When a planned title collides with another unit's title, append the
  planned **topic**: `"Class 01 · Geometry"` (separator ` · `). Only if that still collides, add the counter `" (2)"`.
  Titles that do not collide stay unchanged. Report how many got a topic suffix and how many a counter.
- **Teacher:** "Vidyagram Team". **PDFs:** not in this task (separate task). **MP4:** create the Class, queue nothing,
  mark `mp4-pending` in the ledger.

## Build

Implement `--commit` in `src/scripts/apxCatalogImportClasses.ts` for the `ingest`, `youtube` and `mp4-pending` units:
- Find-or-create the Class by asset key with the fork's existing helpers (`apxPortingService.ts`); same fields the fork
  sets for an APX-ported class, minus any CourseClass, with the taxonomy above. Thumbnail re-host as the fork does.
- `ingest` → one `ApxIngestJob` per Class via the fork's enqueue path. `apxCourseId`: use the `apxcatalogcourses` doc
  `_id` of the source course (we never write `apxcourses`); confirm nothing on the claim path dereferences it.
- `youtube` → Class with the fork's YouTube fields, no job.
- Ledger `apxcatalogimports {customerId:'781', assetKey}` unique → `{classId, kind, ingestJobId, runId, sourceCourseId,
  sourceRowId, titleRule}`; create its index before the first write.
- Rerun is a no-op (same classes, same jobs, same ledger). No CourseClass rows ever.
- Keep the DB-name guard; never log raw links, cookies or `pdf_encryption_key`.

## Tests

Add the tests 04 could not write: rerun no-op, no CourseClass rows, ledger contents, taxonomy find-or-create idempotent,
topic-suffix then counter titles, YouTube no job, MP4 no job, inactive-everywhere → inactive, `apxCourseId` set.

## Trial (allowed)

`--commit --courses 151` into `vidyagramdb` only. Re-read the DB and report: classes by kind, ingest jobs (status
queued), ledger rows, the three taxonomy docs, `courseclasses` = 0, and one example title for each title rule. Run the
same command a second time and show nothing changed. No other courses.

## Done when

Tests pass, `tsc --noEmit` clean, trial verified twice, commits local on `feat/vg-class-import` (not pushed, no dist
rebuild). Queued jobs stay unclaimed until the transcoder side is deployed.
