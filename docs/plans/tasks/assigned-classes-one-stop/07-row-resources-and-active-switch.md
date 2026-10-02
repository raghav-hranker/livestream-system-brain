# Row resource counts and the active switch

**Type**: AFK
**Blocked by**: #01 — Row Go live button, status pill and ⋯ menu

## What to build

PRD decisions 3, 10 and 11. Two changes to every class row in the Assigned Classes outline.

**Resource counts.** An admin can't see which classes are missing notes without opening each ⋯ menu.
- **Backend:** the outline rows (`loadListingRows`, `services/courseOutlineRows`) carry `pdfCount` and
  `testCount`.
  - Count the class's PDF and series assignments through the existing resolvers
    (`resolveClassPdfAssignments` and the series counterpart in `classController.ts`), so legacy
    `pdfIds`/`seriesIds` count too.
  - Count only assignments whose Pdf / Series still exists: one batched `Pdf.find({ _id: { $in } })`
    and one `Series.find` per outline load, never a query per row.
  - The count is not narrowed by the admin ownership filter, so a restricted admin's sheet can list
    fewer than the count. Note it in the code; don't build around it.
- **Admin:** `RowResourceCounts` beside the status pill: `📄 2 · 📝 1` (lucide `FileText` /
  `ClipboardList` are fine in place of the emoji, if they match the row better).
  - Zeros show, in muted text. Never hide a zero: spotting zeros is the point.
  - `aria-label` such as "2 PDFs, 1 test".
  - Each count opens the PDF or Tests sheet for the row's class. If task 03 or 04 has not landed,
    that count is plain text, and the task that lands the sheet wires the click.

**Active switch.** The Status column shows "active" on every row, so it goes.
- Remove the Status header and cell (`AssignedClassesView.tsx`, the `Badge` toggle).
- Put a compact `Switch` (`components/ui/switch.tsx`) on the row, labelled "Active in this course".
  It calls `onUpdateAssignment(assignment.id, { status })`, the same write as the badge, and is
  disabled while that row saves.
- This is the **placement** status (`CourseClass.status`): off hides the class from students in this
  course only. It never touches `Class.status`.
- An inactive row is dimmed and gets an *Inactive* tag next to the status pill.
- Bulk Edit keeps Status; Copy still copies it.

## Acceptance criteria

- [ ] Every class row shows its PDF and test counts, zeros included, and they match the sheets.
- [ ] Counts refresh after a change in the PDF or Tests sheet (the sheets invalidate the outline query).
- [ ] The Status column is gone; the switch turns a row's placement on and off, and an inactive row is
      dimmed and tagged *Inactive*.
- [ ] The row still fits at phone width.
- [ ] Tests: backend — outline rows carry `pdfCount`/`testCount`, legacy ids counted, deleted
      Pdf/Series not counted. Admin — counts render (including 0), the switch sends the placement status
      update, an inactive row shows the tag.
- [ ] Baselines stay green.

## User stories covered

- 21, 22, 23, 24
