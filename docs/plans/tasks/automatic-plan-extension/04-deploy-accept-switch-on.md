# Deploy dark, accept on prod, switch on

**Type**: HITL
**Blocked by**: 01, 02, 03

## Pre-deploy impact gate (2026-09-24)

The read-only production census at 17:14 UTC is in
`reference/scripts/automatic-plan-extension-local/{renewal-impact,paid-access-impact}-2026-09-24.csv`
(ID-only, local, ignored by Git). It compared production `origin/quicktricks-admin`
`10b18139a` with the extension branch `92240a00b`, using the branch's expiry
predicate and the production app/content entitlement predicates.

- **Newly visible inactive plans:** 88,853 users / 153,174 user-plan pairs,
  all on four inactive plans with `amount: '0'`. **Zero** currently inaccessible
  users gain a positive-price purchase option. One ₹1,000-plan holder would
  receive a ₹500 offer under the branch predicate, but their no-expiry order
  already grants app access and is excluded from the renewal-needed count.
  The branch's real listing/admission functions return a ₹0 offer for the four
  plans. All three zero-total order paths immediately create a
  successful order **without `expireDate`**, which the app treats as active
  indefinitely. Decide whether zero-list plans are excluded or can renew free,
  then make that policy and expiry safe before enabling the switch.
- **Existing paid entitlement gaps:** five revenue-eligible users / five
  user-course pairs return `is_buy: 0` despite an unexpired Razorpay purchase.
  **Two** also fail `authorizeCourseAccess` for a non-free course and are
  confirmed paid-content denials. The other three courses are free and the
  content gate allows them; the website's free-course path bypasses `isPaid`,
  so their mobile access remains unverified. Each pair's purchased plan is
  inactive and its snapshot omits the affected course. The branch writes
  snapshots for new purchases but does not repair these existing orders.
  All five pairs were checked with the exact production functions against the
  guarded secondary. Five additional positive-amount pairs are admin
  assignments, not paid sales.
- **Class placement review:** nine paid user-course pairs (six users, including
  the task's test account) have classes assigned only by inactive placements.
  The exact `authorizeClassAccess` function denies at least four class calls
  per pair; some classes remain free. These courses have `status: 0`. Confirm
  which retired placements should remain inaccessible to existing buyers.
- The production `.env.development` leaves `ENFORCE_ORDER_EXPIRY` unset, and no
  successful order in the census has `accessUntil`. Playback/PDF authorization
  therefore does not expire access, even when the app's `is_buy` becomes 0.
  Decide whether renewal is intended to restore only the app gate or also the
  content gate before declaring end-to-end acceptance.

## What to build

Ship tasks 01–03 to prod with the switch unset, prove nothing changed, then turn the feature on and
accept it with a real purchase. Human in the loop: prod deploy, a real payment, and the go/no-go call.

Steps:
1. Rebase the worktree onto a freshly fetched `origin/quicktricks-admin`; surgical `dist` compile of
   the touched files, drift check, commit (no trailers), push.
2. Box: pull ff-only, `pm2 restart 27`, status online. Confirm `LAPSED_EXTENSION_ENABLED` is **unset**
   and a lapsed test fixture sees list price.
3. Set `LAPSED_EXTENSION_ENABLED=true` (percent/days left at defaults) in the box `.env`, restart.
4. Acceptance on the test account (`6a7eb7ce…`) using `reference/scripts/plan_extension_*.js`
   (backdate / restore). Beware the Razorpay sync cron resurrecting voided paid orders.
5. Record results here; leave the switch on or unset it per the user's call.

## Acceptance criteria

- [ ] Dark deploy: a lapsed fixture sees list price and `is_expire: 0`; no listing/checkout regression.
- [ ] Switch on: the lapsed fixture sees 50% of its last paid amount and 183 days in the Android app
      and on the website plans page.
- [ ] Real Razorpay purchase at the offer price creates an order marked as an extension, 183 days,
      pointing at the lapsed order; access restored; listing back to purchased.
- [ ] Inactive-plan case: a deactivated plan shows the offer to the lapsed fixture and not to a fresh account.
- [ ] Android check recorded: what tapping an expired course in My Courses does (reaches the plan
      list or not).
- [ ] Zero-list inactive plans have an explicit product rule and a safe order path; no ₹0 extension
      creates an unbounded entitlement. Repeat inactive-plan listing/checkout checks on a zero-list
      plan before switch-on.
- [ ] The two real-payment non-free user-course pairs pass both the production
      `addIsPaidToCourses` and `authorizeCourseAccess` gates. Repair existing order snapshots or
      the entitlement read path, rather than relying on future-order snapshot writes. Review the
      three free-course badge mismatches with the mobile client separately.
- [ ] Existing buyers' inactive CourseClass placements are reviewed; any classes that should stay
      accessible pass `authorizeClassAccess`. Record the intentional inactive cases.
- [ ] Record the chosen expiry enforcement policy and test the app gate and content gate together
      on an expired order and a renewed order.
- [ ] All test-data changes restored; restore commands recorded here.

## User stories covered

- Stories 7, 32, 34 (verification of the whole PRD on prod)

## Deploy record (2026-09-25, ~01:34 IST)

The user chose to deploy and switch on in one step, skipping the separate dark stage (step 2).

- Box `webserver2-2`, `/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend`:
  `git pull --ff-only` `bcf5d839c..e9d273233` (tracked tree was clean). Only `pm2 restart 27 --update-env`
  (quicktricks-backend) was restarted.
- `.env.development`: appended `LAPSED_EXTENSION_ENABLED=true` (percent/days at defaults 50/183).
  Backup: `.env.development.bak-20260925-lapsed-ext`. **To switch off:** delete that line, then
  `pm2 restart 27 --update-env`.
- Live API check straight after, on real accounts: `…0894` offered only RRB Batch @ : Extension ₹850 / 183 d;
  `…9504` only SPL FOUNDATION @ : Extension ₹300 / 183 d (empty copy not offered); `…8836` no offer.
  `my-courses` 6 / 3 / 1 courses, retired free courses gone, matching the 3110 validator exactly.
- Error log after restart: only a signup `refferal_code` DuplicateKey, which is unrelated.

Still open from the acceptance criteria: a real Razorpay purchase at the offer price, the Android
tap-through from an expired My Courses entry, and the gate items above (5 paid-entitlement pairs,
inactive CourseClass placements, expiry enforcement policy). A ₹0 extension is no longer possible
(task 07). Known gap: iOS users may see the offer on listings, but an Apple purchase grants the plan's normal duration (task 02).
