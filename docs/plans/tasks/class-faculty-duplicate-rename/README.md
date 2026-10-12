# Tasks: Change faculty, duplicate with courses, rename with aliases

State: ready-for-agent (01–02, 04–06, 08–12) · ready-for-human (03, 07, 13)
PRD: [`prd-class-faculty-duplicate-rename.md`](../../prd-class-faculty-duplicate-rename.md). Tasks cite its
sections instead of restating them. Mockups: faculty https://claude.ai/artifact/XBQiVGYJfDWf8LTBgxRrQY,
duplicate/rename/aliases https://claude.ai/artifact/TEEAjaAEeWm8KfgmeBS26i.

Three features, each deployable alone, built in this order: A (faculty), B (duplicate), C (rename).

| # | Task | Type | Blocked by |
|---|------|------|------------|
| 01 | Change faculty from the row ⋯ | AFK | None |
| 02 | Faculty in Bulk edit | AFK | 01 |
| 03 | Deploy faculty | HITL | 01, 02 |
| 04 | Duplicate on the Classes page with pre-ticked courses | AFK (high) | None |
| 05 | Add other courses in the Duplicate dialog | AFK | 04 |
| 06 | Duplicate from the Assign Classes row ⋯ | AFK | 04 |
| 07 | Deploy duplicate | HITL | 04, 05, 06 |
| 08 | Rename in this course only | AFK (high) | None |
| 09 | Rename everywhere | AFK | 08 |
| 10 | Admin search finds every name | AFK | 09 |
| 11 | "Also known as" chips | AFK | 09 |
| 12 | Live classes by course shows the course's name | AFK | None |
| 13 | Deploy rename and aliases | HITL | 08–12 |

## Working-copy rules

- **Base.** Every feature branch was cut on 2026-10-12 from `origin/quicktricks-admin`: backend
  `f41b15314`, admin `ccba8bc`.
- **Integration worktrees** (only the orchestrator merges into them), under `~/Projects/worktrees/`:

  | Feature | Prefix | Branch (both forks) | Tasks |
  |---------|--------|---------------------|-------|
  | A | `qt-faculty` | `feat/class-faculty` | 01–03 |
  | B | `qt-dupcourses` | `feat/class-duplicate-courses` | 04–07 |
  | C | `qt-rename` | `feat/class-rename-aliases` | 08–13 |

- **Task worktrees.** `scripts/qt-tasks.sh mkwt <prefix> NN` makes `<prefix>-{backend,admin}-NN` on
  `<branch>-NN`. Merge with `merge <prefix> NN` and remove with `rmwt <prefix> NN`.
- **node_modules** is symlinked. The backend links to `qt-backend-playback-cdn/node_modules`, which has
  `exceljs` and `ffmpeg-static`. The admin links to `~/Projects/quicktricks-admin/node_modules`. Never run
  `npm install`.
- **Tests.** Run `scripts/qt-tasks.sh suites <worktree> docs/plans/tasks/class-faculty-duplicate-rename/baseline-<side>.txt`.
  It must print `NO NEW FAILURES`. How to run, read and write tests is in
  [`reference/quicktricks-testing.md`](../../../../reference/quicktricks-testing.md).
- **Commits.** Use the work email. No co-author trailers. No `dist/` changes in AFK tasks. The deploy tasks
  build the dist surgically (memory `quicktricks-backend-dist-deploy`).
- **Prod.** Transactions need `startPrimarySession()`, because the prod URI is `secondaryPreferred` and
  Mongo refuses a transaction on a non-primary read preference. The integration harness connects the
  same way.

## Progress

(filled in as tasks merge)
