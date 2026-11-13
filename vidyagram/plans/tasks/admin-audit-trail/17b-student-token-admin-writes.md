# Admin writes any student token can call, plus three leftovers

**Type**: AFK
**Blocked by**: 17
**Repo**: backend

## What to build

Task 17's inventory (`vidyagram/plans/admin-route-inventory-2026-10-30.tsv`) found admin writes that need only
`authenticateToken`, so any student who logs in can call them. Put them behind the route gate with `allow: admin`,
in report mode, the same way task 17 did.

- **Student-token admin writes.** There are 122 rows in the inventory, and many are plain admin deletes:
  - topics, subtopics, sections
  - categories, main-categories, main-menus
  - tags, custom-tags, instructions, faqs
  - authors, publishers
  - course class and test removal
  - series section and cutoff deletes
  - practice-batch assignments
  - notifications

  Reuse task 17's groups where the screen is the same (TAXONOMY, CATEGORIES, TEST_CONTENT, CONTENT, COURSE_ASSIGN…)
  and add the gate after `authenticateToken`. Check every row's admin-panel caller sends the token, the same way
  task 17 did. A row the app really calls as a student is left alone, with the reason.
- **`POST /api/users/batch-register`** (userRoutes): a bulk user create with no login and no admin-panel caller.
  Gate it as `admin` in a new `USER_BULK` group.
- **`/api/apx-ingest-jobs/*` (6 routes):** the apx-ingest-container worker calls these with no token. Don't use a
  login. Require a shared secret header like `requireTranscoderSecret`, behind an off/report/enforce setting named
  `APX_INGEST_SECRET_GATE`. Name the env var the worker must send, and where the worker's code lives if it's on this
  machine.
- **Update the inventory TSV**: set the owner and status for every row this task covers.

## Acceptance criteria

- [ ] Integration: one route per touched group gives 401 with no login and 403 with a student token in enforce, and
      200 for an admin. In report, a student call passes and logs `reason=not-admin`.
- [ ] Integration: batch-register follows the same rule. The apx-ingest routes refuse a missing or wrong secret in
      enforce and pass the right one.
- [ ] Report lists each route, its group, its admin caller, and whether that caller sends a token.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Story 47
