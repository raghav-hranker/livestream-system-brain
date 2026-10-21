# Copy scopes: PDF, selection, section, course

**Type**: AFK
**Blocked by**: #11 — Copy a topic to another course, end to end

## What to build

PRD D10. The remaining Copy entry points over the same endpoint and dialog.

- Row ⋯ "Copy to another course…" (one PDF), selection bar "Copy to another course" (ticked PDFs, in
  outline order), section ⋯ "Copy this section…", toolbar ⋯ "Copy to another course…" (whole course).
- Endpoint scope kinds: PDF ids, section, course (topic exists from 11).

## Acceptance criteria

- [ ] Unit tests for each scope kind (which placements, in what order).
- [ ] Endpoint test per scope; whole-course copy into a course that already holds most PDFs skips them.
- [ ] Component tests: each entry point opens the dialog with the right count.

## User stories covered

- 51
