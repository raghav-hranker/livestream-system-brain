# Playground source routes

**Type**: AFK
**Blocked by**: None
**Repo**: backend

## What to build

The two read routes the Content step needs, in a new router mounted at `/api/admin/course-playground`
(`requireAdmin`, full-access roles like course copy). PRD section "Playground backend routes".

- `GET /sources?search=&category=`: active and inactive courses (not deleted), newest first, max 200, each
  `{id, title, faculties: [name], mainCategory, category, isLive, isRecorded, status, counts: {sections, classes, pdfs, tests}}`.
  `search` matches title and faculty names (case-insensitive). Counts come from active placements only.
- `GET /sources/:courseId/outline`: `{course: {id, title}, sections: [{id, name, topics: [{id, name, subtopics:
  [{id, name, items: [...]}]}]}]}` in the course's own order (the website order the Courses outline uses).
  `item = {kind: 'class'|'pdf'|'test', id, title, meta}`: class `meta` = duration in minutes when known; pdf = page
  count when known; test = question count when known (else null). Class ids are Class ids, pdf ids are Pdf ids,
  test ids are Series ids. Section/topic/subtopic `id` are the shared taxonomy ids where they exist, null for a
  name-only group.
  - Classes: the active placements with their effective taxonomy (reuse `loadListingRows` / `buildCourseOutline`;
    extra APX display listings are not separate items — one item per class, at its primary placement).
  - PDFs (`coursepdfs`, by names): placed under the matching section/topic by name; a PDF with no topic goes to a
    subtopic-less group named "Section-wide" under its section (topic `id` null, `name` "Section-wide").
  - Tests (`coursetests`): under their `topic` when set, else "Section-wide" under the Series' section (or
    `overrideSectionName`).
  - Classes with no topic: in "Section-wide" under their section (they can be imported, but the builder needs a
    topic; task 06 asks the admin to place them).
- Response shapes typed in one place for the admin to copy into `types/`.

## Acceptance criteria

- [ ] Integration: a seeded course with classes under two sections, a PDF with and one without a topic, a test with
      a topic and one without returns them in the right groups and order.
- [ ] Integration: a class placed in two courses appears in both outlines with the same `id`.
- [ ] Integration: switched-off (`status` 0) and removed (`isActive` false) placements are left out; counts match.
- [ ] Integration: `search` matches a faculty name; non-admin and limited-role tokens are refused.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 2, 3, 9
