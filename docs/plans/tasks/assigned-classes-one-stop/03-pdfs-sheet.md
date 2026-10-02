# PDFs sheet from the row

**Type**: AFK
**Blocked by**: #01 — Row Go live button, status pill and ⋯ menu

## What to build

PRD decisions 1 and 8. The row ⋯ menu gets **PDFs**, which opens a side sheet for the class's PDFs.

- **Backend:** the class course count (PRD decision 1) is the number of courses where the class has an
  active placement. Admin auth.
- **Admin:** make `AssignedPdfsViewForClass` and `AvailablePdfsViewForClass` take `classId` as a prop.
  The `/admin/classes/assign-pdfs?classId=` page keeps working by passing it through.
- **The sheet** shows the class's PDFs with preview, reorder and remove, and lets the admin upload new
  PDFs (the bulk sheet with auto-assign) or attach existing ones.
- **Banner:** "Changes apply to this class in every course (N)".

## Acceptance criteria

- [ ] The PDF sheet opens from a row, lists the class's PDFs, previews through the signed admin
      access link, and supports reorder, remove, upload and attach.
- [ ] The banner shows the class's course count.
- [ ] The assign-PDFs page still works.
- [ ] Backend integration test for the count: it counts active placements only, each course once.
- [ ] Admin component test: the banner shows N, and the sheet passes `classId` to both views.
- [ ] Baselines stay green.

## User stories covered

- 6, 7, 9
