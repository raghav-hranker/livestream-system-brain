# PRD: Automatic plan extension

State: `needs-triage`
Owning repos: LMS fork **quicktricks-backend** (all behaviour) · **quicktricks-admin** (remove the
Extension card). Mobile app and website: no release.
Decision record: [`automatic-plan-extension.md`](./automatic-plan-extension.md) (D1–D10, from the
2026-09-24 grilling session). ADR: fork `docs/adr/0023-automatic-lapsed-holder-extension.md`
(proposed). Glossary: fork `CONTEXT.md` → "Plan extension" (**Extension offer**, **Extension base
price**, **Inactive plan**). Both are drafted on fork branch `feat/automatic-plan-extension`
(worktree `../quicktricks-backend-auto-extension`, off `origin/quicktricks-admin` `10b18139a`),
uncommitted.

## Problem Statement

When a student's plan expires, the only way back in is to buy it again at full price. The platform
already has an Extension offer that sells a lapsed holder the plan cheaper, but an admin has to
switch it on and enter a price and validity **on every plan**. There are ~166 plans, and in practice
one test plan has it configured. So lapsed students see full price, many don't come back, and the
business has no win-back lever it can actually use.

There are two other ways a lapsed student gets stuck:

- An admin deactivates an old plan, often to replace it with a new one for the same course. The
  student still sees the expired course in **My Courses** but has no way to renew it.
- On iOS the app buys a fixed App Store product. Today an eligible iOS buyer pays the full Apple
  price but gets only the extension's validity. Once every plan carries an offer, that would hit
  every lapsed iOS user.

## Solution

Every lapsed holder of every plan automatically sees that plan at **50% of what they originally paid
for it (never more than 50% of today's price), for 183 days**. Nobody has to configure anything per plan. On the course and plans screens the
student sees the discounted price and a "Buy Now" button, exactly as the Extension offer looks
today. Buying restores access to everything the plan bundles, for 183 days from the purchase.

- "What they paid" is the amount actually charged, after any coupon, on their first paid
  purchase of the plan, even if the plan is cheaper today (₹799 then, ₹599 now ⇒ ₹400). Later renewals — including APX's, which
  were never marked as renewals — do not lower it. If they never paid (admin grant, free plan, full coupon), it is 50% of the
  plan's current price.
- A plan the admin has made **inactive** stays closed to new buyers. Its own lapsed holders can
  still renew it at the offer price.
- Coupons still work on top of the offer. If the student also qualifies for an Upgrade offer on the
  same plan, they get whichever is cheaper.
- iOS purchases get no offer. An Apple purchase always gives the plan's normal validity.
- The percentage, the number of days, and an on/off switch are environment settings on the server.
  The feature ships **switched off** and is turned on by editing the box env.
- The per-plan Extension settings in the admin panel are removed. There is one rule for everyone.

## User Stories

1. As a lapsed student, I want to see the plan I used to have at a reduced price, so that coming back is an easy decision.
2. As a lapsed student, I want the reduced price to be half of what I actually paid, so that the offer feels fair relative to my own purchase.
3. As a lapsed student who used a coupon, I want the offer based on the price after my coupon, so that I am not charged more than half of what I really paid.
4. As a lapsed student, I want the offer to give me 183 days of access, so that I know exactly how long I am renewing for.
5. As a lapsed student, I want my 183 days to start from the day I renew, so that I get the full period I pay for.
6. As a lapsed student, I want to see the offer price in the same place I normally see the plan's price, so that I don't need to find a special screen.
7. As a lapsed student, I want to tap my expired course in My Courses and reach a way to renew it, so that an expired course is not a dead end.
8. As a lapsed student, I want renewing to unlock every course the plan bundles, so that I get back everything I had.
9. As a lapsed student, I want to keep the same price each time my access lapses, so that the offer doesn't change unpredictably between renewals.
10. As a lapsed student who bought the same plan several times (a full purchase, then renewals), I want the offer based on my original paid purchase, so that renewing never keeps halving the price — and never above half of today's price, so that I don't pay more than a new buyer would. *(Revised 2026-09-24; was "most recent paid purchase".)*
11. As a student whose plan was granted to me for free, I want to be offered the plan at half its current price, so that I also have a way back in.
12. As a lapsed student, I want to apply a coupon on top of the offer, so that I can use promotions I receive.
13. As a lapsed student who also holds a qualifying source plan, I want the cheaper of the Extension and Upgrade prices, so that I never pay more than the lowest price I qualify for.
14. As a lapsed student whose plan was deactivated, I want to still see and renew that plan at the offer price, so that the admin retiring it doesn't lock me out.
15. As a lapsed student whose plan was replaced by a newer plan, I want to renew my old plan at the offer price, so that I can keep what I had without paying the new plan's full price.
16. As a lapsed student whose course was deactivated, I want the renewal offer to still appear, so that the course I can see in My Courses is renewable.
17. As a student with an active plan, I want to see "Purchased", not an offer, so that I don't renew by mistake and restart my access.
18. As a student who never held a plan, I want to see the normal price, so that the offer stays a returning-student benefit.
19. As a new student, I want not to see inactive plans at all, so that I only choose from plans that are on sale.
20. As an anonymous visitor, I want to see only normal prices, so that listings are consistent before I sign in.
21. As a student on the website, I want the offer and the purchase to work exactly as on Android, so that I can renew from either.
22. As an iOS student, I want an Apple purchase to always give me the plan's full normal validity, so that I never pay the full App Store price for a shorter period.
23. As an iOS student, ideally I want not to be shown the reduced price I cannot get, so that the screen doesn't promise something the App Store won't charge. (Best effort: depends on whether the listing request identifies iOS.)
24. As a student whose app sends a stale price, I want the server to reject a payment below the price I actually qualify for, so that the order is consistent.
25. As a student, I want my renewal order to show up in my order history like any other purchase, so that I have a record of it.
26. As an admin, I want lapsed students on every plan to get the offer without any per-plan setup, so that the win-back works across the catalogue.
27. As an admin, I want deactivating a plan to mean "stop selling to new buyers", so that I can retire or replace a plan without stranding its past buyers.
28. As an admin, I want deactivated plans to stay hidden from new students, so that retired plans don't reappear in the store.
29. As an admin, I want the admin Plan form to no longer show Extension settings, so that nobody configures something that has no effect.
30. As an admin, I want the Upgrade offer settings to stay as they are, so that existing upgrade campaigns keep working.
31. As an admin, I want renewal orders marked as extensions and linked to the order they followed, so that I can tell renewals from new sales in reports.
32. As an operator, I want to turn the feature on and off with an env switch, so that I can disable it quickly on launch day without a code deploy.
33. As an operator, I want the percentage and the number of days to be env settings, so that I can change the offer without a code change.
34. As an operator, I want the feature off when the switch is unset, so that deploying the code alone changes nothing for students.
35. As an operator, I want missing or invalid percentage/days values to fall back to 50 and 183, so that a typo can't produce a zero or negative price.
36. As the business, I want a renewal never to be free unless a coupon makes it free, so that free-granted students can't renew for nothing forever.
37. As the business, I want anyone other than an eligible lapsed holder to be unable to buy an inactive plan, at any price, so that retired plans are really closed to new sales.
38. As the business, I want the mobile app to need no release, so that this ships while the app is frozen.
39. As a developer, I want one place that decides a user's offer on a plan, so that the listing and checkout can never disagree.
40. As a developer, I want the offer rule to be a pure function of config, the plan, the user's orders, platform and time, so that every edge case is unit-testable.

## Implementation Decisions

**Modules**

1. **Extension offer policy (new, deep, pure).** The single rule for the Extension offer. It takes:
   - the extension config (enabled, percent, days);
   - the plan's list price;
   - the user's successful orders for that plan (each with expiry, amount paid, extension mark, purchase time);
   - the platform (web / android / ios / unknown);
   - the current time.

   It returns either no offer, or `{ price, duration, sourceOrderId }`, applying these rules in order:
   - Switched off ⇒ no offer. iOS ⇒ no offer.
   - Eligibility reuses the existing single eligibility rule: some order has lapsed and none is
     active. The source order stays the furthest-expiring lapsed order, as today.
   - **Base price:** the amount paid on the oldest (by purchase time) order with amount > 0 that
     is not an extension order — capped at the plan's current list price (min of the two). If there is none, the
     plan's list price.
   - **Price** = base × percent / 100, rounded to a whole rupee (see Further Notes).
   - **Duration** = the configured days.

   It never reads the plan's retired per-plan extension fields.
2. **Extension config (new, shallow).** Reads `LAPSED_EXTENSION_ENABLED` (unset/anything but a truthy value ⇒ off), `LAPSED_EXTENSION_PERCENT` (default 50, valid range 1–100), `LAPSED_EXTENSION_DAYS` (default 183, positive integer). Invalid values fall back to defaults. Read at boot (a change needs a process restart).
3. **Plan offer resolution (modify the existing single seam).** The batch form for listings and the per-purchase form for order paths keep their shapes and the **cheaper-wins, tie ⇒ extension** precedence. Changes:
   - The Extension candidate now comes from the policy, not from per-plan fields.
   - The order queries must fetch amount paid, extension mark and purchase time, not just expiry.
   - Both forms take an optional platform.

   The Upgrade half is unchanged.
4. **Plan visibility for a user (new, deep).** Answers "which plans may this user see in a listing": every active plan, plus the inactive plans on which this user currently has an Extension offer. Anonymous callers and the anonymous active-plans listing only ever get active plans. It is used by the three user-scoped plan listing handlers (active plans for user, the single-plan-by-subscription lookup, filter-active with/without course or category), instead of their hard-coded "active only" filter. An inactive plan returned here is always returned **with** the offer applied (never at list price).
5. **Purchase admission (new, deep).** Answers "may this user buy this plan, and at what minimum price": an active plan ⇒ allowed (price per module 3). An inactive plan ⇒ allowed only when module 1 yields an offer for this user, and then only at the offer price; otherwise rejected. It is used by the grand-total check and every order-creating path (payment link, app Razorpay, website Razorpay, direct create). The Apple path already refuses inactive plans and resolves offers with platform = iOS, so it never gets the Extension offer and always grants the plan's normal duration. Admin assign paths are admin actions and are not gated.
6. **Order creation.** No schema change. Orders already carry the extension marks (the flag and the id of the order it follows) and a snapshot of the plan's courses. Every order-creating path must keep writing that course snapshot. This is load-bearing now, because entitlement ignores inactive plans' course lists.
7. **Admin Plan form (quicktricks-admin).** Remove the Extension card (enable/price/validity), its validation, and the Upgrade ⇄ Extension mutual-exclusion rule and hint. Keep the Upgrade card unchanged. Add help text under the Active toggle: "Inactive plans stay available to their lapsed buyers at the extension price."
8. **Retired fields.** The plan schema keeps `extensionEnabled` / `extensionPrice` / `extensionValidity` so existing documents validate, but no code path reads them. There is no data migration.

**Wire contracts (unchanged shape)**
- Listing rows for an eligible user keep today's Extension offer shape: `amount` = offer price
  (string), `duration` = offer days, `originalAmount` / `originalDuration` = list values,
  `is_expire: 1`, `is_upgrade: 0`, `is_buy: 0`. `is_expire` is never 1 without the offer price in
  `amount` (ADR 0020).
- Order creation: the client still sends `grandTotal` = shown price (less coupon). The server
  recomputes and rejects anything below the admitted price, minus the existing ₹1 tolerance.
- The extension order gets `isExtensionOrder: true`, `extendsOrderId` = the source (lapsed) order,
  `duration` = offer days and `expireDate` = purchase + offer days. The lapsed order is untouched.

**Platform detection.** The Apple IAP path is iOS by construction. For listings, platform is taken from whatever the app already sends, if anything. That has to be established during implementation. If nothing identifies iOS, listings show the offer to all signed-in eligible users, and iOS users who buy anyway receive the plan's normal duration.

**Rollout order.**
1. Ship backend with the switch unset (dark).
2. Accept on prod by setting the env for a test account run.
3. Turn it on.
4. Ship the admin form change.
5. In a separate later slice, retire the older "extension plan" record mechanism after counting prod plans with the old-style extension flag set.

## Testing Decisions

- **What makes a good test here:** only external behaviour. Given a user's orders and a plan, what the listing shows and what checkout accepts. No assertions on query shapes or internal calls. Time is injected, never read from the clock inside the policy.
- **Extension offer policy (unit, pure)** is the heart of the suite. Table-driven cases:
  - off switch;
  - iOS;
  - active holder;
  - never held;
  - single lapsed paid order;
  - coupon-reduced amount;
  - two paid orders (oldest wins); unmarked APX renewal chain (₹709 → ₹299 → ₹299 ⇒ ₹355);
    later full re-buy does not move the base; oldest above list ⇒ capped at list (₹1899 vs list ₹1699 ⇒ ₹850; ₹799 vs ₹599 ⇒ ₹300); older ₹0 `TS-*` clone skipped;
  - paid then extension order lapsed (base stays the paid one, no halving);
  - only ₹0 orders (list-price fallback);
  - mixed ₹0 + paid (paid wins);
  - odd amounts (rounding);
  - invalid env values (defaults);
  - percent 100 / days custom.
- **Extension config (unit):** defaults, invalid values, off-by-default.
- **Plan offer resolution (unit, pure precedence):** extend the existing precedence tests:
  - automatic extension vs Upgrade, cheaper wins;
  - tie goes to the extension;
  - only the winning flag is set.
- **Plan visibility + purchase admission (integration, real routes, in-memory Mongo):**
  - lapsed holder sees an inactive plan at the offer price;
  - new user and anonymous caller don't see it;
  - active holder of an inactive plan sees "Purchased" semantics, not an offer;
  - checkout of an inactive plan at list price is rejected for a stranger;
  - checkout at the offer price succeeds for the lapsed holder, and the created order carries the
    extension marks, 183 days and the course snapshot;
  - a coupon stacks on the offer;
  - the Apple path grants normal duration and no extension marks.
- **Entitlement after renewal (integration):** a renewed inactive plan's courses are accessible through the order's course snapshot.
- **Prior art:** the existing extension marks unit test, the Upgrade offer unit + integration tests (real routes over in-memory Mongo), and the class-access plan-entitlement integration test. The existing extension tests that assert per-plan configuration are rewritten, not deleted: their behaviour moves to the policy.
- **Admin form:** a component test that the Extension card is gone and the Upgrade card saves unchanged.

## Out of Scope

- A per-plan override, opt-out or different percentage for specific plans.
- An App Store product at the offer price, or any iOS offer.
- Any app (Flutter) or website (thedhronas) change.
- Notifications, emails or pushes telling lapsed students about the offer.
- An admin report or list of lapsed students.
- A pre-expiry renewal window or stacking onto the old expiry. Next scope (2026-09-24): validity is
  already defined as 183 days from `max(latest expiry, purchase time)` (design record D4), so it
  can be added without re-deciding validity; it needs the listing wire decided first.
- Carrying the offer over from an inactive plan to its replacement plan. The lapsed holder renews
  the old plan; moving them onto the new plan would be a separate, Upgrade-style feature.
- Retiring the older "extension plan" record mechanism. That is a follow-up slice, gated on a prod
  count.
- What an inactive course's class/PDF listings return to a re-buyer. Parked, and it does not gate
  the offer.
- Dropping the retired fields from Mongo.

## Further Notes

- **Rounding (decided 2026-09-24):** the offer price is rounded **to the nearest whole rupee, halves up** (₹499 → ₹249.50 → ₹250). The app shows `amount` as a string and sends it back as `grandTotal`, so a whole number avoids paise mismatches against the ₹1 tolerance.
- **"Amount paid"** means the order's stored grand total. Coins redeemed at checkout are not added
  back. For an Apple-originated order it is the stored gross INR amount.
- **Acceptance** needs a real lapsed account. The standing test account (`6a7eb7ce…`) owns every
  plan, so use the backdate/restore scripts from the 2026-09-18 extension acceptance
  (`reference/scripts/plan_extension_*.js`). Mind the Razorpay sync cron, which resurrects voided
  paid orders.
- **App check (acceptance, not code):** what the Android app does on tapping an expired course in
  My Courses. If it doesn't reach the plan list, the offer is reachable only from Explore/Plans.
- **Deploy:** the fork's `dist` is the deploy artifact (surgical compile + commit, box pull,
  `pm2 restart 27`). The admin form deploys via Vercel on push. No co-author trailers in the fork
  repos. Commit as the work email.
