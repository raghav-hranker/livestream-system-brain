# Vidyagram Course Builder Playground: tasks

PRD: [`../../prd-vidyagram-course-playground.md`](../../prd-vidyagram-course-playground.md). Prototype (the agreed
design, throwaway): [`../../../prototypes/course-playground/course-builder-playground.html`](../../../prototypes/course-playground/course-builder-playground.html).

Repos: the Vidyagram backend (fork of quicktricks-backend, branch `vidyagram-admin`) and the Vidyagram admin (fork of
quicktricks-admin, branch `vidyagram-admin`). Nothing here touches quicktricks.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Revision as an extra on every builder course](01-revision-extra.md) | AFK | None |
| 02 | [Playground source routes](02-source-routes.md) | AFK | None |
| 03 | [Create route: course, outline and builder in one transaction](03-create-route.md) | AFK | 01, 02 |
| 04 | [Courses screen builder strip: Revision extra and labels](04-builder-strip.md) | AFK | 01 |
| 05 | [Build a course page: the Content step](05-content-step.md) | AFK | 02 |
| 06 | [Price, Details, Review and Create](06-price-details-review.md) | AFK | 03, 04, 05 |
| 07 | [Local end to end on a copy of real courses](07-local-e2e.md) | HITL | 01 to 06 |
| 08 | [Deploy, demo course and app guide](08-deploy.md) | HITL | 07 |

Order: 01 and 02 in parallel; then 03, 04 and 05 in parallel; then 06; then 07 with the user; then 08.

## Working copies

- Integration worktrees on branch `feat/vg-course-playground`, cut from `origin/vidyagram-admin`:
  `~/Projects/worktrees/vg-playground-backend` and `~/Projects/worktrees/vg-playground-admin`.
- Per-task worktrees: `scripts/qt-tasks.sh mkwt vg-playground <NN>`; merge back with
  `scripts/qt-tasks.sh merge vg-playground <NN>`.
- `node_modules` is a symlink to the integration worktree's. Never install.
- Nothing is pushed or deployed, and no real database is written to, until task 08 with the user present.
- The admin `config.ts` must never be committed pointing at localhost.
- Commit as raghavsharma@hranker.com. No co-author trailers.

## Test baselines

Before task 01, write `baseline-backend.txt` and `baseline-admin.txt` here with
`scripts/qt-tasks.sh suites <integration worktree>`. Every task reports
`scripts/qt-tasks.sh suites <worktree> /Users/raghav/Projects/system-brain/vidyagram/plans/tasks/course-playground/baseline-<side>.txt`
printing `NO NEW FAILURES` (the baseline path must be absolute).

## Status

**Tasks 01–06 done 2026-10-28, merged on `feat/vg-course-playground` in both integration worktrees. Not pushed, not
deployed.** Integration heads: backend `62ace2bc6`, admin `f6f1faa`. Every task: NO NEW FAILURES (backend 93, admin 95).

- **01** backend d55ecda3a: Revision is a third build extra; `build.rules: 2` on new orders, older builds read the old
  way; Revision only refused at checkout/grant; ADR 0025. Open (user): Revision is unioned across a student's builds
  of one course, like Notes/Tests (a build without Revision gets revision classes if another build has it).
- **02** backend 36d09a0c8: `GET /api/admin/course-playground/sources` and `/sources/:courseId/outline`.
- **03** backend 32bcaa8ef: `POST /api/admin/course-playground/courses`, one transaction; taxonomy resolver.
- **04** admin ccdb69f: builder strip with the Revision extra, "Show in the app", MRP / maximum / minimum labels.
- **05** admin 87c2d9a: Build a course page, Content step, sidebar + Courses list button.
- **06** admin 5b969bd + backend 7563dca9b: Price, Details, Review, Create; listing price discountPrice = max,
  price = MRP ?? max.
- **07 local end to end (2026-10-28, partly):** six real courses exported read-only from vidyagramdb
  (`reference/scripts/vidyagram-playground-export.cjs`) into docker `vgplay-e2e-mongo` (:27033, rs0) with
  `vidyagram-playground-e2e-seed.cjs`; backend :5933 (`.env.localpreview`, git-ignored), preview admin
  `vg-playground-admin-preview` :3933 (config.ts → localhost, never committed); launch.json `vg-playground-backend`
  / `vg-playground-admin`.
  - Admin click-through by Claude: 3 sources, merge into one Maths section, rename to Quantitative Aptitude, Polity
    from GS, price 799/199/1999 with Notes 100, Tests hidden, Revision 150, Create off sale → landed on the outline;
    builder strip shows the saved extras.
  - Source courses, placements, PDFs and taxonomy byte-for-byte unchanged vs the export; only `searchNames` on the 58
    placed classes changed (by design).
  - `vidyagram-playground-e2e-check.mjs`: 26/26 (Revision gate, rules 2, hidden extra, Revision only 400, HTTP create,
    listing price, duplicate title, student refused).
  - Left for the user: their own click-through; banner upload (no storage locally); live Vidyagram has no course tests.
  - Seen: the builder strip's extra titles truncate ("No…", "Tes…", "Re…") at 1440 px.

## 2026-11-12: brought onto today's builder (not pushed, not deployed)

User: "bring it in but don't deploy". New worktrees `~/Projects/worktrees/vg-pg2-{backend,admin}` on
`feat/vg-course-playground-v2`, cut from origin/vidyagram-admin (backend a71a05570, admin 1dc5fd0c, both with task 14).
- Merged `feat/vg-course-playground`, **leaving out** the Revision-as-extra commits (backend d55ecda3a + ADR 0025,
  admin ccdb69fb): Revision only is paused (builder task 14), and `build.rules: 2` keeps task 14's meaning.
- Backend 34a48c4ff: Create stores the eBooks extra and validity tiers, Revision only off; tests 27/27.
- Admin c6b1ab30 + 80cae095: client `priceBuild` (server rule, floor), Price step with eBooks + the shared
  Validity block + a validity select in the student preview, Review blocks on validity errors, Details validity text
  follows the included tier, drafts v3 (a v2 draft drops Revision, eBooks off, Lifetime only).
- Suites NO NEW FAILURES both sides (baselines `../vidyagram-course-builder/baseline-*-v2.txt`). Local preview:
  launch.json `vg-pg2-backend` :5934 + `vg-pg2-admin-3000` (worktree `vg-pg2-admin-preview`, config.ts local only).
  The Content step loads; Price step only covered by component tests (no click-through yet). Old e2e check not rerun
  (its seed login file is gone).

**DEPLOYED 2026-11-13 ~13:57 IST** (user chose admin + backend): backend 6e326acea (surgical dist, 0 foreign) on pm2 92,
admin 763ee06d on Vercel (success). Rollback: box `git reset --hard 084d0978b && pm2 restart 92`.
