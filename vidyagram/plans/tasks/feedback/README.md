# Vidyagram student feedback — tasks

PRD: [`../../prd-vidyagram-feedback.md`](../../prd-vidyagram-feedback.md).
Repos: Vidyagram backend (fork of quicktricks-backend, branch `vidyagram-admin`) and Vidyagram admin
(fork of quicktricks-admin, branch `vidyagram-admin`). The app team builds the student Rate sheet from the
guide in task 11. Nothing here touches quicktricks.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Class feedback end to end](01-class-feedback-end-to-end.md) | AFK | None |
| 02 | [Course, PDF and test feedback](02-course-pdf-test-feedback.md) | AFK | 01 |
| 03 | [Practice batch feedback](03-practice-batch-feedback.md) | AFK | 02 |
| 04 | [Ebook feedback](04-ebook-feedback.md) | AFK | 01 |
| 05 | [Class teacher link](05-class-teacher-link.md) | AFK | 01 |
| 06 | [Ranked tabs per kind](06-ranked-tabs-per-kind.md) | AFK | 01 |
| 07 | [Teachers tab and faculty page section](07-teachers-tab.md) | AFK | 05, 06 |
| 08 | [Course and practice batch page sections](08-container-page-sections.md) | AFK | 03, 06 |
| 09 | [Hide abusive notes](09-hide-notes.md) | AFK | 06 |
| 10 | [Tags page](10-tags-page.md) | AFK | 01 |
| 11 | [App team API guide](11-app-api-guide.md) | AFK | 02, 03, 04 |
| 12 | [Prod indexes, seed, deploy and backfill](12-prod-deploy.md) | HITL | 01 to 11 |

Order: 01 → (02, 04, 05, 06, 10 in parallel) → 03 after 02 → (07, 08, 09, 11 as their blockers land) → 12.

Done 2026-10-22: 01 (backend 42350c120, admin ad2e9ee), 02 (47a384345, 7e04d8d), 03 (64ddbf45c + build-buyer fix f7540d26f, admin 1151a41), 04 (c906c8fee), 05 (af7216913, 9ef03cc), 06 (b02018e07, f79418e), 07 (b3afb67fb, 3387795), 08 (admin dd6e13a), 09 (057527050, c140d01), 10 (2a6c61195, f29a237), 11 (guide in `vidyagram/reference/`), plus readable refusal messages (d46be69fe). Integration heads: backend 7ee2c1a53, admin 27c895e (both `feat/vg-feedback`, cut from `origin/vidyagram-admin` ab7d7b4e0 / b8416dc). 82 backend and 36 admin feedback tests pass on the heads. Checked by hand on a local preview (backend 5916, admin 3000 from a detached `vg-feedback-admin-preview` copy with config.ts pointed at localhost, local Mongo 27037 seeded with 600 demo ratings): Overview, Classes ranking, item drawer, Teachers, Tags page, course page section. Open before 12: the class teacher backfill has never run on real data (unmatched names unknown); the in-place class create on the Assign Classes outline still sends only `teacherName`; class notes PDFs are not rateable on their own (guide says rate the class).

## Working copies

- Integration worktrees (the orchestrator creates them first, then merges task branches into them):
  - backend `~/Projects/worktrees/vg-feedback-backend`, branch `feat/vg-feedback`, cut from
    `origin/vidyagram-admin`.
  - admin `~/Projects/worktrees/vg-feedback-admin`, branch `feat/vg-feedback`, cut from
    `origin/vidyagram-admin`.
- Per-task worktrees: `scripts/qt-tasks.sh mkwt vg-feedback <NN>` makes `vg-feedback-<side>-<NN>` on branch
  `feat/vg-feedback-<NN>`. Merge back with `scripts/qt-tasks.sh merge vg-feedback <NN>`.
- `node_modules` is a symlink to the integration worktree's. Never install.
- Nothing is pushed, seeded on a real database or deployed from these tasks except in 12, with the user present.
- The admin `config.ts` must never be committed pointing at localhost.
- Local preview, if a task needs a browser check: the course-builder README describes the local Mongo on
  port 27037 (db `vidyagramdb`) and the `.env.localpreview` launch. Reuse it.
- Commit as raghavsharma@hranker.com. No co-author trailers.

## Test baselines

`baseline-backend.txt` and `baseline-admin.txt` in this folder list the failures already present on the
integration heads. The orchestrator writes them with `scripts/qt-tasks.sh suites <integration worktree>`
right after cutting the worktrees, before any task starts. Run
`scripts/qt-tasks.sh suites <worktree> vidyagram/plans/tasks/feedback/baseline-<side>.txt` before reporting.
It must print `NO NEW FAILURES`.

## Shared vocabulary

- **Kind**: one of `course`, `practiceBatch`, `class`, `pdf`, `test`, `ebook`. `test` is a `Series`.
  There is no `faculty` kind. Teachers are rated through their classes.
- **Parent**: `{ kind: 'course' | 'practiceBatch', id }`, the container a student rated a class, PDF or
  test from. Required for those three kinds, absent for the others.
- **Feedback registry**: the one module that maps each kind to `load`, `authorize`, `facultyIds` and
  `consumed`. Task 01 creates it with the class entry. 02, 03 and 04 add entries. Nothing else may branch
  on kind.
- **Tag rule**: tags are complaint codes for the item's kind, allowed only at 1 to 3 stars, empty at 4 or 5.
- **Score**: the Bayesian average `(C·m + Σrating) / (C + n)` with `C = 10` and `m` the mean over the same
  filter. Task 06 defines it. 07 and 08 reuse it.
