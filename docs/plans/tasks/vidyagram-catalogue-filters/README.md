# Vidyagram catalogue filters — tasks

PRD: [`../../prd-vidyagram-catalogue-filters.md`](../../prd-vidyagram-catalogue-filters.md).
Repos: Vidyagram backend (fork of quicktricks-backend, branch `vidyagram-admin`) and Vidyagram admin
(fork of quicktricks-admin, branch `vidyagram-admin`). The app team builds the student screens from the
prototype (`~/Downloads/Vidyagram-App.html#courses`, My courses screen). Nothing here touches quicktricks.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 00 | [Skills main category, seeded and guarded](00-skills-main-category-seed.md) | AFK | — |
| 01 | [Old batch end to end](01-old-batch.md) | AFK | — |
| 02 | [Exams tab with groups and counts](02-exams-tab-groups.md) | AFK | 00, 01 |
| 03 | [Skills tab](03-skills-tab.md) | AFK | 02 |
| 04 | [Remaining tabs and search](04-tabs-and-search.md) | AFK | 01 |
| 05 | [App handoff, seed on prod, deploy](05-app-handoff-and-deploy.md) | HITL | 00–04 |

Order: 00 ∥ 01 → 02 ∥ 04 → 03 → 05.

Done 2026-10-21: 00 (backend 138e6a19b, admin 84956d4), 01 (backend f4c40be8d, admin 328bd50), 02 (67a9fa15f), 03 (cb99d0471), 04 (a57ca3e6e). Integration heads: backend bcf96d5ee, admin cc30cb7. All checked by hand on the local preview (backend 5915, admin 3000, local Mongo 27037). Open before 05: a real form save on a complete course, a real Skills image for the seed, and the course-builder branch landing on `vidyagram-admin` first.

## Working copies

- Integration worktrees (the orchestrator creates them first, then merges task branches into them):
  - backend `~/Projects/worktrees/vg-filters-backend`, branch `feat/vg-catalogue-filters`, cut from the
    course-builder integration head `feat/vg-course-builder` (a59377b2e at the time of writing), because
    the course form and the course controller both changed there and the builder lands first.
  - admin `~/Projects/worktrees/vg-filters-admin`, branch `feat/vg-catalogue-filters`, cut from
    `feat/vg-course-builder` (66dd030).
- Per-task worktrees: `scripts/qt-tasks.sh mkwt vg-filters <NN>` → `vg-filters-<side>-<NN>` on branch
  `feat/vg-catalogue-filters-<NN>`. Merge back with `scripts/qt-tasks.sh merge vg-filters <NN>`.
- `node_modules` is a symlink to the original Vidyagram worktree. Never install.
- Nothing is pushed, seeded on a real database or deployed from these tasks except in 05, with the user present.
- The admin `config.ts` must never be committed pointing at localhost.
- Local preview, if a task needs a browser check: the course-builder README describes the local Mongo on
  port 27037 (db `vidyagramdb`) and the `.env.localpreview` launch; reuse it.

## Test baselines

`baseline-backend.txt` and `baseline-admin.txt` in this folder list the failures already present on the
integration heads. The orchestrator writes them with
`scripts/qt-tasks.sh suites <integration worktree>` right after cutting the worktrees, before any task starts.
Run `scripts/qt-tasks.sh suites <worktree> docs/plans/tasks/vidyagram-catalogue-filters/baseline-<side>.txt`
before reporting; it must print `NO NEW FAILURES`.

## Shared vocabulary

- **Tab**: one of `all`, `exam`, `skills`, `new`, `live`, `vod`, `old`, `free`, sent as `tab` on
  `POST /api/courses/filter`. Absent `tab` = today's behaviour minus old courses.
- **Catalogue rule**: the one pure module that says which query clauses a tab adds and which tabs may list a
  course. Task 01 creates it; 02, 03 and 04 extend it; nothing else may hard-code a tab rule.
- **Groups**: the `groups` array in the filter response (main category → categories, each with
  `coursesCount`). Task 02 defines its shape; 03 reuses it unchanged.
