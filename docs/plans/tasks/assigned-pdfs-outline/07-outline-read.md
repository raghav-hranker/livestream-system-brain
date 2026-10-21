# Outline read, end to end

**Type**: AFK
**Blocked by**: #01 — Course-screen Free writes this course only (merged into `feat/course-pdf-outline`)

## What to build

PRD D1, D2, D7, D11, D12; modules Course PDF naming, Course PDF outline, outline read, Admin outline
model (generalised), Assigned PDFs view. Read-only outline first; ordering comes in 08.

- **Course PDF naming** extracted from the student read into one pure function; the student read and
  the outline both call it. The "No Topic" → "English Grammar" relabel stays in the student read,
  outside the function.
- **Course PDF outline** (pure) and `GET /api/admin/courses/:courseId/pdf-outline` → Section › Topic ›
  PDFs in first-appearance order, each row with title as students see it, Sequence, size, Free (this
  course), Download, other-course count, the PDF's library topic, plus the active-set token later
  writes echo.
- **Admin outline model** made generic over depth (classes three levels, PDFs two). Every existing
  classes model test stays green.
- **Assigned PDFs view** rebuilt as the outline (layout as in the prototype): section and topic
  headers with counts and ⋯ buttons, rows with Sequence, title + meta, Free (this course), Download
  (all courses), Preview, ⋯ (Remove for now). Collapse per section and topic, Collapse/Expand all,
  search across title, topic and section.
- **Removed**: Priority box, "Priority from N", the Section text box and bulk Section; delete the
  unused assign-pdfs bulk-edit sheet. Selection bar: Free (this course), Download (all courses),
  Remove with a count confirmation.
- CONTEXT terms **Course PDF names** and **Course PDF order**.

## Acceptance criteria

- [ ] Ebooks golden and snapshot tests pass unchanged after the naming extraction.
- [ ] Unit tests: naming fallbacks (blank and whitespace fall through; no topic ⇒ All Notes); outline
      ordering, Sequence per topic, interleaved topics grouped; the outline agrees with the student
      read's grouping on the golden fixtures.
- [ ] Endpoint test: shape, admin-only.
- [ ] Component tests: headers and counts; no Priority or Section input; search narrows and opens
      matching topics; Remove confirms with a count.
- [ ] Classes outline tests all still green.

## User stories covered

- 1–10, 32, 49, 50, 61
