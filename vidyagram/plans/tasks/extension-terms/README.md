# Vidyagram extension terms: tasks

PRD: [`../../prd-vidyagram-extension-terms.md`](../../prd-vidyagram-extension-terms.md). Prototype (throwaway):
[`../../../prototypes/extension-bulk-edit/index.html`](../../../prototypes/extension-bulk-edit/index.html), tab E.

Repos: the Vidyagram backend (fork of quicktricks-backend, branch `vidyagram-admin`) and the Vidyagram admin (fork of
quicktricks-admin, branch `vidyagram-admin`). The app needs no change. Nothing here touches quicktricks.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Extension terms on plans, read by the offer rule](01-plan-terms-in-the-rule.md) | AFK | None |
| 02 | [Editable default in the database](02-editable-default.md) | AFK | 01 |
| 03 | [Bulk preview, save and matching routes, list filter](03-bulk-routes.md) | AFK | 02 |
| 04 | [Remove the retired Extension card, filter and badge from the admin](04-remove-retired-admin-extension.md) | AFK | None (see its precondition) |
| 05 | [Plans list Bulk actions and the Extension terms dialog](05-bulk-actions-dialog.md) | AFK | 03, 04 |
| 06 | [Plan form card and Edit default](06-plan-form-card-and-default.md) | AFK | 05 |
| 07 | [Prod deploy and real-plan check](07-deploy-and-check.md) | HITL | 01 to 06 |

Order: 01 and 04 run in parallel; then 02, then 03; then 05, then 06; then 07.

## Working copies

- Integration worktrees on branch `feat/vg-extension-terms`, cut from `origin/vidyagram-admin`:
  `~/Projects/worktrees/vg-extterms-backend` and `~/Projects/worktrees/vg-extterms-admin`.
- Per-task worktrees: `scripts/qt-tasks.sh mkwt vg-extterms <NN>`; merge back with
  `scripts/qt-tasks.sh merge vg-extterms <NN>`.
- `node_modules` is a symlink to the integration worktree's. Never install.
- Nothing is pushed or deployed, and no real database is written to, until task 07 with the user present.
- The admin `config.ts` must never be committed pointing at localhost.
- Commit as raghavsharma@hranker.com. No co-author trailers.

## Test baselines

Before task 01, write `baseline-backend.txt` and `baseline-admin.txt` here with
`scripts/qt-tasks.sh suites <integration worktree>`. Every task reports
`scripts/qt-tasks.sh suites <worktree> vidyagram/plans/tasks/extension-terms/baseline-<side>.txt` printing
`NO NEW FAILURES`.

## Status

**Tasks 01–06 done 2026-10-26, merged on `feat/vg-extension-terms` in both integration worktrees. Not pushed, not
deployed.** Integration heads: backend `ba67f1dc2`, admin `fdf4266`.

- **01:** backend c475661e5. Per-plan `extensionTerms` and the parser; the offer rule reads them.
- **02:** backend a59e5b73d. `extensionsettings` singleton plus a 30 s cached resolver; `GET`/`PUT
  /api/plans/extension-defaults`; CONTEXT.md terms; ADR 0024.
- **03:** backend e873497b1. Preview, bulk save, matching routes; `extension=` list filter. `getPlans` was split into
  `adminPlansListQuery` + `adminPlansSlice` (reviewed: same conditions, same order, same response).
- **04:** admin bcee075. The retired Extension card, filter and Flow label are removed.
- **05:** admin 8716e2f. Bulk actions bar, `ExtensionTermsFields`, `ExtensionTermsDialog`, filter, badge.
- **06:** admin bc51722 (plan form card, Edit default) and 32d9b74. 32d9b74 is the stale-preview fix: the app's
  QueryClient keeps results for 5 min, so a reopened dialog showed the pre-save preview and Undo would have restored
  stale terms. It was found in the browser check.
- **Full suites on both heads:** NO NEW FAILURES against the baselines.
- **Local end to end** (docker `mongo:7` on :27032, seed `reference/scripts/vidyagram-extension-terms-e2e-seed.cjs`):
  - **API check** (`vidyagram-extension-terms-e2e-check.mjs`): 21/21.
  - **Admin click-through** at :3932 against backend :5932. It covered:
    - badges, the menu, a 3-plan save with preview ₹750 / ₹99 / ₹450, and the student's listing matching it;
    - single-plan prefill, Off, the fixed price greying out the minimum, Undo, and the `extension=custom` filter;
    - reopening after a save (fixed);
    - Edit default on top of the dialog: 91 days reached the student's listing, then was set back to 183;
    - the plan form card: 35% saved with the plan, and the offer moved to ₹350.
  - The preview admin is the detached worktree `vg-extterms-admin-preview`, whose `config.ts` points at localhost.
    It is never committed.
- **Deployed 2026-10-27 (task 07):**
  - **Live settings, read first:** only `LAPSED_EXTENSION_ENABLED=false` is set. The percent, days and minimum use
    the code defaults (50 / 183 / 125). So **no Vidyagram student is offered an extension**. The user's call is to
    leave the switch off for now.
  - **Merge:** both sides were merged with `origin/vidyagram-admin`, which carried Uday's plan-order-sync
    (54a0f2cac, 1e77492). The backend had one conflict, in the plans controller imports; both sides were kept, in
    c3f77d811. The suites printed NO NEW FAILURES.
  - **Dist:** 21f231299, 18 files, 0 foreign. 103/103 unit and 25/25 integration tests pass from `dist/`.
  - **Index:** `extensionsettings.singletonKey_1` (unique), built with
    `reference/scripts/vidyagram-extension-settings-indexes.cjs`.
  - **Backend:**
    - Pushed `vidyagram-admin` 8c6bbed59..21f231299. The first push timed out mid-upload and the retry went through.
    - Box backup `~/vg-dist-backup-20261027-1222.tar.gz`, then `ff-only` from ad06377b to 21f23129, and
      `pm2 restart 92` (restart 208).
    - Uday's plan-order-sync went live with it, by the user's call. The `planOrderSyncCron` runs every minute.
  - **Smoke:**
    - The six new routes and Uday's `/api/plan-order-sync-jobs` return 401 with no token.
    - `/plans/active` returns 200, with 82 plans, 0 extension offers and 0 terms.
    - The database has no `extensionsettings` document, no plan terms and no sync jobs.
  - **Admin:**
    - Pushed `vidyagram-admin` 679fee6..77a7cbf.
    - Vercel deployment `vidyagram-admin-lhb4q9td6` (`dpl_5HjoE8…`) is Ready after about 9 minutes and aliased to
      admin.vidyagramar.com.
    - The bulk dialog, the matching route, the plan form card and Edit default are all in the live chunks.
  - **Not done:**
    - Task 07 step 5, the signed-in real-plan check. It needs an admin login on the live site.
    - ~~Flipping `LAPSED_EXTENSION_ENABLED`~~ **done 2026-10-28 ~18:50 IST by the user's call:** `true` in
      `.env.development` (`.env.production` is a symlink to it), backup `.env.development.bak-20261028-pre-extension-on`,
      `pm2 restart 92` (restart 223). Window, percent, days and minimum unset = lapsed holders only, 50% / 183 d / ₹125.
      `reference/scripts/vidyagram-extension-offer-probe.cjs`: 12 of the 300 most recently lapsed pairs now get an offer
      (₹400 on the ₹999 Railway combo, ₹149 / ₹249 on the Maths batches). Undo: set `false`, `pm2 restart 92`.
    - **Window set 2026-10-28 ~19:25 IST by the user's call:** `LAPSED_EXTENSION_WINDOW_DAYS=30` added under the switch,
      backup `.env.development.bak-20261028-pre-extension-window`, `pm2 restart 92` (restart 224). My plans lists only
      active plans, so before this no card could carry an Extend offer. The app team's test holder (plan
      `6ae1a48029d21e519fbb530c`, 3 days left, paid ₹499) now gets "Extend by 6 Months" at ₹250 on Android/web,
      none on iOS (by design). Undo: delete the line, `pm2 restart 92`.
- **Before task 07 (resolved 10-27):**
  - The `PlanForm.tsx` change was the user's own, f1f79c5 from 10-24, already in the base.
  - Find out whose uncommitted `PlanForm.tsx` change sits in `~/Projects/worktrees/vidyagram-admin-ui`. Our branch
    rewrote the area around it, so merging it later may conflict.
  - Get the user's OK to read the box's `LAPSED_EXTENSION_*` values.
  - Build the `extensionsettings` unique index (step 2 of task 07).
