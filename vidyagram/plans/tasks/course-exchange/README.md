# Vidyagram course exchange: tasks

PRD: [`../../prd-vidyagram-course-exchange.md`](../../prd-vidyagram-course-exchange.md). Design record:
[`../../course-exchange.md`](../../course-exchange.md).

Repos: the Vidyagram backend (fork of quicktricks-backend, branch `vidyagram-admin`) and the Vidyagram admin
(fork of quicktricks-admin, branch `vidyagram-admin`). The app team builds the student sheet from the guide in
task 07. Nothing here touches quicktricks.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Lock the admin order exchange and extend-validity routes](01-lock-admin-order-routes.md) | AFK | None |
| 02 | ["Exchange to" list on single-course plans](02-exchange-to-list-on-plans.md) | AFK | None |
| 03 | [Eligibility policy, usage reader and exchange options](03-exchange-options-read.md) | AFK | 02 |
| 04 | [Student swap](04-student-swap.md) | AFK | 01, 03 |
| 05 | [Course-page exchange signal and order history label](05-course-page-signal-and-history.md) | AFK | 04 |
| 06 | [Admin exchange badge and undo](06-admin-order-view-and-undo.md) | AFK | 04 |
| 07 | [App guide and prod deploy](07-app-guide-and-deploy.md) | HITL | 01 to 06 |

Order: 01 and 02 run in parallel, then 03, then 04, then 05 and 06 in parallel, then 07.

**Done 2026-10-23:**
- **01:** backend 6cc9b06e5.
- **02:** backend 1bd406b67, admin 09bd58f.
- **03:** backend d63551c5d.
- **04:** backend 79669eeaf, plus 2782efced (the swap filter matches the stored `userId`).
- **05:** backend ea476302f.
- **06:** backend 500136c3a, admin 9903366. The merge needed one import-line conflict resolved by hand.
- **Fix after 05:** db042c2bb. The course-page `exchange` field takes the student from the bearer token
  (`bearerUserId`, a signature check only). It no longer trusts the body `userId`, because `by-id-2` is public.
- **Fix after the merge:** 4ed6a00ee. `bearerUserId` copes with a request that has no headers. It broke `courseTimeTablePersistence`, which the full suite caught.
- **Integration heads:** backend 4ed6a00ee, admin 62b03f2, both on `feat/vg-exchange`.
- **Task 07 prep (10-23):**
  - Guide written: `vidyagram/reference/vidyagram-course-exchange-api-guide.md`, with sample payloads from a real
    in-memory run.
  - Backend branch merged with `origin/vidyagram-admin` f7b191912, as 77cb63c2d.
  - Dist committed as beb7b0f36, using the new `scripts/qt-surgical-dist.sh`. It is 46 files (23 .js plus their
    maps). Two files from other people's work, which have source but no dist, were left out:
    `vidyagramMergeDuplicateMobileUsers`, `newClassFixtures`.
  - The exchange tests pass when run from `dist/`.
  - Box: on e2acfc9f with no `EXCHANGE_` lines in `.env.development`, so the switch is off by default. Its
    untracked `logs/` and `tmp/` files do not collide with the pull.
- **Backend deployed 2026-10-23 ~18:55 IST with the switch off:**
  - Pushed `vidyagram-admin` 29a28b223. That is our branch plus the other team's dd1d2d2d (exam score), which was
    already on the box and running from 17:52.
  - Box backup `~/vg-dist-backup-20261023-1855.tar.gz`, then `git merge --ff-only 29a28b223` and `pm2 restart 92`
    (restart 191, stable).
  - Smoke checks on the public URL:
    - the five order routes (`exchange-options`, `exchange-self`, `exchange-undo`, `PUT exchange`,
      `extend-validity`) return 401 with no token;
    - `by-id-2` returns 200 with `exchange: null`.
  - The `user-login-session-indexes` warning in the error log is old (21 earlier hits).
  - Not done:
    - the switch flip and a prod test with a test account;
    - an authenticated smoke check.
- **Admin deployed 2026-10-24.** Pushed `vidyagram-admin` 3a8022f (our branch merged with origin 4db989b).
  - Vercel deployment `vidyagram-admin-m9ck1m6xc` is Ready, aliased to admin.vidyagramar.com, and built in 7 min.
  - `exchangeToPlanIds` is in the live orders-page bundle.
  - The screens have not been clicked through in a browser yet.
- **Prod test 2026-10-24 with mock data** (`reference/scripts/vidyagram-exchange-prod-test.cjs`): passed, and cleaned up.
  - **API checks:** 19/19 pass. Covered: the course page field, options, swap, retry, My Courses before and after,
    history, another student's 404, admin swap 409, student undo 403, admin undo, and the 409 on a second swap.
  - **Admin click-through, signed in:** the picker shows the stored target; the badge shows from, to and usage; the
    Undo dialog names both courses; the undo landed and the card reads "Exchange undone" after a reload.
  - **Cleanup:** the test plan and order were deleted, the switch is off, and pm2 92 was restarted.
  - **Findings:**
    - (a) The 20 "… 2026" placeholder plans in vidyagramdb are tagged customer 472, so the admin hides them and they
      can't be swap targets.
    - (b) A saved target the picker can't list is kept on save, not dropped. Corrected after reading the code: the
      form sends its own saved ids, and only "Clear all" removes hidden ones. But the target is invisible, so it can't
      be removed on its own. It can only arise from writes outside the form, or a target that changes after it was
      saved. No fix for now; the option is an "Unknown plan" chip.
    - (c) A target plan's packages (test series) come along in a swap.
- **Switch on, 2026-10-24 ~13:25 IST,** at the user's request, for the app team (pm2 92 restart 195).
  - Their test plan is 6adc64706113c7929c32dc63, tagged `course-exchange-app-team`.
  - The guide gained a status line, a note that extras such as test series come along in a swap, and section 8
    (testing against production).
  - Rule until the app ships: swap lists go on test plans only.
- **Full suites on the heads (10-23):** NO NEW FAILURES on both sides. `retiredPlans.integration.test.ts` once
  failed 8 tests in a full run, passed 8/8 alone, and was clean on the rerun. Treat it as flaky under load.
- **Tests:** 10 new backend tests and 3 new admin tests pass on the heads. Each task's suites printed no new failures.
- **Source only, no dist.** The surgical dist build happens in task 07.

Two choices task 02 made that later tasks rely on:
- A stored target that later becomes a combo blocks saves of the source plan until the admin removes it.
- Task 03 must still drop non-single-course and `status` 0 targets when it builds the options. It does.

What task 03 leaves for task 04:
- `Order` has no `exchange` field in the schema yet. The policy reads it from the raw document, so 04 must add
  it.
- The options response sits inside the usual envelope, `{ state, data }`.
- `EXCHANGE_ENABLED` accepts 1, true, yes or on.
- AppX imports are spotted by the order-number prefixes APX-, CM- and TS-, plus the parent and merge markers.
  Our own checkout numbers start with ORD-.

What task 04 leaves for task 06:
- The shared write is `rewriteOrderGrant(orderFilter, targetPlanId, extraSet)` in `services/order.service.ts`.
  It writes through the raw collection, so `planId` can be matched in both stored forms.
- `loadHydratedOrder(orderId)` is the shared response hydration.
- `exchange.fromPlanId` and `toPlanId` are strings. `fromCourseIds` holds the source plan's single course.

What 05 and 06 leave for task 07:
- **The app must send its bearer token on `POST /api/courses/by-id-2`.** Without it, `exchange` is always
  `null`. Put this in the guide.
- **A missing source plan blocks Undo.** Undo returns 409 `source_plan_missing`, and the admin Exchange tool is
  refused while the swap is live. Such an order can only be fixed in the database. Plans are soft-deleted, so
  this only happens after a manual delete. We accept that.
- **The grouped customer view has no badge.** The badge shows on the order history rows and the order detail.
  `OrdersDashboard` (the grouped customer view) does not show it.

## Working copies

- Integration worktrees, both on branch `feat/vg-exchange`, cut 2026-10-23 from `origin/vidyagram-admin`
  (backend 34ccb32b2, admin 3263d80): `~/Projects/worktrees/vg-exchange-backend` and
  `~/Projects/worktrees/vg-exchange-admin`.
- Per-task worktrees are made with `scripts/qt-tasks.sh mkwt vg-exchange <NN>`. That creates
  `vg-exchange-<side>-<NN>` on branch `feat/vg-exchange-<NN>`. Merge back with
  `scripts/qt-tasks.sh merge vg-exchange <NN>`.
- `node_modules` is a symlink to the integration worktree's. Never install.
- Nothing is pushed or deployed from these tasks, and no real database is written to, except in task 07 with
  the user present.
- The admin `config.ts` must never be committed pointing at localhost.
- Commit as raghavsharma@hranker.com. No co-author trailers.

## Test baselines

`baseline-backend.txt` and `baseline-admin.txt` in this folder list the failures already present on the
integration heads. They were written with `scripts/qt-tasks.sh suites <integration worktree>` before any task
started. Before reporting, run
`scripts/qt-tasks.sh suites <worktree> vidyagram/plans/tasks/course-exchange/baseline-<side>.txt`. It must print
`NO NEW FAILURES`.
