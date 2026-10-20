# Vidyagram Course Builder: local end-to-end verification (2026-10-20)

Scope: the local setup only. Backend `~/Projects/worktrees/vg-builder-backend` at 97225928e, admin
`~/Projects/worktrees/vg-builder-admin` at 27d93a5 (both `feat/vg-course-builder`, nothing pushed), local
Mongo on 127.0.0.1:27037 with the invented course "SSC Aditya Batch 2026-2027 (local sample)". Rules come from
[`../plans/prd-vidyagram-course-builder.md`](../plans/prd-vidyagram-course-builder.md). No product code was
changed.

**Result.** No product defect found. Every agreed rule checked by HTTP holds (74/74), the admin screens behave as
specified, and both suites show no new failures against the baselines. Three observations and one tooling bug
are listed below. None of them breaks an agreed rule.

## How to rerun

```sh
node ~/Projects/system-brain/reference/scripts/vidyagram-course-builder-e2e.mjs \
  ~/Projects/worktrees/vg-builder-backend/.env.localpreview <admin.token>
```

The same file sits next to `e2e-access.mjs` in the vg-mongo scratchpad, as `e2e-builder.mjs`. It writes invented
users, orders, classes, PDFs, Series and CourseTests into the LOCAL Mongo, each tagged `e2eRun`, and removes them
at the end. `--keep` leaves them for a look in the admin, and `--clean` removes every kept run. The older
`e2e-access.mjs` still passes 10/10. It does not clean up after itself (3 users and 2 orders per run).

## 1. Pricing (admin quote and build checkout)

Razorpay has no keys locally, so checkout answers 500 after pricing. The charged amount is read from the
`razorpay_payment_logs` row that checkout writes just before it calls Razorpay. Every checkout also sent
`grandTotal: 1` and `amount: 1`, which were ignored.

| Case | Quote | Checkout charge | Result |
|---|---|---|---|
| Whole course, Notes + Tests on | 799 | 799 | PASS |
| Whole course, Notes off | 699 | 699 | PASS |
| Whole course, Tests off | 649 | 649 | PASS |
| Whole course, both off | 549 | 549 | PASS |
| Arithmetic only (51%) | 407 | 407 | PASS |
| Arithmetic, both off (157 before the floor) | 199, atMinimum | 199 | PASS |
| Partnership alone (2%) | 199, atMinimum | 199 | PASS |
| Revision only, Notes + Tests on | 449 | 449 | PASS |
| Revision only, Notes off | 349 | 349 | PASS |
| Revision only, both off | 199, atMinimum | 199 | PASS |
| Cap on chapters only: two custom ₹500 chapters, Notes off | subtotal 1000, capped 799, final 699 | n/a (unsaved settings) | PASS |
| Coupon code sent | | 400 "Coupons cannot be applied to a Course Builder build yet." | PASS |
| No token | | 401 | PASS |
| Topic outside the builder / empty normal build | | 400 / 400 | PASS |
| Course status 0 (set and restored by the script) | | 400 "This course is not on sale." | PASS |
| Whole-course owner | | checkout 409, build-grant 409 | PASS |

## 2. Access by HTTP for grants from `POST /api/orders/build-grant`

Allowed playback answers 404 because the sample classes have no video. Refused playback answers 403.

| Check | Answer | Result |
|---|---|---|
| Bought chapter classes play (Percentage · Class 2, Algebra · Class 5) | 404, 404 | PASS |
| Unbought chapter classes refused (Geometry · Class 2, Number System · Class 3) | 403, 403 | PASS |
| Class added to a bought chapter after the grant plays; same class refused to a non-buyer | 404 / 403 | PASS |
| Free placement open to a non-buyer and to a partial buyer | 404, 404 | PASS |
| Revision only: tagged class plays; untagged and late untagged classes refused | 404 / 403, 403 | PASS |
| No purchase refused | 403 | PASS |
| Order set to `status: 0` after the grant: playback and chapter PDF | 404 before, 403 after; PDF 403 | PASS |
| Class notes: with Notes 200, without Notes 403, unbought chapter 403 | 200 / 403 / 403 | PASS |
| Chapter (course) PDF: with Notes 200, without Notes 403, unbought chapter 403 | 200 / 403 / 403 | PASS |
| Revision only with Notes: chapter PDF 200, notes of an untagged class 403 | 200 / 403 | PASS |
| Tagged test: Tests + its chapter open; no Tests restricted; Tests + other chapter restricted | false / true / true | PASS |
| Untagged test (interim section rule): Tests + a chapter of its section open; other section restricted | false / true | PASS |
| Revision only with Tests and whole-course owner open a tagged test | false, false | PASS |
| Token-only route `allow-user-test-course/:seriesId/:courseId` | restrict false | PASS |
| URL userId differs from the token user | 403 "userId does not match the signed-in user" | PASS |

The sample has no tests or PDFs, so the script seeds two Series, two CourseTests, four Pdfs (legacy URL, no
asset), two CoursePdfs and two classes, then removes them.

## 3. Listings

| Check | Result |
|---|---|
| My Courses (`POST /api/courses/my-courses`), build buyer: is_buy 1, isPartial true, ownedTopicIds = 2 chapters, ownedExtras [notes], revisionOnly false, revisionTopicIds [] | PASS |
| Course detail (`POST /api/courses/by-id-2`), build buyer: same fields | PASS |
| My Courses, Revision-only buyer: revisionOnly true, all 25 chapters in ownedTopicIds and revisionTopicIds, extras [notes, tests] | PASS |
| Full owner: is_buy 1 and none of the partial fields, in My Courses and course detail | PASS |
| Non-owner: course absent from My Courses; detail is_buy 0, no partial fields | PASS |
| Deleted build order: course absent from My Courses | PASS |
| `GET /api/courses/:id/builder`: buyer ownership partial; full owner ownsAll with 25 chapters; non-owner owns nothing; signed out has no ownership block | PASS |

## 4. Admin UI (in-app browser, http://localhost:3002)

| Check | What was seen | Result |
|---|---|---|
| Builder mode strip and columns | Settings strip (Sell as Course Builder, min 199, max 799, struck-out 1999, Notes 100, Tests 150, Revision only 350, "Weights 100%", Save). Columns Weight %, Custom ₹, Chapter price, Revision. | PASS |
| Weight total gates Save | Partnership 2 → 3: badge "Weights 101% (1% over)", Save disabled. Back to 2: "Weights 100%", Save enabled. Not saved. | PASS |
| Revision switch persists | Number System · Class 7 switched on, placement `isRevision` true in Mongo, still on after reload; switched back off and confirmed false. | PASS |
| Preview price drawer | 799 (struck 1,999), Notes off 699, both off 549, Revision only 449 / 349 / 199, Arithmetic only 407 (struck 1,018), Arithmetic both off 199 with "At the minimum price" note. Same as item 1. | PASS |
| Assign Tests chapter column | Tagged test shows "Arithmetic Maths › Percentage", untagged shows "No chapter"; the picker lists chapters as Section › Topic. | PASS |
| Order page of a granted build | Course, chapters with prices (Percentage ₹39.95, Algebra ₹63.92), Revision only No, Notes Included, Tests Not included, chapters 13% ₹103.87, Tests switched off −₹150, build price raised to the minimum ₹199, paid ₹0 given for free, settings version 1 note. | PASS |

## 5. Suites

`scripts/qt-tasks.sh suites` was run for both worktrees. The comparison step failed (see the tooling bug below),
so the failure lists were compared with `comm` against the baselines by hand.

| Side | Failing | New vs baseline | Fixed vs baseline |
|---|---|---|---|
| Backend | tsc 0, unit 18, integration 69 | none | none |
| Admin | tsc 44, lib 0, vitest 52 | `.next/types/validator.ts TS2306` only (known, dev-server generated) | none |

The title-collision and liveScheduleOrderingAndEnded noise did not show up as new this run.

## Observations (no agreed rule broken)

1. **The test gate still answers for a URL userId when no token is sent.** `GET
   /api/user-test/allow-user-test-course/<userE>/<series>/<course>` with no Authorization header returned 200
   `restrict: false` for user E's build. The route is `optionalAuthenticateToken`
   (`src/routes/userTestDataRoutes.ts:83`) and falls back to the URL id
   (`src/controllers/userTestDataController.ts:1063`). This is the open item already listed before task 12.
2. **A build checkout writes no order when Razorpay fails.** The Order is created after `createRazorpayOrder`
   (`src/controllers/buildCheckoutController.ts:66` then `:82`). Locally that means checkout can be observed only
   up to the Razorpay request log. This is expected, but the initiated-order write and the webhook success path
   were seen only in the integration suite, never by HTTP.
3. **Listings and the scope resolver read a missing `expireDate` differently for whole-course orders.** The
   listings treat a non-build order without `expireDate` (and no `daysLeft`) as lapsed
   (`src/services/planExtension.service.ts:20`). The scope resolver treats a null `expireDate` as never expiring
   (`src/services/courseScope.ts:81`). A hand-made full order with `expireDate: null` therefore plays and is
   refused a build (409), yet My Courses shows `is_buy: 0`. This predates the builder, and real orders all carry
   an `expireDate` (sibling note, 2026-10-18). Builds are special-cased and read correctly.

Cosmetic: on a build's order page the old "Package Information" block shows Plan Name and Course as "—", while
the new Course Builder card names the course.

## Tooling bug

`scripts/qt-tasks.sh suites <worktree> <relative baseline>` cannot compare. `cmd_suites` keeps the baseline path
as given (`scripts/qt-tasks.sh:86`) and then runs `cd $wt`, so `sort` cannot find the file. It prints
"sort: No such file or directory" and lists every failure as NEW. The README's command uses a relative path.
Passing an absolute baseline path works around it. The fix is `baseline=${2:+${2:A}}`.

## Not verified locally

- Real Razorpay order creation, the payment webhook marking a build order successful, and the invoice / My
  Purchases text for a paid build.
- Playback of a real video (allowed answers are 404 "no video"), the realtime token and recording downloads for a
  build. They read the same scope loader as playback, which is inferred, not observed.
- Course PDFs whose names do not match a chapter on real Vidyagram data (needs a live read).
- The app's student screens.
- Behaviour with `ENFORCE_ORDER_EXPIRY=true`.
