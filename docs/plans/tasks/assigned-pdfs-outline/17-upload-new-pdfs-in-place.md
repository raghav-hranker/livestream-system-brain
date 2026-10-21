# Upload new PDFs in place, like Add recorded classes

**Type**: AFK
**Blocked by**: none (#15, #16 deployed)

## Why

User, 2026-10-12, looking at prod Courses – New → PDFs → Add PDFs ▾ → Upload new PDFs: the bulk upload
sheet asks Main Category, Category, Section and Topic under a "Global Settings" box, and they found it
confusing. They want it to work like Assign Classes' "Add recorded classes": add from the top, or from a
section or topic row, where the row pre-picks its place. Mockup approved in chat (two rounds):
a centred dialog, not the wide sheet.

Assign Classes already takes Main Category / Category from the course and asks only Section › Topic
(backend `src/services/courseClassInPlace.ts`, admin `components/admin/assign-classes/AddClassInPlaceDialog.tsx`).

## Decisions (user, 2026-10-12)

- **Entry points**, same as classes:
  - Top "Add PDFs ▾" → "Upload new PDFs": the admin picks Section and Topic.
  - Section header → "Upload new PDFs here": section fixed (locked field), the admin picks the topic.
  - Topic header (All Notes included) → "Upload new PDFs here": both fixed, straight to files.
  - Section and topic headers get the classes' hover **+** quick-add button (`quickAddMenu` /
    `HEADER_CONTROL_REVEAL` in `AssignedClassesView.tsx`) opening the same items as their ⋯ menu:
    "Upload new PDFs here" and "Add existing PDFs here" (hint "Pick from the PDF library"). The ⋯ menus
    gain "Upload new PDFs here" too.
- **Main Category and Category are never asked** when the course has both: they come from the course
  (`useCourse`). A course missing either falls back to showing those two pickers.
- **Description is dropped** from this dialog (editable later on the PDF page).
- **Active is kept**: per-row "Active" tick, default ticked.
- **Free means free in this course only** (per-row "Free here" tick, plus a "Free in this course: all"
  header tick). The upload session must send `isFree: false` for every file (never `Pdf.isFree` — today's
  sheet writes the global flag from this screen, the leak flagged in task 03); the Free ticks land on the
  CoursePdf placement after assign.
- **"Global Settings" box is gone.**

## What to build (admin)

- A dialog matching the mockup and the classes dialog's layout (`SCROLL_DIALOG*` from
  `assign-classes/dialog-layout.ts`): title "Upload new PDFs" / "Upload new PDFs to <Section>" /
  "Upload new PDFs to <Section> › <Topic>"; Section + Topic fields (picker or locked); a file chooser,
  then one compact row per file: drag handle, PDF icon, editable title (from the file name, as now),
  size, "Free here", "Active", remove; "Add more PDFs"; hint "They go last in <Section › Topic>, in this
  order." Footer note: "Filed in the PDF library under the course's own category (<Main › Category>)."
  Buttons Cancel / "Upload N PDFs". While uploading, rows show progress → "Added" with Preview; failed
  rows keep Retry.
- **Reuse the upload machinery** of `components/admin/BulkUploadPdfsSheet.tsx` (session create,
  coordinator, retry, recovery, preview) rather than rewriting it — e.g. a course-place mode alongside
  the existing `forClass` mode, or extract the upload state into a hook both use. The PDF library page
  (`PdfsDashboard`) bulk upload and the class "Upload PDFs" sheet keep their current behaviour.
- **Library filing (IDs)** vs **course place (names)**: the outline is by course PDF names
  (`types/course-pdf-outline.ts`), the upload session needs library IDs.
  - Top: library `SectionPick` / `TopicPick` (`assign-classes/PlacePicker.tsx`); place names = the picked
    names (as `AddExistingPdfsSheet`'s top picker does with `pickedPdfPlace`).
  - Section row: resolve the section id from its name (exact match via `/sections/dropdown?search=`);
    `TopicPick` for that section; place = row's sectionName + picked topic name. Unresolvable → show
    the section picker unlocked.
  - Topic row: topic id = the card's PDFs' `libraryTopic.topicId` (most common), its section from the
    topic; All Notes → topic null. Unresolvable → pickers unlocked, prefilled with what resolved.
  - Assign with `useAssignCoursePdfsIntoPlace` + `pdfAssignBody(pdfIds, {sectionName, topicName})` so the
    PDFs land last in exactly the clicked group, in the dialog's row order; then set Free on the ticked
    ones' placements (e.g. `useBulkUpdateCoursePdfs`, the outline's own Free path). If that needs a
    backend change, stop and report what is needed rather than changing the backend.
- Retire `UploadNewPdfsSheet.tsx` from the outline (the legacy screen keeps its own sheet).

## Acceptance criteria

- [ ] Component tests: the three entry points open the dialog with the right fields locked; header +
      button shows both items; no Main Category / Category / Description / Global Settings when the
      course has a category; fallback pickers when it has none.
- [ ] Session payload: mainCategory/category from the course, section/topic from the place, every file
      `isFree: false`, `isActive` per row.
- [ ] After upload: assign body carries the place names and the row order; Free ticks set the placement
      flag only.
- [ ] `BulkUploadPdfsSheet` existing tests (incl. recovery) and classes tests green; type check clean;
      baselines unchanged.
