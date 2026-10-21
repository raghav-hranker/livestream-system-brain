# The place decides Free

**Type**: AFK
**Blocked by**: #03 — Free-in-all-places changes, conversion script, Pdf.isFree audit

## What to build

PRD D6, D13 step 2. `Pdf.isFree` stops granting access anywhere students read PDFs.

- Remove the PDF's own flag from: the access check (`isEntitled` order becomes admin → place free →
  entitlement), the course PDF item builder's effective `isFree`, and every other reader the task 03
  audit listed.
- Student responses keep the same `isFree` field, now meaning "free in this place".
- **Deploys only after the conversion has run** (task 06); before that it would lock the 14 PDFs.
  The task notes state this ordering in bold.

## Acceptance criteria

- [ ] Access tests: a place-free PDF opens for a non-buyer; a PDF with only `Pdf.isFree` no longer
      does; a paid one stays locked; admins always open.
- [ ] Listing tests: the lock icon follows the place flag only, for course, class and batch reads.
- [ ] The Ebooks golden and course-search tests change only in cases that relied on the PDF flag, and
      each such change is named in the commit message.
- [ ] Baselines otherwise green.

## User stories covered

- 40, 41, 42

## Notes

**This change must not deploy before the prod conversion (task 06, `scripts/convertPdfFreeToPlaces.ts --commit`) has run. Deployed first, it locks the 14 globally free PDFs in all 41 course placements and the 1 class attachment until the conversion runs.** `pdfFreeToPlaces.integration.test.ts` pins this: before the conversion, task 05 code returns 403 for the globally free PDF in every place.

Built 2026-10-03: backend `822271553` on `feat/pdf-place-decides-free` (worktree `qt-pdf-place-decides-backend`, on task 03 `0d9ce9db9`), local, not pushed. Tests: unit 2175 / 16 fail (base 17; the class-listing fixture fixed), integration 564 / 6 fail (base 551 / 6; +13 new in `pdfPlaceDecidesFree.integration.test.ts`), tsc clean.

What changed per reader (audit numbering from task 03). Before → after:

- R1 access (`services/issuePdfAccess.ts`, `isEntitled`): admin → place free → **Pdf.isFree** → entitlement becomes admin → place free → entitlement. `PdfForAccess` loses `isFree`, and the loader no longer selects it, so the PDF's own flag cannot grant access again by mistake.
- R2/R3 course PDF item builder (`services/coursePdfItem.ts`): `isFree` was placement OR PDF; now `CoursePdf.isFree` only. This covers the Ebooks tab (`GET /api/courses/:id/pdfs`), course search's course-PDF section, and the admin mount's `isFree`. The admin mount's `placementIsFree` and `pdfIsFree` are unchanged; they belong to task 04.
- R4 class cards' `classPdf` (`services/classTabs/classCardPdfs.ts`): attachment OR PDF → attachment only.
- R5 `GET /api/classes/:id/pdfs` (`classController.getAssignedPdfsForClass`): attachment OR PDF → attachment only.
- R6 `GET /api/topics/:topicId/classes` `classPdf` (`courseClassController.getClassesForTopic`): it served the raw PDF flag; now it serves the flag on the class's `pdfAssignments` entry for that PDF (`$anyElementTrue` over the array). Which PDFs are listed is still decided by `pdfIds`, as before; the writers keep `pdfIds` in step with `pdfAssignments`. A legacy `pdfIds`-only link has no `pdfAssignments` entry, so it is **paid**. That matches the resolver and R1, which already deny it.
- R7 `GET /api/courses/:id/assigned-pdfs` (`coursePdfController.getAssignedPdfsForCourse`, public; it reads the legacy `Course.assignedPdfs` array): raw PDF flag → the course's active `CoursePdf` placement flag. A PDF in that array with no placement is paid.
- R8 `GET /api/classes/:id/available-pdfs`: this is the admin class picker. The route is public, and the admin `AvailablePdfsViewForClass` does not read `isFree`. Raw PDF flag → always `false`: a PDF that is not attached has no place in this class. The fix is in `mapClassPdfListItem` (`utils/pdfSerializer.ts`): its default `isFree` is now `false` instead of the PDF's flag, and callers pass the place's flag.
- Practice-batch reads were already place-only: `POST /api/practice-batch/schedule` `is_free` comes from the batch row, and the populate never selects `Pdf.isFree`. The new integration test pins this.
- `mapPdfDoc` stays dead. Only its unused import in `search/registry.ts` was removed.
- Not changed: admin-only A1–A3 and the writers (task 04).
