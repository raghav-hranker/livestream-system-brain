# Course-screen Free writes this course only

**Type**: AFK
**Blocked by**: None — can start immediately

## What to build

PRD D6, D8, sequencing step 1. Stops the leak: ticking Free on a course's PDF screen changes that course
only. Built on a fix branch from `origin/quicktricks-admin` in both forks; deployable alone (task 02).

- **Backend.** `PATCH /api/courses/:courseId/pdfs/bulk`: `isFree` writes `CoursePdf.isFree` on this
  course's placements; `isDownloadable` keeps writing the PDF. The assign endpoint already accepts a
  per-course `isFree`; keep it.
- **Admin, Assigned PDFs tab** (today's flat table): the row Free checkbox and the bulk Free action call
  the bulk endpoint for this course instead of `PUT /pdfs/:id`. Label "Free (this course)".
  Download keeps writing the PDF, labelled "Download (all courses)".
- **Globally free PDFs** (`Pdf.isFree` true) show a ticked, disabled "Free (all courses)" checkbox with a
  lock and the hint "Ticked on the PDF page, so it is free in all N courses it is in. Untick it there."
  This state disappears after task 06.
- **Admin, Available PDFs tab**: the Free checkbox is actually sent, per course. Priority, Section and
  Download inputs go; a newly assigned PDF lands last.
- The row shows the effective state: per-course Free comes from the placement, not the PDF.

## Acceptance criteria

- [ ] Ticking Free on course A's Assigned tab sets that placement's `CoursePdf.isFree` and leaves
      `Pdf.isFree` and every other course's placement untouched (integration test).
- [ ] The bulk endpoint with `isFree` writes only the given course's placements; with `isDownloadable`
      it writes the PDFs (endpoint tests).
- [ ] A globally free PDF renders the locked "Free (all courses)" box; its checkbox cannot be changed
      from the course screen (component test).
- [ ] Assigning from the Available tab with Free ticked creates a placement with `isFree: true`; no
      Priority, Section or Download input remains (component test).
- [ ] A student who has not bought course A can open a PDF made free in A, and still cannot open it
      in paid course B (existing placement-free access tests extended).
- [ ] Baselines recorded on the branch base stay green.

## User stories covered

- 30, 31, 33, 34, 43
