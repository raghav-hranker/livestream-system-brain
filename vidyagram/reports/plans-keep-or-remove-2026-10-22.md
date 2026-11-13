# Do we need Plans? (Vidyagram, 2026-10-22)

Read-only look at the code (backend `vidyagram-admin` at ab7d7b4e0, admin `vidyagram-admin` at b8416dc) and at
vidyagramdb. Nothing was changed. Probe: `reference/scripts/vidyagram-plans-shape-probe.cjs` (`DETAIL=1` for the
combo listing). Raw output from this run is not kept; rerun the probe for fresh numbers.

## The short answer

**Keep Plans, but stop letting them decide access on their own.** A Plan is the price tag the app buys against. The
app lists plans, pays for a plan and sends the plan id back. That can't change quickly, and coupons, reports,
broadcasts and all 1.7M imported orders also hang on the plan id. What causes the trouble is a different job Plans
also do: today access is read *live* from the plan's course list. If each order carries its own list of courses and
access reads that list, a plan becomes a price tag and nothing more. Then a course exchange, a stray course in a plan
or a price edit can no longer reach students by surprise.

On Vidyagram most plans already hold one course, and only about 9 are real combos. So "one plan = one course" can
be the norm, with combos treated as a separate thing that is exchanged whole or not at all.

## What the data says (vidyagramdb, read 2026-10-22)

- **Almost no sales have gone through our own checkout yet.** Of 1.73M successful orders, 1.06M are AppX imports
  (`orderNumber` `APX-*`) and 669k are admin-path grants. These are mostly the AppX subscriber copy of the same
  purchase: 677k student+course pairs are held through both an AppX order and an admin order on the same plan. Only
  **7** were paid through our own Razorpay checkout (₹12–15 plans). The 10-22 note saying "half of the paid orders in
  the last 30 days are on combos" was counting the AppX import, whose `createdAt` is back-dated.
- **Plans: 81 active.** 43 hold one course. 17 hold no course at all; they sell test series (`packages`) or ebooks.
  21 hold 2 or more courses.
- **Most of those 21 "combos" are not real combos.** 12 of the 14 two-course plans are a real batch with an
  unrelated cheap course attached. Example: "Champions 5.0 Maths" also holds "SSC CHSL Complete Course 2026". The
  attached courses are 20 single-course "… 2026" courses priced ₹12–96, all created 10-19. The AppX orders on these
  plans list only the real batch, but access reads the plan's live list, so **about 13.6k students currently also get
  a course they never bought.** Where these attachments came from is not known yet (see Open questions).
- **The real combos are about 9:** प्रहार 2.0 / 3.0 / without-Maths, UPGK + Computer, UPSI + UP Constable, UP Police
  2027 (+ old Maths VOD), 3 in 1 Mastery, the Jai Sir English VOD bundle, and the internal "staff combo".
- **The "61 courses sold by 2+ plans" figure is mostly noise.** The staff combo (64 courses, ₹500) alone puts nearly
  every active course into a second plan, and the 12 stray pairs add the rest. Real overlap is a few courses inside
  the प्रहार and UP Police combos.
- **None of the extra plan features are switched on for Vidyagram.** No active plan has Upgrade, Extension, Explore
  Test Series, Topper Pass, Grammar/Vocab/Editorial, an Apple product id or a plan coupon id set. 20 have a `priceIOS`
  but no Apple product id, so no iOS purchase is possible on them.
- **Course price and plan price disagree.** "Vocab Ocean" sells at ₹99 by its plan, but the course says ₹1999.
  "प्रहार 4.0" plan ₹1499, course ₹1999. The course has `price`/`discountPrice` and a free-text `validity` label; the
  plan has `amount` and `duration` in days. Two sources of the same fact.

## What a Plan does today that a Course does not

| Job | Plan's part | Where |
|---|---|---|
| What the app can buy | The app lists **plans** via `POST plans/filter-active/:userId` and checks out with a `planId` | `src/routes/planRoutes.ts:21-35`, `src/controllers/plansController.ts:626-807` |
| Price check at checkout | `verifyGrandTotal` checks only against `plan.amount` (or the offer). With no plan it passes anything | `src/controllers/orderController.ts:412-475` (no-plan pass at :423) |
| Who may buy | `admitPlanPurchase` (inactive plans, upgrade-only plans) | `src/services/planAvailability.service.ts:122-136` |
| Validity | `duration` in days; the order's `expireDate` is now + duration. Course has only a text label | `src/models/Plans.ts:75`, `src/controllers/razorpayController.ts:212-221`, `src/models/Course.ts:188` |
| Bundling | `course`, `packages` (test series), `ebook`, `practiceBatch`, `batchCourse` | `src/models/Plans.ts:91-95` |
| Order snapshot | At purchase the plan's items are copied onto the order (`courseId`, `packageId`, …) | `src/services/order.service.ts:59-74` |
| Coupons | Only plan coupons exist; the discount is computed from `plan.amount` | `src/controllers/couponController.ts:349-440`, admin `components/admin/CouponForm.tsx:47` |
| Apple IAP | Apple product id → plan; iOS price is `priceIOS` | `src/services/appleIapFulfilment.service.ts:90-101`, `src/controllers/plansController.ts:69-89` |
| Upgrade offer | Target plan lists source plans and an upgrade price | `src/services/planUpgrade.service.ts:42-58` |
| Automatic Extension offer | Half the plan price, floor ₹125, swapped into `amount` | `src/services/extensionOfferPolicy.ts:79-105`, `src/services/planOffer.service.ts:78-110` |
| Feature flags | Grammar / Vocab / Editorial / Explore / Topper Pass read from held plans | `src/utils/planEntitlements.ts:29-70`, `src/controllers/package.controller.ts:40-47` |
| Broadcasts | Audience by plan (holders, non-holders, lapsed); study plans via `practiceBatch` | `src/services/notificationAudience/audienceSettings.ts:49-120`, admin `components/admin/NotificationForm.tsx:1605` |
| Reports | Top plans, revenue, GST, coupon and product analytics grouped by `planId` | `src/controllers/dashboardAnalyticsController.ts:349`, `src/services/dashboardDailyFacts.ts:53`, `src/services/gstReport.service.ts:235` |
| Admin actions | Assign plan(s), exchange (rewrites plan + items), Bulk Sale edits plan price/validity | `src/controllers/orderController.ts:1628-1690, 1837-1903`, `src/services/bulkSale.service.ts:25-31` |
| AppX history | The importer made one plan per AppX course or test series; every imported order has a `planId` | `src/scripts/apxOrdersNewPlansMigration.ts:1-35`, `apxOrdersNewToOrdersMigration.ts:229` |

**Not a Plan job:** the Course Builder sells chapters with no plan. It prices from `Course.builder`, writes
`build.courseId`, and its orders never expire (`src/services/buildOrder.service.ts:41-86`,
`src/controllers/buildCheckoutController.ts:82-96`). No admin screen creates a plan when a course is made.

### How access reads plans today

Access is "the order's own course list **plus** whatever the plan holds right now":

- Playback, PDFs, live token, timetable: `courseScope.loadScopeOrders`. It adds the live list of **active** plans
  (`src/services/courseScope.ts:167-195`; used by `classAccessAuthz.ts:330`, `issuePdfAccess.ts:219`).
- Bought / expired / extension flags on the course: the live list of **any** plan, except retired ones
  (`src/services/courseAccessState.service.ts:24-41`).
- My Courses: live plan list + order list + `build.courseId` (`src/controllers/courseController.ts:2335-2368`).
- Test series and ebooks: live from `Plans.packages` / `Plans.ebook` (`src/utils/packageUtils.ts:24-157`). Practice
  batches use the order's own list only (`packageUtils.ts:98-120`).

So adding a course to a plan gives it to every past buyer, and removing it takes nothing away (the order copy stays).
Switching a plan off silently drops its live part from playback but not from My Courses. That mix is the real
source of confusion, not the existence of Plans. In all, 87 non-test files read `planId` and 39 load the Plans
model.

## What removing Plans would cost

1. **The app breaks.** It lists plans and pays by plan id (Razorpay and Apple). All 7 real Vidyagram sales went
   through plan checkout. The app can't be changed quickly. Its repo is not on this machine, so this comes from the
   backend routes and `docs/ios-apple-iap-mobile-contract.md`. A plan-less world needs a new app release, or a fake
   "plan" endpoint that wraps courses, which is a plan under another name.
2. **Test series and ebooks have nowhere to live.** 17 active plans sell no course at all, and 197k imported orders
   are on them. A course can't carry a test series price.
3. **1.7M orders need rewriting.** Each would need its `courseId`/`packageId` list filled. 669k admin-path orders
   have an empty course list today and rely only on the plan.
4. **About 90 files change**: checkout, price check, coupons, Apple, offers, broadcasts, reports, admin forms.
5. **Quicktricks shares the code.** There, Plans carry Apple IAP, Upgrade, automatic Extension, Explore Test Series,
   Topper Pass and Grammar/Vocab/Editorial (see memories `apple-iap`, `plan-upgrade-offer`,
   `automatic-plan-extension`). Removing Plans would be a Vidyagram-only fork of the core sales path.

## What removing Plans would gain

- One price per course instead of two that disagree.
- Exchange course-for-course with no "the whole combo leaves" surprise.
- One access rule ("you bought these courses") instead of the order + live plan mix.
- No stray-course leaks like the 13.6k above.
- Fewer screens for the admin (no separate plan to create per course).

Almost all of these gains come from **access reading the order's own course list**, not from deleting Plans. That
is why the middle option below gets most of the gain for a fraction of the cost.

## The middle options

**A. Plans stay the price tag; access comes from the order's own course list.** (recommended)
Checkout, coupons, reports and the app stay as they are. At purchase the plan's courses are already copied onto the
order (`order.service.ts:59-74`). Make every access path read only that copy (and `build.courseId`), and stop adding
the live plan list. Exchange then edits one order's course list. A plan edit no longer reaches old buyers. Before
the switch, fill `courseId` on orders whose list is empty (the 669k admin-path rows) from their plan.

**B. One plan per course, made automatically.** When a course is published, the system creates or updates its own
single-course plan (price and validity taken from the course). The admin never sees it. This fixes the "two prices"
problem and keeps the app working. Combos stay as hand-made plans. It works well on top of A.

**C. Combos become an explicit "bundle".** A bundle is a plan marked as such. It shows its courses in the app and is
exchanged whole (current design D1) or not exchanged at all in version 1. This is mostly a flag plus wording on what
exists today.

**D. Remove Plans.** Full rewrite of sales, the app and 1.7M orders. Not worth it while the app can't change.

## Tradeoffs

| | Keep as is | A. Access from order's course list | B. Auto one plan per course | C. Bundles as a flag | D. Remove Plans |
|---|---|---|---|---|---|
| App changes needed | none | none | none | wording only | new app release |
| Per-course exchange | only whole plan | yes, edit the order's list | yes | bundles whole or blocked | yes |
| Stray courses / plan edits reach old buyers | yes | no | no | no | no |
| One price per course | no | no | yes | n/a | yes |
| Test series / ebooks | fine | fine | fine | fine | need a new home |
| Coupons, reports, broadcasts | fine | fine | fine | fine | rebuild |
| Order data work | none | fill `courseId` on ~669k orders | none | none | rewrite 1.7M |
| Behaviour change | none | adding a course to a plan no longer gives it to past buyers | admin edits course price, not plan | none | everything |
| Size of work | none | the access readers above + one backfill | one sync service | small | ~90 files + app |
| Quicktricks impact | none | same shared code; can be behind a tenant switch | Vidyagram-only | none | splits the fork |

## Recommendation

1. Keep Plans as the price tag and checkout unit.
2. Do **A** for Vidyagram first, behind a switch, since exchange needs it: access reads the order's own course list
   only. Backfill empty `courseId` lists from the plan before turning it on.
3. Add **C**: mark the ~9 real combos as bundles; exchange swaps the whole bundle (as decided in D1) or is off for
   them in version 1.
4. Later, **B** if the two-price problem keeps causing mistakes.

For quicktricks the answer is a firmer "keep": Plans there carry Apple IAP, Upgrade, Extension and several feature
flags that Vidyagram doesn't use. Option A would change quicktricks too unless it sits behind a tenant switch.

## Open questions for you

- **The 12 stray courses inside real plans.** About 13.6k students can open a course their AppX order never
  listed, because access reads the plan's live list. Both fixes (taking the course out of the plan, or option A)
  take that access away, which runs against "never remove granted access". This needs your call. Where the
  courses came from (the 10-19 import or someone's test) is not known.
- Should adding a course to a plan still reach past buyers? Under A it would not, unless an admin action pushes it
  to existing orders on purpose.
- `vidyagram/plans/course-exchange.md` still quotes the "16k of 33.5k paid orders" figure; it was the AppX import.
