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

**Tooling from task 05** (backend `0cfee7714`):
- `src/models/CourseTopic.ts` declares a unique `{course:1, topic:1}` index named
  `course_1_topic_1_unique`, with `autoIndex: false` and `autoCreate: false`.
  - It is not in `app.ts`'s `createIndexes`/`syncIndexes` list, so a restart never builds it.
  - A unit test fails if `autoIndex` stops being false.
- `src/scripts/buildCourseTopicsUniqueIndex.ts`.
  - **Dry run (the default):** prints member health, the row count, existing indexes and every
    duplicate pair.
  - **`--commit`:** builds only when there are no duplicates and every member is healthy, using
    `commitQuorum: "majority"` and `readPreference=primary`. It never deletes anything.
- On the box, from the backend checkout (after the deploy has put the script there):
  ```sh
  DOTENV_CONFIG_PATH=.env.development npx ts-node --transpile-only src/scripts/buildCourseTopicsUniqueIndex.ts
  DOTENV_CONFIG_PATH=.env.development npx ts-node --transpile-only src/scripts/buildCourseTopicsUniqueIndex.ts --commit
  ```
- Duplicate check by hand (mongosh, on the PRIMARY):
  `db.coursetopics.aggregate([{ $group: { _id: { course: "$course", topic: "$topic" }, count: { $sum: 1 }, ids: { $push: "$_id" } } }, { $match: { count: { $gt: 1 } } }, { $sort: { count: -1 } }])`
- **Until the index exists**, writes upsert on (course, topic) with `updateMany`, so duplicate rows
  stay in step (same priority and active flag).
- **Order of work:** the script ships with the backend deploy, so run the dry run right after
  task 11's backend pull, and `--commit` with the user's go-ahead before anyone drags on prod.
  The index is a safety net, not a functional dependency, so task 11 can proceed with this order.

## Acceptance criteria

- [ ] The duplicate check has been run and the result shown to the user.
- [ ] The user has approved the build in chat.
- [ ] `db.coursetopics.getIndexes()` on the PRIMARY shows the unique `(course, topic)` index.
- [ ] Memory and this file record the build time.

## User stories covered

- None directly (a data-integrity precondition for 21, 22, 47)
