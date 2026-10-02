# Tasks: Assigned Classes one-stop

State: `ready-for-agent` (01–06) · `ready-for-human` (07)

Vertical-slice breakdown of [the PRD](../../prd-assigned-classes-one-stop.md). The tasks cite the PRD's
numbered decisions instead of restating them.

**Working-copy rules**
- **Branch.** Both forks use `feat/assign-classes-one-stop`, cut from `feat/course-class-grouped-view`
  (backend `f86dfb19d`, admin `380a5d5`). Everything stays local: no push, no deploy.
- **Worktrees.** Work in the dedicated worktrees:
  - backend `~/Projects/worktrees/qt-one-stop-backend`;
  - admin `~/Projects/worktrees/qt-one-stop-admin`;
  - plus per-task worktrees when tasks run in parallel.

  **Never edit** `qt-grouped-view-backend` or `qt-grouped-view-admin`: the user's local preview runs
  from them.
- **No npm install in the admin.** It rewrites the lockfile, and `node_modules` is symlinked.
- **Commits.** Use the work email, with no co-author trailers.
- **Tests.**
  - Backend: `npm test`, `npm run test:integration`, `npx tsc --noEmit`. Baseline: 17 unit and 6
    integration failures, all pre-existing; tsc is clean.
  - Admin: `node --test 'lib/**/*.test.ts'`, vitest `--exclude '.sandcastle/**'` (14 pre-existing
    failures), `npx tsc --noEmit` (139 errors plus 1 stale `.next` error).

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Row Go live button, status pill and ⋯ menu](01-row-menu-go-live.md) | AFK | — |
| 02 | [Upload video from the row](02-upload-video-from-row.md) | AFK | 01 |
| 03 | [PDFs sheet from the row](03-pdfs-sheet.md) | AFK | 01 |
| 04 | [Tests sheet from the row](04-tests-sheet.md) | AFK | 01, class-tests auth fix |
| 05 | [Add recorded class here](05-add-recorded-class-here.md) | AFK | — |
| 06 | [Schedule live class here](06-schedule-live-class-here.md) | AFK | 05 |
| 07 | [Preview and deploy](07-preview-deploy.md) | HITL | 01–06, outline task 11 |

"Class-tests auth fix" is the separate task "Guard class test-assignment routes with requireAdmin".
