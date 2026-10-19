# PRD: Vidyagram Course Builder (buy chosen chapters of a course)

State: needs-triage (open questions at the end block the pricing slice only)
Date: 2026-10-18
Owning repos: Vidyagram backend (fork of quicktricks-backend, branch `vidyagram-admin`, worktree
`~/Projects/worktrees/appx-tenant-backend`) and Vidyagram admin (worktree
`~/Projects/worktrees/vidyagram-admin-ui`). The Vidyagram app team builds the student screen
against the contracts below.
Mockup: admin pricing artifact https://claude.ai/artifact/QzLTCVVUE9arNE6r34yWwA (shows an older,
weight-scaled extras model; the pricing rule in this PRD supersedes it).

## Problem Statement

A Vidyagram student who needs only part of a course has to buy all of it. A student weak in
Arithmetic but fine in Advanced Maths pays ₹799 for the whole SSC Aditya Batch, including 107
Advanced classes they will not watch. A student who only wants video classes still pays for notes and
tests. The price is all or nothing, so some students do not buy at all.

The platform cannot sell less than a course today. A purchase grants a whole course (directly or
through a plan), and every access check (playback, downloads, PDFs, tests, live-class token) asks
only "does this user own this course". There is no way to record or enforce "these chapters, with
notes but without tests".

## Solution

On a course the admin has opened for building, the student sees the **Course Builder** screen:
the course's sections, each expandable into its chapters, with each section's share of the syllabus
("Arithmetic Maths · 51% of syllabus · 15 of 15 chapters"). The student ticks whole sections or
single chapters, switches **Notes** and **Tests** on or off, and can choose **Revision only**. Classes
are always included. Revision is not extra content. Some ordinary classes are marked as revision
classes. **Revision only** is a separate whole-course choice: it gives the student every revision
class in the course and nothing else, for a fixed lower price. While it is on, chapters are all
included and cannot be picked or unpicked. With it off (the default), the student picks chapters
and gets every class of them, revision classes included. The price updates as they tap, and the footer summarises the build
("24 chapters · 196 classes · 147 hours · 100% of syllabus · notes · tests", ₹799, lifetime
validity). **Continue** goes to payment.

After paying, the student finds the course in My Courses. Chapters they bought play normally.
Chapters they did not buy are visible but locked. Notes and tests are open only if that extra was in
the build. A Revision-only build opens only the revision classes of the course.

The admin sets, per course: whether the builder is on, a **minimum** and **maximum** price, each
chapter's **weight** (its % of the syllabus) and optional **custom price**, the value of Notes and
Tests, and the **Revision-only discount**. The admin marks which classes are **revision** classes.

### Pricing rule (backend-owned)

```
chapter price  = customPrice if set, else maxPrice × weight / 100
chapters       = min( Σ chapter price over picked chapters, maxPrice )
                 or, with Revision only ON: maxPrice − revision-only discount (whole course, picks locked)
price          = chapters − Σ value of each extra the student switched OFF
final          = max( price, minPrice ), rounded to the rupee (halves up)
```

- The maximum caps the chapters subtotal only, before extras come off, so switching an extra off
  always saves its full value unless the minimum is reached.
- The minimum applies to the final price, so the price never goes below it or negative.
- Example (max ₹799, min ₹199, Notes ₹100, Tests ₹150, Revision-only discount ₹350): whole course
  with Notes and Tests = ₹799; whole course, Notes off = ₹699; whole course, Revision only = ₹449;
  Arithmetic (51%) with Notes and Tests = ₹407; Arithmetic, Notes + Tests off = ₹157 raised to ₹199.

The app runs the same rule locally for instant display, from configuration the backend serves. At
checkout the backend recomputes the price from the picks and charges its own number. Any amount the
app sends is ignored.

## User Stories

Student, browsing and building

1. As a student, I want to see which courses offer a Course Builder, so that I know I can buy part of them.
2. As a student, I want to see each section with its share of the syllabus, chapter count and class count, so that I can judge what a section is worth.
3. As a student, I want to expand a section into its chapters, so that I can buy single chapters.
4. As a student, I want to tick or untick a whole section in one tap, so that I do not have to tick every chapter.
5. As a student, I want "Select all" and "Clear", so that I can start from the whole course or from nothing.
6. As a student, I want to switch Notes and Tests on or off, and choose Revision only, so that I pay only for the material I want.
7. As a student, I want the price to update the moment I change a pick, so that I can try combinations.
8. As a student, I want to see the original (struck-out) price next to my price, so that I can see the saving.
9. As a student, I want the footer to summarise chapters, classes, hours and % of syllabus, so that I know exactly what I am buying.
10. As a student, I want to be told when my build is already at the minimum price, so that I understand why switching an extra off does not lower it.
11. As a student, I want Continue disabled until I pick at least one chapter, so that I cannot pay for nothing.
12. As a student, I want to pay the same price I saw on the screen, so that checkout holds no surprise.
13. As a student, I want to apply a coupon to my build, so that offers work here too (subject to the open coupon question).

Student, after purchase

14. As a student, I want my build to appear in My Courses, so that I can find it like any course.
15. As a student, I want the chapters I bought to play normally, live and recorded, so that I get what I paid for.
16. As a student, I want classes added later to a chapter I bought to be included, so that my purchase stays complete as the course grows.
17. As a student, I want chapters I did not buy shown as locked, not hidden, so that I can buy them later.
18. As a student with Notes in my build, I want the notes of my chapters' classes and the chapter PDFs, so that I can study offline material.
19. As a student without Notes, I want notes shown as locked, so that I know they exist.
20. As a student with Tests in my build, I want the tests of my chapters, so that I can practise.
21. As a student short on time, I want a Revision-only purchase that gives me every revision class of the course at a fixed lower price, so that I can revise quickly without choosing chapters. Without Revision only, I get every class of the chapters I pick, revision classes included.
22. As a student, I want lifetime validity on my build, so that it never expires.
23. As a student, I want my invoice and My Purchases to list the chapters and extras I bought, so that I have a record.
24. As a student who already owns the full course, I want the builder to say I already own everything, so that I do not pay twice.

Admin

25. As an admin, I want to switch the Course Builder on or off per course, so that only courses ready for it show it.
26. As an admin, I want to set a minimum and a maximum price per course, so that builds stay within a range I choose.
27. As an admin, I want to enter each chapter's weight on the course outline I already use, so that I set weightage where I see the chapters.
28. As an admin, I want a running total that must reach 100% before I can save, so that weights never silently add to 97%.
29. ~~As an admin, I want a "normalise to 100%" helper.~~ Dropped 2026-10-19 (user): it rescaled every chapter when one weight was mistyped. Weights are only what the admin types.
30. As an admin, I want to set a custom price on a chapter that overrides its weight, so that I can price a key chapter on its own terms.
31. As an admin, I want to see each chapter's computed price next to its weight, so that I know what a student will be charged.
32. As an admin, I want to set the value of Notes and Tests, the Revision-only discount, and whether each is offered, so that I control the options.
33. As an admin, I want to mark classes as revision classes, so that the Revision extra has content behind it.
34. As an admin, I want to tag a course test with its chapter, so that Tests in a build follow the student's chapters.
35. As an admin, I want a price preview where I tick chapters and extras, so that I can check the price before saving.
36. As an admin, I want to see a student's build (chapters, extras, price paid) on their order, so that I can answer support questions.
37. As an admin, I want to grant a build manually, so that support can fix a failed payment.
38. As an admin, I want a saved configuration to apply only to new purchases, so that changing weights never changes what existing buyers own or paid.

System

39. As the platform, I want the backend to compute the price at checkout, so that a tampered request cannot buy a build for ₹1.
40. As the platform, I want the backend to reject picks that are not chapters of this course or extras that are not offered, so that orders are always valid.
41. As the platform, I want every access check to ask one function what a user owns of a course, so that partial access is enforced the same way everywhere.
42. As the platform, I want a build order to snapshot its chapters, extras and price breakdown, so that later config edits do not rewrite history.

## Implementation Decisions

### Modules

1. **Build pricing policy (new, deep, pure).** One function: `priceBuild(config, picks, extrasOn) →
   { chaptersSubtotal, capped, extrasOff, final, atMinimum, share, lines }`. No I/O. The only place
   the pricing rule lives on the server. Its rule is also published to the app team as the client
   formula. Rounding: nearest rupee, halves up (same convention as the plan-extension policy).
2. **Builder configuration (new).** Stored on the course as an embedded `builder` object:
   `{ enabled, minPrice, maxPrice, mrp?, chapters: [{ topicId, weight, customPrice? }],
   extras: { notes, tests: { offered, value, defaultOn } }, revisionOnly: { offered, discount } }`. Validation on save:
   weights sum to 100 (0.5 granularity), `0 < minPrice ≤ maxPrice`, values ≥ 0, every `topicId` is a
   topic in the course's outline (`CourseTopic`), no duplicates. A chapter in the outline with no
   weight entry is not sellable in the builder.
3. **Build checkout (new).** An authenticated route (user from the token, never the body) that takes
   `{ courseId, topicIds, extrasOn, revisionOnly, couponCode? }`, validates them against the
   configuration, prices with module 1, creates the Razorpay order for the server amount, and writes a
   pending order with a `build` snapshot `{ courseId, topicIds, extrasOn, revisionOnly, breakdown,
   configVersion }`. The existing
   payment-success path marks it successful; `expireDate` stays null (lifetime). It does not reuse
   the client-amount checkout routes.
4. **Course scope resolver (new, deep).** `resolveCourseScope(userId, courseId) →
   { kind: 'none' } | { kind: 'full' } | { kind: 'partial', chapters: Map<topicId, 'all' | 'revision'>,
   extras }`. Reads orders and plans the way today's owned-course check does, with expiry read from
   `expireDate`. Full beats partial; several builds on one course union their chapters and extras,
   and `all` beats `revision` for the same chapter. **Subtract first**: the five
   current owned-course readers (class access authz, PDF access, test access gate, course access
   state flags, and the duplicate owned-course reader in the course-class controller) move onto this
   resolver with behaviour unchanged, before partial scope exists.
5. **Content placement (new, small).** Given an item a student opens, answer `{ topicId, kind }`:
   a class placement uses its per-course topic override, else the class topic, with kind `class` and
   a `revision` flag from the placement or class tag. A class's attached notes take its topic and its
   revision flag, kind `notes`. A course PDF resolves its section and topic names to a topic id in
   this course, kind `notes`. A course test uses its new chapter tag, kind `tests`. Access: full scope
   opens everything. Otherwise the item's chapter must be in the scope; a class (or its notes) also
   needs the chapter to be `all`, or the class to be a revision class; notes and tests also need that
   extra. Free placements and free classes stay free, as today.
6. **Student read contract (extended).** A builder endpoint returning the course outline with
   per-chapter weight, price, counts (classes, notes, tests, revision, hours) and the extras config,
   which is everything the app needs to run the formula. My Courses and the course detail add
   `isPartial` and `ownedTopicIds` / `ownedExtras` so the app can lock what is not owned. Existing
   `is_buy` becomes 1 for a partial owner.
7. **Revision tag (new field).** A boolean on the course-class placement, defaulting from a class-level
   flag. Revision classes are ordinary classes that every normal build includes. The tag only matters
   for Revision-only builds, which open tagged classes and nothing else.
8. **Course test chapter tag (new field).** An optional topic on the course-test placement. Until a
   test is tagged it is covered when the build contains any chapter of the test's section (interim
   rule, open question 5).
9. **Admin UI: Builder mode on Assign Classes.** No separate builder page. The existing Assign
   Classes screen (Section › Topic › class outline) gets a **Builder mode** switch. With it on, topic
   rows gain weight %, custom ₹ and computed chapter price; section rows show their total; class rows
   gain a revision toggle; a header strip holds the course-level settings (sell-as-builder switch, min,
   max, struck-out price, extras) with the running weight total and Save; a side drawer previews a
   student build with the same rule. Builder mode is a view switch only. Selling is controlled by the
   separate sell-as-builder setting. Course tests get their chapter picker on the Assign Tests screen.
   The order view shows the build, with a manual-grant action.

### Prerequisites found during research

- Checkout routes take `userId` from the body without auth, and trust the client `grandTotal`,
  `courseId[]` and `duration` whenever no plan is set. The build checkout must not inherit this
  (module 3 is a separate authenticated route).
- The test-access route takes `userId` from URL params. Build scope on tests is meaningless until it
  takes the user from the token.
- The access check read a non-existent `accessUntil` field on orders. Fixed locally as 9db09adbb on
  `vidyagram-admin` (reads `expireDate`). Not pushed. `ENFORCE_ORDER_EXPIRY` is off on prod.

### Contracts

- Price is computed by module 1 only. The app's local copy is display-only. A mismatch is resolved
  in favour of the server, and the checkout response returns the charged breakdown.
- A build's scope is stored as topic ids, never class ids, so later classes in a chapter are
  included.
- An order an admin deletes (`status: 0`) grants nothing anywhere: playback, downloads, realtime
  token and PDFs included (decided 2026-10-19; before this, those four still counted deleted orders).
- Config edits are not retroactive. Orders keep their snapshot, and access uses the snapshot's
  topic ids and extras.

## Testing Decisions

A good test drives a module through its public interface and asserts the result a user would
notice: the price charged, or whether a class / PDF / test opens. Never assert internal call order
or private helpers.

- **Build pricing policy.** Table tests, including the PRD examples, the cap-before-extras case (custom
  prices summing above max), the minimum floor with all extras off, rounding at .5, empty picks,
  unoffered extras ignored. Prior art: the plan-extension offer policy unit tests.
- **Course scope resolver.** Integration tests against a test Mongo: no order, full course order, plan
  carrying the course (both string and ObjectId ids in `Plans.course`), one build, two builds
  unioned, build plus full, expired order. Prior art: the plan-entitlement id-cast regression test.
  Run the existing access suites before and after moving the readers; results must be identical.
- **Access by content.** For a partial owner: bought chapter class plays, unbought chapter class is
  denied, class notes and course PDF denied without Notes, tagged test denied without Tests, free
  placement still open. In a normal build both revision and non-revision classes of a bought chapter
  play. In a Revision-only build the revision class plays and the non-revision class is denied.
- **Build checkout.** Integration with Razorpay stubbed: server amount charged regardless of a sent
  amount, foreign topic rejected, unoffered extra rejected, unauthenticated request rejected, success
  webhook grants the snapshot. Prior art: the plan-offer integration suites and the Postman beds under
  `reference/postman/`.
- **Config validation.** Weights not summing to 100, min above max, unknown topic, and duplicate topic
  are each rejected with a clear message.

## Out of Scope

- iOS in-app purchase of builds (Apple needs fixed-price products). v1 sells builds through Razorpay
  only; the iOS app hides the builder or routes to web, which is the app team's call.
- Upgrading a build later by paying the difference. v1 allows a second build on the same course at its
  own full computed price, unioned into scope.
- Course Builder across several courses in one purchase.
- Plan-style offers on builds (lapsed-holder extension, upgrade offers).
- Per-chapter weights for each extra (an extra is one flat value per course).
- Porting the feature to the quicktricks production line.

## Further Notes

Open questions for the team (only 1–3 block the pricing slice):

1. ~~Is `maxPrice` the whole course with Notes and Tests on?~~ Decided 2026-10-18 (user): yes.
   `maxPrice` is the headline price with everything on; Notes and Tests set how much a student saves
   by switching them off (₹799 / ₹699 / ₹649 / ₹549). Custom chapter prices are entered the same way
   (with Notes and Tests on). Save is refused unless Notes + Tests ≤ maxPrice − minPrice, and the
   admin sees the derived "whole course, Notes and Tests off" price.
2. ~~Is the custom price set per chapter or per section?~~ Decided 2026-10-18: per chapter.
3. ~~Does the minimum apply to the final price?~~ Decided 2026-10-18: yes. No build is ever charged
   below `minPrice`, whatever is switched off.
4. Do coupons apply to builds, and before or after the minimum?
5. Who tags tests with chapters, and is the interim "any chapter of the section" rule acceptable?
6. Is there a struck-out price for partial builds, and how is it derived (assumed: final × mrp / maxPrice)?
7. When a build hits the minimum, should the app grey out the extras or show "already at the minimum price"?
8. ~~Classes in a section with no topic?~~ Decided 2026-10-18: sold as their own chapter by filing
   them under a topic (for example "Introduction") before the builder can be switched on. No new
   "chapter without topic" concept. Builder mode lists classes outside any chapter, and the backend
   refuses to enable selling while any active placement in the course has no topic. A chapter can
   have weight 0 if it should be free to tick.
9. ~~How is Revision only priced?~~ Decided 2026-10-18: a fixed amount off, set by the admin, and
   Revision only covers the **whole course only**. With it on, every chapter is included and locked,
   the student gets only revision classes, and the price is `maxPrice − discount`, then extras off,
   then the minimum. The backend ignores or rejects chapter picks on a Revision-only checkout. Save is
   refused unless Notes + Tests + revision discount ≤ maxPrice − minPrice. A student who later wants
   full classes of some chapters buys a normal build; full classes win for those chapters. The app
   labels the toggle "Revision only".
   Notes and Tests can still be switched off in Revision-only mode (user, 2026-10-18).
10. In a Revision-only build, do Notes cover only the revision classes' notes plus the chapter PDFs,
    and do Tests stay whole-chapter (both assumed)?

Delivery order (each step ends in a check): resolver with behaviour unchanged → builder config +
admin weights + student read contract → pricing policy + build checkout → content-level enforcement
→ revision and test tags → admin order view and manual grant.
