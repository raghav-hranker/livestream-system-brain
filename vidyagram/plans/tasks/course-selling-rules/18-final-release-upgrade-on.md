# Final release and turn upgrade on

**Type**: HITL
**Blocked by**: All
**Repo**: Prod, with the user

## What to build

Release the remaining backend and admin work. Once the app shows the warning, test one real upgrade end to end with a test account, then turn the switch on. Tell the client team about `Plans.offer`, so that upgrades have one way to be set up.

## Acceptance criteria

- [ ] Backend and admin are live with the upgrade switch off, and the smoke checks pass.
- [ ] The app build shows the warning, seen on a device.
- [ ] One real upgrade: the old course is gone, the new one works, no extension offer appears for the old one, its payment still shows in revenue, and Undo works.
- [ ] The switch is on, with the undo steps recorded.

## Rollout notes from the autonomous run (2026-11-06)

- **Deploy order.** Backend before admin, every time. The backend's `selling` schema is `.strict()`, so an old backend rejects any course save that sends `combo`, `attached`, `addons` or `exchange`.
- **Indexes.** Build each one by hand, record it in the index ledger, and use `commitQuorum: 'majority'`:
  - `Plans` `{'courseSale.key': 1}`
  - `Course` `{'selling.addons.courseId': 1}`
  - `Course` `{'selling.exchange.courseIds': 1}`
  - `orders` `upgraded_to_order`: `{upgradedToOrderId: 1}`, partial on `upgradedToOrderId: {$exists: true}`

  The two `courseSale` indexes from 06 come first, which makes six in all. There's no build script yet.
- **Before the upgrade switch.**
  - Fix or hand-run the Apple IAP and QR sync tests the baseline already fails. This branch changed those paths, and the suite can't see regressions in tests that already fail.
  - Count the AppX-merged source orders that will never be offered an upgrade.
  - Tell the app team that hand-made upgrade offers now say `kind: 'addon'` in My plans.
  - Decide whether QR should keep refusing every upgrade-only plan.
  - Polish review lows. None is needed once `ORDER_WRITE` enforces, but each is small:
    - Store the Razorpay order or link id in `upgradeConsent` and require it in `upgradePaymentProven`. A PUT of `orderId` can borrow a payment of exactly the consented amount.
    - Alert on orders that are success, carry `upgradeConsent`, and have no `paymentProof`. The student keeps both courses and only a `console.warn` shows it.
    - Read `primary` in `markOrderSuccessful`'s pre-read.
- **Exchange.** The Allow Exchange row needs no switch beyond `EXCHANGE_ENABLED`, which is already on. Once live, any admin can put swap lists on real courses before the app ships.
- **Lengths.** `DURATION_PRICING_ENABLED` and `NEXT_PUBLIC_DURATION_PRICING` stay off until task 01 shows the app handles several lengths.
- **Upgrade switch.** Before turning on `UPGRADE_REMOVAL_ENABLED`, move the `ORDER_WRITE` auth group from report to enforce on the Vidyagram box.
  `POST /api/orders` and `PUT /api/orders/:id` are open today, so anyone can create success orders.
  Task 15b gates removal on checkout consent, so they can't remove a course. They can still hand out free access, which is an older hole.
- **Apple.** Course-made plans have no Apple product id. Check what the iPhone app shows on one before release.

## User stories covered

- None directly. This releases the earlier tasks.
