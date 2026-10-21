# Automatic extension offer, end to end, behind the switch

**Type**: AFK
**Blocked by**: None — can start immediately

## What to build

Replace the per-plan Extension offer with the system-wide rule (design record D1–D4, D6–D8, D10),
end to end on **active** plans. With `LAPSED_EXTENSION_ENABLED` set, a lapsed holder of any plan sees
it in the plan listings at the offer price and duration with `is_expire: 1`, and can buy it through
every Razorpay checkout path at that price (coupons stacking); the resulting order is an Extension
order for the offer's days. With the switch unset, behaviour is identical to today minus the retired
per-plan offer (only the test plan `explore Test` had one).

Shape (PRD → Implementation Decisions, modules 1–3):
- **Extension config** — reads the three env vars; unset switch ⇒ off; invalid percent/days ⇒ 50/183.
- **Extension offer policy** — one pure function: (config, plan list price, the user's successful
  orders for the plan, platform, now) → no offer | `{ price, duration, sourceOrderId }`. Eligibility
  keeps the existing single rule (a lapsed order and no active one; source = furthest-expiring lapsed).
  Base = amount paid on the most recent paid (> 0) non-extension order, else the plan's list price.
  Price = base × percent / 100 rounded to the nearest rupee, halves up. Platform is accepted but only
  used by task 02.
- **Plan offer resolution** — the existing seam calls the policy instead of reading
  `extensionEnabled/extensionPrice/extensionValidity`; its order queries fetch amount paid,
  extension mark and purchase time. Cheaper-wins / tie ⇒ extension precedence unchanged.
- Commit the drafted ADR 0023 and `CONTEXT.md` glossary edits (already in the worktree) with this slice.

## Acceptance criteria

- [ ] Policy unit tests (table-driven, time injected): switch off; active holder; never held; single
      lapsed paid order; coupon-reduced amount; two paid orders (most recent wins); paid then lapsed
      extension order (base stays the paid order — no halving); only ₹0 orders (list-price fallback);
      ₹0 + paid (paid wins); ₹499 → ₹250 and ₹333 → ₹167 rounding; custom percent/days.
- [ ] Config unit tests: unset ⇒ off; invalid/negative/zero/over-100 values ⇒ defaults.
- [ ] Precedence tests extended: automatic extension vs Upgrade — cheaper wins, tie ⇒ extension,
      only the winner's flag set.
- [ ] Integration (real routes, in-memory Mongo): with the switch on, a lapsed holder's
      `filter-active` / `active` listing row has `amount` = offer price (string), `duration` = 183,
      `originalAmount` = list price, `is_expire: 1`, `is_buy: 0`; an active holder and a stranger see
      list values with `is_expire: 0`; anonymous listings never carry the offer.
- [ ] Integration: checkout at the offer price succeeds on every Razorpay order path; below it
      (beyond the ₹1 tolerance) is rejected; a coupon applies on top of the offer price; the created
      order has `isExtensionOrder: true`, `extendsOrderId` = the source order, 183 days, and the
      lapsed order is unchanged.
- [ ] With the switch unset, the same fixtures produce no offer anywhere.
- [ ] No code path reads `extensionEnabled` / `extensionPrice` / `extensionValidity`; the schema keeps them.
- [ ] Existing extension tests that assert per-plan configuration are rewritten against the policy,
      not deleted; the full backend suite shows no new failures versus the clean tip.

## User stories covered

- Stories 1–6, 8–13, 17, 18, 20, 21, 24–26, 31–36, 38–40
