# Revision-only access

**Type**: AFK
**Blocked by**: #05 — Classes locked by chapter, #08a — Revision tagging

## What to build

A Revision-only purchase opens only the classes tagged as revision, across the whole course. A chapter
scoped `revision` (task 05) opens a class only when its placement has `isRevision: true`; a chapter
scoped `all` opens every class, revision ones included. Class notes follow their class.

## Acceptance criteria

- [ ] Normal build: revision and non-revision classes of a bought chapter both play.
- [ ] Revision-only purchase: revision class plays, non-revision class denied, in every chapter.
- [ ] Revision-only purchase plus a later normal build of one chapter: that chapter opens fully.
- [ ] Suites `NO NEW FAILURES`.

## User stories covered

- Story 21
