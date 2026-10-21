# PDF page and PDFs list: Free in all its places

**Type**: AFK
**Blocked by**: #03 — Free-in-all-places changes, conversion script, Pdf.isFree audit

## What to build

PRD D14. The PDF itself stops carrying a Free switch; the PDF page offers one-time bulk actions instead.

- **Backend.** One admin endpoint for one or many PDFs: `{pdfIds, isFree, preview}`. Preview returns
  the counts (courses, classes, practice batches) and writes nothing; otherwise it writes through
  Free-in-all-places changes. The admin PDF list returns per PDF "free in X of Y places".
- **Admin.**
  - Create form (and the dashboard bulk upload when not opened from a class): no Free control. Where
    the upload is opened from a class, the per-class "Free in this class" meaning stays (one-stop).
  - Edit page: "Make free in all its places (N courses, M classes)" and "Make paid in all its places",
    each with a confirmation showing the preview counts.
  - PDFs list: the bulk Free action becomes the same two actions for the ticked PDFs; the Type column
    shows "Free in 3 of 6" / "Paid" / "Not placed".
- Stops every admin write to `Pdf.isFree` found by the task 03 audit.

## Acceptance criteria

- [ ] Endpoint tests: preview writes nothing; a real call writes every place; non-admin 403.
- [ ] No admin path writes `Pdf.isFree` any more (grep + tests on the create, edit, bulk and upload
      requests).
- [ ] Component tests: confirmation shows the counts; the list column renders the three states.
- [ ] Baselines stay green.

## User stories covered

- 35, 36, 37, 38, 39
