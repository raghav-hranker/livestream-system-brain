# Vidyagram course selling rules: tasks

PRD: [`../../prd-vidyagram-course-selling-rules.md`](../../prd-vidyagram-course-selling-rules.md). Prototype (throwaway):
[`../../../prototypes/course-form-compact/index.html`](../../../prototypes/course-form-compact/index.html). Fuller rule
logic: [`../../../prototypes/course-selling-rules/index.html`](../../../prototypes/course-selling-rules/index.html).

Repos: the Vidyagram backend (fork of quicktricks-backend, branch `vidyagram-admin`) and the Vidyagram admin (fork of
quicktricks-admin, branch `vidyagram-admin`). The app and website teams build from the guide in task 16. Nothing here
touches quicktricks.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Test two plans on one course by hand](01-test-two-plans-by-hand.md) | HITL | None |
| 02 | [Four-step form with today's fields](02-four-step-form.md) | AFK | None |
| 03 | [Course makes its main plan](03-course-makes-main-plan.md) | AFK | 02 |
| 04 | [Course-made plans on the Plans page](04-plans-page.md) | AFK | 03 |
| 05 | [Tool to connect old courses, dry run only](05-connect-tool-dry-run.md) | AFK | 03 |
| 06 | [Connect the 46 courses and first release](06-connect-46-first-release.md) | HITL | 04, 05 |
| 07 | [Pricing plans](07-pricing-plans.md) | AFK | 01, 03 |
| 08 | [Discount codes and timer](08-discount-codes-timer.md) | AFK | 03 |
| 09 | [Combos and sub courses](09-combos-sub-courses.md) | AFK | 03 |
| 10 | [Attach products](10-attach-products.md) | AFK | 03 |
| 11 | [Extension row](11-extension-row.md) | AFK | 03 |
| 12 | [Exchange row](12-exchange-row.md) | AFK | 03 |
| 13 | [Add-on](13-add-on.md) | AFK | 03 |
| 14 | [Reports keep upgraded orders, close access gaps](14-upgraded-orders-reports.md) | AFK | None |
| 15 | [Upgrade with removal, switch off](15-upgrade-with-removal.md) | AFK | 13, 14 |
| 16 | [Offers and warning on the owned course's page](16-offers-and-warning.md) | AFK | 13, 15 |
| 17 | [Connect the other 26 courses](17-connect-remaining-26.md) | HITL | 05, 09, 10 |
| 18 | [Final release and turn upgrade on](18-final-release-upgrade-on.md) | HITL | All |

Order: 01, 02 and 14 can start at once. Then 03, then 04 and 05, then 06. After 03, tasks 07 and 11 can run in parallel.
Tasks 09, 10, 13, 12 and 08 run one at a time in that order, because each extends the shared sync (see Adding a rule).
Then 15, then 16. Task 17 follows 05, 09 and 10. Task 18 is last.

## Decisions behind this split

- Upgrade removal sets `status: 0` plus a label, so access checks need no new rule. Task 14 protects the revenue reports.
- Connecting old courses comes early, because rows can only pick connected courses.
- Upgrade stays behind a switch until the app shows the warning.
- Each rule owns its files from task 03, but only tasks 07 and 11 fit that alone. A review found the others need the sync extended: 09 and 10 remove courses from a plan, 13 writes a plan on another course, 12 needs another course's plan id, 08 writes coupons, and 10's row sits on Content. They run in sequence rather than building that all up front.

## Assumptions to confirm

These are the PRD's defaults. Changing one changes the tasks named.

- Past buyers get what's added to a course later (09, 10). New buyers only would add a large order job first.
- One discount code per course (08). Several needs a backend change.
- Attached books are free (10).

## Working copies

- Integration worktrees on branch `feat/vg-course-selling`, cut from `origin/vidyagram-admin`:
  `~/Projects/worktrees/vg-selling-backend` and `~/Projects/worktrees/vg-selling-admin`.
- Per-task worktrees: `scripts/qt-tasks.sh mkwt vg-selling <NN>`; merge back with
  `scripts/qt-tasks.sh merge vg-selling <NN>`.
- `node_modules` is a symlink to the integration worktree's. Never install.
- Never `git stash` in a task worktree. All worktrees of a repo share one stash stack, so two agents' stashes swap.
  Compare against a commit with `git diff <sha>` or `git worktree add` instead.
- Nothing is pushed or deployed, and no real database is written to, outside the HITL tasks with the user present.
- The admin `config.ts` must never be committed pointing at localhost.
- Commit as raghavsharma@hranker.com. No co-author trailers.

## Adding a rule

From task 03, a rule that only adds fields to `selling`, changes the course's own plans or writes Course fields is one file on each side plus one registry line. `Course.selling` is Mixed on the model and the parsers are built from the registries. Only tasks 07 and 11 fit that alone.

- **Backend, `src/services/courseSelling/`:** a `SellingRule` (`core.ts`) in its own file, like `price.ts`, listed in `registry.ts`. It gives `shape` (its zod fields of `selling`), `refine`, `plans(course, planned)` (its part of `plansForCourse`) and `courseFields(selling)` (the Course fields older readers use). Going off sale is applied to every rule's plans in `plans.ts`.
- **Admin, `components/admin/course-form/`:** a `PricingRow` (`pricingRow.ts`) in its own file, like `AllowPaymentRow.tsx`, listed in `pricingRowRegistry.ts`. It gives `step` (`pricing` or `content`, the step it renders on), `shape`, `refine`, `initial`, a one-line `summary`, and `switchField` or `Fields` or both.
- **Sync:** `sync.ts` owns writing. It compares by `courseSale.key` and turns off any plan with this `courseSale.courseId` that no rule wants. Two plans on one key converge: the one with the most orders stays, then the oldest, and the other turns off sale. Object plan fields compare by value, whatever the key order. `DesiredPlanFields` lists the Plans fields sync writes, so a new one goes there.
- **A course save never shrinks `Plans.course`** (`courseListKeeping` in `sync.ts`). The exceptions are items a rule recorded adding (`courseSale.comboCourses`, `attachedCourses/Tests/Books`). Those are released only when nobody holds the course through its main plans.
- **How a rule reads another course.** A rule's parts see only this course. A rule that needs another course names it in `otherCourses(selling)`.
  - Before `plansForCourse` runs, `sellingLookup` (sync.ts) loads a `SellingLookup` for every named course: `firstMainPlanIds` and `courses`, the course as selling reads it. A course that is gone, or has no such plan, is missing from it.
  - The rule reads the lookup in `mainPlanFields(selling, lookup)` or through `offerPlansForCourse`, so it stays pure and its tests pass a hand-built lookup.
  - A save syncs only the saved course. When the other course changes, its sync must reach back: `followThisCourse` for Exchange, `syncIncomingOffers` for add-ons.
- **Field ownership on offer plans** (`addon:*`, later `upgrade:*`) is `OFFER_PLAN_FIELD_WRITER` in `core.ts`. The source writes price, validity, offer fields and on-sale. The destination writes contents and text. Both compute on-sale with `addonOnSale`.
- **Tests:** the throwaway rules in `courseSellingRules.test.ts`, `courseSellingMainPlan.integration.test.ts`, `CourseForm.pricing.test.tsx` and `CourseForm.rowStep.test.tsx` show the shape.

### What one file can't do

These tasks extend the shared code when they run. Nothing is built for them in advance.

| Task | What it adds beyond its own file |
|---|---|
| 09, 10 | Removing a course from a plan. `courseListKeeping` only ever adds, so each owns removal and its warning |
| 13 (and 15's upgrade plans) | Writing a plan on another course. `upgrade:*` and `addon:*` plans sell the destination, so the sync's turn-off must be narrowed first, or saving the destination turns them off |
| 12 | Another course's plan id, because `plans(course, planned)` sees only this course |
| 08 | Writing coupons, which `sync.ts` doesn't touch |
| 10 | A Content row's validation error. `step` renders the row on Content, but `FIELD_STEP` in `lib/course-form-steps.ts` sends every `selling` error to Pricing, so the form would open the wrong step |

Tasks 09, 10, 13, 12 and 08 run one at a time, in that order, because each changes the shared sync.

## Test baselines

Before the first AFK task, write `baseline-backend.txt` and `baseline-admin.txt` here with
`scripts/qt-tasks.sh suites <integration worktree>`. Every AFK task reports
`scripts/qt-tasks.sh suites <worktree> vidyagram/plans/tasks/course-selling-rules/baseline-<side>.txt` printing
`NO NEW FAILURES`.

## Status

Tasks written 2026-11-05. Integration worktrees cut from backend 2873f5679 and admin 36960a33. Baselines recorded: backend 98, admin 88 known failures.

- **14:** backend 450500cc4, admin 2c4281cd. The packageUtils gaps were not real. Three in plansController and one in `getOrdersByUser` were, and are closed. A seventh money reader, `GET /orders/stats`, was found and fixed. Report totals on a copy of real data were not run, so that criterion is still open and needs a read-only comparison before task 18.
- **02:** admin 1f7de1eb, e4bb5dd4.
- **Merged on `feat/vg-course-selling`, not pushed.** After an independent review and a click-through on a local backend: admin d6d48aaa (a new draft opens with admission open; a failed edit no longer shows Success), admin 81e4db0d (a course refresh keeps unsaved edits; orders export says Upgraded), backend 94c64f0ce (a draft can't be bought through build checkout). Admin head d3c2b442 (export type fix). Full suites rerun on the merged heads.
- **03:** backend 78474f6df, admin da750c7e. Clicked through on a local backend: a draft makes an off-sale plan, Active lists it, a price edit keeps the plan id, Allow Payment off and Inactive take it off sale with the plan still active.
- **03 review fixes:** backend 5ddfd2ab8, admin 0a91a6e6. NO NEW FAILURES on both. Not checked in a browser, on a real checkout or on a real database.
- **04, 05, 07, 11** (2026-11-06, autonomous run): built in parallel, each independently reviewed, merged on `feat/vg-course-selling`. No High findings.
  The review fixes are 05b (backend cf23d3d47) and rf1 (backend 945336818, admin fac53328). Merged heads are backend ff680508f and admin 8627ee83.
  Full suites on the merged heads print NO NEW FAILURES on both sides.
  - 04: `GET /plans` hides course-made plans unless `madeBy=course|all`. `PUT` refuses a field the course's sync writes for that plan (409), and `status` is always locked. Delete is refused.
  - 05: `src/scripts/vidyagramConnectCoursePlans.ts`. It runs a dry run by default and takes a run lock on `--commit`. A connected card keeps its struck-out price. Notes for the run are in 06.
  - 07: lengths are behind `DURATION_PRICING_ENABLED` (backend) and `NEXT_PUBLIC_DURATION_PRICING` (admin). Both are off and stay off until task 01. The rule that an owner of one length can't buy another is always on. Course-made plans have no Apple product id; the app needs a real-iPhone check.
  - 11: `selling.extension`. When the row is untouched, the course writes nothing, and the Plans page and bulk dialog keep control.
  - Apple fulfilment now finds an off-sale plan (status 1) because Apple has already charged. A status-0 plan is still refused.
  - Clicked through on the local backend with both switches on: two lengths make two plans, the Extension terms reach both, the Plans filter works, and the lock refuses delete, price, status and terms.
  - Open nits: both lengths share one plan name, and the 409 message names raw keys such as `extensionTerms`.
- **09** (backend 8ddcb53f2, admin b8c1fda9; fixes 09b backend 0bf46a862, admin 80836dae) and **10** (backend 81e8a469b, admin c9485b8b;
  fixes 10b backend 6f45c778d, d9be74289) are merged on `feat/vg-course-selling` (backend c4d8557cd, admin 5b3b427f).
  - Combo and Attach put items on every `main:*` plan, turned-off lengths included, so past buyers of any length get additions.
  - Each plan records what a rule added (`courseSale.comboCourses`, `attachedCourses/Tests/Books`). A sync releases only recorded items.
  - **Decision, needs the user's sign-off to change:** a removal is refused (409) while anyone holds the course through its main plans.
    The sync also holds the item back on every route. The PRD said "warn, then let the admin go ahead". The standing rule never-remove-granted-access won.
  - Holders are counted with the content gate's own rule (`GRANTING_ORDER_MATCH` / `orderStillGrants` in `courseScope.ts`), not `isActiveOrder`.
    With `ENFORCE_ORDER_EXPIRY` off (prod), every success order ever counts, so in practice nothing can be removed from a course that has sold.
  - Nested combos, attached combos, non-test-series packages and printed books are refused.
  - Plan names stay the course title, because the AppX order importer matches plans by exact name.
  - Not covered: a checkout still in flight (`orderStatus` initiated) isn't counted by the refusal.
- **13** add-on (backend 1d2c9e461, admin 7e34a9ef; fixes 13b backend 3ec9568dc), **12** exchange (backend b44be32f1, admin d6492eab; fixes 12b backend 2d3e5c35b, admin 15b28517)
  and **08** discount codes (backend 8b4f3a4d0 f099c5c55, admin d1455c84; fixes 08b backend 9fc5d056f, admin ea00cd69) are merged.
  - **13, decided:** an add-on is on sale only while the row exists, the source is live (its Allow Payment is ignored, because add-ons are for owners), the source has a main plan, and the destination is live, paid and open (`addonOnSale`).
    A student who can already open the destination isn't offered it. QR now refuses every upgrade-only plan, which closes an existing pay-at-offer-price hole for strangers.
  - **12:** destinations are followed write-side (`followThisCourse`). Combos and courses with attached courses can't use the row.
    A hand-set list on a connected plan shows read-only until the row is saved. `twinToKeep` in exchange.ts copies `planToKeep` in sync.ts; export one and delete the other.
  - **08:** a course save only ever adds or removes its own main plans on a coupon (`$addToSet` / `$pull`). An ordinary code already on other plans is refused, and so is a code a live Bulk Sale holds.
    The Coupons page answers 409 instead of taking a course's plans off its code. The listing sends `showTimer`.
  - Not ours, but found: the Plans page's Add Coupon still rewrites an ordinary coupon's plan list (`setPlanCoupon` → `attachCouponToPlans`), wiping its other plans. That existing behaviour needs its own fix.
- **15** upgrade with removal (backend 97da457e2, admin a52cbb6c) is merged behind `UPGRADE_REMOVAL_ENABLED` (off).
  - Fix rounds:
    - 15b (backend 57eff90e9, admin 85ed3497): removal needs `upgradeConsent` from the student's own logged-in checkout.
    - 15c (backend 345525118 dc4ad4264, admin cb3799d4): pending record, undo by label, the expired-token answer, only the consented orders.
    - 15d (backend c32d8e20a): server-only `paymentProof`.
    - Polish (backend 3172fbde4): the proof amount must equal the consent's `grandTotalPaise`.
  - Admin assign, PUT /orders, Extensions and swaps never remove. Voiding an upgrade order undoes first.
  - AppX-merged source orders aren't offered an upgrade. Nobody has counted how many students that hides; do a read-only count before 18.
- **16** offers (backend 37debb407; fixes 16b backend 276b8da08): `by-id-2` `offers[]`, My plans `kind`/`removes`, filter-active `offerKind`/`removes`. The guide is `vidyagram/reference/vidyagram-course-selling-app-guide.md`, unsent. Regenerate its samples after the polish round.
  - **Live change on deploy:** My plans `kind` for existing hand-made upgrade offers becomes `'addon'`, because they don't remove the source. Tell the app team before deploy.
- **Polish** (backend 61a86d01b 463b30705 09f23028b 23b79b861 3172fbde4, admin c2d7f5d2):
  - proof must match the order;
  - filter-active applies cheapest per kind;
  - history names course-made plan orders after the plan;
  - one `planToKeep` (`twins.ts`);
  - new add-on and upgrade rows start at 12 Months.
- **Final heads:** backend 098d3a6d4, admin a25b6606. Full suites rerun by the coordinator: NO NEW FAILURES on both sides.
  - Caveat: the baseline already fails about 30 Apple IAP tests and one QR sync test, on paths this branch changed. Fix those tests, or run those paths by hand, before release.
- **Live change on deploy:** QR checkout now refuses every plan with an upgrade offer, hand-made ones included, so a qualifying owner can't pay for one by QR. That closes a hole where a stranger could buy it at the offer price. Confirm or reverse it before deploy.
- **Reviews:** every task got an independent review. Most fix rounds were reviewed only by their tests and the coordinator: 05b, rf1, 10c, 12b, 13b, 08b, 15c, 15d, 16b and polish. 09b, 10b and 15b got a second review.
  Hand merges were import and route-block conflicts only. Each merged head reran 290 backend selling tests and 144 admin form tests green.
- **Open for later tasks:** `coursesOnPriceSale` still trusts snapshot status, so a leftover snapshot can block the AppX sync's price write (06); a banner on create stores price 0 instead of null, and titles under 3 characters fail with a vague message (old quirks); Combo stays a Settings checkbox until 09.
- **Local click-through:** `reference/scripts/vidyagram-selling-local-seed.cjs`, launch configs `vg-selling-backend` and `vg-selling-admin`, preview worktree `vg-selling-admin-preview`.
