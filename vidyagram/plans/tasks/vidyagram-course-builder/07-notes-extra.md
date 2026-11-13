# Notes extra

**Type**: AFK
**Blocked by**: #05 — Classes locked by chapter

## What to build

Notes open only for a build that kept Notes on. A class's attached notes follow the class (its chapter,
and in Revision only, only revision classes). A course PDF is resolved to a chapter of this course
through its section and topic names; an unresolved PDF is treated as not in any chapter and reported in
the test fixture notes. PDF access for a partial owner requires the chapter in scope and Notes in the
build. Free PDFs and free placements stay free.

## Acceptance criteria

- [ ] Partial owner with Notes: class notes and chapter PDFs open. Without Notes: both denied.
- [ ] PDF of an unbought chapter denied.
- [ ] Suites `NO NEW FAILURES`.

## User stories covered

- Story 18, 19
