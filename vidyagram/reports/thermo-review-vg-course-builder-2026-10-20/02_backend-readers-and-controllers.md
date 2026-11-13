# Thermo-nuclear review 02 — backend readers, controllers, routes and side features

Branch `feat/vg-course-builder` in `~/Projects/worktrees/vg-builder-backend`, diff `origin/vidyagram-admin...HEAD`, read-only. Scope: everything that consumes the core (`courseScope.ts`, `classAccessAuthz.ts`, `courseAccessState*`, `buildOrder.service.ts`, the models), which another reviewer owns.

## Verdict

The core did its job: `courseScope.ts` is the one place that says what a build owns, and three hand-rolled "orders → plans → course ids" expansions died on this branch (`courseClassController.getPurchasedCourseIdsForUser`, `packageUtils.getPurchasedCourseIds`, `courseAccessState`'s private `idList`). The consumers did not follow through. The *reading* side of a build — "which course does this order belong to" — is re-derived at thirteen sites with four different spellings (`buildOrderMatch`, `buildCourseCountExpr`, a second `$lookup`, `order.build?.courseId`, `idStrings('build.courseId')`, `scopeBuild(...)` as a boolean), the two notification delivery services received the same hunk twice on top of a pre-existing fork, the two new controllers carry the service layer inside them (raw collection queries, update literals, a fabricated admin principal, a third "what you own" shape), and the 113-line PDF-chapter name matcher exists only because `CoursePdf` was not given the `topic` tag that `CourseTest` got in the same branch. None of this is wrong today; all of it is the next person's `if (order.build)` grep. Four structural moves below would delete roughly 250 lines and two whole mechanisms (the name matcher and the second delivery copy) without changing behaviour.

## 1. "Which course does this order cover" is answered thirteen times in six spellings (High)

The core exports a `ScopeOrder` with `courseIds` + `build` and says a build is "its course only in `build.courseId`" (`src/services/courseScope.ts:24-27`). Every reader that lists, counts or matches a course's orders now has to remember that on its own, and each one did it differently:

| Site | Spelling |
|---|---|
| `src/controllers/courseController.ts:104-105, 148` | a second `$lookup` on `build.courseId` and `studentCount: { $add: [$size orders, $size buildOrders] }` |
| `src/controllers/courseController.ts:2290` | `addCourseId(order.build?.courseId)` next to a manual `courseId`/`latestCourseId` flatten |
| `src/controllers/dashboardAnalyticsController.ts:535` | `courseCount: { $add: [{ $size courseId }, buildCourseCountExpr] }` |
| `src/services/dashboardPurchaseReporting.ts:7-13` | `linkedItemCount` adds `buildCourseCountExpr` |
| `src/services/gstReport.service.ts:222` | `if (scopeBuild(order?.build) && !kinds.includes('Course')) kinds.push('Course')` |
| `src/services/invoice.service.ts:116` | `if (order.build?.courseId)` |
| `src/services/coursePurchasers.service.ts:157, 192, 207-215, 291-298` | `buildOrderMatch`, a `__build` flag, a `$push` of the snapshot and `buildSourceOf` re-running `courseScopeFromOrders` on synthetic `{ courseIds: [], build }` orders |
| `src/services/notificationAudience/segmentFilters.ts:234` | `idStrings('build.courseId')` in a `$setUnion` |
| `src/services/notificationTokenDelivery.service.ts:173-177` and `advanceNotificationTokenDelivery.service.ts:140-144` | a parallel `buildBuyerUserIds` query unioned with `Order.distinct('userId', query)` |
| `src/controllers/userController.ts:1601-1611` | `orders.map(o => ({ courseIds: [], build: scopeBuild(o.build) }))` then `courseScopeFromOrders` per course |
| `src/controllers/userStatsController.ts:460-466` | `loadScopeOrders` + the same per-course loop again |
| `src/controllers/orderController.ts:326, 365-368` | `describeBuildOrders` (fine: the one summary reader) |

The pattern `{ courseIds: [], build: scopeBuild(x) }` — constructing a fake `ScopeOrder` so `courseScopeFromOrders` will look at the build — appears three times (`coursePurchasers.service.ts:293`, `userController.ts:1605`, `courseAccessState.ts:172`). That is the tell: readers want a function the core does not export, so they forge its input.

Remedy — one typed "course line" reader and one query/expression pair, exported from `courseScope.ts` and consumed by every site above. Sketch:

```ts
// courseScope.ts — the only three ways a reader asks "which courses does this order cover?"

/** Mongo match: orders that cover any of these courses, in full or as a build. */
export const courseOrderMatch = (courseIds: string[]) => ({
  $or: [
    { courseId: { $in: objectIds(courseIds) } },
    { latestCourseId: { $in: objectIds(courseIds) } },
    { 'build.courseId': { $in: objectIds(courseIds) } },
  ],
});

/** Aggregation expr: the course ids an order covers, as strings (full and build alike). */
export const ORDER_COURSE_IDS_EXPR = {
  $setUnion: [idStrings('courseId'), idStrings('latestCourseId'), idStrings('build.courseId')],
};

/** In memory: every course an order covers, and the scope kind it covers it with. */
export const orderCourseLines = (order: ScopeOrder): { courseId: string; kind: 'full' | 'partial' }[] => [
  ...order.courseIds.map((courseId) => ({ courseId, kind: 'full' as const })),
  ...(order.build ? [{ courseId: order.build.courseId, kind: 'partial' as const }] : []),
];
```

With those three, `courseController`'s two `$lookup`s become one `$lookup` with a `pipeline: [{ $match: { $expr: { $in: ['$$id', ORDER_COURSE_IDS_EXPR] } } }]` and `studentCount` goes back to one `$size`; `segmentFilters` uses `ORDER_COURSE_IDS_EXPR`; `coursePurchasers` drops `buildOrderMatch` + `__build` for `courseOrderMatch`; `gstReport.kindsIn` and `dashboardAnalytics.courseCount` read `$size ORDER_COURSE_IDS_EXPR`; `getUserCourses` and the progress report iterate `orderCourseLines`. `buildOrderMatch` and `buildCourseCountExpr` then have no callers and go. The core reviewer owns the file; the point for this review is that every consumer is currently composing the rule by hand.

## 2. The notification audience was patched twice because the two delivery services were already a fork (High)

Before the branch, `notificationTokenDelivery.service.ts:152-176` (`getOrderUserIds` + `getPaidUserIds`) and `advanceNotificationTokenDelivery.service.ts:118-135` (`getPaidUserIds`) were the same function, as were `isActiveOrderWindow` (now at :123 and :92) and `getProductFilterForConnectWith`. The branch extended the fork rather than closing it: the hunks at `notificationTokenDelivery.service.ts:150-178` and `advanceNotificationTokenDelivery.service.ts:119-145` are byte-identical apart from the `INotification`/`IAdvanceNotification` type name — same `PaidAudienceNotification` alias, same `orderMatch` split, same `Promise.all([Order.distinct(...), buildBuyerUserIds({...})])`, same `new Set([...userIds, ...builders].map(normalizeString).filter(Boolean))`. Both `notificationMatchesUser` signatures got the same `| 'classId'` splice.

`buildBuyers.ts` itself does not duplicate an existing audience resolver (nothing else in `notificationAudience/` resolves course buyers; `segmentFilters` is the per-user facts pipeline and only needed the one-line `$setUnion` edit), and it correctly reuses `mongoAuthorizationDeps.findCoursesForClass` + `buildOpensClass` for the class scoping. The smell is its shape: it takes `orderMatch` (the caller's status/tenant/window filter) as a bag and re-runs an `Order.find` the caller just ran with `distinct`. Two queries where one would do.

Remedy: one `notificationAudience/paidBuyers.ts` that owns `isActiveOrderWindow`, `getProductFilterForConnectWith` and `paidBuyerUserIds(notification)`; both services import it. Inside it, one `Order.find({ ...orderMatch, ...courseOrderMatch(courseIds) }).select({ userId, build })` and a single in-memory filter: rows with no `build` pass; rows with a build pass through `buildOpensClass` when `scopeToClass`. `buildBuyers.ts` disappears into it. Net: −60 lines across the two services, and the next audience rule is written once.

## 3. The test gate's auth lives in the controller because the whole router is unauthenticated (Medium-High)

`src/routes/userTestDataRoutes.ts` has twenty-one routes and, before this branch, zero middleware; every handler trusts `:userId` from the URL. The README's "the test gate still trusts a URL userId when no token is sent" is a symptom of that file, not of the branch. The branch's answer (`:85-95`) is structurally the worst of the available options: two routes with different param shapes bound to one handler, `optionalAuthenticateToken` on one and `authenticateToken` on the other, and the identity reconciliation done inside the handler (`userTestDataController.ts:1160-1170`: compare `tokenUserId(req)` to `urlUserId`, 403 on mismatch, 401 when neither). That is the same inline check `courseClassController.getMyTimeTable` already does by hand at `:1031-1032`. Two copies of "the URL userId must be the token's user" now exist, neither is middleware, and the controller branches on which route shape it was mounted at.

Remedy: a `principalUserIdParam('userId')` middleware in `authMiddleware.ts` that runs `optionalAuthenticateToken`, then sets `req.principalUserId` = token user when present (403 if a URL `userId` disagrees), else the URL `userId` (behind a `LEGACY_URL_USER_ID` allow flag so the fallback can be switched off per deploy). The gate route becomes one line and the handler reads `req.principalUserId`; `getMyTimeTable` adopts the same middleware and drops its inline check. The second `/allow-user-test-course/:seriesId/:courseId` route is then unnecessary: the token form is just the first route with the token winning.

## 4. `adminCourseBuilderController` and `courseBuilderDataController` are services wearing a controller's hat (Medium)

Neither controller is thin. Concretely:

- `adminCourseBuilderController.ts:102-122` composes the Mongo update literal (`$set` of six dotted paths, a conditional `$unset` for `mrp`, `$inc` of `version`). `:228-237` does the placement-in-course count check and the `updateMany`. `:174-179` re-implements the "foreign topic" rule that `buildOrder.service.prepareBuildOrder` (`:49-52`) already has, with a different message.
- `courseBuilderDataController.ts:31-57` (`tallyChapters`) runs two raw `mongoose.connection.collection(...)` queries — the only place in the diff that bypasses the models — to count revision placements and sum durations. `:105-141` is the section/chapter shaping. `:62-77` (`ownershipOf`) is a **third** "what does this user own of the course" output shape, next to `courseAccessState.partialAccess` (`:181-191`, which spreads `PartialOwnership` into `CourseState`) and `coursePurchasers.buildSourceOf` (`:291-298`). The builder screen's shape adds `ownsAll` and, for a full owner, synthesises `ownedTopicIds = every chapter` and `ownedExtras = [...BUILD_EXTRAS]` — a fiction the course page does not tell (there a full owner gets no ownership fields at all). The app now has to read two vocabularies for the same fact.
- Both controllers call `loadListingRows(courseObjectId, { role: 'admin' })` (`adminCourseBuilderController.ts:37`, `courseBuilderDataController.ts:99`). Every other caller passes the real `req.user` (`adminCourseClassGroupsController.ts:50,163,237,444`, `adminCourseClassLibraryController.ts:138`, `courseCopy.ts:118,194`). `loadListingRows` only uses the user for `hasFullAccess(user)` (`ownership.ts:21-24`, `FULL_ACCESS_ROLES.has(user?.role)`), so `{ role: 'admin' }` is a forged principal that happens to satisfy the role set. If `FULL_ACCESS_ROLES` changes, the builder silently loses rows. The service needs a `scope: 'all'` option, not a fake user.
- The `extras`/`revisionOnly` serialisation is written twice: `adminCourseBuilderController.ts:24-29` (`serializeBuilder`) and `courseBuilderDataController.ts:157-161`, identical six-line literals.
- `(req as any).user` ×3, `(course as any).builder` ×3, `(updated as any)?.builder` — the `Course` model has `ICourseBuilder` but the `.lean()` reads are not typed.

Remedy: `src/services/courseBuilder.service.ts` with `loadBuilderOutline(courseId)`, `saveBuilderSettings(courseId, input)` (owns the update literal), `builderScreen(courseId, viewerUserId?)` (owns `tallyChapters` via the models, the section shaping and the ownership read), and a `serializeBuilderSettings` shared by both routes. The two controllers shrink to param validation + status mapping (~40 lines each). For ownership, the builder screen should emit the same `Partial<PartialOwnership>` the course page emits (`courseAccessState`) and nothing else — delete `ownsAll` and the synthesised full-owner list; the app already knows `is_buy: 1` without `isPartial` means everything.

```ts
// courseBuilder.service.ts (sketch)
export const builderScreen = async (courseId: string, viewer?: string) => {
  const course = await Course.findById(courseId).select('title builder').lean<{ title: string; builder?: ICourseBuilder }>();
  if (!course?.builder?.enabled) return null;
  const rows = await loadListingRows(new Types.ObjectId(courseId), null, { scope: 'all' });
  const sections = chapterSections(course.builder, rows, await loadCourseTopicPriorities(...), await chapterTallies(rows));
  const ownership = viewer ? ownershipFields(await resolveCourseScope(viewer, courseId, { enforceExpiry: true })) : {};
  return { course: { id: courseId, title: course.title }, ...builderSettingsView(course.builder), sections, ...ownership };
};
```

## 5. `coursePdfChapter.ts` exists because `CoursePdf` was not given the tag `CourseTest` got (Medium, code-judo)

Task 09 added `CourseTest.topic` (`src/models/CourseTest.ts:138-144`): the admin tags a test with its chapter, and `courseTestAccess.ts` is a 44-line pure rule over that id. Task 07 did not do the same for PDFs; instead `coursePdfChapter.ts` (113 lines) reconstructs a chapter id from *names*: `normalise` (trim, collapse spaces, lower-case), match topic name, break ties by section name, give up on a tie (`:28-48`), fed by `loadCourseChapterNames` (`:56-93`), a bespoke `CourseClass` aggregation that re-runs `createCourseClassDisplayPlacementStages` + `createEffectiveCourseClassTaxonomyStage` + two name `$lookup`s — the same stages `loadListingRows` runs (`courseOutlineRows.ts:118-129`) — to emit `(topicId, sectionName, topicName)` pairs twice over (record name and override name). The README already lists "unmatched course PDFs on real Vidyagram data" as an open item: the name matcher is a known source of misses, and every rename of a Topic or Section silently moves PDFs out of their chapter.

Two facts make the tag the obvious move. First, the admin PDF outline already resolves a topic *id* for library-filed PDFs (`adminCoursePdfOutlineController.ts:36, 101`: `libraryTopic: { topicId, topicName }`), so the admin screen has the id in hand at filing time. Second, `issuePdfAccess.ts:145-150` consumes the chapter as an optional `resolveCoursePdfChapter?: (courseId, pdfId) => Promise<string | null>` dep — the consumer does not care how the id is found.

Remedy: add `CoursePdf.topic?: ObjectId` with the same semantics as `CourseTest.topic`; set it from the PDF outline's filing writes (`moveCoursePdfs`, `assignCoursePdfsIntoPlace`) using the id those screens already hold, with a one-off backfill script that runs today's `matchCoursePdfChapter` once and writes the id. Then `resolveCoursePdfChapter` becomes a four-line `CoursePdf.findOne(...).select('topic')`, and `matchCoursePdfChapter`, `loadCourseChapterNames`, `normalise`, `single`, `firstName` and the test file go. The interim "untagged test opens any chapter of its section" branch in `courseTestAccess.ts:28-29, 35-42` (PRD open question 5) is the same shape of debt on the test side; once tagging is required on assign, `opensCourseTest` collapses into `scopeOpensCourseTest` with no `Topic.find`.

## 6. Progress report and stats bolt a build path beside a hand-rolled full path (Medium)

`userController.ts:1615-1626` (`getEnrolledCourseIdsFromOrders`) is the last surviving hand-rolled plan expansion in the codebase — the branch deleted the other two but left this one and built on it: `getBuildClassIdsByCourse` (`:1601-1611`) forges `ScopeOrder`s from the same raw orders, and `getUserProgressReport` (`:1706-1720, :1922, :1952-1955, :1969-1972`) now carries `fullCourseIds`, `buildClassIdsByCourse`, `enrolledCourseIds`, `fullCourseObjectIds`, `courseWatchScope` and a merged `courseVideoTotalsById` — six derived collections for one concept, spliced into a 300-line handler. `userStatsController.ts:456-468` does the same from the other end: the existing pipeline (`:474-556`) counts orders by `userId` alone (no `orderStatus`, no `status`, no expiry) through a four-`$lookup` chain, and `getBuildClassesCompleted` runs `loadScopeOrders` (success, not deleted) beside it; the two totals are then summed (`:562-568`) although they are computed under different ownership rules.

Remedy: one service, `watchableClasses(userId) → Map<courseId, { kind: 'full' | 'partial'; classIds: string[] }>`, built from `loadScopeOrders` + `orderCourseLines` (finding 1) + `classIdsOpenedByScope`. Both the progress report and classes-completed consume that map; `getEnrolledCourseIdsFromOrders` and the stats `$lookup` chain are replaced, and the two reports stop disagreeing about what an order is.

## 7. Smaller structural notes (Low)

- `courseTestController.ts` (1,013 → 1,053): the chapter tag is spliced into `assignTestToCourse` and `updateAssignedTest` as four scattered edits each (schema field, `chapterTagExists`, the `existingAny.topic = ...` branch at `:201-203`, the `$set`/`$unset` dance at `:240-245`, the response field). The `topicId === null ? $unset : $set` idiom appears here and in `saveCourseBuilder` for `mrp`; a `setOrUnset(path, value)` helper would make both one line. The reactivate-soft-deleted path (`:197-205`) and the create path (`:178-213`) must both be kept in step for every new field — that pre-existing shape is why the hunk is 52 lines for one field.
- `coursePurchasers.service.ts:207-215` pushes the raw snapshot through the `$group` and then re-derives scope in JS (`buildSourceOf`). Pushing `userId`s and loading the build orders once in a second query would avoid carrying nested arrays through `$group`; with finding 1's `courseOrderMatch` the `__build` flag goes.
- `orderController.ts:344-350` (`buildHistoryItem`) and `invoice.service.ts:116-122` are correct uses of `describeBuildOrders`; the invoice path calls the batch API with a one-element array, which is fine.
- `courseBuilderDataController.ts:143` reads `(req as any).user?.user_id` while the same branch uses `tokenUserId(req)` in `userTestDataController.ts:1161`; 29 raw `user?.user_id` reads vs 7 `tokenUserId(` across controllers — the branch added to the wrong column.
- `adminCoursePickerRoutes.ts:94-99` and `orderRoutes.ts:49-54` follow the existing per-route `requireAdmin`/`authenticateToken` pattern exactly; no ad hoc middleware there. `courseRoutes.ts:66` wires `optionalAuthenticateToken` the same way `/:id` does. Routes are fine.

## Measurements

```
$ git diff --stat origin/vidyagram-admin...HEAD -- src | tail -1
72 files changed, 5143 insertions(+), 307 deletions(-)

$ git diff origin/vidyagram-admin...HEAD --stat -- src/controllers
 adminCourseBuilderController.ts | 247 +   buildCheckoutController.ts | 184 +   courseBuilderDataController.ts | 170 +
 courseClassController.ts | 36 (−31)      courseController.ts | 17        courseTestController.ts | 52
 dashboardAnalyticsController.ts | 4      orderController.ts | 23       userController.ts | 40
 userStatsController.ts | 28              userTestDataController.ts | 35

$ wc -l (HEAD)
 3056 courseController.ts   2745 userController.ts   2283 orderController.ts   1818 courseClassController.ts
 1400 userTestDataController.ts   1053 courseTestController.ts
 1161 notificationTokenDelivery.service.ts   757 advanceNotificationTokenDelivery.service.ts

$ for f in <changed non-test src files>; grep -cE 'build\b|\.build|chapterIds|isRevision|revisionOnly|partial|builderSettings|BUILD'
 50 courseScope.ts  33 buildOrder.service.ts  19 courseAccessState.ts  18 buildCheckoutController.ts
 17 classAccessAuthz.ts  17 adminCourseBuilderController.ts  15 courseBuilderDataController.ts
 13 coursePurchasers.service.ts  12 buildPricingPolicy.ts  12 models/Order.ts  9 buildBuyers.ts
  8 userController.ts  8 dashboardAnalyticsController.ts  6 orderController.ts  5 courseController.ts
  4 courseTestAccess.ts  3 notificationTokenDelivery.service.ts  3 issuePdfAccess.ts  3 gstReport.service.ts
  2 segmentFilters.ts  2 invoice.service.ts  2 advanceNotificationTokenDelivery.service.ts
  1 dashboardPurchaseReporting.ts  1 courseOutlineRows.ts

$ grep -rn "{ courseIds: \[\], build" src --include=*.ts | grep -v tests
 coursePurchasers.service.ts:293   userController.ts:1605   courseAccessState.ts:172

$ grep -rn "loadListingRows(" src --include=*.ts | grep -v tests
 7 callers pass the request user; adminCourseBuilderController.ts:37 and courseBuilderDataController.ts:99 pass { role: 'admin' }

$ grep -c 'as any\|: any\|any\[\]' (new files)
 4 adminCourseBuilderController  3 courseBuilderDataController  5 coursePdfChapter  1 courseTestAccess
 1 buildBuyers  11 buildOrder.service

$ grep -rn "tokenUserId(" src --include=*.ts | grep -v tests | wc -l   → 7
$ grep -rn "user?.user_id" src/controllers --include=*.ts | wc -l       → 29

$ git show origin/vidyagram-admin:src/services/notificationTokenDelivery.service.ts | grep -n "getOrderUserIds\|getPaidUserIds"
 152 (def getOrderUserIds)  175-176 (getPaidUserIds = getOrderUserIds(n, true))  557, 1153 (callers)
 → activeOnly=false had no caller on the base; the branch correctly dropped the parameter.

$ grep -rn "Topic.exists" src --include=*.ts | grep -v tests
 courseTestController.ts:32 only (the chapterTagExists helper is new, no existing twin)
```

## Verified / not verified

Verified by reading HEAD and base: every file:line above; the base bodies of both `getPaidUserIds`; that `loadListingRows` uses its `user` argument only through `hasFullAccess`; that `adminCoursePdfOutlineController` already emits `libraryTopic.topicId`; that `issuePdfAccess` takes the chapter resolver as an optional dep; that `getMyTimeTable` has its own inline URL-vs-token check; that no other file in `notificationAudience/` resolves course buyers.

Not verified: the test suites were not run (per brief); whether `FULL_ACCESS_ROLES` currently contains `'admin'` (the forged principal works today only if it does — I did not open `baseConstants`); whether the app already tolerates the course page's `Partial<PartialOwnership>` shape so the builder screen could drop `ownsAll` without an app change (task 12 owns that); the real-data miss rate of `matchCoursePdfChapter` (README says it is open).
