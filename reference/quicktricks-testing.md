# Testing the quicktricks forks

How to run, read and write tests in `quicktricks-backend` and `quicktricks-admin` worktrees. Task
agents read this before their first test; the facts here were each rediscovered by several agents
(retro 2026-10-03). Paths are relative to the repo root of the worktree.

## Running the suites

```sh
scripts/qt-tasks.sh suites <worktree> [docs/plans/tasks/<feature>/baseline-<side>.txt]
```

(`scripts/` here is system-brain's.) It runs every suite **one at a time** (parallel runs get
SIGKILLed and corrupt the baseline), writes logs plus `failures.txt` under `$TMPDIR/qt-suites/<worktree>/`,
reruns each failing vitest file alone once (flakes drop out), and with a baseline file prints only the
**new** failures. A suite that dies before reporting shows as `CRASHED`, never as clean.

- Backend takes ~6 minutes (unit ~1973 tests, integration ~644 on the one-stop line); admin several.
  Run it with `run_in_background`, or a Bash `timeout` of 600000 — the default 2 minutes kills it.
- **Baselines are files, not prose.** A feature's known failures live in
  `docs/plans/tasks/<feature>/baseline-{backend,admin}.txt`, taken with the command above on the
  integration head. Re-take it after a merge round; never re-measure by hand.
- One file: backend `node --require ts-node/register/transpile-only --test <file>`; admin vitest
  `npx vitest run --exclude '.sandcastle/**' <file>`; admin lib `node --test lib/<file>.test.ts`.
- Typecheck: `npx tsc --noEmit` (backend is clean on the one-stop line; admin has a pre-existing
  count — it is in the baseline file as `tsc: <file> TSxxxx xN` rows).

## Reading the output

- **node:test (backend, admin `lib/`) prints `ℹ tests N` / `ℹ pass N` / `ℹ fail N`** — spec
  reporter, not TAP. `grep '^# pass'` matches nothing. Failing names follow the `✖ failing tests:` line.
- **vitest** prints ` FAIL  <file> > <describe> > <test>` per failure and a `Tests  N failed | M passed` line.
- Pre-existing admin failures: BannedUsersDashboard, LearnLibraryDashboard, LearnLibraryPriorityEditor,
  PdfForm.section-topic (some flaky). They are in the baseline file; do not chase them.

## Shell

zsh on macOS. `~/.zshenv` sets `nonomatch noequals`, so unmatched globs and `echo ====` are safe —
still quote globs you mean literally (`--include='*.ts'`). BSD tools: `sed -i ''`, no `cat -A`.
No `timeout` binary; `sleep` is blocked in the harness (use `run_in_background`).

## Backend tests

- Unit: `src/tests/*.test.ts`. Integration: `src/tests/integration/*.integration.test.ts`.
- Integration harness `src/tests/integration/setup.ts`: `before(startMemoryMongo)`,
  `after(stopMemoryMongo)`, `beforeEach(clearCollections)`. Each file gets its own in-memory replica
  set, so transactions work and nothing touches a real database.
- Seed with `mongoose.connection.db!.collection('<name>').insertMany([...])`.
- Call controllers directly: a fake `{ params, body, user } as unknown as Request` and the
  `mockResponse()` helper — copy both from `adminCourseClassGroups.integration.test.ts`.
- Role-restricted paths: flip `ENABLE_ROLE_BASED_DATA_FILTER` on `require('../../config/baseConstants')`
  inside `try/finally` — see the "restricted role gets 403" test in the same file.
- One-off data scripts (backfills): copy `src/scripts/backfillClassHomeFiling.ts` (dry run by
  default, backup file, `--commit`, `--restore`, `DOTENV_CONFIG_PATH=.env.development`) and its
  `backfillClassHomeFiling.integration.test.ts`. Both are on `feat/assign-classes-one-stop`, not yet
  on origin.

## Admin tests

- `lib/**/*.test.ts` run under plain `node --test` (Node 24 strips types; vitest excludes `lib/**`).
  Runtime imports inside `lib/` must be **relative with the `.ts` extension**
  (`import { x } from './y.ts'`); `@/…` works only in `import type`. A `lib/` module with a runtime
  `@/` import (e.g. `upload-with-progress.ts`) cannot be node-tested — keep logic you test pure.
- Components: vitest + jsdom, setup `test/setup.ts`.
- Mocking `@/config`: partial mock,
  `vi.mock('@/config', async (importOriginal) => ({ ...(await importOriginal()), … }))`.

### `components/admin/assign-classes/`

- `AssignedClassesView.test.tsx` (~100 KB): mocks are declared at the top through `vi.hoisted`
  (`hooks`, `goLive`); helpers `renderView`, `layOutRows`, `keyboardReorder`. Grep for them; read by
  range.
- **Drag and drop (dnd-kit) under jsdom:** every rect is zero, so call `layOutRows()` (a
  `getBoundingClientRect` spy) before a pointer drag; the sensors are **Mouse, Touch and Keyboard,
  not Pointer** (`OutlineSortable.tsx`, `useSensors`); dnd-kit swallows clicks for ~50 ms after a
  drop, so wait before clicking. Keyboard reorder is the cheap path: `keyboardReorder(title, 'ArrowDown')`.

## File map: assign classes

Big files — grep the symbol, then read by offset/limit. Never `cat` them whole.

| What | Where |
|---|---|
| Page state, every mutation, refetch | admin `app/admin/courses/assign-classes/page.tsx` (`updateAssignment`, `handleRemoveClass`, `handleBulk*`; refetch from `useCourseClasses` in `hooks/api/use-course-classes.ts`) |
| Outline UI (~80 KB) | admin `components/admin/assign-classes/AssignedClassesView.tsx`: small parts first (`OutlineHeaderRow`, `AlsoUnderTag`, `OutlineHeaderMenu`, `OutlineMoveMenuItems`), then one large `AssignedClassesOutline` |
| Drag mechanics | admin `components/admin/assign-classes/OutlineSortable.tsx` |
| In-place create / upload (~33 KB) | admin `components/admin/assign-classes/AddClassInPlaceDialog.tsx`; backend `src/controllers/adminCourseClassInPlaceController.ts` |
| Outline read, reorder, taxonomy, listing priority | backend `src/controllers/adminCourseClassGroupsController.ts` |
| Student class listings | backend `src/controllers/courseClassController.ts` |
| Course PDF assignment (CoursePdf rows) | backend `src/controllers/coursePdfController.ts` |
| stream-status flip | backend `src/controllers/streamStatusController.ts` |
| Domain terms (Placement, Listing, Section/Subtopic order) | backend `CONTEXT.md` → "Course class order" — on `feat/assign-classes-one-stop` only until it is pushed; read it from `~/Projects/worktrees/qt-one-stop-backend` |
