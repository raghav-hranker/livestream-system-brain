# Automatic extension: renewal and paid-access impact

Snapshot: 2026-09-24 17:14 UTC. Guarded, read-only secondary reads of the
production Mongo replica set. Production code was pinned to
`quicktricks-backend` `origin/quicktricks-admin` at `10b18139a`; the proposed
extension code was `feat/automatic-plan-extension` at `92240a00b` with the
extension switch treated as on. The two ID-only extracts are
[renewal-impact-2026-09-24.csv](scripts/automatic-plan-extension-local/renewal-impact-2026-09-24.csv)
and [paid-access-impact-2026-09-24.csv](scripts/automatic-plan-extension-local/paid-access-impact-2026-09-24.csv).
The extracts are local and ignored by Git.

## 1. Lapsed course holders who can renew

The starting pair has a successful, non-voided order for a plan, at least one
expired order, and no order the branch considers active for the same plan.
Pairs whose plan courses are already covered by a current app-valid order,
including their own order, are removed. `daysLeft` follows the branch's
eligibility predicate; the app's course badge uses `expireDate`. This matters
for three orders with no expiry date: the branch calls them lapsed while the
app still grants access.

| Outcome | Distinct users | User-plan pairs | Today's normal listing | Proposed listing |
|---|---:|---:|---|---|
| Active plan | 115,841 | 156,999 | Buy at list price | Extension offer; cheaper |
| Inactive plan | 88,853 | 153,174 | Absent | Extension offer to prior holder |
| Already covered by another order | 21 | 21 | Course still accessible | No renewal need counted |
| Still accessible on the same plan | 3 | 3 | Course still accessible | No renewal need counted |
| Plan has no course | 53,295 | 61,530 | Outside course question | Outside course question |

The active and inactive groups overlap by 32,934 users. Their union is
171,760 users; 76,872 users are lapsed on more than one uncovered plan.
No identifiable lapsed user-course pair without a plan ID, or pair pointing
to a deleted plan, appeared in this snapshot. The last-order Apple gateway
proxy marked zero pairs, but the listing does not know the buyer's platform;
that is not an iOS count.

**Critical price result:** Every newly listed inactive-plan pair — 88,853
users / 153,174 pairs across four plans — has list amount `0`, so the proposed
offer is also ₹0. **Zero users** gain a positive-price purchase option in this
snapshot. One further ₹1,000-plan holder would see a ₹500 offer under the
branch rule, but their zero-total coupon order has no `expireDate` and already
grants the course in today's app; they were excluded from the renewal-needed
count. Representative cases were passed through the branch's real
`resolveVisiblePlansForUser` and `admitPlanPurchase` functions.
The three zero-total checkout paths create a successful order without
`expireDate`, making it app-valid indefinitely. Thus the 88,853 users are
newly offered free access by the current branch, not newly able to make a paid
renewal. The normal app path does not list inactive plans today; raw checkout
API behavior is a separate question.

## 2. Users with an unexpired paid order and entitlement mismatches

The paid population requires a successful, non-voided order active under the
branch predicate, positive `grandTotal`, and the production revenue rule
(admin assignments and Apple sandbox/pending rows are excluded). Intended
course coverage is the order's `courseId` plus `latestCourseId` plus its
plan's current `course`, even when the plan is inactive.

| Outcome | Distinct users | User-course pairs |
|---|---:|---:|
| Revenue-eligible paid, intended course | 103,185 | 145,704 |
| App `is_buy: 0` despite current paid order | **5** | **5** |
| Of those, non-free course with `authorizeCourseAccess` denial | **2** | **2** |
| Of those, free course with content gate allowed | **3** | **3** |

The five affected paid source orders are Razorpay purchases on inactive
plans. Their order snapshots omit a course that the plan now contains. For
the **two confirmed paid-content denials**, no other order supplies the
missing non-free course. The other three courses have `isFree: true` and the
content gate allows them; the website explicitly uses `enrolled || isFree` to
open free course content, so `is_buy: 0` is a badge mismatch, not a confirmed
block on that surface. Mobile behavior remains unverified. The exact
production `addIsPaidToCourses` and `authorizeCourseAccess` functions were
run for all ten flagged positive-amount pairs and agreed with the census.
The other five pairs (three users) have positive amounts on admin assignments,
so they are not evidence of payment.

Separately, ₹0 orders have three denied user-course pairs (one user), with
two course-gate denials. No active paid QR order was found, so the branch's QR
snapshot change helps future purchases but repairs no current paid QR case.
No paid pair pointed at a deleted course. There are 3,266 active paid orders
with no intended *course*: 2,968 package-plan orders, 294 other no-course
plan orders, and four practice-batch-plan orders. They are outside this course
access denominator.

Nine paid user-course pairs (six users, including the plan's test account)
have classes whose placements in that course are all inactive; exact
`authorizeClassAccess` calls deny some classes in every pair. These courses
have `status: 0`; the intended availability of retired classes needs a
product decision. Another 246 paid pairs (210 users) have no `CourseClass`
placement; that alone does not establish a broken entitlement, since some
courses carry other content.

The production box's `.env.development` leaves `ENFORCE_ORDER_EXPIRY` unset,
and no successful production order has `accessUntil`. Therefore the content
gate does not use `expireDate` to stop playback/PDF access, even though the
app's `is_buy` does. The branch's new-order snapshots do not repair the five
existing paid pairs. The deploy gate in
[task 04](../docs/plans/tasks/automatic-plan-extension/04-deploy-accept-switch-on.md)
records the zero-price and paid-entitlement blockers.

Re-run with
[`count-renewal-and-access.cjs`](scripts/automatic-plan-extension-local/count-renewal-and-access.cjs)
from the production backend checkout using the sibling
`readonly-guard.cjs` preload. The script streams the successful orders by
user and writes only IDs, counts, and gate flags. Production data can change
after this snapshot.
