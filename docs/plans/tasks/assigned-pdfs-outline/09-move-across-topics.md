# Move across topics: drag, multi-drag, Move to…

**Type**: AFK
**Blocked by**: #08 — Hardened reorder; drags within a group

## What to build

PRD D4, D5; module Course PDF order (move half); move endpoint.

- **Course PDF order, move**: PDF ids + target section and topic names + "before PDF X" or "last" →
  names and priorities. Names cleared when the target equals the PDF's library filing. Refused: All
  Notes for a PDF that has its own library topic.
- **`POST /api/admin/courses/:courseId/pdfs/move`**: names and priorities in one transaction; 409 on a
  stale set; 422 with the reason on a refusal.
- **Admin**: drag a PDF into any open topic, landing at the drop line; dragging a ticked row moves all
  ticked rows in outline order. Row ⋯ "Move to…" and selection-bar "Move to…" open the shared picker
  (library sections and topics; All Notes disabled with the reason when it would be refused); the PDF
  goes last. Empty topics and sections disappear. **No Reset action** (user, 2026-10-03).

## Acceptance criteria

- [ ] Unit tests: drop-point and last moves; multi-PDF moves keep outline order; names cleared on the
      library filing; All Notes refusal.
- [ ] Endpoint tests: one transaction; 409; 422 refusal writes nothing.
- [ ] Component tests: cross-topic drop payload; multi-drag payload; Move to… payload; All Notes
      disabled in the picker for such PDFs.
- [ ] Integration: after a move, the student read shows the PDF under the new section and topic, and
      another course holding the same PDF is unchanged.

## User stories covered

- 12, 13, 22–29
