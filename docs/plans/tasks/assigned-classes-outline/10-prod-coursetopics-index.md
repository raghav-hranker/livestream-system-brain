# Build the unique (course, topic) index on prod

**Type**: HITL
**Blocked by**: #05 — Course topic order: topic and section drag; delete Topic Priority page

## What to build

`coursetopics` has only `_id` on prod (114 rows, 11 courses). Build the unique `(course, topic)` index
that task 05 declares, **before** the deploy in task 11, with the user's explicit go-ahead.

- Read memory `mongo-index-build-commit-quorum` first. On rs0 a build hangs while a voter is down, so
  check every member is healthy and build on the PRIMARY.
- Before building, check for duplicate `(course, topic)` pairs. If any exist, show them to the user and
  get a decision; never auto-delete.
- Record the result: the index name, when it finished, and `getIndexes()` output.

## Acceptance criteria

- [ ] The duplicate check has been run and the result shown to the user.
- [ ] The user has approved the build in chat.
- [ ] `db.coursetopics.getIndexes()` on the PRIMARY shows the unique `(course, topic)` index.
- [ ] Memory and this file record the build time.

## User stories covered

- None directly (a data-integrity precondition for 21, 22, 47)
