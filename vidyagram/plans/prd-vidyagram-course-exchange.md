# PRD: Vidyagram course exchange

Status: ready-for-agent, drafted 2026-10-23 from the design record [`course-exchange.md`](course-exchange.md) (D1–D14).
Vidyagram only (backend branch `vidyagram-admin`, admin branch `vidyagram-admin`). Nothing here ships to quicktricks.

## Problem Statement

A student buys a course, opens it, and realises it is the wrong one: wrong exam, wrong level, or a teacher they don't
like. Today their only way out is to call support, and support has no tool built for this. The one admin tool that
exists (the "Exchange" dialog on an order) swaps an order's plan with no rules, no record of what changed and no undo.
It is also not locked to admins, so any logged-in student token could call it.

The Vidyagram team wants students to fix a wrong purchase themselves, quickly and safely, without giving away
courses for free.

## Solution

On the page of a course they bought, an eligible student sees an "Exchange course" action. It opens a sheet, as in the
reference mock:

- A banner says whether they can exchange, and why. For example: "You've watched 0% and bought it 12 days ago. 18 days
  left to exchange."
- A list of the courses they can pick instead, with each course's banner and title and a "Free swap" tag. No price is
  shown, because no money moves.
- An "Exchange course" button, and a footnote with the rule: "Eligible if under 5% watched within 30 days of
  purchase."

The student picks a course and confirms. The new course opens straight away. The old course leaves My Courses, and the
order history says "Exchanged from <old course>". The end date stays the same. Each purchase can be exchanged once.

The admin decides which courses each course can be exchanged for, on that course's plan. On any order, the admin can
see that it was exchanged, from what, when and at what usage. They can undo a swap.

Version 1 covers only single-course purchases paid through Vidyagram's own Razorpay checkout. Combos, iPhone purchases,
free or admin-given courses and orders imported from AppX show no Exchange action.

## User Stories

1. As a student who bought the wrong course, I want an Exchange action on that course's page, so that I can fix it
   without calling support.
2. As a student, I want the Exchange action to appear only when I can actually use it, so that I don't tap into a
   dead end.
3. As a student, I want the sheet to tell me how much I've watched, how long ago I bought the course and how many days
   I have left to exchange, so that I know where I stand.
4. As a student who is not eligible, I want a plain reason (watched too much, too late, already exchanged, took a
   test, opened too many PDFs), so that I understand why.
5. As a student, I want to see the courses I can switch to, with their banner and title, so that I can choose with
   confidence.
6. As a student, I want each option marked "Free swap", so that I know I won't be charged.
7. As a student, I don't want to see courses I already own in the list, so that I don't swap into something I have.
8. As a student, I don't want to see courses that are no longer on sale, so that I don't pick something that is being
   retired.
9. As a student, I want one confirm step that names both the course I'm giving up and the course I'm getting, so that
   I don't swap by accident.
10. As a student, I want the new course to open immediately after I confirm, so that I can start studying.
11. As a student, I want my end date to stay the same after the swap, so that I neither lose nor gain days.
12. As a student, I want the old course gone from My Courses after the swap, so that my list shows what I have.
13. As a student, I want my order history to say "Exchanged from <old course>", so that I can see what happened.
14. As a student, I want a double tap or a dropped connection not to swap twice or into the wrong course, so that a
    flaky network can't hurt me.
15. As a student, I want to know that a purchase can be swapped only once, so that I choose carefully.
16. As a student who bought a combo, I want no Exchange action on the combo's courses, so that I never lose a whole
    combo by tapping on one course.
17. As a student, I want the "days left to exchange" count to start from when I actually paid, so that it is fair.
18. As an admin, I want an "Exchange to" picker on the plan form of a single-course plan, so that I decide which
    courses students can switch to.
19. As an admin, I want the "Exchange to" picker hidden on combo plans and on plans with no course, so that I can't
    set up a swap the system won't honour.
20. As an admin, I want the picker to search plans by name, like the Upgrade source-plans picker, so that I can find
    targets quickly.
21. As an admin, I want the backend to refuse an "Exchange to" list on a combo plan even if the form is bypassed, so
    that the rule holds.
22. As an admin, I want a plan with an empty "Exchange to" list to show no Exchange action to its buyers, so that
    exchange is opt-in per course.
23. As an admin, I want the 30-day window, the 5% watch limit and the PDF-open limit set in one config place, so that I
    can tune them without a code change.
24. As an admin, I want to see on an order that it was exchanged, from which course, when, and what the student had
    watched, opened and attempted at that moment, so that I can answer support questions.
25. As an admin, I want an "Undo exchange" action on an exchanged order, so that I can fix a mistake.
26. As an admin, I want undo to put back the old course and remove the new one, keeping the end date, so that the
    student is exactly where they were.
27. As an admin, I want undo to refuse if the order has changed since the swap, so that I don't overwrite a later
    edit.
28. As an admin, I want an undone order to stay closed to further student swaps, so that a student can't swap, ask
    for an undo and swap again.
29. As an admin, I want the old admin Exchange and Extend validity tools to need an admin login, so that students can't
    call them.
30. As a support agent, I want an exchanged order to keep its original payment, amount and invoice, so that payments
    and refunds still reconcile.
31. As a finance user, I want exchanges to move no money and change no order totals, so that revenue reports stay
    true to what was paid.
32. As a developer, I want the eligibility rule in one pure function that takes facts and returns either a reason or
    the banner numbers, so that it is easy to test and to change.
33. As a developer, I want the swap and the undo to be single conditional writes, so that retries and races converge.
34. As a developer, I want the place where a swap changes what an order grants to be one function, so that a later
    change to how orders grant courses touches only that function.
35. As an app developer, I want one read endpoint that returns eligibility, the banner numbers and the targets, and one
    write endpoint, so that the sheet is one screen with one call each way.
36. As an app developer, I want a stable `reason` code for ineligibility, so that the app can show its own copy.
37. As an app developer, I want a written guide for the two endpoints and the button rule, so that I can build the
    sheet without reading backend code.

## Implementation Decisions

### Scope and rules (from the design record)

- **The unit is the order, and only single-course plans can exchange (D1).** The "Exchange to" list lives on the
  source plan as a list of target plan ids. Both the source and every target must hold exactly one course. Combo
  plans (2+ courses) and course-less plans cannot carry a list, and the backend refuses to swap their orders.
- **Straight swap (D2).** No money moves. Order totals, coins, coupons and invoices stay untouched.
- **Keep the original expiry (D3).** `expireDate`, `duration` and `daysLeft` stay as they were.
- **"Used" counts video, PDFs and tests (D4).** All of these must hold:
  - the purchase was within `EXCHANGE_WINDOW_DAYS` (default 30);
  - the course watch % is below `EXCHANGE_MAX_WATCH_PCT` (default 5);
  - there are zero test attempts in the course;
  - at most `EXCHANGE_MAX_PDFS_OPENED` (default 2) of the course's PDFs have been opened.
- **Purchase time.** The window starts when the order was marked successful, never at the `createdAt` of an
  imported row. No field stores that moment. `markOrderSuccessful` sets `expireDate = now + duration` at success, so
  the purchase time is `expireDate − duration` days. It falls back to `createdAt` when `duration` is missing.
  Extend-validity edits would shift the result. Those orders are rare and admin-made, and they only move the window
  later.
- **Once per order (D6).** An order that carries an `exchange` record can never be student-swapped again, even after
  an undo.
- **Excluded orders (D7).** These are ineligible with a reason:
  - Apple IAP orders;
  - orders with `grandTotal` 0;
  - admin-assigned and free orders;
  - AppX-imported orders;
  - upgrade and extension orders;
  - Course Builder build orders;
  - orders already exchanged;
  - orders that are not `success`, have `status` 0 or are expired.
- **The swap is instant (D10).** It needs no approval.
- **The old course disappears (D11).** The source course leaves My Courses and stops opening. The user accepted this
  removal for a swap the student starts and confirms. It is the stated exception to "never remove granted access".
- **Admin undo (D12).** Described below.
- **The target list (D13).** It hides plans the student already actively holds, plans with `status` 0, and plans that
  fail the single-course rule.
- **A course held twice (D14).** If two eligible orders grant the same course, the action acts on the newer one.

### Modules

**Exchange policy (deep, pure).** One function decides eligibility.

Its input:
- the order: status, gateway, total, offer marks, build, import marker, purchase time, any exchange record;
- the source plan's shape;
- the usage numbers: watch %, PDFs opened, tests attempted;
- now, and the config.

Its output is a tagged result. It is either `eligible`, with `watchedPct`, `daysSincePurchase` and
`daysLeftToExchange`, or `ineligible`, with one `reason`.

Reasons are a closed set, checked in a fixed order so the first one wins:
1. `not_owner`
2. `order_inactive`
3. `excluded_order_kind`
4. `combo_plan`
5. `no_targets`
6. `already_exchanged`
7. `window_passed`
8. `watched_too_much`
9. `test_attempted`
10. `pdfs_opened`

It does no I/O. Every rule lives here and nowhere else.

**Usage reader.** Given a user and a course, it returns `{ watchedPct, pdfsOpened, testsAttempted }`.
- The watch % reuses the course watch-time calculation that already exists. Classes with no length count 0 toward
  the watched time, as well as toward the total, so missing lengths cannot inflate the percentage.
- PDFs opened counts the distinct course PDFs that have an impression for the user.
- Tests attempted counts test attempts tagged with the course.
- It reads only; it never writes.

**Exchange service.** This one does I/O.
- `options(userId, orderId)` loads the facts, runs the policy and resolves the targets. Each target comes back with
  its plan id, course id, title and banner.
- `exchange(userId, orderId, targetPlanId)` runs the policy again, checks the target is on the list, and then makes
  one conditional update. The update only applies if the order is still on the source plan and has no `exchange`
  record.
- `undo(adminId, orderId)` also makes one conditional update. It only applies if the order is on the recorded target
  plan and the exchange has not been undone.
- A retry that finds the swap already made returns the current state with 200, and writes nothing.

**Order grant rewrite (one function).** This is the only code that changes what an order grants. It sets `planId`,
the item ids resolved from the target plan, `planFor` and `updatedTime`, and clears `latestCourseId`. The same function
runs in reverse for undo. If the separate plans rethink
([`plans-keep-or-remove-2026-10-22.md`](../reports/plans-keep-or-remove-2026-10-22.md)) moves access onto a per-order
course list, this function is the only one that changes.

**Plan schema and admin plan form.**
- Plans gain `exchangeToPlanIds: ObjectId[]`, default empty.
- Plan create and update validate it: the plan holds exactly one course, every target holds exactly one course, no
  target is the plan itself, and every target exists. A violation returns 400.
- The admin plan form gets an "Exchange to" picker. It reuses the Upgrade source-plans picker (search box, name sort)
  and is limited to single-course plans. It shows only when the plan has exactly one course.

**Order schema.**
- Orders gain an optional `exchange` subdocument with these fields: `fromPlanId`, `fromCourseIds`, `toPlanId`, `at`,
  `by` ('student'), `watchedPct`, `pdfsOpened`, `testsAttempted`, `undoneAt`, `undoneBy`.
- The order stays `orderStatus: 'success'`, so the Razorpay sync cron and the webhooks never touch it.

**Routes.**
- `GET /api/orders/:id/exchange-options` and `POST /api/orders/:id/exchange-self` with body `{ targetPlanId }`. Both
  are student routes: `authenticateToken`, owner taken from the JWT, and someone else's order returns 404.
- `POST /api/orders/:id/exchange-undo` is admin-only, behind `requireAdmin`.
- The existing `PUT /api/orders/:id/exchange` and `PUT /api/orders/:id/extend-validity` move behind `requireAdmin`.
  This is task 01 and a prerequisite for everything else.

**Course-page signal.** The course detail response the app already reads gains
`exchange: { orderId, eligible, reason? } | null`.
- It is `null` when the student holds no order on a plan with a non-empty "Exchange to" list.
- The app shows the action only when `eligible` is true. The full sheet data comes from `exchange-options`.
- This one field is the button rule, so the app needs no other request to decide.

**Admin order view.** The order detail and history rows show an "Exchanged" badge with from, to, time and the usage
snapshot, plus an "Undo exchange" button. An undone exchange shows "Exchange undone" with its time.

### Wire shapes

`GET exchange-options` returns 200 with:

```
{
  eligible: boolean,
  reason?: string,
  watchedPct: number,
  daysSincePurchase: number,
  daysLeftToExchange: number,
  rule: { windowDays, maxWatchPct, maxPdfsOpened },
  source: { courseId, title, banner },
  targets: [ { planId, courseId, title, banner } ]
}
```

`POST exchange-self` returns 200 with the hydrated order. Errors:
- 400 `target_not_allowed`;
- 409 with the policy `reason` when the student is no longer eligible;
- 404 for someone else's order.

### Config

- `EXCHANGE_ENABLED` (default `false`) is the kill switch. When it is off, the course-page field is `null` and the
  student routes return 404.
- `EXCHANGE_WINDOW_DAYS=30`, `EXCHANGE_MAX_WATCH_PCT=5` and `EXCHANGE_MAX_PDFS_OPENED=2`.

## Testing Decisions

A good test drives the public route, or the pure policy through its one entry point. It asserts what a student or
admin observes: the response, the order as stored and course access afterwards. It does not assert on query shapes or
private helpers.

**Policy unit tests** (table-driven):
- Each `reason` fires on its own fixture.
- When several reasons apply, the first in the fixed order wins.
- The boundaries behave as stated: 4.9% and 5.0% watched, day 30 and day 31, 2 and 3 PDFs opened, and the purchase
  time taken from the success time rather than `createdAt`.
- The banner numbers are correct for an eligible order.

**Backend integration tests** on in-memory Mongo, through the real routes:
- A student on a single-course plan with a list gets eligible options. The targets exclude a plan they already hold
  and a `status` 0 plan.
- `exchange-self` swaps it. Afterwards the old course's class and PDF access is refused, the new course's class
  access is allowed, My Courses lists only the new course, and `expireDate` and `grandTotal` are unchanged.
- A second identical `exchange-self` returns 200 and writes nothing. A different target after the swap returns 409
  `already_exchanged`.
- Two concurrent `exchange-self` calls with different targets leave exactly one swap.
- Another user's order returns 404. A target not on the list returns 400.
- A combo order, an Apple order, a ₹0 order, an APX order and an expired order are each ineligible with the right
  reason.
- `undo` restores the source plan and access. A second undo is a no-op. `exchange-self` after the undo returns 409
  `already_exchanged`.
- Plan update with `exchangeToPlanIds` on a combo plan returns 400, and a combo target returns 400.
- `PUT /:id/exchange` and `/:id/extend-validity` return 403 for a student token and 200 for an admin token.
- With `EXCHANGE_ENABLED=false`, the course-page field is `null` and the student routes return 404.
- The Razorpay sync cron over an exchanged order leaves it unchanged.

**Usage reader tests:**
- A class with no length does not raise the watch %.
- A PDF opened twice counts once.
- A test attempt in another course does not count.

**Admin component tests:**
- The picker shows only for single-course plans and sends the ids.
- The order view shows the badge and the usage snapshot, and Undo calls the route.

Prior art:
- `planUpgradeOffer.test.ts` and the extension policy tests for pure policy tables.
- The `src/tests/integration` suites for real routes on in-memory Mongo.
- The feedback PRD's integration list for style.

## Out of Scope

- Combos, including swapping one course out of a combo. This is a later phase, decided after the plans rethink.
- Paying the difference for a pricier target, or refunding or crediting coins for a cheaper one.
- Fresh validity on the new course.
- Admin approval queues, and a student-side undo.
- Apple IAP, AppX-imported, admin-given, free and build orders.
- Practice batches, test series and ebooks, which are not courses.
- quicktricks. The admin route lock there is a separate task, never part of this change.
- Push or SMS notifications about a swap.

## Further Notes

- **The data shape is different from what the design record said.** The plans report
  ([`plans-keep-or-remove-2026-10-22.md`](../reports/plans-keep-or-remove-2026-10-22.md)) corrected the 10-22 count.
  Vidyagram has not launched. Only 7 orders have come through our own checkout, and the "half are combos" figure was
  the back-dated AppX import. Single-course plans are already the norm (43 of 81 active), and only about 9 plans are
  real combos. So D1 costs very little.
- **Launch timing.** Version 1 serves only buyers through our own checkout after launch, because every imported order
  is excluded. That is intended. Imported AppX purchases are older than the window, and their watch history is not in
  our data.
- **The PDF-open limit is a guess.** The default of 2 should be revisited after launch.
- **App contract.** The Flutter guide for the course-page field and the two student routes ships with the last task,
  as with the catalogue-filters guide.
