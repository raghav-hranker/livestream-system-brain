# Add PDFs the way Assign Classes adds classes

**Type**: AFK
**Blocked by**: #10 — Add existing PDFs here (merged), #09, #12 (merged)

## Why

Found in the local preview (2026-10-03): the user looked for "Add existing PDFs" and could not find it,
because it only lives in a topic's ⋯ menu. They asked for it "similar to how it is in assign classes".
Assign Classes (one-stop rounds 3–4, `components/admin/assign-classes/AssignedClassesView.tsx`) offers
adding at three levels; the PDF outline should match.

## What to build

- **Top "Add PDFs ▾" button** on the Assigned PDFs outline, placed like the classes' "Add classes ▾"
  (always visible, empty course included; the empty state points at it). Items:
  - **Add existing PDFs** — opens the Add existing PDFs sheet with **no place**. The sheet then shows an
    optional place picker (library Section › Topic, two levels — reuse `PlacePicker` as the classes top
    sheet does). The picker only says where the ticked PDFs go; it never filters the list (user rule
    for classes, 2026-10-03). Left empty, **each PDF goes where it is filed in the library** (placement
    names left unset, so the shared naming rule shows the library filing); a PDF with no library topic
    then lands in All Notes of its library section (or "No section").
  - **Upload new PDFs** — opens the existing `BulkUploadPdfsSheet` with auto-assign to this course, as
    the Available tab's "Bulk Upload & Assign" already does.
- **Section ⋯ → "Add existing PDFs here"** — the sheet for that section; like the classes section
  header, the sheet asks which of the section's topics (from the loaded outline, All Notes included)
  before Add is enabled.
- **Topic ⋯ → "Add existing PDFs here"** — keep, but styled like the classes item: icon + the hint
  "Pick from the PDF library".
- The sheet keeps task 10's rules: lands last, paid; already-in-course rows disabled with where they
  are; All Notes / "No section" refusals; names equal to the library filing cleared
  (`coursePdfPlaceNames`).
- **Backend**: `POST /api/admin/courses/:courseId/pdfs/assign` accepts "no place" (each where it is
  filed). Pick the wire shape (e.g. `place: null` or omitting both names under an explicit flag) so the
  existing `{sectionName, topicName}` meaning — `null` topic = All Notes — does not change.

## Acceptance criteria

- [ ] Component tests: the top button and its two items; the no-place sheet shows the picker, Add works
      with it empty and with a place; section ⋯ asks for a topic; topic ⋯ item has the hint.
- [ ] Endpoint test: no-place assign leaves names unset and lands last; the existing place-mode tests
      unchanged.
- [ ] Baselines unchanged; classes tests green.
