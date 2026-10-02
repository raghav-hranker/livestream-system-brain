# Tasks: Assigned Classes one-stop

State: 00–07 and 09–13 **done** (2026-10-02, local) · `ready-for-human` (08)

**Merged heads** of `feat/assign-classes-one-stop`: backend `4e9456e64`, admin `c37e774` (worktrees
`qt-one-stop-backend` / `qt-one-stop-admin`). Round 1 ended at backend `146653960`, admin `94cf488`.
Task 00 also sits alone on `fix/class-series-require-admin`
(backend `98a4a874a`, admin `a414e5a`, off origin) and was cherry-picked into the one-stop branch.
Final suites after round 2: backend tsc clean, 17 unit (of 1959) + 6 integration (of 597) failures
(baseline); admin 14 vitest failures of 440 (BannedUsers, LearnLibrary ×2, PdfForm.section-topic),
138 tsc errors (+1 stale `.next` in the integration worktree), lib 275/275. The integration admin
worktree carries an uncommitted `config.ts` → `localhost:5912` LOCAL PREVIEW edit: never commit it.

**Round 2 commits** (per-task branches `feat/assign-classes-one-stop-NN`, merge order 13, 09, 12, 10, 11):
13 admin `75e93b3` (backend unchanged) · 09 admin `5cb94f3` · 12 backend `4a5998eb8`, admin `afe848c` ·
10 backend `8d184b780` + `a4665385f`, admin `8787060` (task 12 merged into its branch: backend `838988534`, admin `f10652a`) · 11 backend
`38c008a7e` (test only), admin `40d69ed`.
Round 2 notes for the preview (08): nothing was checked in a browser or on a phone; keyboard reorder
stays inside a group (Move to… is the keyboard/phone path across groups); Remove now always confirms;
selection is per row, so ticking one place of a class in two places acts on that place only; a drop into
a topic with no section is refused (the move endpoint needs a section); the class PDFs tab still caps at
25 (pre-existing); student class-tabs ignore a moved place (known PRD gap).
Live in-place classes end at the end of the start's IST day (no live-duration default exists).

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
| 00 | [Guard class test-assignment routes with requireAdmin](00-class-tests-auth.md) | AFK | — |
| 01 | [Row Go live button, status pill and ⋯ menu](01-row-menu-go-live.md) | AFK | — |
| 02 | [Upload video from the row](02-upload-video-from-row.md) | AFK | 01 |
| 03 | [PDFs sheet from the row](03-pdfs-sheet.md) | AFK | 01 |
| 04 | [Tests sheet from the row](04-tests-sheet.md) | AFK | 00, 01 |
| 05 | [Add recorded class here](05-add-recorded-class-here.md) | AFK | — |
| 06 | [Schedule live class here](06-schedule-live-class-here.md) | AFK | 05 |
| 07 | [Row resource counts and the active switch](07-row-resources-and-active-switch.md) | AFK | 01 |
| 09 | [Row and bulk cleanup: Go live into ⋯, arrows out, Bulk edit trimmed](09-row-and-bulk-cleanup.md) | AFK | — |
| 10 | [Move to… (one row or a ticked set) and Reset](10-move-to.md) | AFK | 09 |
| 11 | [Drag across groups, and several classes at once](11-cross-group-multi-drag.md) | AFK | 10 |
| 12 | [Classes that appear in two places](12-classes-in-two-places.md) | AFK | 09 |
| 13 | [Class PDF upload: filed from the class, free in this class only](13-class-pdf-upload.md) | AFK | — |
| 08 | [Preview and deploy](08-preview-deploy.md) | HITL | 01–07, 09–13, outline task 11 |

Task 00 is on its own branch off `origin/quicktricks-admin` so it can deploy ahead of the outline; it is merged into the one-stop branch for task 04.

**Round 2** (2026-10-02, after the local preview): tasks 09–13, PRD section "Round 2". Wave 1 = 09 and
13 in parallel; then 10 and 12 (both after 09; they touch the same view, so merge one before starting
the other's merge); then 11. Task 08 runs once round 2 is merged.
