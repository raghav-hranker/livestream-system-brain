# No Extension offer on a plan that unlocks nothing or costs ₹0

**Type**: AFK
**Blocked by**: 03 — Inactive plan = closed to new buyers (done)
**Status**: **done** — pushed to `quicktricks-admin` `e9d273233` (2026-09-25)

## Why

Task 03 reopens an inactive plan to its own lapsed holders. The APX import left plans that should
never be reopened:

- **Empty migration copies.** APX logged one payment as two rows: the "Digital Products" row
  `X @` (the product the student bought) and a "Batches" row `X` (the batch it unlocks). The import
  found no plan for the Batches row and created one: `unmatchedMigratedItem` set, **no `course`, no
  `packages`**, usually `status: 0`. On prod, 18 plans carry `unmatchedMigratedItem`; 17 of them are
  empty and 13 are inactive. About 13.7k users hold a lapsed paid order on one of them.
  Worked example: user `6a4590c0…6693` paid ₹799 once (`pay_MkEhX1HyO4iUoA`, 5 Oct 2023). That payment
  is on both `APX-16287` (plan `6a4e2c13…18b7`, "MATHS SPL FOUNDATION (LIVE + VOD) @", active, course
  attached) and `APX-6984` (plan `6a4e2c12…18ae`, same title without the @, inactive, empty). With the
  switch on, `GET /api/plans/active/:userId` would offer the empty copy at ₹400 as well. Buying it
  writes an empty course snapshot, so the student would pay for no access.
- **Retired free plans.** An inactive ₹0 plan (for example "Current Affairs 2024-25 … FREE E-Book")
  whose holders never paid gets a base of list ₹0, so it comes back as a ₹0 "renewal".

## What to build

In the offer seam (`src/services/planOffer.service.ts`, `extensionCandidate` or just above it),
return **no Extension offer** when either condition holds:

1. **The plan unlocks nothing.** `course`, `packages`, `ebook`, `practiceBatch` and `batchCourse`
   are all empty or missing. Test for content, not for `unmatchedMigratedItem`: an empty plan is
   useless whatever created it, and the one non-empty unmatched plan must keep its offer.
2. **The offer price is ₹0.** A renewal that costs nothing isn't a renewal.

Both listing (`resolvePlanOffersForUser`) and purchase admission (`resolvePlanOffer`, which feeds
`admitPlanPurchase`) must apply it. `resolvePlanOffer` selects only `OFFER_FIELDS`, so add the
content fields there. An inactive plan with no offer is not listed and cannot be bought
(task 03's rule), so the empty copies disappear with no separate visibility change.

Keep `extensionOfferPolicy.ts` pure and plan-shape-free if you can: the content check belongs
to the plan, the ₹0 check can sit in either place. Pick one place per rule and test it there.

## Acceptance criteria

- [ ] Unit: a lapsed holder of an inactive plan with every content array empty gets no offer, even
      though a paid order exists.
- [ ] Unit: the same plan with any one content array non-empty (course, packages, ebook,
      practiceBatch or batchCourse) gets the offer.
- [ ] Unit: a lapsed holder whose only orders are ₹0 on a plan listed at ₹0 gets no offer.
- [ ] Integration: the SPL Foundation shape. A user with ₹799 orders on both an empty inactive copy
      and the real active plan sees **only** the real plan in `active/:userId` and `filter-active`,
      at ₹400 with `is_expire: 1`. Checkout of the copy is rejected with the inactive-plan message.
- [ ] Integration: an active plan with empty content held by a lapsed user is still listed at list
      price, with no offer. The guard removes the offer, not the plan.
- [ ] Offer integration suites stay green; unit/integration failure lists identical to the base.

## Before task 04: copy-only count (done 2026-09-25)

Read-only prod count (`reference/scripts/automatic-plan-extension-local/apx-extension-queries/copyonly.js`):
of 14,107 lapsed paid (user, empty-copy-plan) pairs, 9,733 have the same payment on a real plan,
which is the SPL Foundation shape. **4,374 pairs / 4,349 users** don't. That's an upper bound,
because a twin with a missing or different `trxId` counts as copy-only.

| Copy plan | Copy-only pairs | Losing the offer is… |
|---|---|---|
| Test Pass (APX ₹39 test pass, no equivalent product here) | 3,748 | right: renewing it grants nothing |
| Railway Mathematics Book (paperback) | 214 | right: a physical book isn't renewable |
| qr test | 15 | right: test data |
| Real batches: SSC CGL Crash Course 2023 (174), संकल्प BPSC TRE 2.0 (53), प्रमाण 2024 (47), MATHS SPL FOUNDATION (42), सफलता Bihar SSC (29), Panacea Of Arithmetic (21), हुँकार SSC GD (19), SSC CGL DI (6), SSC-GD FOUNDATION (5), Percentage (1) | ~397 | a gap: they'd need a copy → real plan mapping to get an offer |

Decision: the guard ships as written (selling an empty plan is never right). The ~397 batch holders
get a mapping only if the user asks for it (a separate HITL data task). Side finding: "SSC CGL Crash
Course 2023", "प्रमाण 2024" and "Panacea Of Arithmetic" copies are **active** and empty, so anyone can
buy them today at list price for no access. That's a pre-existing bug outside this guard.

## Done (2026-09-25)

Scope was widened with the user after testing their real accounts on the 3110 prod read-only server:

- **Retired plan** (new rule, user-approved): for one user, an *inactive* plan they never paid for
  (every order ₹0) whose access has lapsed. It gets **no offer** (this covers the ₹0 free plans and the ₹10
  placeholder test series granted as free add-ons, which the old "never paid ⇒ half list" rule offered at ₹5).
  Its courses also **leave `POST /api/courses/my-courses`** unless another order still grants them.
  The My Courses filter is **not behind the switch**. It went live with the push: ~150k expired free-course
  entries on prod (RRB NTPC Free Crash Course 58.7k users, Current Affairs FREE E-Book 54.1k, Previous
  Year Papers 23.1k, SSC CGL 35 Days 17.8k). Paid lapsed courses and free plans still running stay.
- The two rules above, as specified: no offer on an empty plan, no offer at ₹0 (any plan).

Code: `src/services/retiredPlan.ts` (pure: `isPlanRetiredForUser`, `retiredPlanIdsForUser`,
`planUnlocksContent`), `extensionOfferPolicy.ts` (`planActive` input, ₹0 guard), `planOffer.service.ts`
(content guard, `OFFER_FIELDS` + content fields), `courseController.getUserCourses`. Tests:
`retiredPlan.test.ts`, new policy cases, `integration/retiredPlans.integration.test.ts`; offer fixtures
now give plans a package. Glossary: `CONTEXT.md` → Retired plan, Empty plan; ADR 0023 bullet.

Verification: unit 28 / integration 8 failures identical to origin tip `bcf5d839c`; newman 377/377
(seed plans now carry a package); 3110 validator (checks these rules + My Courses) OK for …0894, …9504, …8836;
committed dist == fresh compile of the tip.
