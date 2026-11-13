# Build buyers in the course-buyer readers

**Type**: HITL (two product calls), then AFK
**Blocked by**: #04, #11

## Why

A build order keeps its course only in `Order.build.courseId`: never in `Order.courseId`, never as a
`planId`. That way no legacy reader can mistake a chapter purchase for the whole course. The cost is that
every reader that lists or counts a course's buyers through `courseId` / `latestCourseId` / `planId` misses
build buyers. This task goes through those readers and decides each one.

Rule for every fix: the reader learns about builds through `src/services/courseScope.ts` (`scopeBuild`,
`loadScopeOrders`, `chapterOpensClass`, and a match helper for `build.courseId` added there). The course
never goes into `Order.courseId`.

What a build order looks like today: `orderStatus: 'success'`, `planId` unset, `courseId` empty,
`planFor: "<course title> (Course Builder)"` (`buildPlanFor`), `build: { courseId, topicIds, extrasOn,
revisionOnly, breakdown, settingsVersion }`.

## Decisions

| Reader | Today, for a build buyer | Decision |
|---|---|---|
| `coursePurchasers.service.ts`: admin "Users" button per course | Missing from the list and the counts | **Include.** The match adds `build.courseId`. A new source `{ kind: 'build', chapters, revisionOnly, extras }` shows in admin as "Course Builder: N chapters" (plus "Revision only", "+ Notes", "+ Tests"). `access` follows the build's `expireDate`. `totalSpent` is the build's `grandTotal`. |
| `notificationTokenDelivery.service.ts` + `advanceNotificationTokenDelivery.service.ts` `getPaidUserIds` (course-buyer pushes, `audienceType` paid/unpaid). The senders are "Class Starting Soon" (`classNotificationScheduler`), "Class Has Started/Ended" (`classLifecycleNotification`) and admin course pushes. | Not paid. They get no class reminders, and they do get "unpaid" promos for that course | **PRODUCT CALL, see below** |
| `notificationAudience/segmentFilters.ts` `orderItemFactsStages` (Advanced segment audiences, product type `course`). Not in the original list. | The build's course is not one of their items | Follows the push-audience call. Recommended: count the build's course as a `course` item, so "paid on course X" includes them. |
| `dashboardAnalyticsController.ts` `itemRows` (purchased-items donut) and the `unlinked` drill-down | Counted as a zero-item ("unlinked") paid order. Revenue is already in the totals. The plan breakdown already shows a "<course> (Course Builder)" row through `planFor` | **PRODUCT CALL, see below** |
| `dashboardAnalyticsController.ts` records drill-down (`recordCourseIds` / `itemName`) | Item name falls back to `planFor`, "<course> (Course Builder)" | Leave as it is: the name is already right. |
| `courseController.ts` `getOrdersLookup` → `studentCount` on `getCourseById`. Not in the original list. | Not counted. (The count already includes orders of any status, which is a separate problem.) | **PRODUCT CALL, see below** |
| `userController.ts` `getEnrolledCourseIdsFromOrders` (admin progress report for a user) | The build's course is missing from enrolled courses | **Include** the build's course. For a build, its `totalVideos` counts only the classes its chapters open (`chapterOpensClass` over the `CourseClass` topic + `isRevision`), so completion % is measured against what they bought. |
| `userStatsController.ts` `getClassesCompletedData` (student "classes completed") | Build classes are left out of total and viewed | **Include** the classes the build's chapters open. Full-course orders are unchanged. |
| `gstReport.service.ts` | Name is "<course> (Course Builder)" through `planFor`, but product type is blank | **Fix:** product type is `Course` for a build order. |
| `order.service.ts` | Writes plan entitlements into `courseId`. It is a writer, not a buyer reader | No change. |
| `plansController.ts` | Reads `Plans.course` (which plans carry a course) and `is_buy` by `planId`. Never lists course buyers | No change. A build is not a plan. |

## Product calls (asked 2026-10-20)

1. **Push audience.** Who among build buyers gets a course's "paid" pushes?
2. **Dashboard counting.** How does a build count in the purchased-items donut?
3. **`studentCount` on the course page.** Should build buyers count?

Answers (user, 2026-10-20):

1. **Chapter-scoped.** A paid push that names a class (`classId`: class reminders, started/ended) reaches
   a build buyer only when their chapters open that class (`chapterOpensClass` with the placement's
   `isRevision`). A paid push with no class reaches every active build buyer of the course. An "unpaid"
   push for the course skips every build buyer of it. Segment audiences count the build's course as a
   `course` item.
2. **As a course order.** In `itemRows` a build counts as one course: `courses` +1, `courseOrders` +1, and
   it is no longer unlinked (`linkedItemCount` +1, so it leaves the `unlinked` drill-down). Revenue is
   unchanged.
3. **Count them.** Each build order adds one to `studentCount`, the same way full orders do.

4. **"Course Builder sales" view** (raised by the parent session: "how will I know which course is sold
   how much"). **Not now.** Builds already show as "<course> (Course Builder)" rows in top plans. That row
   is keyed on the `planFor` title, so a course rename splits it. With this task, builds also count as
   course orders in the donut. Nothing yet reports chapters or options.
   If the view is built later, show whole-course and build sales **side by side per course**:
   whole-course orders and revenue, build orders and revenue, and a total. A plan order that carries
   several courses counts toward orders but not revenue, since its revenue can't be split by course.

## How it was built

- `courseScope.ts` got four helpers: `buildOrderMatch(courseIds)` (query on `build.courseId`),
  `buildCourseCountExpr` (aggregation: a build is one course item), `buildOpensClass(build, placement)`, and
  `classIdsOpenedByScope(courseId, partialScope)` (the active placements a partial owner can open).
- `notificationAudience/buildBuyers.ts`: build buyers for both push services' `getPaidUserIds`. It reuses
  `mongoAuthorizationDeps.findCoursesForClass` for the class's chapter in each course.
- `Order` has a new partial index, `build_course` (`{ 'build.courseId': 1 }`, partial on `$exists`). It is
  built at boot by `Order.createIndexes()`. On Vidyagram prod it starts empty, so the build is instant.
  Task 12 should confirm it exists after deploy.
- The admin "Users" list shows the new source as "Course Builder: N chapters" (or "Revision only, N
  chapters"), plus "+ Notes" and "+ Tests".
- The progress report's per-course `totalVideos` for a build course is the number of classes its build
  opens. Watch metrics count only those classes.

## Acceptance criteria

Done 2026-10-20: backend f2fbe5851 (merge 68e1b1cbc), admin d3bb89a (merge 2d0b28d). Nothing pushed. Suites: `NO NEW FAILURES` on both sides. `adminPlacementAssign` fails under full-suite load but passes alone (8/8). `partialOwnershipListings` now expects `studentCount` +1 for each build.


- [x] Each "Include" / "Fix" row is implemented through `courseScope.ts` helpers, with a test per reader.
- [x] The agreed product calls are implemented, with tests.
- [x] No build order ever gets `Order.courseId` or `planId`.
- [x] Suites: `NO NEW FAILURES` against `baseline-backend.txt` / `baseline-admin.txt` (absolute paths).
