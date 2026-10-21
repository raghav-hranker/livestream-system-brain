# Hardened reorder; drags within a group; Reverse and Move up/down

**Type**: AFK
**Blocked by**: #07 — Outline read, end to end

## What to build

PRD D3; module Course PDF order (reorder half); hardened reorder endpoint.

- **Course PDF order** (pure): the admin's view of the active set + a new full order, a topic reverse,
  or a reverse of every topic → refusal (stale set, unknown or duplicate id) or priorities 1…N in
  outline order.
- **`PUT /api/courses/:courseId/pdfs/reorder` hardened**: exact active set, distinct priorities, one
  transaction, never the "clash → max+1" save hook, 409 on a stale set.
- **Admin**: drag a PDF within its topic, a topic within its section, a section within the course
  (same sortable component as classes; focusable keyboard handle). Topic ⋯: Reverse priority, Move up,
  Move down. Section ⋯: Move up, Move down. Toolbar ⋯: Reverse priority in every topic. Drag off while
  searching, with the note. 409 shows "This course changed since it was loaded. Refresh and try again."

## Acceptance criteria

- [ ] Unit tests: exact-set validation (missing, extra, duplicate → refusal); priorities 1…N; topic and
      all-topic reverse leave section and topic order.
- [ ] Endpoint tests: 409 on a stale set; a partial list is refused; one transaction (no half writes).
- [ ] Component tests: each drag and menu item sends the expected payload; handles disabled while
      searching.
- [ ] Integration: after a topic move, the student `groupBy=topic` read lists topic cards in the new
      order.

## User stories covered

- 11, 14–21
