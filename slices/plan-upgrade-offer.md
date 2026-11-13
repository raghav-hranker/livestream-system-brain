# Slice — Plan Upgrade offer (holders of B or C buy A at a special price)

**Decision:** `../quicktricks-backend/docs/adr/0021-upgrade-offer-on-the-target-plan.md` (match by title; the fork has two ADR series).
**Terms:** `../quicktricks-backend/CONTEXT.md` → "Plan upgrade" (Upgrade offer, Upgrade eligibility, Offer precedence, Upgrade order).
**Status (2026-09-18 ~23:00 IST):** PUSHED + DEPLOYED. Backend `origin/quicktricks-admin` = `6e6b8295e`, live on the prod box (pm2 27 restarted; listings carry `is_upgrade`). Admin `origin/quicktricks-admin` = `9ee19ab`, Vercel deployment Ready, aliased to admin.quicktricksbysahilsir.com. Testing handoff: `/private/tmp/handoff-plan-upgrade-offer-testing-2026-09-18.md`. Acceptance (below) not yet run — no prod plan has an upgrade price yet.

## The contract that forced the shape
The Flutter app (`hranker-com/sahil_sir_quick_tricks`) cannot be released. It lists plans only via
`POST /api/plans/filter-active/:userId`, shows `amount` (Android) / `priceIOS` (iOS), and sends back
`grandTotal` = the price it showed for the server to verify. So the offer must ride `amount`, exactly
like the Extension offer, and the order paths must expect the offer price.

## Hops (in order)
1. **quicktricks-backend** (`feat/plan-upgrade-offer`, rebased onto origin 7533b80ae — commits: docs `60d452881`, source `6c0e528a5`, dist `6e6b8295e`)
   - `src/models/Plans.ts` + `src/schemas/PlansSchema.ts`: `upgradationPrice` (unset ⇒ offer off, so the shipped display-only rows are unchanged).
   - `src/services/planUpgrade.service.ts`: eligibility = active successful order on any source plan, no active order on the target; furthest-expiring source order is the one followed.
   - `src/services/planOffer.service.ts`: the ONLY place Extension and Upgrade meet — cheaper wins (tie ⇒ extension), only the winner's flag (`is_expire` | `is_upgrade`), `amount` swapped, `originalAmount` kept, `priceIOS` untouched. `resolvePlanOffer` (orders) / `resolvePlanOffersForUser` (listings).
   - `src/controllers/plansController.ts` (3 listing paths) + `src/controllers/orderController.ts` (payment-link, razorpay, apple, createOrder, `verifyGrandTotal`) + `src/services/order.service.ts` go through the resolver; `Order.isUpgradeOrder` / `upgradesFromOrderId`.
   - Tests: `src/tests/planUpgradeOffer.test.ts` (12) + `src/tests/integration/planUpgradeOffer.integration.test.ts` (9, real routes + memory Mongo). Compiled into the tracked `dist/`.
2. **quicktricks-admin** (`feat/plan-upgrade-offer`, commit `9ee19ab` (rebased onto origin 4b53b78), worktree `../quicktricks-admin-upgrade`)
   - `components/admin/PlanForm.tsx`: Upgrade Price (₹) input, required when the offer is on; copy rewritten to the source-plan meaning. `hooks/api/use-plans.ts`: type + normaliser.
3. **App / website**: no change possible or needed — the price arrives in `amount`. `is_upgrade` is there for the next app release.

## Deploy (client convention: push → pull on the prod box → pm2 restart; admin via Vercel on push)
- Backend: `git push origin feat/plan-upgrade-offer:quicktricks-admin` after fetch+rebase (remote moves ~7×/day), then on the box `git pull` + `pm2 restart 27`. Pre-deploy check: compiled tip must equal committed dist (see memory `quicktricks-backend-dist-deploy`).
- Admin: push the same way; Vercel builds `origin/quicktricks-admin`.

## Acceptance (needs a user who holds ONLY a source plan — the usual test user owns every plan)
1. Admin: on plan A tick Upgrade offer, pick B as source, price 499 → save → reopen shows both.
2. `POST /api/plans/filter-active/<userId>` `{subscriptionId: A}` for an active B holder ⇒ `amount "499"`, `originalAmount "1000"`, `is_upgrade 1`, `is_buy 0`; for a stranger ⇒ list price, `is_upgrade 0`.
3. Checkout from the app as the B holder shows ₹499 and succeeds; the order carries `isUpgradeOrder: true` + `upgradesFromOrderId`.
4. Regression: a lapsed A holder with the Extension offer still sees the extension price; if both apply, the cheaper one.

## Known gaps (accepted in ADR 0021)
- iOS shows the offer but Apple charges the plan's tier (same gap as extension) until a per-offer Apple product id exists.
- Overpaying is accepted by `verifyGrandTotal` (pre-existing tolerance rule) — an eligible user's stale client sending the list price is not rejected.
