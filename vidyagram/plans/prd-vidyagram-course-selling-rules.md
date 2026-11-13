# PRD: Vidyagram course selling rules

Tenant: Vidyagram (781). Prototype: `vidyagram/prototypes/course-form-compact/` (chosen layout). Rules in detail:
`vidyagram/prototypes/course-selling-rules/`. Earlier on-sale flows: `vidyagram/prototypes/course-auto-plan/`. Status: draft, 2026-11-05. Nothing is built.

## Problem Statement

To sell a course, an admin makes the course, then goes to Plans and makes a plan by hand, then types the price and
validity a second time. Combos are hand-built the same way: UPSSSC Mains (₹799, 731 days) was assembled as a plan
holding its own course plus three others on 5 Nov.

The two records drift. Of the 46 active courses with their own plan, 10 show a card price that differs from what
the plan charges. Offers are configured on plans, in fields whose direction is easy to read backwards: on 4 Nov an
admin set upgrade and exchange settings on the Maths VOD 2.0 plan the wrong way round.

Students who own a course can't see from that course's page what they could move to or add.

## Solution

The course form becomes four steps, with the steps down the left side and a short summary under each:

| Step | Holds | Moved from today's form |
|---|---|---|
| 1. Basic Information | Website and App banners; title, short description, description, tags, doubt group; main category, category, faculty | Media, Basic Information, Category and Faculty |
| 2. Pricing | MRP, selling price and validity, then the rows below | Price, discount price, validity; Combo; Close Admission |
| 3. Content | Classes, tests and PDFs through Assigned Classes; attached test series, courses and books; highlights; time table; FAQ | Content, FAQ |
| 4. Settings | Status, priority; Is Free, Live, Recorded, Show in New, Old batch | Settings |

For a new course, the first Continue saves a draft, because classes can only be assigned to a course that exists. The
later steps stay locked until then.

The Pricing step is the one place an admin sells a course. Each rule is one line showing its current value and a
switch, and clicking anywhere on the line opens its fields. Several can stay open:

| Card | Who it serves | What the student gets |
|---|---|---|
| Price and validity | Anyone | This course, at one price, or at a price per length when Access Duration Based Pricing is on |
| Discount codes | Anyone buying | Codes shown on the course page |
| Make this a combo | Buyers of this course | Sub courses, shown on a Sub Courses tab |
| Allow Payment | Anyone | Off means admission is closed, and the price is kept |
| Extension | Owners, from a set number of days before expiry | More time on this course |
| Upgrade | Owners of this course | A destination course, at the row's price and validity. **This course is removed when they pay** |
| Add-on | Owners of this course | A destination course, at the row's price and validity. **They keep both** |
| Exchange | Owners of this course | A free swap to a destination course, keeping the end date |

Saving writes the plans behind the scenes. The app and checkout keep buying plans as they do today.

Anything added to a course also reaches everyone who already bought it, as it does today. Offers show on the source
course's page as well as on the target's.

## User Stories

### Selling a course

1. As an admin, I want to set MRP, selling price and validity on the course form, so that I never make a plan by hand.
2. As an admin, I want a new course to save off sale, so that nobody buys a course with no classes.
3. As an admin, I want to set Status to Active when the course is ready, so that I decide when students can buy it.
4. As an admin, I want to leave the selling price blank so that a course is only available inside combos, with no plan of its own.
5. As an admin, I want each rule's row to show its current value in one line, so that I can check a course without opening anything.
6. As an admin, I want a price edit to reach new buyers only, so that nobody's existing order changes.
7. As an admin, I want a course's card price and the price charged to be the same number, so that students are never quoted one and charged another.
8. As an admin, I want a live Bulk Sale to keep its sale price when I save a course, so that my edit applies when the sale ends.
9. As an admin, I want to take a course off sale without touching anyone's access, so that buyers keep what they paid for.

10. As an admin, I want to turn on Access Duration Based Pricing and add pricing plans, each with its own length and price, so that a student can choose 2 years at ₹449 or 3 years at ₹549.
11. As a student, I want to pick a length before I pay, so that I only pay for the time I need.
12. As an admin, I want removing a length to stop new sales only, so that buyers of that length keep their access.

13. As an admin, I want to attach discount codes to a course, so that students see them on the course page.
14. As an admin, I want to turn a countdown timer on or off for each discount code, so that I choose when a code shows urgency.

### Combos and attached products

15. As an admin, I want to turn on "Make this a combo" and search for sub courses, so that I can build a combo the way I did in AppX.
16. As a student, I want a combo's page to list its sub courses with a View Course button on each, so that I can see what I'm buying.
17. As an admin, I want to attach courses, test series and books to a course, so that buyers get them with no separate purchase.
18. As a student, I want attached products to simply unlock when I buy, so that I can open them from where they normally live.
19. As an admin, I want a combo to appear on the catalogue's Combo tab when I turn the switch on, so that I don't set it in two places.
20. As an admin, I want to be told how many existing orders an addition will reach, so that I know who will get it.
21. As an existing buyer, I want to get what is added to a course I bought, and keep everything I can open today, so that a new rule never takes access away from me.
22. As an admin, I want a warning with the order count before I remove something from the list, so that I know some students may lose it.

23. As an admin, I want to drag sub courses, upgrade rows and add-on rows into the order I want, so that the most important ones come first.

### Extension

24. As an admin, I want the same Default or Custom choices for duration, price and minimum price as the Plans bulk dialog, so that I don't learn extension twice.
25. As an admin, I want to set how many days before expiry the offer shows for this course, so that a short course and a long one can differ.
26. As an admin, I want to turn extension off for one course, so that it isn't offered where it doesn't make sense.
27. As an admin, I want bulk extension edits on the Plans page to keep working, so that I can still change many courses at once.
28. As a student near expiry, I want to see the extension's price and length on my course, so that I can keep studying.

### Upgrade

29. As an admin on the course a student owns, I want to list the courses they can upgrade to, each with its own price and validity, so that I set where they can go next.
30. As an admin, I want upgrade and add-on to work the same way on the form, so that I only learn one pattern.
31. As a student who owns this course, I want to see the upgrade price on the destination course's page, so that I know what it costs me.
32. As a student who owns this course, I want to see its upgrades on its own page, in the order the admin set, so that I find them without searching.
33. As a student who owns several courses that lead to the same destination, I want the cheapest price, so that I'm never overcharged.
34. As a student, I want to be told before paying that I will lose the old course, so that the removal is my choice.
35. As an upgrading student, I want the old course to stop only after my payment succeeds, so that a failed payment costs me nothing.
36. As an upgrading student, I want my validity to run from the purchase date for the length shown, so that the offer means what it said.
37. As a student who holds the source through both an imported and an admin order, I want the removal to be complete and consistent, so that the course doesn't half disappear.
38. As a student who also owns the source course inside a combo, I want to keep it through that combo, so that the upgrade only ends the plan I moved from.
39. As an admin, I want to offer upgrades from a combo if I choose to, so that combo owners can move up, and the student is told every course they will lose.
40. As a student who was given a course free or by an admin, I want the same upgrade and add-on offers, so that how I got the course doesn't limit me.
41. As an admin, I want an upgraded order labelled Upgraded, not Deleted, with an Undo, so that I can read its history and put a support case right.

### Add-on

42. As an admin on SSC CGL, I want to list the courses its owners can add, each with its own price and validity, so that an SSC CGL owner can add Maths VOD for ₹200.
43. As a student who owns this course, I want to see its add-ons on its page, in the order the admin set, and on the destination's page, so that I can find them from either.
44. As a student, I want to be told I keep my course, so that I can tell an add-on from an upgrade.

### Exchange

45. As an admin, I want to pick destination courses on the course form, so that I don't have to open the plan.
46. As an admin, I want the form to tell me a combo can't be exchanged, so that I don't set up something that won't work.
47. As a student, I want the exchange to behave as it does today, a free swap keeping my end date, so that nothing changes for me.

### Plans page and reports

48. As an admin, I want plans made by a course to be filtered out of the default Plans list, so that the page stays about hand-made plans.
49. As an admin, I want to open a course-made plan and see its price, length and state locked with a link to the course, so that I edit it in the right place.
50. As an admin, I want hand-made plans to keep working as they do, so that test series and ebooks still sell.
51. As an admin looking at a destination course, I want to see which courses lead to it and jump to them, so that I don't hunt for where its offers are set.
52. As a finance user, I want orders, revenue and GST reports to keep working on plan ids, so that reporting doesn't change.

### Existing data

53. As an admin, I want existing single-course plans linked to their courses instead of recreated, so that orders and reports stay on one plan.
54. As an admin, I want to approve each course whose card price differs from its plan, so that a price never changes silently.
55. As an admin, I want a combo that has no course of its own to get one, so that every combo can be edited from the course form.

## Implementation Decisions

### The forcing constraint

A plan with an Upgrade offer refuses every buyer who doesn't qualify, and the listings hide it from them. So the
public price and an upgrade can't live on one plan. **One course means one main plan plus one plan per distinct
offer price.** This also gives per-source prices and separate validity using fields that exist today.

### Data shape

- **`Course.selling`** is the admin's intent, parsed at the API boundary. There is no sold-as mode: a price makes a
  plan, a blank price means the course is only available inside combos, and the existing Is Free flag means no plan.
  Course Builder stays configured on Assigned Classes, as today.
- `selling` holds a list of price options, each with an id, price, MRP and validity. One option is the normal case; the Access Duration Based Pricing switch lets an admin add more. It also holds the included lists (`subCourses`, attached `courses`,
  `tests`, `books`); extension terms; upgrade rows and add-on rows (destination, price, validity), in order; exchange
  destinations. All three are set on the course a student owns, so the form reads one way.
- **`Plans.courseSale`** links a plan to its course: `{ courseId, key }`. The key is stable: `main:<optionId>`,
  `upgrade:<sourceCourseId>` or `addon:<sourceCourseId>`, on a plan whose `courseId` is the destination. So saving one course can write plans that sell another. A price edit updates the same plan, so
  ids stay fixed for orders and reports.
- The key also says what a purchase does. `upgrade:*` removes the source; `addon:*` doesn't.
- **An upgraded source order gets `status: 0` plus a label**, `upgradedToOrderId` and `upgradedAt`. The status stops
  access, and the label says why and keeps the history. The field name follows the client team's profile dashboard spec,
  which described it but never built it.
- `extensionTerms` gains an optional `windowDays`. Absent means the existing default.
- `Course.price`, `discountPrice`, `validity` and `isCombo` are written from `selling` so that existing readers and
  the app stay correct.

### Modules

- **Selling rules (new, pure).** `plansForCourse(course)` returns the plans a course should have. No database. This
  module holds the rules, and it is where the depth is.
- **Course plan sync (new).** Compares desired plans with the plans linked by `courseSale`, then creates, updates or
  turns off. It is idempotent, skips price writes during a live Bulk Sale, and never deletes a plan. It follows the
  single-ebook plan's pattern, with one difference: going off sale never sets a plan's status to 0. About 680k orders
  have no course list of their own and get access only through an active plan. Off sale clears `displayOn` and refuses
  new purchases instead.
- **Upgraded orders (small).** Access checks already skip `status: 0`, so they need no new rule. Five revenue readers
  must keep counting an order with `upgradedToOrderId`: sales report, dashboard analytics, daily facts, coupon analytics,
  product analytics. The GST report ignores status and is unchanged. Admin order screens show Upgraded. `packageUtils` and
  `plansController` appear to lack the status check (text search only), so confirm and close those gaps. Access stays the
  union of the order's lists and the plan's live list, which is what lets additions reach past buyers.
- **Upgrade completion (new).** Runs at the successful-payment step for `upgrade:*` orders, behind a switch that is off
  until the app shows the warning. It sets `status: 0` and the label on every active order the student holds on the source
  plan, and is safe to run twice. Undo restores every order carrying that label.
- **Offer resolver (changed).** Extends the existing plan-offer resolution with one read per owned course, so the
  course page, My plans and checkout quote the same price.
- **Course form and Plans page (changed).** Layout A in the admin, a filter and locked fields on the Plans page.

### Rules

- **Upgrade removal never uses `orderStatus`.** The Razorpay sync cron re-marks captured orders as successful, so a
  voided paid order comes back within the hour. The cron only looks at `orderStatus`, so `status: 0` stays. Chosen over a
  label-only filter on 5 Nov: that needed a change in about 24 access files (text search), and a missed one lets a student
  keep a course they gave up. A missed report here only shows a low revenue figure.
- **Expiring the source order is rejected.** It would make the student look lapsed and earn them an extension offer
  on the course they left, and undo would need the old date kept elsewhere.
- **Removal is by plan.** A student who also holds the course through another plan keeps it. 691,098 student and plan
  pairs are held through both an imported and an admin order, so removal must cover all of a student's orders on that
  plan, not only `upgradesFromOrderId`.
- **Extension ignores upgraded orders** through the same status check. My plans drops the source card after an upgrade. Today's card stays,
  because today's upgrade leaves the source alone.
- **Who qualifies.** Any active order on a source plan counts, including ₹0 and admin-granted orders, as today.
  Exchange keeps its own stricter rule. Removal covers those orders too.
- **A combo can be an upgrade source if the admin picks it.** We trust the admin for now. The whole plan is removed, so
  the consent text must list every course the student will lose. The form says so when a combo is picked.
- **Additions reach past buyers; removals warn.** Most orders hold no list of their own, so removing an item from a
  plan can cut access for those students. The form shows the order count and lets the admin go ahead.
- **On sale is the existing Status field**, on the Settings step. Active means on sale, Inactive means off
  sale with buyers keeping access, and a new course starts as Draft. There is no separate On sale switch and no
  ready-to-sell check, so nothing stops an admin setting a course with no classes to Active.
- **Allow Payment** replaces Close Admission and keeps the price. Today Close Admission sets the price to 0, which loses it.
- **Discount codes** attach to the course's main plans, not its upgrade or add-on plans. Today one coupon attaches to one
  plan, so showing several needs a backend change.
- **Each attached discount code has a Show timer switch**, off by default. On means the course page shows a countdown to
  that coupon's existing expiry date, so there is no separate timer date. The switch belongs to this course and code,
  and the plan listing sends it beside the coupon code and end date it already sends.
- **Extension fits on one row.** Leaving a box empty uses the default from the Plans bulk dialog's settings.
- **Attached products sit on the Content step** and are free with the course.
- **Sub courses, upgrade rows and add-on rows are ordered by dragging.** The list order is saved in `selling`, and the
  Sub Courses tab and the offers on the owned course's page follow it. The main plan's course list keeps this course first, because My plans opens a card's first course.
- **"Owns this course" is checked across all the course's plans.** Today eligibility looks at the target plan alone,
  so an owner of the main plan could be offered its upgrade plan.
- **Sources and destinations are courses in the form and plans underneath.** A course with no linked plan can't be
  picked until it is linked.
- **A course not yet connected keeps working as it does today**, including its hand-made plans. Saving it in the new form
  makes no plan, so no duplicate plan can split its orders and reports.
- **Plans stay in step across courses.** An upgrade or add-on plan holds its destination's contents, so changing what a
  course includes also updates every plan that sells it.
- **One file per rule.** Each rule owns its row in the form, its parser and its part of `plansForCourse`, so rule tasks can
  run in parallel.
- **Exchange keeps its rules:** single-course plans only, straight swap, same end date.
- **Each length is its own main plan**, with the same contents and offer terms, so orders, reports and validity stay
  plain. Removing a length takes it off sale and leaves its plan active, so its buyers keep access.
- **Lengths and offers.** The Extension card applies to every length, and "50% of what the student paid" still works
  per order. A source course counts through any of its lengths. Upgrade and add-on plans carry their own validity, so
  lengths don't affect them. An exchange swaps to the destination's first option, since it keeps the end date anyway.
- **A student who owns any length can't buy another.** To get more time they use Extension. The course card and
  `Course.price` show the first option.
- **Upgrade and add-on share one form pattern.** A row names a destination, price and validity. The only difference is
  that an upgrade removes the course the student owned. The live fields stay as they are: a plan's `upgradationPlanIds`
  still name its sources, and the form writes them from the source's side. A destination course lists the courses that
  lead to it, read-only, with a link to each.
- **Cheapest offer wins** when several owned courses lead to one destination, as it does today. A target is listed once,
  at that price.
- **Consent.** The upgrade's checkout and offer text must name the course being removed. Offers carry a `kind` so
  clients can word them. This is the second exception to never removing access, after exchange: the student confirms
  and pays.

### API contract changes

- Course create and update accept `selling`. The backend deploys before the admin, because the strict update schema
  refuses unknown fields.
- The public course read (`by-id-2`) gains `subCourses` and, with the student's token, `offers[]` of
  `{ kind, planId, targetCourseId, price, duration, removes }`.
- My plans' `upgradeOffers` gains `kind` and `removes`.

### Sequence

Tasks are in `tasks/course-selling-rules/`. Each ships and is checked alone.

1. **Test two plans on one course by hand**, in the app and on the website. No code, and the result sizes pricing plans.
2. **Four-step form, then the course makes its main plan**, then the Plans page.
3. **Connect the 46 single-plan courses**, using a dry-run tool, and do the first release.
4. **Rule rows in parallel:** pricing plans, discount codes, combos, attach products, extension, exchange, add-on.
5. **Upgrade:** report fixes and access gaps, removal behind the switch, then offers and the warning.
6. **Connect the other 26 courses**: combos, strays, and combos with no course.
7. **Final release**, and turn upgrade on once the app shows the warning.

## Testing Decisions

A good test states what a user can observe and survives a refactor: which plans exist, what a student can open, what
price is quoted. It doesn't assert on internal calls.

- **Selling rules:** table-driven tests over `plansForCourse`, including one plan per upgrade or add-on row, on the destination course, and
  combos.
- **Course plan sync:** against memory Mongo. Running twice changes nothing, a price edit keeps the plan id, a live
  Bulk Sale is respected.
- **Upgraded orders:** after an upgrade, every access reader denies the source plan, and each of the five revenue readers
  still counts its payment. This is the main safety check.
- **Upgrade completion:** a paid upgrade removes the source, running it twice is harmless, a failed payment removes
  nothing, a double-held student loses it on both orders, a holder through another plan keeps it, a combo source goes
  whole, the sync cron doesn't bring it back, undo restores it, and with the switch off nothing is removed.
- **Course plan sync, off sale:** a course taken off sale leaves every buyer's access unchanged.
- **Offer resolver:** the same price at course page, My plans and checkout, for each student type in the prototype.
- **Admin:** form tests per card in the existing vitest setup, then a click-through against the local stack.

Prior art: the extension terms suites, course exchange suites and prod test script, plan upgrade integration tests,
the single-ebook plan's tests, and the Postman collections for offer flows.

## Out of Scope

- Paid exchange. Planned as a later phase. It would pay, remove the old course and set new validity, as an upgrade
  does, so it should be small once task 15 ships (inference, not yet designed).
- Moving access to each order's own list. The 22 Oct report proposed it, and the user chose on 5 Nov to keep past
  buyers getting additions, so the 719k order backfill isn't needed.
- Upgrading from one length to a longer one of the same course. Extension covers it.
- Fixed end date as validity. All 72 active courses use a plain length.
- Hand-made plans for test series and ebooks, which stay on the Plans page.
- Easy EMI, upsell and international pricing. AppX's catalogue shows 0 of 154 courses using them.
- `Plans.offer` and `/api/admin/plan-offers`. See the note below.
- Rule 1 and "Courses Internal changes" from the team's notes. The user said to ignore them.
- Any change to quicktricks. It keeps upgrades that leave the source alone. Tenant rules apply.

## Further Notes

### Open questions

**Past buyers.** This PRD assumes they get anything added to a course. That is one reading of the user's message and isn't
confirmed. New buyers only would bring back the 719k order job as the first step.

**Several discount codes.** One per course is ready to build. Several, as AppX shows, needs the backend change above.

**Books.** Attached books are free here. AppX charges the book's price along with the course, optionally. If physical
books should be charged, that is new checkout work.

**Stray courses.** 12 active plans are a real batch plus an unrelated cheap course. Their buyers keep getting that
course through the plan's live list, as they do today. When old plans are linked in task 17, the course form will show
these as attached. Default: leave them, and let an admin remove any from the form, seeing the warning.

### Duration pricing on AppX

The AppX catalogue (`vidyagram-apx-duration-pricing-probe.cjs`, 5 Nov) shows pricing plans filled on 37 of 154 courses,
36 of them with two lengths, and the switch on for 32. 11 of those 32 are active courses on our side, such as Champions
5.0 Maths at ₹449 for 2 years or ₹549 for 3 years. Our import kept one length per course, so these sell one length
today. AppX and our prices also differ on some, such as ₹449 against ₹899 on Champions 5.0. That may be a sale or a
stale snapshot; the cause isn't checked, so these prices need review during task 17.

### Client team's offer plans

The client team added `Plans.offer` and `/api/admin/plan-offers` on 28 Oct, from their profile dashboard spec. An offer
is a separate plan with its own price, days and source plans. Their own doc marks it "Not wired yet": My plans doesn't
list these plans, and checkout sells one as an ordinary plan with no check that the buyer owns a source. There is no
admin screen, and on 5 Nov vidyagramdb had 0 such plans (`vidyagram-plan-offers-probe.cjs`). Decision: build on the
live upgrade fields, which My plans and checkout already read. Tell the client team, because two ways to set up an
upgrade would confuse admins, and their spec's idea of an upgrade replacing the old plan is the one this PRD builds.

### Evidence

Read-only probes on 2026-11-05: `vidyagram-course-plan-fit-probe.cjs`, `vidyagram-plans-shape-probe.cjs` and
`vidyagram-plan-offers-probe.cjs`, `vidyagram-apx-duration-pricing-probe.cjs`. Earlier
analysis: `vidyagram/reports/plans-keep-or-remove-2026-10-22.md`. Related designs: `course-exchange.md`,
`prd-vidyagram-extension-terms.md`.

### Clients

The length picker, the coupon timer, offers on the source page, the Sub Courses tab and the upgrade's consent text need the app and website teams. I don't
know whether many courses still arrive through the AppX nightly, which skips this form. That would reduce the saving
until admins create courses here, and it isn't measured.
