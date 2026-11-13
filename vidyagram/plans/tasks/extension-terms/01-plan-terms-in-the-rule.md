# Extension terms on plans, read by the offer rule

**Type**: AFK
**Blocked by**: None, can start immediately
**Repo**: backend

## What to build

A plan can carry its own extension terms, and every offer path prices and sizes the extension from them.

- `Plans.extensionTerms`, the `PlanExtensionTerms` shape in the PRD (`off`, or `custom` with `days`, `pricing`,
  `minPrice`, each nullable). Absent means all default.
- One parser (say `services/extensionTerms.ts`) that turns a request body into `PlanExtensionTerms` or "unset" and
  enforces the PRD bounds. A `custom` with all three fields null becomes "unset". `pricing.kind 'fixed'` forces
  `minPrice` null.
- Plan create (`POST /api/plans`) and update (`PUT /api/plans/:id`) accept `extensionTerms` through that parser
  (400 on a bad body, nothing written). `null` unsets it. The admin plan reads return it.
- `computeExtensionOffer` (`services/extensionOfferPolicy.ts`) takes the plan's terms plus the default (still the env
  config in this task) and applies the PRD rule: off ⇒ null; percent with the effective percent and minimum; fixed ⇒
  `min(amount, list)` with no minimum; any final price ≤ 0 ⇒ null; duration = effective days. Every existing gate stays
  in front, in the same order.
- `extensionCandidate` in `services/planOffer.service.ts` passes `plan.extensionTerms`. `PLAN_OFFER_FIELDS` gains
  `extensionTerms`.

## Acceptance criteria

- [ ] Unit (`extensionOfferPolicy.test.ts`): each PRD policy case, including fixed above list, fixed ignoring the
      minimum, a custom minimum of 0, and a ₹0 list price under percent and under fixed.
- [ ] Unit: the parser accepts the PRD shapes and rejects out-of-bound numbers, unknown kinds and fixed with a minimum
      (it drops the minimum, it does not reject).
- [ ] Integration: a plan saved with custom terms, then read, returns them; `null` unsets them.
- [ ] Integration: a lapsed holder of a plan with `{ days: 91, pricing: percent 40, minPrice: 0 }` sees
      `amount` 40% of the base, `duration` 91 and "3 Months Validity" on a plan listing; a checkout through
      `resolvePlanOffer` gets the same price and days. A plan with `off` shows no extension.
- [ ] Existing extension and upgrade suites unchanged.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 3, 4, 6, 7, 8, 9, 10, 11, 21, 22, 23
