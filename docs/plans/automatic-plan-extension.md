# Automatic plan extension — design record

State: `needs-triage` (design agreed in a grilling session 2026-09-24; no code yet)
Owning repos: LMS fork `quicktricks-backend` (all logic) · `quicktricks-admin` (retire the Extension card)
App: `hranker-com/sahil_sir_quick_tricks` — **no release required**; the wire is unchanged.

Builds on the live per-plan Extension offer (fork `CONTEXT.md` → "Plan extension", ADR
`is-expire-signals-the-extension-offer`) and the Upgrade offer (ADR `plan-upgrade-offer`). Match
fork ADRs by title — the fork has colliding ADR numbers.

## Problem

The Extension offer lets a lapsed holder re-buy a plan cheaper, but an admin must configure price +
validity on every plan (~166). Nobody will. We want every lapsed holder of every plan to get a
win-back price automatically.

## Decisions

| # | Decision |
|---|---|
| D1 | **Computed, never stored.** No per-user plans, no offer records. Eligibility and price are resolved when the plan is listed for the user and re-resolved at checkout. Rejected: auto-creating a plan per user+course (revives the old "extension plan" record mechanism; pollutes `/plans/all`, dashboard analytics, other users' listings). |
| D2 | **Sold per Plan, not per Course.** Orders carry `planId`; a plan may bundle several courses and a course may sit in several plans. "Expired" = the user's **Effective plan expiry** has passed (no active successful order for that plan). |
| D3 | **Offer price** = `LAPSED_EXTENSION_PERCENT` (50) % of the `grandTotal` of the user's OLDEST paid (> ₹0), non-extension order for the plan — the original purchase, **capped at the current list price** (base = min(original, list)), coupon-reduced price counts as "what they paid". ₹0 orders (admin grants, `free_course`, APX `TS-*` companion clones — always `grandTotal: 0`) are never the base. Extension orders never become the base. If every order for the plan was ₹0 ⇒ percent of the **current list price** (`amount`). *Revised 2026-09-24 (was: most recent paid order), then the same day the list cap was dropped, then **restored 2026-09-25**: a real holder who paid ₹1899 (list now ₹1699) would have been offered ₹950, more than half a new buyer's price. Cost accepted: ₹799 original / ₹599 list ⇒ ₹300, not ₹400.* Why: APX renewals were imported as ordinary unmarked paid orders (only 1 prod order carries `isExtensionOrder`), so "most recent paid" halved the price again on every APX renewal (₹709 → ₹299 → ₹299 offered ₹150; the rule now offers ₹355). The list cap keeps an older, higher price era from charging a returning holder more than half of what a new buyer pays today. A later full re-buy does not move the base (₹1809 → ₹799 → ₹1599 ⇒ base ₹1809 ⇒ ₹905). |
| D4 | **Offer validity** = `LAPSED_EXTENSION_DAYS` (183, fixed days — not calendar months) starting at `max(latest expiry of the plan, purchase time)`. Today the offer is lapsed-holders-only, so the latest expiry is always in the past and this is exactly "183 days from the extension purchase date" — no code change at checkout. *Revised 2026-09-24:* the `max(…)` form is recorded so a **pre-expiry renewal** (APX's actual pattern: pay early, access starts at the old expiry, stacked) can be added without re-deciding validity. Rejected: plain "latest expiry + 6 months" — for a lapsed holder that sells 1 month to someone 5 months lapsed and nothing to someone 7+ months lapsed. Pre-expiry offering is **next scope, not this slice** (touches the `is_expire` wire). |
| D5 | **Inactive means "closed to new buyers", for plans and courses alike.** An inactive plan is listed **only** to its lapsed holders, **only** at the offer price; anonymous / new / active holders never see it, and checkout rejects everyone else — including list-price purchases of an inactive plan (closes a pre-existing gap: `verifyGrandTotal` never checked `Plans.status`). Course status does not gate the offer: `POST /my-courses` already shows expired + inactive courses to their buyers, so blocking would strand them. Access after purchase relies on the **order's `courseId` snapshot** (`classAccessAuthz` ignores inactive plans' `course` join) — every order-creation path must write it. |
| D6 | **Retire the admin-configured Extension offer.** The automatic rule is the only extension. Stop reading `extensionEnabled` / `extensionPrice` / `extensionValidity`; leave the values in Mongo (no drop migration). Remove the admin Plan-form Extension card and the Upgrade⇄Extension checkbox exclusion (`quicktricks-admin` `6d8c3a0`). Only data affected: test plan `explore Test`. |
| D7 | **Coupons stack** on the offer price (existing behaviour of both offers). |
| D8 | **Offer precedence vs Upgrade: cheaper wins** (existing rule, tie ⇒ extension; only the winning flag is sent). |
| D9 | **iOS gets no offer.** App Store charges a fixed per-plan product; a per-user price is inexpressible. An Apple purchase always grants the plan's normal `duration` and is never an extension order (today it grants extension validity at full Apple price — a bug the automatic rule would spread to every plan). Suppress the offer on iOS listings too if the request identifies the platform. |
| D10 | **Env-driven, ships dark.** `LAPSED_EXTENSION_ENABLED` (unset ⇒ off), `LAPSED_EXTENSION_PERCENT` (default 50), `LAPSED_EXTENSION_DAYS` (default 183). Box `.env` + `pm2 restart 27` to change. |
| D11 | **Extension window (2026-09-25, reverses D4's "next scope" and the 2026-09-18 lapsed-only cut).** A holder whose Effective plan expiry is within `LAPSED_EXTENSION_WINDOW_DAYS` (default 0 = off; **30** once accepted) may buy the offer. Same price rule (D3). Validity stacks: `max(Effective plan expiry excluding this order, paidAt) + 183 d`, computed in **`markOrderSuccessful`** (the one seam all 6 Razorpay/QR success paths share) for `isExtensionOrder` only, at payment time; the order's `daysLeft` is written as the days until that date. With window 0 this computes exactly what it does today. Why: course listings gain an "Extend" state, and a button that leads nowhere is worse than none. |
| D12 | **Plan-listing wire for the window: `is_buy: 1, is_expire: 1`.** `is_buy` stays truthful (holding), `is_expire` means "offer applies". The Flutter gate `!(is_buy==1 && is_expire==0)` already shows Buy Now; the **website plans page reads only `is_buy`** ⇒ it shows "Purchased" to in-window holders until the site team reads `is_expire` (HITL request to thedhronas). Rejected: `is_buy: 0` for in-window (would lie to every other `is_buy` reader). |
| D13 | **Course state flags, one read-time rule.** New term **Effective course expiry** = the furthest expiry among the user's success orders that grant the course (order `courseId`/`latestCourseId` snapshot, or the order's plan's `course` of **any** plan status). No-`expireDate` orders follow `isActiveOrder` (only 3 of 1.07M prod success orders; all `daysLeft` 0 ⇒ lapsed). Wire, per course: `is_buy` (0/1) + `isPaid` (bool, mirror), **`isExtension`** (bool), **`isExpired`** (bool), **`daysLeft`** (whole days, rounded up; `0` when expired; `null` when never held / signed out). States: never held `0/false/false/null`; Resume `1/false/false/n`; Extend `1/true/false/1–30`; Expired+offer `0/true/true/0`; Expired no offer `0/false/true/0`. `isExtension` = "you can buy an Extension offer that grants this course right now" (same promise as `is_expire`; off when the switch is off, on empty/₹0 plans, on inactive plans never paid for). The frontend distinguishes never-held from expired itself. Course state keys on the course's furthest expiry: a course also held through a long-running plan is Resume even if another granting plan is in its window. |
| D14 | **One rule on every endpoint that sends `is_buy`**: `GET /api/courses/active`, `POST /filter`, `/batch-filter`, `/my-courses` (replaces its hard-coded `$literal` 1), `/by-id-2`. Implemented by replacing `addIsPaidToCourses`'s body, never a second rule beside it. Side effect: active holders of **inactive** plans stop reading as unpaid (old rule matched `status: 1` plans only). |
| D15 | **Course page (`by-id-2`) shows the offer, response shaping only.** For a user with an offer on a plan that grants the course: cheapest eligible offer ⇒ `discountPrice`, that plan's list ⇒ `price` (strike-through), `validity: "6 Months"` (from `LAPSED_EXTENSION_DAYS`). Stored course untouched. Display only: website "Buy Securely" opens `/user/plans/{courseId}/{type}` (plan checkout, price-checked by `admitPlanPurchase`). The public `/courses/…` page is SSG with `userId:'0'`, so it never personalises; only `/user/courses/…` does. The site's CTA returns early on `isPaid` ⇒ in-window holders need a site change to reach the offer (same HITL request as D12). Task 08 (₹0 course price) to be re-checked against the 2026-09-25 price backfill before building. |
| D16 | **Retired plans in the new states.** An inactive plan's offer needs a paid (> ₹0) order from this user, lapsed **or in the window** (a ₹0-granted holder is never offered it, so no offer that exists only in the month before lapse). A Retired plan's courses read as **never held** on catalogue endpoints, not Expired. |
| D17 | **Rollout.** (1) truthful course flags: live, no switch (correctness fix, like task 07's My Courses filter); (2) `isExtension` + `by-id-2` offer: ride `LAPSED_EXTENSION_ENABLED`; (3) window: stacking ships in the same release, `LAPSED_EXTENSION_WINDOW_DAYS` stays 0 until one real in-window test purchase shows the stacked expiry, then 30. Side finding for a task: 3 QR paths bypass `markOrderSuccessful` (`qrCodeController.ts` ~503/522/807) and grant `plan.duration \|\| 365` — a QR-paid extension gets full plan duration. iOS cannot be detected on course listings either (task 02 finding) ⇒ same accepted gap as plans. |
| D18 | **Extension floor (2026-09-30).** Offer price = `max(percent price, min(LAPSED_EXTENSION_MIN_PRICE, list))`, floor default **₹125** (unset ⇒ 125, `0` ⇒ off, invalid ⇒ 125). Trigger: APX holders who paid ₹9/₹10 were offered ₹5. Capped at list so a sub-₹125 plan renews at list, never above a new buyer's price. Applied after the ₹0 check, so it never creates an offer (free plans stay unoffered). On the offer price only — coupons (D7) still apply after it. One seam (`computeExtensionOffer`) ⇒ listings, `by-id-2`, every checkout path agree. ADR 0023 amendment 2026-09-30; branch `feat/extension-min-price` in `../quicktricks-backend-auto-extension`. |

Unchanged wire (the app contract): eligible listing rows swap `amount` → offer price and
`duration` → 183, keep `originalAmount`, send `is_expire: 1` beside `is_buy: 0`. Orders keep
`isExtensionOrder: true` + `extendsOrderId` (the lapsed order), the lapsed order is untouched.

## Flow

```
buy P (paid ₹500 after coupon) → O1, expires after P.duration
  ↓ O1 lapses, no active order for P
list plans (course screen / My Courses → course / plans page)
  → server: lapsed holder of P, P active-or-inactive, not iOS, switch on
  → amount 250, duration 183, originalAmount P.amount, is_buy 0, is_expire 1
  ↓ Buy (Razorpay; coupon optional)
server recomputes eligibility + price → verifyGrandTotal ≥ 250 (minus coupon)
  → O2 {grandTotal 250, duration 183, isExtensionOrder, extendsOrderId O1, courseId snapshot}
  ↓ captured → access restored; listing back to is_buy 1 / is_expire 0
O2 lapses → offer again at 250 (base is still O1)
```

## Open / to verify during implementation

- **Old "extension plan" mechanism** (`isExtension` + `extensionBasePlanId`, `filterExtensionPlansForUser`,
  `validateExtensionPlanPurchase`): count prod plans with `isExtension: true` before retiring it.
- **Every order-creation path writes the `courseId` snapshot** (D5 depends on it) — add a test.
- **App behaviour on tapping an expired course in My Courses** — does it reach the course's plan list?
  If not, the offer is reachable only via Explore / Plans. Acceptance check, not a code change.
- **iOS detection on listings** — does the app send a platform header/param to `filter-active`?
- **Inactive course content** — what an inactive course's class/PDF listings return to a re-buyer
  (parked; offer is not gated on it).
- **Rollout order:** ship automatic rule dark → flip env → remove admin card → delete dead code.

## Glossary changes — APPLIED (uncommitted) in fork worktree `../quicktricks-backend-auto-extension`, with ADR `0023-automatic-lapsed-holder-extension.md`; PRD: [`prd-automatic-plan-extension.md`](./prd-automatic-plan-extension.md)

- **Extension offer** — redefine: a system-wide rule, not per-plan configuration. A lapsed holder may
  re-buy the plan at a fixed percentage of what they last paid for it, for a fixed number of days;
  never on iOS. _Avoid_: configured extension (retired), extension plan (older record mechanism).
- **Extension base price** (new) — the amount the offer percentage applies to: what the user paid on
  their oldest paid, non-extension order for the plan (the original purchase), capped at the
  current list price; else the list price.
- **Inactive plan** (new) — closed to new buyers; still offered to its lapsed holders at the
  extension price. _Avoid_: withdrawn / deleted.
- **Offer precedence** — drop the "configured" wording; unchanged otherwise.
