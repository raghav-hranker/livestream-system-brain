# Extension window behind `LAPSED_EXTENSION_WINDOW_DAYS` (default 0)

**Type**: AFK
**Blocked by**: 09 — Course state flags; 11 — Extension orders stack their validity
**Status**: done 2026-09-25, `6818adfb3` (local); Postman folder 5 written, newman not run
**Decisions**: design record D11, D12, D16(a), D17(3); CONTEXT → *Extension window*, *Extension eligibility*,
*Inactive plan*; ADR 0023 → "Amendment 2026-09-25".

## What to build

A holder whose **Effective plan expiry** is within `LAPSED_EXTENSION_WINDOW_DAYS` days may buy the
Extension offer. Env in `src/config/lapsedExtension.ts` next to PERCENT/DAYS; **default 0 = off**; invalid
or negative ⇒ 0. Only meaningful while `LAPSED_EXTENSION_ENABLED` is on.

- **Eligibility**: `pickExtensionSourceOrder` (`planExtension.service.ts`) today returns `null` when any
  order is active. With window W > 0, a user whose furthest active expiry is within W days is eligible.
  The source order is then the furthest-expiring one. Thread the window through `computeExtensionOffer`
  config. Callers that pass no window behave exactly as today.
- **Inactive plans**: in-window eligibility on an **inactive** plan requires a paid (> ₹0) order from
  this user. The ₹0-granted in-window holder gets no offer (no offer that exists only in the month
  before lapse).
- **Plan listings** (`/plans/active/:userId`, `/plans/filter-active/:userId`, the third site in
  `plansController.ts`): an in-window holder gets the offer's amount/duration, `is_buy: 1`,
  `is_expire: 1` (`is_buy` stays truthful). Inactive plans stay visible to in-window paid holders
  (`planAvailability.service.ts` → `resolveVisiblePlansForUser`).
- **Checkout**: `admitPlanPurchase` and the order paths admit an in-window buyer at the offer price and
  mark the order `isExtensionOrder` + `extendsOrderId` (task 11 then stacks it).
- **Courses** (task 09's rule): a course whose Effective course expiry is within the window and has an
  extension offer buyable ⇒ `is_buy: 1, isExtension: true, isExpired: false, daysLeft: 1–W`.
- **Upgrade precedence**: unchanged (cheaper wins, tie ⇒ extension). An in-window holder of A is not an
  Upgrade candidate for A.

## Acceptance criteria

- [ ] Window 0: every existing offer, listing and course test passes unchanged.
- [ ] Window 30: holder with 20 days left ⇒ plan listing `is_buy: 1, is_expire: 1`, offer price/183 d;
      holder with 40 days left ⇒ no offer; course Extend state as in the table; checkout at offer price
      succeeds and the order is marked extension; paying it stacks (with task 11).
- [ ] Inactive plan: in-window paid holder offered; in-window ₹0-only holder not offered.
- [ ] Postman test bed (`reference/postman/automatic-plan-extension.README.md`): add a 4th server or env
      variant with the window at 30, seed an in-window user, extend the generator. newman green.
- [ ] Suites: failure lists identical to base; `tsc` clean on touched files.

## Done (2026-09-25, `6818adfb3`)

- `windowDays` in `lapsedExtension.ts` (unset / invalid / negative / fractional ⇒ 0). `pickExtensionSourceOrder(orders, now, windowDays)`:
  with an active order, the source is the furthest active order when its days left ≤ window. `activeDaysLeft`
  is shared with the course flags so the two never disagree. D16 check in `computeExtensionOffer`: an inactive
  plan needs a paid order. `extensionOfferCandidatePlanIds` also resolves in-window plans. No controller changes:
  listings, availability and checkout all run through the one rule. `is_buy` stays truthful on all three listing shapes.
- Example (paid ₹800, list ₹1000, 20 days left), window 30: listing ₹400 / 183 d, `is_buy 1`, `is_expire 1`;
  course Extend (20); checkout ₹400 accepted on all 3 Razorpay paths and marked extension; webhook ⇒ old
  expiry + 183 d, `daysLeft` 203. 40 days left ⇒ list price / Resume. Window 0 ⇒ everything as before.
- Tests: unit 1736 / 28 fail, integration 363 / 8 fail, failure lists identical to base `aa9025447`; `tsc` clean.
- Postman: `seed.js` (plan W, inactive plan I; users in_window / far / iw_paid / iw_zero), `build-postman.cjs`
  folder 5 (105 requests), `run-servers.sh` 4th server 3109 with window 30. **newman not run**: ports 3106–3108
  are held by the local-test worktree at `92240a00b`. Move that worktree to the branch tip, restart
  `run-servers.sh`, re-seed, then run.
- Findings, not fixed: (1) an active legacy order with no future `expireDate` counts its `daysLeft` for the
  window, but stacking reads `expireDate` only, so those days would be lost (0 such orders on prod).
  (2) A 100 % coupon checkout writes a success order directly and skips `markOrderSuccessful`, so an
  in-window extension bought that way would not stack (existing behaviour for every ₹0 order).
