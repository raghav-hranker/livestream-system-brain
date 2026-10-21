# Free-in-all-places changes, conversion script, Pdf.isFree audit

**Type**: AFK
**Blocked by**: #01 — Course-screen Free writes this course only

## What to build

PRD D6, D13, module "Free-in-all-places changes", conversion script. On a switch-over branch in the
backend fork (from the task 01 head or `origin/quicktricks-admin` once 02 is live).

- **Audit first, written into this task's notes before any code:** every **reader** and every
  **writer** of `Pdf.isFree`.
  - Backend readers known so far: the access check (`isEntitled`), the course PDF item builder, course
    search's course-PDF section (via the builder), the PDF serializer. Find the rest: class PDFs,
    practice batches, learn library, any app/website endpoint returning `isFree` from the PDF.
  - Student clients: check `thedhronas` for any read of a PDF's own `isFree` outside the course and
    class listings. The app is not in our repos; list the endpoints it calls that carry the PDF flag.
  - Writers known so far: PDF create/edit, `pdfController` bulk Free, the dashboard bulk upload sheet,
    whose "Free by default" is **ticked** on prod (`BulkUploadPdfsSheet`), and the course-screen paths
    task 01 fixed. Find the rest.
- **Free-in-all-places changes** (pure): one or many PDFs plus their places (course placements active
  and inactive, class `pdfAssignments`, legacy class `pdfIds`, practice-batch rows) and a target state
  → the per-place writes, with counts by kind. A legacy `pdfIds`-only class link is converted into a
  `pdfAssignments` entry so it can carry the flag (0 such links today).
- **Conversion script**: dry run by default, `--commit` to write. It backs up every document it will
  change to a JSON file, applies "free in all places" for every PDF with `Pdf.isFree` true, then
  clears `Pdf.isFree`. A re-run is a no-op. It prints the planned rows per PDF.
- **ADR** in the backend fork: "A PDF's Free is decided per place" (records D6 + D13; refer by title,
  the fork has two numbered series). CONTEXT term **Place free**.

## Acceptance criteria

- [ ] The audit lists every reader and writer, with file and line, in this task's notes.
- [ ] Unit tests: every place kind counted and written; legacy `pdfIds` converted; idempotent.
- [ ] Integration test: a seeded globally free PDF in two courses and a class → after `--commit`,
      every place is free, `Pdf.isFree` is false, and the student listing and access answers are the
      same as before.
- [ ] Dry run against prod (read-only) prints 14 PDFs, 41 course placements, 1 class attachment,
      0 batch rows (or explains any difference).
- [ ] ADR and CONTEXT entry written.

## User stories covered

- 42

## Notes

### Audit of `Pdf.isFree` (2026-10-03, before any code)

Sources: backend worktree `qt-pdf-free-place-backend` at task 01 head `4e758ade9`; admin
`qt-pdf-free-admin` at `a536e06`; student website `thedhronas` = the **local checkout at `71881ae`**
(branch `quicktricksbysahilsir-new`, not fetched, one unrelated uncommitted change). Line numbers are
at those commits.

**Backend readers (8 student-facing, 3 admin-only, 1 dead).** "OR" = transitional placement-or-global;
"raw" = the PDF's own flag only, the placement flag ignored.

| # | Where | Surface | How |
|---|---|---|---|
| R1 | `src/services/issuePdfAccess.ts:201` (`isEntitled`), loaded at `:384–390` | every `/access` mint (course, class, practice batch) | OR |
| R2 | `src/services/coursePdfItem.ts:133–137` | `GET /api/courses/:courseId/pdfs` (app Ebooks + website), via `coursePdfController.ts:809/836` | OR |
| R3 | same builder via `src/services/courseSearch/coursePdfSection.ts:50/87` | course search, course-PDF section | OR |
| R4 | `src/services/classTabs/classCardPdfs.ts:53` | course class cards' `classPdf`: class tabs (`classTabsQuery.ts:345/359`), course search classes (`courseSearch/classSection.ts:131`), `POST /api/courses/:id/todays-classes` (`courseClassController.ts:966`) | OR |
| R5 | `src/controllers/classController.ts:2459` (`getAssignedPdfsForClass`) | `GET /api/classes/:classId/pdfs` (public; website class PDF popup) and admin mount `/api/admin/classes/:classId/pdfs` | OR |
| R6 | `src/controllers/courseClassController.ts:706` (`getClassesForTopic`) | `GET /api/topics/:topicId/classes` `classPdf[].isFree` | **raw**, and it looks up `classDetails.pdfIds` only (`:626–630`), not `pdfAssignments` |
| R7 | `src/controllers/coursePdfController.ts:654` (`getAssignedPdfsForCourse`) | `GET /api/courses/:courseId/assigned-pdfs` (**public**, older grouped read) | **raw** — a placement-free PDF already shows paid here |
| R8 | `src/controllers/classController.ts:2331` → `utils/pdfSerializer.ts:94` (`getAvailablePdfsForClass`) | `GET /api/classes/:classId/available-pdfs` (**public**, the admin class picker) | raw |
| A1 | `src/controllers/coursePdfController.ts:803` | admin mount of the course listing: `pdfIsFree` half (task 01 lock) | raw, by design |
| A2 | `src/controllers/coursePdfController.ts:1112` (`getAvailablePdfsForCourse`, `requireAdmin`) | admin Available tab | raw |
| A3 | `src/controllers/pdfController.ts:466/502` via `serializePublicPdf` (pass-through) | admin `GET /api/pdfs`, `GET /api/pdfs/:id` (PDFs list "Type" column, PDF page) | raw |
| — | `src/services/search/mappers.ts:132–143` (`mapPdfDoc`) | none: imported in `search/registry.ts:12` but no registry entry uses it | dead |

Not readers of `Pdf.isFree` (checked): practice-batch listings (`practiceBatchController.ts:453` read
`PracticeBatchPdf.isFree`, a place flag), learn library (`LearnLibraryItem.isFree`, its own flag;
`sourcePdfId` is provenance only), `playbackController`/`realtimeTokenController`/`classAccessAuthz`
(`Class.isFree`), global search (Ebook/Course models).

**Backend writers (5 live paths + seeds).**

| # | Where | What |
|---|---|---|
| W1 | `src/controllers/pdfController.ts:161` (validate, `createPdfSchema` requires `isFree`, `schemas/pdfSchemas.ts:32`) → insert `:326` | `POST /api/pdfs` create (incl. duplicate) |
| W2 | `src/controllers/pdfController.ts:588` (`updatePdfSchema` requires `isFree`, `pdfSchemas.ts:60`) → `:767` | `PUT /api/pdfs/:id` edit — every edit re-sends it |
| W3 | `src/controllers/pdfController.ts:697–722` (`bulkUpdatePdfs`) | `PATCH /api/pdfs/bulk` — **no admin caller in `a536e06`** |
| W4 | `src/contracts/pdfUploadSession.ts:92` → `services/pdfUploadSession.ts:196` → `controllers/pdfUploadSessionController.ts:286/349` | bulk upload sessions and the single create's direct-upload path (memory "PDF create direct upload") |
| W5 | (fixed by task 01) `coursePdfController.ts:538–546` | course-screen bulk now writes `CoursePdf.isFree` only |
| — | `src/scripts/seedCoursesClassesPdfs.ts`, `seedAllCollections.ts:303` | dev seeds only |

`apxPdfAsset.ts:112` (AppX port create) does not set it (default false).

**Admin writers / readers (`qt-pdf-free-admin` @ `a536e06`) — removing them is task 04.**

- `components/admin/PdfForm.tsx:58/112/392` — "Free PDF" switch on create **and** edit → W1/W2
  (`hooks/api/use-pdfs.ts:188` session metadata, `:235–249` create form, `:294–315` edit form).
- `components/admin/BulkUploadPdfsSheet.tsx:187` — `globalSettings.isFree` defaults **true** ("Free by
  default", `:713–717`), applied to rows `:267/316`, per-row toggle `:931`, sent `:394` → W4.
- `components/admin/PdfsDashboard.tsx:193` — "Type" Free/Paid column (reader of A3). There is **no
  bulk Free action** in PdfsDashboard at this commit; nothing calls `PATCH /api/pdfs/bulk`.
- Course screens (`assign-pdfs/*`) already write `CoursePdf.isFree` (task 01); class sheet
  `assign-pdfs-to-class/AssignedPdfsViewForClass.tsx:364` writes `pdfAssignments.isFree`, but displays
  the R5 OR value, so a globally free PDF shows ticked there.

**thedhronas (local `71881ae`).** No read of a PDF's own `isFree` outside the course and class listings:
- `pages/courses/[slug]/[id]/index.tsx:704`, `pages/user/courses/[slug]/[id]/index.tsx:603`,
  `sharedComponents/cards/batch-course/BatchCoursePdfCard.tsx:110–115` read `pdf.isFree` from
  `GET /courses/:id/pdfs?groupBy=topic` (`utils/CommonAPIService.ts:3134`) = R2.
- Class PDF popup (`BatchCoursePdfPopup.tsx`, `/api/classes/:id/pdfs`, `CommonAPIService.ts:4198`)
  gates on the class's `isFree || isBuy` (`BatchCoursePaidClassCard.tsx:122`), not the PDF flag.
- `PracticeBatchPdfCard.tsx:111–113` reads `is_free` = the practice-batch place flag.
- `CoursePdfCard.tsx:94–96` and `CommonAPIService.ts:1621` read `is_free` from the **legacy PHP** API
  (`getCourseDataByTopic-v2`), not this backend.

**App (not in our repos): endpoints that carry a PDF free flag** — R2 (Ebooks tab), R3, R4 (class
cards' `classPdf`), R5, R6 (`/api/topics/:topicId/classes`), the practice-batch listing (place flag),
and the `/access` mints (R1).

**Surprises.**
1. R6/R7/R8 serve the **raw** global flag on public routes; R7 already disagrees with the access rule for
   placement-free PDFs, and R6 also ignores `pdfAssignments` entirely. After the conversion clears the
   flag, these three would show the 14 PDFs as paid while R1 (via the place) still opens them. Task 05
   must switch them to the place (or drop them) along with R1–R5.
2. W3 (`PATCH /api/pdfs/bulk`) has no admin caller — the "PdfsDashboard bulk Free" in the README does
   not exist at `a536e06`; task 05 can retire or repoint it.
3. Legacy class links: the resolver uses `pdfAssignments` when non-empty, else **all** of `pdfIds`
   (`utils/classPdfAssignments.ts:36–50`). A pdfIds-only link is therefore only visible when the class has
   no `pdfAssignments` at all; converting one must convert the class's whole `pdfIds` list, or every
   other legacy PDF of that class would vanish. A pdfId sitting in `pdfIds` of a class that does have
   `pdfAssignments` is invisible to students today and is not a place (left untouched, counted).
4. Every place kind has a Free field: `CoursePdf.isFree`, `Class.pdfAssignments[].isFree`,
   `PracticeBatchPdf.isFree`. No schema change needed.

### Build (2026-10-03, backend `0d9ce9db9` on `feat/pdf-free-per-place`, local, not pushed)

- Pure planner `src/services/pdfPlaceFree.ts` (`planFreeInAllPlaces(pdfIds, places, isFree)` →
  writes + `counts` + `reach` + `perPdf`); loader/applier/conversion `src/services/pdfPlaceFreeStore.ts`
  (raw collection writes, each guarded by the state it expects); CLI `src/scripts/convertPdfFreeToPlaces.ts`
  (no npm script: `package.json` is off-limits for agents). ADR `docs/adr/0024-pdf-free-is-decided-per-place.md`,
  CONTEXT "Place free" under Content Protection → Free PDFs.
- `reach` counts every place incl. inactive placements; task 04's "(N courses, M classes)" may want
  active-only — decide there.
- Prod dry run: not yet run (agents may not connect to prod). Expected: 14 PDFs, 41 active course
  placements (the total line also prints inactive ones), 1 class attachment, 0 batch rows.

### Prod dry run (2026-10-03, read-only, run by the user)

Matches the expected figures exactly: **14 PDFs, 41 course placements (all active, 8 courses),
1 class attachment** (class `6aa4044ed0cb6b41ae696b9c`, PDF "Current Affairs 01 (testing)"),
**0 legacy links, 0 practice-batch rows**; then clear `Pdf.isFree` on 14. Four PDFs sit nowhere (two
`qa-bulk-pdf-retry-*`, two `practicebatch_pdfs_*`); clearing their flag changes nothing a student
sees, since batches link only through `PracticeBatchPdf.pdf` and the batch populate never selects
`isFree`. Re-run the dry run just before task 06 in case a writer re-sets a global flag.
