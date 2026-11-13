# Thermo-nuclear code quality review — Vidyagram Course Builder

Reviewed 2026-10-20. Scope is the `feat/vg-course-builder` branch in both integration worktrees, our side
only (three-dot diff against `origin/vidyagram-admin`):

| Side | Worktree | Base read | Head read | Diff |
|---|---|---|---|---|
| backend | `~/Projects/worktrees/vg-builder-backend` | `e1857b474` | `2ee01628d` | 72 files, +5,143 / −307 (about 3,600 of the additions are tests) |
| admin | `~/Projects/worktrees/vg-builder-admin` | `4cffddc64` | `66dd030` | 19 files, +2,452 / −14 |

Note on timing: while this review ran, the backend worktree gained `257fb37b3 build: dist for the Course Builder`
and `feat/vg-course-builder` was pushed to `origin/vidyagram-admin` (the remote-tracking reflog says "update by
push"). The three-dot diff is therefore empty at the time of writing. Every finding below was verified against
the pinned commits in the table, and the code at the pushed head is the same code plus `dist/`. This review no
longer gates a merge; it is the cleanup list for what was merged.

Detail files: [01 backend ownership and pricing core](01_backend-ownership-core.md),
[02 backend readers, controllers, routes and side features](02_backend-readers-and-controllers.md),
[03 admin Builder UI](03_admin-builder-ui.md). Each carries the file:line evidence, the measurement commands
and what was verified by reading versus inferred. No test suite was run and no worktree file was edited.

## Verdict

Not at the approval bar for maintainability, even though the behaviour is green (74/74 end-to-end on 10-20
per the task README). Two parts of the branch are genuinely good and should be kept as the model for the rest:
the pricing core (`priceBuild` is a pure function over an explicit input, the save rules live in one zod module,
one snapshot writer serves both checkout and admin grant) and the admin hook layer (typed query keys, no `any`,
cache patched rather than invalidated). The price preview drawer carries no price math and quotes the backend,
as task 10 asked.

The rest shares one root cause. A build is a second kind of ownership, and the PRD asked for one resolver that
every owned-course read goes through (task 01). What landed is a 22-export toolbox, and every reader that
needed to know "which course does this order cover" or "does this scope open this item" composed the rule
itself. The result is thirteen reader sites in six spellings for the first question and five spellings for the
second, three places that forge the resolver's internal `{ courseIds: [], build }` shape to get at its merge
rule, two order loaders for one query, and two expiry predicates that already disagree at the boundary second.
On the admin side the same thing happened in miniature: Builder mode went into the 1,586-line
`AssignedClassesView` as a flag with eight conditionals, and the build shape was hand-declared three times
with three levels of strictness. None of this is a bug today. All of it is the shape that becomes spaghetti on
the next feature (coupons on builds, a third extra, a second partial product), and the remedies delete more
than they add.

## Findings

### 1. `courseScope` is a toolbox, and the order-to-course rule is re-derived at thirteen reader sites (High, backend)

`src/services/courseScope.ts` exports 22 names. The deep entry point `resolveCourseScope` has three callers;
five modules call `courseScopeFromOrders` directly, and three of them (`userController.ts:1604`,
`courseAccessState.ts:171`, `coursePurchasers.service.ts:293`) build fake `ScopeOrder`s of the form
`{ courseIds: [], build }` because the function they need, "give me the scope from a raw order document", is
not exported. `courseAccessState.service.ts` runs the same `Order.find` as `loadScopeOrders` through a second
loader, and the two expiry tests differ (`courseAccessState.ts:170` uses `<`, `courseScope.ts:84` uses `<=`).
Downstream, "which course does this order cover" is answered in six spellings across `courseController` (a
second `$lookup` on `build.courseId`), the dashboard (`buildCourseCountExpr`), gst (`scopeBuild(...)` used as
a boolean), invoice (`order.build?.courseId`), purchasers (`buildOrderMatch` plus a `__build` flag),
`segmentFilters` (`idStrings('build.courseId')`) and both notification services (a parallel query). Reports
01 §1 and 02 §1 list all sites. The remedy is to cut the public surface to one loader, one adapter from a raw
order, `scopeOf`, `resolveCourseScope`, `resolveOwnedCourseIds`, and three reader helpers
(`orderCourseLines`, `courseOrderMatch`, `ORDER_COURSE_IDS_EXPR`); `buildOrderMatch`, `buildCourseCountExpr`,
`scopeBuild` and the forged-order idiom then have no callers. Report 02 §1 sketches the three helpers.

### 2. Five spellings of "does this scope open this item" (High, backend)

The PRD's module 5 asked for one placement shape and one rule. The branch has `scopeOpensClass` in
`classAccessAuthz.ts:80-94`, a different course-PDF rule in the `notesChapter` branch of `authorizeCourseAccess`
at `:241-245`, `buildOpensClass` in `courseScope.ts:218` (per build, bypassing the union merge; used by the
push audience), `classIdsOpenedByScope` at `:227-248` (which re-implements the topic fallback that
`findCoursesForClass` also implements), and `scopeOpensCourseTest` in `courseTestAccess.ts:20-30`. One pure
`scopeOpens(scope, item)` over a small `ScopedItem` union, plus one placement resolver shared by
`classIdsOpenedByScope` and `findCoursesForClass`, replaces all five. Report 01 §2 has the sketch.

### 3. Build checkout re-types the Razorpay initiation and the admin grant (High, backend)

`buildCheckoutController.ts:55-96` is `orderController.ts:774-835` with the fields renamed: payment log,
`createRazorpayOrder`, payment log, `Order.create` with the same status and gateway fields. `grantBuildForFree`
at `:153-173` is the free branch of `assignPlan` (`orderController.ts:1649-1680`) with `build` in place of the
plan arrays. `generateOrderNumber` is defined for the eighth time. `Order.type: 'course_builder'` is written
twice and read nowhere; every reader discriminates on `build.courseId`. Extract `initiateRazorpayOrder` and
`createAdminGrantOrder` into `order.service.ts`, migrate the legacy controller onto them too (that deletion is
what pays for the extraction), and either read `Order.type` or stop writing it. Report 01 §3.

### 4. Builder mode is a flag threaded through a 1,586-line component (High, admin)

`AssignedClassesView.tsx` grew 1,474 to 1,586. The pixels moved to `CourseBuilderMode.tsx`, but the decisions
stayed: 13 `builderMode` references, eight mode conditionals (lines 822, 861, 960, 1008, 1093, 1134, 1323,
1430), three builder hooks and a handler mounted inside the outline, and three per-level ternaries that decide
which builder cells a section, topic or subtopic header gets. The `builderCells` slot the branch added to
`OutlineHeaderRow` is the right seam; the wrong thing is what is passed into it. Replace the ReactNode slot with
an `OutlineExtension` object (`columnCount, heads, headerCells(node), rowCells(listing), bulkActions, above,
aside, toolbar`) returned by `useBuilderExtension()` or null, so the outline has zero builder literals and
shrinks by about 60 lines instead of growing by 112. Report 03 §1 has the full sketch.

### 5. The build shape is declared three times on the admin (High, admin)

`BuildPrice` in `lib/course-builder.ts:244` is strict; `OrderBuildSummary.breakdown` in `use-orders.ts:20` is
the same object with every field optional, which forces six `Number(… ?? 0)` guards in `OrderBuildCard`; and
`use-course-purchasers.ts:9` carries a third inline union. The extras union is declared three times,
`EXTRA_LABELS` three times, `formatRupees` twice with different rounding, and the order page now prints
rupees at two precisions. `beforeMinimum` is never read. Make `lib/course-builder.ts` the single declaration
site, add a `normalizeBuildPrice` for the order snapshot, and delete the copies. Report 03 §2.

### 6. The notification delivery fork was extended rather than closed (Medium-High, backend)

`notificationTokenDelivery.service.ts` and `advanceNotificationTokenDelivery.service.ts` were already a fork
(`getPaidUserIds`, `isActiveOrderWindow`, `getProductFilterForConnectWith`). The branch patched both with
largely the same hunk: 10 of the roughly 16 added lines are identical, the rest differ only by type name.
`buildBuyers.ts` is not a duplicate of an existing resolver, but it re-runs the `Order` query the caller just
ran with `distinct`. One `notificationAudience/paidBuyers.ts` that both services import, with `buildBuyers`
folded in and a single query, removes about 60 lines and the fork. Report 02 §2.

### 7. The two new controllers are services, and partial ownership has three wire shapes (Medium, backend)

`adminCourseBuilderController.ts` composes the Mongo update literal and repeats the foreign-topic rule that
`prepareBuildOrder` already has. `courseBuilderDataController.ts` runs raw `mongoose.connection.collection`
queries, the only place in the diff that bypasses the models. Both pass a forged `{ role: 'admin' }` principal
to `loadListingRows` where every other caller passes `req.user`. The builder screen emits a third "what you
own" shape (`ownsAll` plus a synthesised full list) beside `courseAccessState`'s spread
`Partial<PartialOwnership>` and `coursePurchasers`' `{ kind: 'build', … }`, and `revisionOnly` means three
things (pick input, snapshot flag, derived wire value). Move the logic into a `courseBuilder.service.ts`,
give `loadListingRows` a `scope: 'all'` option, and emit one nested `Ownership` DTO everywhere. Reports 01 §4
and 02 §4.

### 8. `coursePdfChapter.ts` exists because `CoursePdf` was not given the tag `CourseTest` got (Medium, code judo)

Task 09 added `CourseTest.topic` and a 44-line pure rule. Task 07 instead matches course PDFs to chapters by
normalised topic and section names, with a bespoke 113-line aggregation that re-runs the stages
`loadListingRows` already runs. The admin PDF outline already holds the topic id at filing time
(`libraryTopic.topicId`), and the README lists "unmatched course PDFs on real Vidyagram data" as open, which is
exactly the failure mode of name matching. Add `CoursePdf.topic`, set it on the filing writes, backfill once
with today's matcher, then delete the matcher. The untagged-section fallback in `courseTestAccess` is the same
debt on the test side. Report 02 §5.

### 9. The test gate's auth lives in the controller because the router is unauthenticated (Medium, backend)

`userTestDataRoutes.ts` has 21 routes and had no middleware. The branch bound two routes with different param
shapes to one handler and reconciles token versus URL user inside the controller, duplicating the inline check
in `getMyTimeTable`. A `principalUserIdParam` middleware shared by both removes the second route and both
inline checks. Report 02 §3.

### 10. Watchable classes are computed three ways; `breakdown` is `Mixed`; dead Mongoose validation (Medium, backend)

`userController` (+40 lines, six derived collections in a 300-line handler), `userStatsController` (a parallel
pipeline summed with a legacy one computed under different ownership rules) and `courseController` (a second
`$lookup`) each compute "the classes a user's builds open". One `watchableClasses(userId)` service replaces the
two in-process copies. `Order.build.breakdown` is `Schema.Types.Mixed` though it is always `BuildPrice`, so
`describeBuildOrders` is written over `any` (8 `any`, 5 `as any`); `settingsVersion` is write-only. The
`min`/`required` constraints on the builder subschema never run because the save uses `findOneAndUpdate`
without `runValidators`. Reports 01 §5-7 and 02 §6.

### 11. `CourseBuilderMode.tsx` is three modules; `lib/course-builder.ts` parses text nine times (Medium, admin)

The 536-line file holds state hooks (50-165), a 230-line settings form (167-397) and table cell fragments
(399-536) with 13 exports. Split along those seams, or make the cells private to `useBuilderExtension`.
`useBuilderMode` hand-rolls localStorage where `hooks/use-persisted-state.ts` exists. In the domain module the
all-strings draft forces `fieldNumber` at nine sites and a NaN-to-null trick for zod; one memoised
`draftValues()` lets every rule take numbers. Four walks of sections-to-topics with two `seen` sets collapse to
one `outlineChapters()`. The local chapter-price and 100% rules are bounded and acknowledged, but should be one
function each. Report 03 §3-4.

### 12. Low-severity notes

`AssignedTestsView.saveChapter` is a copy of `saveCustomTag`, and `testChapterOptions` invents its own
"Section › Topic" naming instead of `lib/course-outline.ts`'s `sectionTitle`/`topicTitle`, so one topic can be
named two ways on two tabs. The backend error envelope is read three ways in one admin diff. `courseTestController`
spent 52 lines on one field because the create and reactivate paths must be kept in step by hand; a
`setOrUnset` helper would make the `$set`/`$unset` idiom one line here and in `saveCourseBuilder`. Reports 02 §7
and 03 §5-6.

## Remediation sequence

Ordered so each step deletes callers for the next, and so the backend core lands before the readers that
consume it. Steps 1-3 are the ones worth doing before the next Course Builder feature.

1. **Narrow `courseScope` and add the three reader helpers** (findings 1, 2): one loader, one raw-order adapter,
   `scopeOf`, `scopeOpens`, `orderCourseLines`, `courseOrderMatch`, `ORDER_COURSE_IDS_EXPR`. Migrate the
   thirteen reader sites and the five opens-predicates; `courseAccessState` consumes the same loader. Delete
   `buildOrderMatch`, `buildCourseCountExpr`, `scopeBuild`, `buildOpensClass`, `classIdsOpenedByScope`'s
   private fallback and the forged-order idiom. Resolve the `<` versus `<=` expiry split once.
2. **Extract the order sequences** (finding 3): `initiateRazorpayOrder`, `createAdminGrantOrder` and one
   `generateOrderNumber` in `order.service.ts`; both checkout controllers become thin. Decide `Order.type`.
3. **`courseBuilder.service.ts` and one `Ownership` DTO** (finding 7): controllers shrink to validation and
   status mapping; `loadListingRows` gets `scope: 'all'`; the builder screen emits the course page's ownership
   shape. This is the one step that touches the app contract, so it must land before task 12's handoff freezes
   `isPartial` and `ownsAll`, or carry both for one release.
4. **`paidBuyers.ts`** (finding 6) and **`watchableClasses()`** (finding 10) as two small follow-ups on step 1.
5. **`CoursePdf.topic` with backfill, then delete the name matcher** (finding 8). Needs the live read the
   README already lists as open, so schedule it with that.
6. **Admin: `OutlineExtension`** (finding 4), then **single declaration site in `lib/course-builder.ts`**
   (finding 5), then split `CourseBuilderMode.tsx` and introduce `draftValues()` (finding 11).
7. **`principalUserIdParam` middleware** (finding 9), typing `breakdown` and dropping dead validation
   (finding 10), and the lows (finding 12).

Each step is behaviour-preserving and can be checked with the existing suites plus the baseline files in
`vidyagram/plans/tasks/vidyagram-course-builder/`.
