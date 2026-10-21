# Inactive plan = closed to new buyers

**Type**: AFK
**Blocked by**: 01 — Automatic extension offer, end to end, behind the switch

## What to build

Design record D5 / glossary **Inactive plan**. An inactive plan (`status: 0`) is listed **only** to
its own lapsed holders, **only** at the offer price; everyone else never sees it and cannot buy it at
any price — which also closes today's hole where the grand-total check never looked at plan status.
Course status does not gate the offer.

Shape (PRD modules 4–6):
- **Plan visibility for a user** — every active plan plus the inactive plans on which this user
  currently has an Extension offer; used by the user-scoped listing handlers (active-for-user, the
  single-plan subscription lookup, filter-active with/without course or category) in place of their
  hard-coded active-only filter. The anonymous active-plans listing stays active-only.
- **Purchase admission** — active plan ⇒ allowed as before; inactive plan ⇒ allowed only when the
  policy yields an offer for this user, and only at that price; otherwise rejected. Applied in the
  grand-total check and every Razorpay order path. Admin assign paths are not gated.
- Access after purchase comes from the order's course snapshot (entitlement ignores inactive plans'
  course list) — prove it, and prove every order-creating path writes the snapshot.

## Acceptance criteria

- [ ] Integration: with the switch on, a lapsed holder of an inactive plan sees it in `filter-active`
      (plain, with `courseId`, with `categoryId`) and `active/:userId` at the offer price with `is_expire: 1`.
- [ ] Integration: a new user, an anonymous caller, and the anonymous active-plans listing never see
      the inactive plan; an active holder of it is not offered it.
- [ ] Integration: with the switch **off**, nobody sees the inactive plan (it is exactly as today).
- [ ] Integration: checkout of an inactive plan is rejected for a stranger at list price and at the
      offer price; accepted for the eligible lapsed holder at the offer price; rejected for them below it.
- [ ] Integration: after the lapsed holder buys a renewed inactive plan, class and course access
      authorization grant its courses via the order's course snapshot.
- [ ] Test (unit or integration) that every order-creating path writes the plan's courses onto the order.
- [ ] Offer shown even when the plan's courses are inactive (no course-status gate).

## User stories covered

- Stories 7, 14, 15, 16, 19, 27, 28, 37
