# Thermo-nuclear review — backend ownership and pricing core

Branch `feat/vg-course-builder` (worktree `~/Projects/worktrees/vg-builder-backend`), diff `origin/vidyagram-admin...HEAD`.
Scope: `courseScope.ts`, `classAccessAuthz.ts`, `courseAccessState(.service).ts`, `buildPricingPolicy.ts`,
`courseBuilderConfig.ts`, `buildOrder.service.ts`, `buildCheckoutController.ts`, the `Course`/`CourseClass`/`Order`
schema additions, `packageUtils.ts`, and the owned-course readers the diff touched.

## Verdict

The pricing half is in good shape: `priceBuild` is a pure function over an explicit input type, the save rules
live in one zod module, and the order snapshot is written by one path for both checkout and admin grant. The
ownership half is not the deep module the PRD asked for. `courseScope.ts` exports fourteen things; the one
resolver (`resolveCourseScope`) has three callers while nine other modules reach past it into `scopeBuild`,
`courseScopeFromOrders`, `buildOrderMatch`, `buildOpensClass`, `classIdsOpenedByScope` and the aggregation
fragments, three of them hand-assembling fake `ScopeOrder`s (`{ courseIds: [], build: ... }`) to get at the merge
rule. There are two order loaders for the same query, two expiry predicates, and four spellings of "does this
scope open this item". The build checkout re-types the Razorpay initiation sequence and the admin free-grant
shape instead of extracting them, and `Order.type: 'course_builder'` is a discriminator nobody reads. None of
this is wrong today; all of it is the shape that becomes spaghetti on the next feature (coupons on builds,
a third extra, a second partial product). The remedies below delete more than they add.

## 1. `courseScope` is a toolbox, not a resolver; ownership is still re-derived in six places — High

`src/services/courseScope.ts` exports `ChapterScope`, `chapterOpensClass`, `CourseScope`, `ScopeOrder`,
`ScopeBuild`, `toIdString`, `orderDirectCourseIds`, `planCourseIds`, `ownedCourseIds`, `ScopeRules`,
`courseScopeFromOrders`, `scopeBuild`, `PartialOwnership`, `partialOwnership`, `loadScopeOrders`,
`buildOrderMatch`, `buildCourseCountExpr`, `ClassPlacement`, `buildOpensClass`, `classIdsOpenedByScope`,
`resolveOwnedCourseIds`, `resolveCourseScope`. The import grep (Measurements, M3) shows the deep entry
points are used by `buildOrder.service.ts`, `userTestDataController.ts`, `courseBuilderDataController.ts`
(`resolveCourseScope`) and `courseClassController.ts` (`resolveOwnedCourseIds`). Everyone else imports the
parts and re-assembles the rule:

- `src/controllers/userController.ts:1604` — `orders.map((order) => ({ courseIds: [], build: scopeBuild(order.build) }))`
  then `courseScopeFromOrders(scopeOrders, courseId, { enforceExpiry: false })`, from orders it loaded itself
  with its own success/expiry query at `:1590-1597` (`getActiveUserOrders`).
- `src/services/coursePurchasers.service.ts:293` — `builds.map((build) => ({ courseIds: [], build: scopeBuild(build) }))`
  feeding `courseScopeFromOrders` purely to get the "all beats revision" merge.
- `src/services/courseAccessState.ts:171` — `entry.live.push({ courseIds: [], expireDate, build })` for the same
  reason, after its own expiry test at `:170` (`expireDate.getTime() < now.getTime()`, exclusive) while
  `courseScope.ts:83-84` says `<=` (inclusive). Two expiry predicates for one concept, already disagreeing at the
  boundary second.
- `src/controllers/userStatsController.ts:459-468` — `loadScopeOrders` then a manual
  `courseScopeFromOrders` loop per build course.

The fake `ScopeOrder` is the tell: callers need a function that takes a raw order document and they do not
have one, so they construct the resolver's internal shape by hand. `courseAccessState.service.ts:21-41`
(`loadCourseAccessRecords`) runs the identical `Order.find({ userId, orderStatus: 'success', status: { $ne: 0 } })`
as `courseScope.ts:168` (`loadScopeOrders`) and loads plans a second way (all statuses, for the Retired-plan rule).
That is two loaders for one read.

Owned-course readers the PRD's "subtract first" rule did not reach (each still flattens `courseId` +
`latestCourseId` + `Plans.course` itself, and each got the build case bolted on by hand):
`src/controllers/userController.ts:1614-1625` (`getEnrolledCourseIdsFromOrders`),
`src/controllers/courseController.ts:2277-2298` (`getUserCourses`, with `addCourseId(order.build?.courseId)` at `:2291`),
`src/services/notificationAudience/segmentFilters.ts:234` (`idStrings('build.courseId')` appended to the
aggregation), `src/services/coursePurchasers.service.ts:150-157` (its own `$or` ownership match plus
`buildOrderMatch`), `src/services/gstReport.service.ts:221`. The two aggregation readers may legitimately stay
in Mongo, but the three in-process ones are exactly what `resolveOwnedCourseIds` exists for.

Remedy: cut the public surface to the resolver and one adapter, and make `courseAccessState` a consumer of
the same loader.

```ts
// courseScope.ts — public surface
export type CourseScope = { kind: 'none' } | { kind: 'full' } | { kind: 'partial'; chapters: Map<string, ChapterScope>; extras: Set<BuildExtra> };
export const scopeOrder = (doc: RawOrderDoc, planCourses: ReadonlyMap<string, string[]>): ScopeOrder;   // the one adapter
export const loadScopeOrders = (userId: string): Promise<ScopeOrder[]>;                                   // the one loader
export const scopeOf = (orders: ScopeOrder[], courseId: string, rules: ScopeRules): CourseScope;          // was courseScopeFromOrders
export const resolveCourseScope = (userId, courseId, rules) => scopeOf(await loadScopeOrders(userId), courseId, rules);
export const resolveOwnedCourseIds = ...;
export const scopeOpens = (scope: CourseScope, item: ScopedItem): boolean;                                // see finding 2
```

`scopeBuild`, `buildOpensClass`, `chapterOpensClass`, `orderDirectCourseIds`, `planCourseIds`, `ownedCourseIds`,
`partialOwnership`'s input type and the `{ courseIds: [] }` idiom become private. `courseAccessState.ts`'s
`buildsByCourse` (`:162-175`) collapses to `scopeOf(orders, courseId, ...)` on the orders `loadScopeOrders`
already returns (`loadCourseAccessRecords` keeps only its plan-with-any-status half for the Retired rule, or
`loadScopeOrders` grows a `plans` return). `userController.getEnrolledCourseIdsFromOrders`,
`getBuildClassIdsByCourse` and `userStatsController.getBuildClassesCompleted` become one call each.

## 2. Four spellings of "does this scope open this item" — High

The PRD (module 5) asked for one placement shape `{ topicId, kind, revision }` and one rule. The branch has:

1. `src/services/classAccessAuthz.ts:80-94` `scopeOpensClass` — per placement: `courseScopeFromOrders` →
   `chapterOpensClass(scope.chapters.get(topicId), isRevision)` → `contentKind === 'notes' ? opens && scope.extras.has('notes') : opens`.
2. `src/services/classAccessAuthz.ts:241-245` the partial branch of `authorizeCourseAccess` — a different rule
   for course PDFs: `scope.extras.has('notes')` and `scope.chapters.has(topicId)` (either chapter scope, no
   revision test), driven by an optional callback `ctx.notesChapter`.
3. `src/services/courseScope.ts:218-221` `buildOpensClass(build, placement)` — per *build*, not per scope, used
   by `notificationAudience/buildBuyers.ts:37-39`, so the push audience bypasses the union/`all beats revision`
   merge the resolver documents (equivalent today because "any build opens it" is monotone, but it is a second
   path to keep equivalent).
4. `src/services/courseScope.ts:227-248` `classIdsOpenedByScope` — the bulk inversion (scope → class ids),
   which re-implements the "placement topic else class topic" fallback that
   `mongoAuthorizationDeps.findCoursesForClass` at `classAccessAuthz.ts:307-350` also implements, with its own
   `CourseClass.find` + `Class.find` pair.
5. `src/services/courseTestAccess.ts:20-30` `scopeOpensCourseTest` — the tests variant with the section fallback.

Remedy: one pure predicate and one placement resolver.

```ts
export type ScopedItem =
  | { kind: 'class' | 'notes'; topicId: string | null; isRevision: boolean }
  | { kind: 'tests'; topicId: string | null; sectionId: string | null; chapterSections: ReadonlyMap<string, string> };

export const scopeOpens = (scope: CourseScope, item: ScopedItem): boolean => {
  if (scope.kind === 'full') return true;
  if (scope.kind !== 'partial') return false;
  if (item.kind !== 'class' && !scope.extras.has(item.kind)) return false;
  if (item.kind === 'tests') return item.topicId ? scope.chapters.has(item.topicId) : coveredBySection(scope, item);
  return chapterOpensClass(scope.chapters.get(item.topicId ?? ''), item.isRevision);
};
```

`scopeOpensClass`, the `notesChapter` branch, `buildOpensClass`, `scopeOpensCourseTest` all become calls to
`scopeOpens`; `buildBuyers` resolves the scope per buyer (it already has the rows) instead of per build.
`classIdsOpenedByScope` and `findCoursesForClass` share one `placementsOf(courseId | classId)` that returns
`{ courseId, topicId, isRevision, placementIsFree }` with the class-topic fallback done once. Note the course-PDF
rule (2) deliberately ignores `isRevision`; if that is intended, it is a `kind: 'notes'` item with
`isRevision: true`, which `chapterOpensClass` already accepts, so no special case survives.

## 3. Build checkout re-types the Razorpay initiation and the admin grant; `type: 'course_builder'` is write-only — High

`src/controllers/buildCheckoutController.ts:55-96` is `src/controllers/orderController.ts:774-835`
(`initiateRazorpayOrder`) with the fields renamed: payment-log "request sent" → `createRazorpayOrder` →
payment-log "response" → `Order.create({ orderStatus: RAZORPAY_INITIATED, gateway: 'razorpay', customer_id,
orderId: rzpOrder.id, razorpayStatus, orderNumber, orderDate })`. `grantBuildForFree` at `:153-173` is
`orderController.ts:1649-1680` (`assignPlan` free branch) with `build` in place of the plan arrays:
`orderStatus: RAZORPAY_SUCCESS, gateway: 'free', orderVia: 'admin', givenForFree: true, assignedByAdmin: true,
assignedPlanAt: now, remarks: ... || 'Given for free by admin'`, then `ensureInvoiceForOrder`.
`generateOrderNumber` at `:16-17` is the eighth copy in the repo (M5). There is no canonical helper to reuse
because the existing sequence is inline in the controller; `order.service.ts` holds only the Apple variant.
The PRD's "does not reuse the client-amount checkout routes" is about the *route* trusting the body, not about
the persistence sequence.

Remedy: extract the two sequences into `order.service.ts` and make both controllers thin.

```ts
// order.service.ts
export const generateOrderNumber = ...;                                   // delete the other seven
export async function initiateRazorpayOrder(args: { userId: string; amount: number; notes: Record<string, string>; order: Partial<IOrder>; logTitle: string }): Promise<{ order: IOrder; rzpOrder }>;
export async function createAdminGrantOrder(args: { userId: string; listPrice: number; planFor: string; remarks?: string; createdBy; order: Partial<IOrder> }): Promise<IOrder>;
```

`buildCheckoutController` then becomes `prepareBuildOrder` → `initiateRazorpayOrder({ ..., order: { planFor, build } })`,
and the legacy controller's two inline copies migrate onto the same helpers (that is the deletion that pays for
the extraction). Separately, `Order.type` is set to `'course_builder'` at `:88` and `:160` and read nowhere (M6);
every reader discriminates on `build.courseId` presence instead. Either read it (e.g. the GST product-type rule at
`gstReport.service.ts:221` is the natural reader) or stop writing it; a discriminator with zero readers is a lie
waiting to go stale.

## 4. Partial ownership has three shapes and `revisionOnly` three meanings — Medium

The internal model is `CourseScope{ kind: 'partial', chapters, extras }` (good, closed union). The wire model
is `PartialOwnership{ isPartial: true, ownedTopicIds, revisionTopicIds, ownedExtras, revisionOnly }`
(`courseScope.ts:143-149`). `CourseState` at `courseAccessState.ts:28-34` is then
`{ is_buy, isPaid, isExtension, isExpired, daysLeft } & Partial<PartialOwnership>`, so `isPartial` is
`true | undefined` spread into the flags object. `courseBuilderDataController.ts:62-77` consumes this by
destructuring `isPartial` back out and building a third shape `{ ownsAll, isPartial: false, ownedTopicIds:
full ? chapterIds : [], revisionTopicIds: [], ownedExtras: full ? [...BUILD_EXTRAS] : [], revisionOnly: false }`
for the full/none cases. `revisionOnly` is a pick input (`BuildPicks`), an order-snapshot flag
(`IOrderBuild.revisionOnly`), and a derived "every owned chapter is revision-only" on the wire
(`courseScope.ts:159`). `coursePurchasers.service.ts:30` adds a fourth partial shape
`{ kind: 'build'; chapters: number; revisionOnly; extras }`.

Remedy: one wire DTO, nested, never spread.

```ts
export type Ownership = { kind: 'none' } | { kind: 'full' } | { kind: 'partial'; ownedTopicIds: string[]; revisionTopicIds: string[]; ownedExtras: BuildExtra[] };
export const ownershipOf = (scope: CourseScope): Ownership;      // the only CourseScope → DTO function
export type CourseState = { is_buy; isPaid; isExtension; isExpired; daysLeft; ownership?: Ownership };
```

`isPartial` and the derived `revisionOnly` are then client-side derivations (`ownership.kind === 'partial'`,
`revisionTopicIds.length === ownedTopicIds.length`), the builder-data controller returns `ownershipOf(scope)`
unchanged, and the purchasers row carries the same DTO. If the app contract for `isPartial` on My Courses is
already frozen (PRD module 6 names it), keep `isPartial` as a flat boolean alongside a nested `ownership` and
let the rest go.

## 5. `Order.build.breakdown` is `Mixed`; `settingsVersion` is write-only — Medium

`src/models/Order.ts:19` declares `breakdown: Record<string, any>` and `:27` stores it as `Schema.Types.Mixed`,
though it is always `priceBuild()`'s `BuildPrice` (`buildCheckoutController` → `prepareBuildOrder` →
`snapshot.breakdown = breakdown`). The read side pays for it: `describeBuildOrders` in
`buildOrder.service.ts:113-162` is written entirely over `any` (8 `any`, 5 `as any`, M4) to pull `lines`,
`extrasOff` back out. `settingsVersion` (`:20`, `:28`) is written at `buildOrder.service.ts:84` and read only to
echo itself at `:158`; no code compares it against `Course.builder.version`. Remedy: `breakdown: BuildPrice` on
the interface (a subschema mirroring `BuildPrice`, or keep Mixed in Mongo but type the interface), which lets
`describeBuildOrders` drop its casts; delete `settingsVersion` unless a reader is planned, in which case name it
in the field comment.

## 6. Pricing: pure and well-typed, with two leaks — Low

`priceBuild` (`buildPricingPolicy.ts:59-98`) is a pure function with an explicit `BuildPricingSettings` input,
no I/O, no clock, and the rounding convention stated in the header. Good. Two leaks:

- `courseBuilderDataController.ts:19-20` re-implements the chapter price
  (`chapter.customPrice ?? (builder.maxPrice * chapter.weight) / 100`) that `buildPricingPolicy.ts:62-63` owns
  and whose header says it is "the only place the server prices a build". Export `chapterPrice` from the policy.
- `BuildPricingSettings.chapters[].topicId: unknown` plus `Number(settings.maxPrice) || 0` coercions
  (`:60-61`) exist so the function accepts a raw Mongoose `builder` (`prepareBuildOrder` passes `builder: any`
  at `buildOrder.service.ts:44,69`). That widens the pure core's contract to "whatever is in Mongo". Prefer
  typing the input as `ICourseBuilder` and coercing at the one load site.

`courseBuilderConfig.ts` is not an identity wrapper: the zod schema is structural, `courseBuilderError`
(`:54-93`) holds the cross-field rules (weights sum to 100 in 0.5 steps, min ≤ max, extras ≤ gap, outline
membership, unfiled placements). The Mongoose subschema in `Course.ts:73-98` repeats `min: 0` and `required`
on every number, but `adminCourseBuilderController.ts:102-122` saves with `findOneAndUpdate` and no
`runValidators`, so those constraints never execute (M7). Dead validation is worse than none because it reads as
a guarantee; drop the `min`/`required` from the subschema or add `runValidators: true` and accept the double
check.

## 7. Three bolt-ons compute "the classes a user's builds open" three ways — Low

`userController.ts:1599-1612` (`getBuildClassIdsByCourse`, +40 lines in a 2,745-line file, then a
`$or` of `{ courseId }` and `{ courseId, classId: { $in } }` at `:1715-1718` and a merged totals map at
`:1972-1975`), `userStatsController.ts:459-468` (`getBuildClassesCompleted`, +28 lines, a parallel
`Promise.all` with the legacy aggregate and a hand-merged percentage at `:561-571`), and
`courseController.ts:101-106,148` (a second `$lookup` on `build.courseId` and `$add` of two `$size`s for
`studentCount`). All three are "per course the user holds partially, the class ids the scope opens", which is
`classIdsOpenedByScope` per course; the first two differ only in what they do with the ids. A single
`buildClassScope(userId): Promise<Map<courseId, classId[]>>` in `courseScope` (built on `loadScopeOrders`, not
on each controller's own order query) replaces both in-process copies and leaves one line in each controller.
`courseController`'s aggregation copy is fine as Mongo-side, but `getOrdersLookupStages` is now the fourth
place that knows "a build keeps its course only in `build.courseId`" (with `buildOrderMatch`,
`buildCourseCountExpr`, `segmentFilters.ts:234`); that invariant should be stated once in `Order.ts` next to
the `build_course` index and the others should cite it.

## Measurements

M1. Line counts (`wc -l` in the worktree):
```
 266 src/services/courseScope.ts         368 src/services/classAccessAuthz.ts (base 412)
 215 src/services/courseAccessState.ts   113 src/services/courseAccessState.service.ts
 109 src/services/buildPricingPolicy.ts   93 src/utils/courseBuilderConfig.ts
 176 src/services/buildOrder.service.ts  184 src/controllers/buildCheckoutController.ts
 244 src/models/Course.ts  411 src/models/CourseClass.ts  292 src/models/Order.ts
 251 src/utils/packageUtils.ts (−40: getPurchasedCourseIds deleted; its only caller allowUserTestCourse now calls resolveCourseScope + opensCourseTest)
2745 src/controllers/userController.ts  3056 src/controllers/courseController.ts  2283 src/controllers/orderController.ts
```
`git diff --stat origin/vidyagram-admin...HEAD -- src`: 72 files, +5,143 / −307 (tests ≈ 3,600 of the additions).

M2. Base `classAccessAuthz.ts` exported `OrderForAuthz`, `ownedCourseIds`, `toIdString`; those moved to
`courseScope.ts` as `ScopeOrder`, `ownedCourseIds`, `toIdString` (`git show origin/vidyagram-admin:src/services/classAccessAuthz.ts | grep -n export`).
Base `courseClassController.ts:79` had `getPurchasedCourseIdsForUser`; HEAD has no match (deleted, now `resolveOwnedCourseIds` at `:1048`).

M3. `grep -rln "from '.*courseScope'" src --include=*.ts | grep -v tests/` → 14 modules.
Callers of `resolveCourseScope`: 3 (`buildOrder.service`, `userTestDataController`, `courseBuilderDataController`).
Callers of `resolveOwnedCourseIds`: 1 (`courseClassController`). Callers of `courseScopeFromOrders` directly:
4 (`classAccessAuthz`, `courseAccessState`, `coursePurchasers.service`, `userController`, `userStatsController` = 5).
`grep -rn "courseIds: \[\]" src --include=*.ts | grep -v tests/` → 3 hits (`userController.ts:1604`,
`courseAccessState.ts:171`, `coursePurchasers.service.ts:293`).

M4. Casts per file (`grep -c ': any\|any\[\]\|<any>'` / `grep -c 'as any'`):
courseScope 6/1, classAccessAuthz 5/2, courseAccessState 2/2, buildPricingPolicy 0/0, courseBuilderConfig 0/0,
buildOrder.service 8/5, buildCheckoutController 2/2, courseBuilderDataController 0/3, coursePurchasers 2/3, buildBuyers 1/0.

M5. `grep -rn "generateOrderNumber" src --include=*.ts | grep -v tests/ | grep "const\|function"` → 8 definitions
(orderController, packageOrderController, order.service, buildCheckoutController, 4 scripts).

M6. `grep -rn "course_builder" src --include=*.ts | grep -v tests/` → 3 hits, all in `buildCheckoutController.ts`
(two writes, one comment). No reader. `Order.type` is `{ type: String }` with no enum (`Order.ts:154`).

M7. `grep -n runValidators src/controllers/adminCourseBuilderController.ts` → none; the save is
`findOneAndUpdate(..., { new: true, projection: { builder: 1 } })` at `:102-122`.

M8. Spread of the build concept across non-test source (`grep -rl`): `build.courseId` 13 files,
`revisionOnly` 14 files, `scope.kind` 7 files that are course-scope related (the other 8 hits are the unrelated
`courseCopy` "scope"), `isPartial` 3 files, `extrasOn` 8 files.

M9. `grep -rln "orderStatus: 'success'" src --include=*.ts | grep -v tests/` → 36 files (19 are one-off
scripts). In-process owned-course flatteners still outside the resolver: `userController.getEnrolledCourseIdsFromOrders`,
`courseController.getUserCourses`, `coursePurchasers.service.listCoursePurchasers` (Mongo `$or`),
`segmentFilters.orderItemFactsStages` (aggregation), `gstReport.productTypeOf`.

## Verified / not verified

Verified by reading the full HEAD files: `courseScope.ts`, `classAccessAuthz.ts` (and its base), `courseAccessState.ts`,
`courseAccessState.service.ts`, `buildPricingPolicy.ts`, `courseBuilderConfig.ts`, `buildOrder.service.ts`,
`buildCheckoutController.ts`, `courseBuilderDataController.ts`, `courseTestAccess.ts`, `buildBuyers.ts`; the diff
hunks of `Course.ts`, `CourseClass.ts`, `Order.ts`, `packageUtils.ts`, `issuePdfAccess.ts`, `search/viewer.ts`,
`userController.ts`, `courseController.ts`, `orderController.ts`, `userStatsController.ts`, `userTestDataController.ts`,
`coursePurchasers.service.ts`, `gstReport.service.ts`, `invoice.service.ts`, `segmentFilters.ts`; the
`initiateRazorpayOrder` (`orderController.ts:660-835`) and `assignPlan` (`:1620-1690`) bodies; the save site in
`adminCourseBuilderController.ts:100-125`; PRD modules 1-9 and contracts; task 01 in full.

Inferred, not verified: that the Razorpay webhook (`razorpayController.ts:217` → `markOrderSuccessful`) needs no
build-specific branch (I did not read `markOrderSuccessful`'s body); that the `<` vs `<=` expiry difference
between `courseAccessState.ts:170` and `courseScope.ts:84` is unintended (no test pins either boundary that I
read); that `settingsVersion` has no planned reader beyond the echo. No test suite was run and no file in the
worktree was edited.
