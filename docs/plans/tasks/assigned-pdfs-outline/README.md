# Tasks: Assigned PDFs outline + Free decided per place

State: **DEPLOYED 2026-10-03 ~19:50 IST** — track B outline (07–12, 15, 16 + tabs removed/collapsed + primary-pinned txns) and task 01 (Free per course on the old screen, = task 02) live: backend 7e13127bd (box pulled + pm2 restarted), admin c561ff2 (Vercel success). Courses – New → PDFs = outline at /admin/courses/v2/assign-pdfs; old /admin/courses/assign-pdfs = legacy flat table. Still open: track A 03–05 (branches feat/pdf-free-per-place, feat/pdf-free-page-actions, feat/pdf-place-decides-free; need origin sync) + 06 conversion; real-data test on prod pending. History: State: `ready-for-agent` (AFK) · `ready-for-human` (02, 06, 13, 14) · track A AFK done locally 2026-10-03, nothing pushed: 01 backend 4e758ade9 / admin a536e06 (`fix/course-pdf-free-per-course`, `qt-pdf-free-{backend,admin}`); 03 backend 0d9ce9db9 (`feat/pdf-free-per-place`), prod dry run matched 14/41/1/0; 04 backend d9a010d64 / admin 82cb664 (`feat/pdf-free-page-actions`); 05 backend 822271553 (`feat/pdf-place-decides-free`) — **deploy only after the task 06 conversion**; 04+05 merged on `feat/pdf-free-switch-over` (worktree `qt-pdf-free-switch-backend`, merge clean, no new failures) · track B: `feat/course-pdf-outline` from one-stop heads backend 83e1dca1b / admin 015833e + task 01 cherry-picked (`qt-pdf-outline-{backend,admin}`); 07 done locally (backend 2b5f385fc, admin 2023149); 08–12 done on `-08…-12` branches and all merged into `feat/course-pdf-outline` (backend 1b7a920ae incl. Copy clearing names on the library filing, admin 98bb4be; suites = baseline); 15 (Add PDFs like Assign Classes, found in preview) merged: backend f9fe2cfdd, admin b886648 — track B AFK complete, 13/14 wait for the classes deploy

Vertical-slice breakdown of [the PRD](../../prd-assigned-pdfs-outline.md). Tasks cite the PRD's decisions
(D1–D16) and user stories; they do not restate them.
Prototype (accepted, v3): https://claude.ai/artifact/P4o9kJKL6g7QkaGrLnfBDn

## Two tracks, two starting points

- **Track A, Free (01–06): ships first.** It starts from what is live (`origin/quicktricks-admin` in
  both forks) and depends on no unreleased code. The Free leak is a live defect, and the switch-over
  changes who can open what, so it ships as small releases of its own.
- **Track B, Outline (07–14): ships after the classes work.** It reuses the Assigned Classes outline
  code, which lives only on `feat/assign-classes-one-stop` (not deployed). Branch
  `feat/course-pdf-outline` in both forks, cut from the one-stop integration heads (round 4 merged:
  admin `064e8cc`). Only 07 waits on track A (01), so the outline's Free box already writes per course.

## Working-copy rules

- **Fresh worktrees per track**, never the user's preview worktrees (`qt-grouped-view-*`,
  `qt-one-stop-backend`, `qt-one-stop-admin`).
  - Track A: e.g. `~/Projects/worktrees/qt-pdf-free-{backend,admin}` on a fix branch from
    `origin/quicktricks-admin`. Backend fetch needs `git fetch git@raghav-hranker:abhi092515/quicktricks-backend.git`
    (plain `origin` is denied).
  - Track B: `qt-pdf-outline-{backend,admin}` on `feat/course-pdf-outline`.
- **Existing code to build on** (backend): `src/controllers/coursePdfController.ts` (assign, reorder,
  bulk update, the student read with `groupBy=topic`), `src/services/coursePdfItem.ts` (student item
  builder, effective free ~129), `src/services/issuePdfAccess.ts` (`isEntitled`, the "transitional OR"
  ~186–201), `src/controllers/pdfController.ts` (PDF create/edit, bulk Free ~694), models `CoursePdf`,
  `Pdf`, `Class.pdfAssignments`, `PracticeBatchPdf`.
  (Admin): `components/admin/assign-pdfs/{AssignedPdfsView,AvailablePdfsView,BulkEditSheet}.tsx`,
  `components/admin/{PdfForm,PdfsDashboard,BulkUploadPdfsSheet}.tsx`, `hooks/api/use-course-pdfs.ts`.
  Track B also reuses the one-stop admin outline: `lib/course-outline.ts`, `lib/placement-move.ts`,
  `components/admin/assign-classes/{OutlineSortable,MoveToDialog,PlacePicker,CopyToCourseDialog,AddExistingClassesSheet}.tsx`.
- **Local writes hit production.** A local backend runs against the prod database (ssh tunnel). Test
  writes only on a course the user names; anything destructive belongs in the in-memory integration
  tests. Prod reads from the Mac: `NODE_PATH=<backend>/node_modules`, rebuild `MONGO_URI` with the host
  swapped to `127.0.0.1:27018` + `directConnection=true`, and **never print it**.
- Commit as `raghavsharma@hranker.com`, **no co-author trailers**. Never push or deploy without asking.
  Backend deploy = commit `dist` (surgical `tsc --outDir` + copy), push, box pull + pm2 restart
  (memories `quicktricks-backend-dist-deploy`, `quicktricks-prod-box`); admin deploy = Vercel on push.
- Tests: before the first task of a track, take the baselines on the branch base with system-brain's
  `scripts/qt-tasks.sh suites <worktree>` and save each `failures.txt` here as
  `baseline-{backend,admin}.txt`; each task then runs the same command with that file and must print
  `NO NEW FAILURES`. How to run, read and write tests:
  [`reference/quicktricks-testing.md`](../../../../reference/quicktricks-testing.md).

| # | Task | Type | Blocked by |
|---|---|---|---|
| | **Track A: Free** | | |
| 01 | [Course-screen Free writes this course only](01-course-screen-free-per-course.md) | AFK | — |
| 02 | [Deploy the Free fix](02-deploy-free-fix.md) | HITL | 01 |
| 03 | [Free-in-all-places changes, conversion script, Pdf.isFree audit](03-free-in-all-places-and-conversion.md) | AFK | 01 |
| 04 | [PDF page and PDFs list: Free in all its places](04-pdf-page-free-in-all-places.md) | AFK | 03 |
| 05 | [The place decides Free](05-place-decides-free.md) | AFK | 03 |
| 06 | [Run the conversion on prod, deploy the switch-over](06-convert-and-deploy-switch-over.md) | HITL | 02, 04, 05 |
| | **Track B: Outline** | | |
| 07 | [Outline read, end to end](07-outline-read.md) | AFK | 01 |
| 08 | [Hardened reorder; drags within a group; Reverse and Move up/down](08-reorder-and-drags-within-group.md) | AFK | 07 |
| 09 | [Move across topics: drag, multi-drag, Move to…](09-move-across-topics.md) | AFK | 08 |
| 10 | [Add existing PDFs here](10-add-existing-pdfs-here.md) | AFK | 07 |
| 11 | [Copy a topic to another course, end to end](11-copy-topic-to-another-course.md) | AFK | 07 |
| 12 | [Copy scopes: PDF, selection, section, course](12-copy-scopes.md) | AFK | 11 |
| 13 | [Preview and deploy the outline, drags and Move to](13-preview-deploy-outline.md) | HITL | 08, 09, classes deploy |
| 15 | [Add PDFs the way Assign Classes adds classes](15-add-pdfs-like-assign-classes.md) | AFK | 10 (found in preview) |
| 14 | [Preview and deploy Add existing and Copy](14-preview-deploy-add-and-copy.md) | HITL | 10, 12, 13 |

What can run in parallel:
- Track A: 03 starts after 01; 04 and 05 run side by side after 03.
- Track B: 07 first; then 08 → 09, 10 and 11 → 12 side by side.
- The tracks touch different code; 03–05 can run alongside 07–12.
