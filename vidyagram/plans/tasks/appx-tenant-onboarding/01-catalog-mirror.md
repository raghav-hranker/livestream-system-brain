# 01 — AppX catalogue mirror (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-catalog-mirror` (off `vidyagram-admin`
252c9bcea), worktree `~/Projects/worktrees/vg-catalog-mirror`. Plan: [../../appx-tenant-onboarding.md](../../appx-tenant-onboarding.md).

## Goal

Copy Vidyagram's AppX catalogue verbatim into new raw mirror collections in `vidyagramdb`, so the later Build preview
runs offline with zero AppX calls. Nothing student-visible. Never write `apxcourses` (the 02:30 catch-up Build turns
every `apxcourses` doc into a live Course).

## Facts verified 2026-10-13

- `POST cms.appx.co.in/paid_course4/get_all_courses` with the live session: 145 courses, 99 enabled. Row keys include
  `id,title,course_name,enable,price,validity,end_date,exam_id,pricing_plan_id`.
- `GET https://armathsapi.akamai.net.in/get/folder_contentsv3?course_id=22&parent_id=-1&start=-1` with headers
  `Auth-Key: appxapi`, `Client-Service: Appx`, `source: website` and no auth returns 200 JSON `{message,status,data,total}`.
  Items carry `id,parent_id,Title,material_type,free_flag,live_status,videos_count,files_count,duration_in_secs,strtotime,
  sortingparam,pdf_link,pdf_link2,thumbnail` and many media fields.
- The live session is the single `apxsessions` doc `{orgId:'2177599', customerId:'781'}`; the box keep-alive (pm2 92)
  refreshes it every minute. AppX sets an anonymous `ci_session` on every response: **never parse Set-Cookie, never
  write `apxsessions`.**
- Mongo from this Mac works with the worktree `.env.development` (copy it from `~/Projects/worktrees/vg-backend`).
  Use `readPreference: 'primary'` for read-after-write. Force IPv4 for AppX calls from the Mac (`family: 4`).

## Endpoints

| Endpoint | Auth | Paging | Notes |
|---|---|---|---|
| `POST paid_course4/get_all_courses` | ci_session | DataTables start/length, stop on short page | |
| `GET paid_course4/get_course_by_id?id=` | ci_session | none | JSON labelled text/html; store whole body |
| `POST paid_course4/get_pc4_contents` + filterbycourse | ci_session | DataTables, `iTotalRecords` null, stop on short page | includes rows under deleted folders with enable=1/deleted=0; never folders; misses cross-listed rows |
| `GET paid_course4/getFolderPaths?course_id=&search=&page=<offset>&size=100` | ci_session | `results` + `pagination.more` | live folders only |
| `GET paid_course4/get_content_by_id?id=&from=…` | ci_session | one per row | try `from=upcoming` + Referer `/products/list_pc4_contents/<course>` and `from=pc4list`; `allRecord[].backPath` marks "(Deleted)" ancestors |
| `GET <tenant API>/get/folder_contentsv3?course_id&parent_id&start=-1` | none (headers above) | one call per folder | API order = depth-first priority |

Use `maxRedirects: 0`. A 3xx, an HTML body, or a missing row array is `SessionLost`: mark the course failed, stop the run.

## Mirror shape (raw driver collections, no Mongoose models; unique indexes created before first write)

- `apxcatalogcourses` `{customerId, apxCourseId}` unique: `listRow`, `detail`, `folderPaths`, `capture {runId, status, counts, completeness, error, completedAt}`.
- `apxcatalogrows` `{customerId, apxCourseId, rowId}` unique: `raw` (pc4 row verbatim), `lastSeenRunId`, `hiddenReason`.
- `apxcatalogtree` `{customerId, apxCourseId, parentId}` unique: `rows` (folder_contentsv3 `data` verbatim, API order), `lastSeenRunId`.
- `apxcatalogcontent` `{customerId, rowId}` unique: raw get_content_by_id body (backPath, cross-listed rows).

Verbatim payloads, no normalisation. Rows are never deleted; readers filter on `lastSeenRunId == capture.runId`.

## Driver

`src/scripts/apxCatalogCapture.ts --courses 22[,…] [--run <id>]` (no `--courses` = all). Per course: detail → pc4 rows
→ getFolderPaths → visible-tree crawl → classify hidden rows → resolve cross-listed rows → completeness check →
status `done`. Idempotent upserts; resume skips a course only when its runId matches and status is `done`.

- Re-read `apxsessions {customerId: String(CUSTOMER_ID), isActive: {$ne:false}}` before every CMS request; require exactly
  one doc with `orgId === APX_ORG_ID`.
- CMS calls serial, ~150 ms apart. Tree crawl ≤ 8 concurrent with `withRetry`.
- Connect with `{ dbName: DB_NAME }` and refuse if the URI names a different DB.
- Never log raw rows (they hold `pdf_encryption_key` and student-facing links). Log counts only.
- Completeness per course (any unexplained item fails the course): pc4 paging saw no repeated id; every visible
  VIDEO/LIVE/PDF id is a pc4 row or a resolved cross-listed row; every pc4 row missing from the tree is explained by
  deleted / enable=0 / hiddenReason / live_status 1–2; every visible folder id is in getFolderPaths; course count equals
  get_all_courses total. Print a per-course count table at the end.

## Reuse / port / delete

- Reuse: `fetchLiveCourseRows`, `fetchLiveCourseDetail` (`src/services/apx/apxPdfSigningService.ts`), `withRetry`.
- Export `fetchAllContentRows` (same file) with a repeated-id guard if it fits; otherwise a small local paginate.
- Port (as functions, not files): `hiddenRows` + getFolderPaths/backPath fetchers from quicktricks-backend branch
  `feat/apx-catalogue-completeness` `scripts/apx-content-audit/audit.cjs`; the crawl loop of `collectVisibleApxSnapshot`
  from nodejs-server `quicktricks-prod:scripts/apx-course-reconciliation-pilot.mjs` (bounded concurrency, keep every
  material type, record raw pages).
- Delete `src/scripts/apxCaptureAll.ts`, `src/services/apx/apxCaptureWalker.ts`, `src/tests/apxCaptureWalker.test.ts`
  (dead `/get/allfoldercontent` path; writes `apxcourses`). Remove the `capture:apx-all` npm script; add `capture:apx-catalog`.
- Out of scope: Build, taxonomy, `apxCatchup*`, views pass, ebooks, test series.

## Tests

Unit tests with injected fetchers on mongodb-memory-server: paging stops on a short page and fails on a repeated id;
hidden-row classification; cross-listed detection; resume skips `done` courses of the same runId and redoes failed ones;
`SessionLost` stops the run; a second run with the same input produces no new documents.

## Trial (allowed for the implementer)

After tests pass, run the driver for ONE large enabled course against `vidyagramdb`. Before and after, read the
`apxsessions` doc (print only isActive, lastHttpStatus, lastCheckedAt). Report: counts per collection, the completeness
result, which `get_content_by_id` `from` variant worked, whether `videos_count` is a subtree count, which of
`free_flag`/`live_status` appear on pc4 rows, the description/validity/banner field names in the detail body, and the
course's row and tree sizes. Do not run the whole catalogue.

## Done when

Tests pass, `tsc --noEmit` shows no new errors, the one-course trial completes with completeness `ok` (or every
unexplained item is listed), the session is still active afterwards, and commits are local on `feat/vg-catalog-mirror`
(not pushed, no dist rebuild).
