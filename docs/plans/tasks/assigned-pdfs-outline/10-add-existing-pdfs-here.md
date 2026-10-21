# Add existing PDFs here

**Type**: AFK
**Blocked by**: #07 — Outline read, end to end

## What to build

PRD D9; assign-into-place endpoint; Add existing PDFs sheet.

- **`POST /api/admin/courses/:courseId/pdfs/assign`** `{pdfIds, sectionName, topicName}` → placements
  last in that topic, paid, under those names (cleared if they equal the PDF's library filing);
  inactive placements reactivated, not duplicated; PDFs already active refused per id. All Notes
  refused for PDFs with their own library topic.
- **Library list** for the sheet: the existing ranked admin PDF title search, each result marked
  "already in this course" or "has its own topic" where relevant.
- **Admin**: topic ⋯ → "Add existing PDFs here…" sheet with search, ticks, disabled rows with reasons,
  "Add N PDFs".

## Acceptance criteria

- [ ] Endpoint tests: lands last; reactivation; refusals; admin-only.
- [ ] Component tests: disabled rows and reasons; the request carries the topic's names.
- [ ] Integration: added PDFs appear last in that topic on the student read, locked for non-buyers.

## User stories covered

- 44–48
