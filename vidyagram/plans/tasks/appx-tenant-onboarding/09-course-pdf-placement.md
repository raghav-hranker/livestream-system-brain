# 09 — Course PDFs: place the imported standalone PDFs in their courses (Vidyagram)

Status: **done 2026-10-27** — indexes built, 10,099 coursepdfs in 103 courses, reruns no-op, admin page checked on 103. Tenant: Vidyagram (customer 781, DB `vidyagramdb`).
Branch `feat/vg-course-pdf-placement` 348d4e79c (off `feat/vg-nightly-sync` 660468e6c), worktree
`~/Projects/worktrees/vg-course-pdf-placement`, local only, not pushed.

## Why

Admin "Assign PDFs to Course" showed "No PDFs assigned yet" on every imported course (user, 2026-10-27, course 103
"Maths VOD Batch by Aditya Ranjan Sir": AppX has `Percentage › PDF` with 3 files). Task 06 created every standalone PDF
(a PDF row in an AppX course folder) as a `Pdf` in the holding section with **no course placement**, by design. Task 08
placed classes only. Nothing ever wrote `CoursePdf`; the `coursepdfs` collection did not exist on vidyagramdb. Class notes
(`Class.pdfAssignments`) are a separate path and were attached at import.

## Rules (user: "the same taxonomy rules" as the classes)

- Filing = today's plan item for (course, rowId): the planner's section + topic, wrapper folders (VIDEO/PDF/teacher/batch)
  dropped. These are the names `CourseClass` pins, so a PDF lands in its classes' topic.
- `CoursePdf` has no subTopic: a PDF under a subtopic sits in its topic (687 rows in the dry run).
- Loose PDF (no folder): course section + "Start Here" when the course has foldered classes, else no topic ("All Notes").
- Names are always written. Every imported Pdf's library filing is the holding section with no topic.
- Pdf = the PDF ledger `apxcatalogpdfimports` file (status done) whose standalone sources include (course, rowId).
- Course-wide priority in AppX tree order, after the course's highest existing priority. The same Pdf twice in one course
  keeps the first.
- Raw `bulkWrite insertOne`, as admin "Add existing PDFs" writes: disabled = `isActive:false`, `isFree` from AppX,
  `apxTitle` = AppX text. Existing (course, pdf) rows are untouched, so a rerun is a no-op and admin moves survive.
- The Course must exist (never created). Rows gone from AppX are not brought in.
- `--commit` refuses without the unique `{course:1, pdf:1}` index.

Code: `src/services/apx/apxCatalogCoursePdfImport.ts`, CLI `src/scripts/apxCatalogImportCoursePdfs.ts`, tests
`src/tests/integration/apxCatalogCoursePdfImport.integration.test.ts` (8 new + 21 course-import = 29/29), tsc clean.

## Dry run 2026-10-27 (box, `~/vg-coursepdf/run-348d4e79c`, read-only)

`--run daily-2026-10-26`: 102 courses, **10,097 rows** (24 free, 37 loose, 687 folded from a subtopic, 0 inactive), 187 same
file twice in a course, 5 files not imported, 552 ledger sources gone from AppX. AppX 97 "SSC EXAMS" and 116 "STATE EXAMS"
have no Course (category pages, task 08) and are skipped. Course 103: 40 topics, e.g. `Maths › Percentage (प्रतिशत)` 3.
`--run daily-2026-10-22 --courses 96`: 2 rows, 3 not imported. 148/149 have no PDFs.
Of 2,688 PDF topics, 2,592 equal a class topic in the course. The other 96 are AppX folders that hold only PDFs ("MOCK TEST
(PDF)", "E- BOOK", "Handwritten Notes PDF") and become their own topics.
Report: box `~/vg-coursepdf/out/dryrun-all-2026-10-26.{json,log}`.

## To commit (each step needs the user's go)

1. Indexes: `node ~/vidyagram-coursepdf-indexes.cjs` from the Vidyagram checkout (system-brain
   `reference/scripts/vidyagram-coursepdf-indexes.cjs`), then `--commit`. The collection is empty, so the build is instant.
2. Trial: `... apxCatalogImportCoursePdfs.ts --run daily-2026-10-26 --courses 103 --commit`. Check the admin Assign PDFs
   page for course 6ad5fa4c308a95d039c360fe, then rerun to show nothing changes.
3. Rest: `--run daily-2026-10-26 --commit`, then `--run daily-2026-10-22 --courses 96 --commit`.
   Undo: `coursepdfs.deleteMany({})` (the collection holds only this import's rows until admins add more; after that,
   delete by `_id` time range).

## Committed 2026-10-27 (user's go at each step)

1. Indexes built 13:5x IST, 8 present incl. unique `course_1_pdf_1`.
2. Course 103 trial: 180 rows, rerun 0. Admin Assign PDFs page: "180 assigned", MATHS 41 topics, Percentage (प्रतिशत) = ClassRoom
   Sheet / Class Notes / Pro Level Sheet, Free off, Download on.
3. All courses 14:02 IST: 9,917 rows in 101 courses; course 96 on daily-2026-10-22: 2 rows (16 AppX PDFs never imported).
   Reruns 0. Primary check: 10,099 rows / 103 courses, no orphan Pdf/Course, every row named, no repeated priority; 8 rows
   point to Pdfs with status 0. Ledger + undo: memory prod-data-changes.

## Later, not this task

- Nightly: built 2026-10-27; **DEPLOYED 2026-10-30 10:21Z** to test-uday as a narrow overlay (3-way merge of 660468e6c..a0aae70c9
  onto the deployed files; REVISION `+ course-pdfs-a0aae70c9`; backup `/home/raghav/vidyagram-nightly-backup-20261030T102100Z`).
  Same day the 101-row backlog (35 PDFs) was placed by hand first. `feat/vg-nightly-sync`
  a0aae70c9 (fast-forwarded to 348d4e79c first; local, not pushed): new step `course-pdfs` right after `pdfs`, so tonight's
  imported files are placed tonight (after `placement` as asked, but `pdfs` runs after `placement`); skipped when no course
  was captured; run doc counts rowsCreated / coursesTouched / notImported / noCourse; report
  `apx-catalog-course-pdfs-<runId>.json`. The import now goes through the step's `db` (sandbox-safe) and refuses a write
  without the unique index. Tests 55/55 (course PDF 9, course import 21, nightly 25), tsc clean.
  **Deploy trap:** test-uday runs `f79842940 + pacing + placement-7f9cfc649` as a file overlay. The branch's
  `vidyagramNightlySync.ts` / `vidyagramNightlySteps.ts` also carry the CMS-tree-default commits (130af1e86, ec1f2a4e5,
  e2bee8e70) that overlay lacks. So copying those two files brings them along. Either deploy the CMS tree with it, on
  purpose, or build a narrow overlay of the course-pdfs hunks onto the deployed copies. Also new: `apxCatalogCoursePdfImport.ts`,
  plus `apxCatalogCourseImport.ts` (only `courseToday` / `CourseToday` / `Filing` exported). The nightly is held anyway
  (10-27 02:30 run stopped: AppX session not live; 10-26 remediation hold).
- Course Builder chapter access matches CoursePdf topic names to class topics by name (`coursePdfChapter.ts`). The 96
  PDF-only topics will not match a chapter.
