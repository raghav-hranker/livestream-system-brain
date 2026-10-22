# Course and practice batch page sections

**Type**: AFK
**Blocked by**: 03, 06
**Repo**: admin (backend only if a missing filter turns up)

## What to build

The course edit page and the practice batch edit page each get a Feedback section: the container's own
row, then its classes, PDFs and tests ranked worst first, using `/items` with `parentKind` and `parentId`.
Rows open the drawer from 06.

## Acceptance criteria

- [ ] Admin component tests: the course page section requests `parentKind=course&parentId=<id>` and
      renders the course row first; the practice batch page does the same with `practiceBatch`.
- [ ] Checked by hand on the local preview with seeded feedback; screenshot in the report.
- [ ] `NO NEW FAILURES` against the admin baseline (and backend, if touched).

## User stories covered

- Story 17
