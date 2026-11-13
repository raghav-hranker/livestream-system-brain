# Thermo-nuclear review 03 — Vidyagram Course Builder, admin UI

Branch `feat/vg-course-builder` in `~/Projects/worktrees/vg-builder-admin`, diff `origin/vidyagram-admin...HEAD`, non-test files only. Read-only review of structure and maintainability; behaviour was not exercised and the suites were not run.

## Verdict

The branch is cleaner than the worst case: Builder mode's rendering lives in two new files, the hook file follows the repo's query-key convention, and the price preview defers the four-step rule to the backend quote endpoint as task 10 asked. But it still grew `AssignedClassesView.tsx` by 112 lines to 1,586, because the *decisions* of Builder mode (which cells a section, merged section, topic, subtopic or class row gets; the preview grid; the bulk-bar buttons; the column count) stayed in the giant component behind eight `builderMode` conditionals, while only the *pixels* moved out. `CourseBuilderMode.tsx` (536 lines) is three modules in one file. `lib/course-builder.ts` keeps a second, local copy of the per-chapter price rule and the 100 % rule beside the quoted one, and the "build" shape is declared three times across the hooks. Six findings follow; the first three are the ones worth acting on before merge.

## 1. Builder mode is a flag threaded through `AssignedClassesView`, not a composition (High)

`components/admin/assign-classes/AssignedClassesView.tsx` went from 1,474 to 1,586 lines. `grep -c builderMode` gives 13; the conditionals keyed on it sit at lines 822 (`{builderMode && assignedClasses.length > 0 && <BuilderSettingsStrip …>}`), 861 (the Preview button), 960 (`{builderMode && <BuilderColumnHeads …>}`), 1008, 1093 and 1134 (three `builderCells={!builderMode ? undefined : (…)}` ternaries, one per header level), 1323 (the class row's `BuilderEmptyCells` + `BuilderRevisionSwitchCell`) and 1430 (the two bulk-bar buttons). Beside the flag, `AssignedClassesOutline` now mounts three builder hooks and five derived values (lines 423–432: `useBuilderMode`, `useCourseBuilderDraft`, `useRevisionMarks`, `builderExtras`, `columnCount`, `isPreviewOpen`, `showPreview`, `revisionCountOf`), one handler (`markTickedRevision`, 504–509), and a layout wrapper for the preview grid (823, 1499–1508). The import block at 91–107 pulls twelve names from `CourseBuilderMode`.

The branch did add a slot — `builderCells?: React.ReactNode` on `OutlineHeaderRowProps` (line 161, rendered at 218) — which is the right move. The trouble is what is passed *into* the slot. The decision of which cells a header gets is made at the call site, in the giant file, three times:

```tsx
// line 1008 — section header
builderCells={!builderMode ? undefined : (
    <>
        {merged && mergedTopic?.topicId
            ? <BuilderChapterCells state={builder} topicId={mergedTopic.topicId} path={sectionName} />
            : <BuilderSectionCells state={builder} topicIds={section.topics.flatMap((topic) => (topic.topicId ? [topic.topicId] : []))} />}
        <BuilderRevisionCountCell count={revisionCountOf(section.topics.flatMap((topic) => topic.groups.flatMap((group) => group.listings)))} />
    </>
)}
// line 1093 — topic header: topicId ? ChapterCells : UnfiledCells, plus a count
// line 1134 — subtopic header: EmptyCells + empty count
```

So "Builder mode" is a mode flag inside an already-too-large component, and every future column the builder gains (the PRD's toggles, a per-chapter preview link) will add another conditional to each of the five row kinds here. The test file for this component is 2,449 lines because the only way to test Builder mode is to mount the whole outline.

**Remedy.** Turn the slot from "a ReactNode" into "an extension object" computed once, and make `AssignedClassesOutline` know nothing about builders — only that an extension may add columns, a strip above, an aside, and bulk actions. The extension knows the outline's node shapes, so the per-level ternaries move with it:

```tsx
// lib/outline-extension.ts (or next to CourseBuilderMode)
export interface OutlineExtension {
    columnCount: number
    heads: React.ReactNode
    headerCells(node: { level: "section" | "topic" | "subtopic"; section: CourseOutlineSection; topic?: CourseOutlineTopic; path: string }): React.ReactNode
    rowCells(listing: CourseClassListing, title: string): React.ReactNode
    bulkActions(selectedPlacementIds: string[]): React.ReactNode
    above?: React.ReactNode   // the settings strip
    aside?: React.ReactNode   // the price preview, when open
    toolbar?: React.ReactNode // the Preview button
}

// CourseBuilderMode.tsx
export function useBuilderExtension(courseId: string, sections: CourseOutlineSection[], assignedCount: number): OutlineExtension | null {
    const [on, setOn] = useBuilderMode()
    …                                   // all of today's lines 423–432 and 504–509 move here
    if (!on) return null
    return { columnCount: BUILDER_COLUMN_COUNT, heads: <BuilderColumnHeads …/>, headerCells: (node) => …, rowCells: …, bulkActions: …, above: …, aside: …, toolbar: … }
}

// AssignedClassesView.tsx — the only builder-aware lines left
const ext = useBuilderExtension(courseId, sections, assignedClasses.length)
const columnCount = COLUMN_COUNT + (ext?.columnCount ?? 0)
…
{ext?.above}
<TableHead …>Active</TableHead>{ext?.heads}
<OutlineHeaderRow … builderCells={ext?.headerCells({ level: "section", section, path: sectionName })}>
…
{ext?.rowCells(listing, rowTitle)}
…
{ext?.bulkActions(selectedPlacementIds)}
```

That removes every `builderMode` literal and the three ternaries from the file (net −60 lines instead of +112), gives `useBuilderExtension` a 30-line test seam that does not need the outline mounted, and leaves `OutlineHeaderRow` with a slot it can also lend to the next cross-cutting column (the PRD's chapter-toggle pricing is the obvious one). The `BuilderModeSwitch` itself can stay in the toolbar as `ext`'s `toolbar` plus one switch, or be lifted into `AssignedClassesView` (the thin wrapper at line 341) so the outline never sees the flag at all.

## 2. Three copies of the "build" shape, three `EXTRA_LABELS`, two `formatRupees` (High)

The same backend types are hand-declared in three places with three levels of strictness:

- `lib/course-builder.ts:244` `BuildPrice` — the backend's `priceBuild` result, all fields required (`lines, share, chaptersSubtotal, capped, revisionDiscount, extrasOff, beforeMinimum, final, atMinimum`). `beforeMinimum` is never read on the client (`grep -rn beforeMinimum components hooks lib` outside this file: nothing).
- `hooks/api/use-orders.ts:20` `OrderBuildSummary.breakdown` — the same object with every field optional (`share?: number; chaptersSubtotal?: number; … final?: number`) and `| null`, so `OrderBuildCard.tsx:35–37` has to write `build.breakdown ?? {}`, `Number(breakdown.chaptersSubtotal ?? 0)`, `Number(breakdown.capped ?? subtotal)` and later `Number(breakdown.share ?? 0)`, `Number(breakdown.revisionDiscount ?? 0)`.
- `hooks/api/use-course-purchasers.ts:9` `{ kind: 'build'; chapters: number; revisionOnly: boolean; extras: ('notes' | 'tests')[] }` — a third, inline union.

The extras union itself is declared three times: `ExtraKey = "notes" | "tests"` (`lib/course-builder.ts:39`), `BuildExtra = 'notes' | 'tests'` (`hooks/api/use-orders.ts:18`), and the inline literal in `use-course-purchasers.ts:9`. `EXTRA_LABELS` is declared three times: `lib/course-builder.ts:61` (`Record<ExtraKey, string>`), `components/admin/OrderBuildCard.tsx:17` (`Record<string, string>`, which is why line 126 needs `EXTRA_LABELS[off.extra] ?? off.extra`), and `components/admin/CoursePurchasersList.tsx:30` (`as const`). `formatRupees` is declared twice with different rounding: `lib/course-builder.ts:183` (sign-aware, 2 dp) and `OrderBuildCard.tsx:14` (`Number(amount ?? 0)`, 2 dp), while the card sitting directly above it on the same page uses `OrderDetail.tsx:32 formatCurrency` at 0 dp — the order page now prints rupees two ways.

**Remedy.** `lib/course-builder.ts` already is the domain module; make it the only declaration site. Export `BUILD_EXTRAS = ['notes','tests'] as const`, `BuildExtra`, `EXTRA_LABELS`, `formatRupees`, `BuildPrice`, and a `normalizeBuildPrice(raw): BuildPrice | null` that turns the order snapshot into the same strict type the preview uses. Then `OrderBuildSummary.breakdown: BuildPrice | null`, `OrderBuildCard` loses its six `Number(… ?? 0)` guards and its private `formatRupees`/`EXTRA_LABELS`, `CoursePurchaseSource` reuses `BuildExtra[]`, and `buildLabel` in `CoursePurchasersList` imports the labels. Drop `beforeMinimum` from the client type or read it; a field nobody reads in a hand-copied type is how the two sides drift silently.

## 3. `CourseBuilderMode.tsx` is three modules in one file (Medium)

The 536-line file has 13 exports and three unrelated responsibilities, each with its own imports and test surface:

1. **State hooks**, lines 50–165: `useBuilderMode` (localStorage toggle), `useCourseBuilderDraft` (query + draft + save + error), `useRevisionMarks` (optimistic pending map + mutation). No JSX except none; these are `hooks/` material.
2. **The settings strip**, lines 167–397: `RupeeInput`, `SettingField`, `WeightsTotalChip`, `BuilderSettingsStrip` — a 230-line form.
3. **Outline cells**, lines 399–536: `BuilderColumnHeads`, `BuilderChapterCells`, `BuilderSectionCells`, `BuilderUnfiledCells`, `BuilderRevisionCountCell`, `BuilderRevisionSwitchCell`, `BuilderEmptyCells` — table fragments that only make sense inside `AssignedClassesView`'s `<Table>`.

`AssignedClassesView` imports twelve of the thirteen; `BuilderPricePreview` imports only the `CourseBuilderDraftState` type. Split along those seams: `hooks/use-course-builder-draft.ts` (hooks 1), `BuilderSettingsStrip.tsx` (2), `BuilderOutlineCells.tsx` (3) — or, with finding 1, the cells become private to `useBuilderExtension` and stop being exported at all. Two smaller points in the same file:

- `useBuilderMode` (lines 51–66) hand-rolls localStorage with two try/catch blocks and a mount effect. The repo has `hooks/use-persisted-state.ts`, whose header explains why it deliberately avoids storage (hydration). Task 02 says the mode "*may* be remembered per browser", so `usePersistedState("builder-mode", false)` would satisfy it in one line and match the other list screens; if cross-reload memory is wanted, add that to `usePersistedState` once rather than here.
- `useCourseBuilderDraft` line 89 and `BuilderPricePreview` line 70 both use the set-state-during-render idiom (`if (query.isSuccess && loaded.from !== query.data) setLoaded(…)`). The base file uses the same idiom at line 148 (`hasOpenedOutline`), so it is a house pattern, not a regression; noting it only so nobody "fixes" one copy.

## 4. `lib/course-builder.ts`: the pure domain module is good, but it carries a second price rule and parses text nine times (Medium)

The file is what it says: pure, typed, no React, and the preview section (lines 230–322) correctly treats the price as the backend's (`BuildQuote` from `POST …/builder/quote`). That answers the task-10 question: the drawer carries no price math.

What the file *also* carries is a local copy of the per-chapter rule and of two save rules, for the outline columns and strip that render on every keystroke:

- `chapterPrice` (line 168): `custom ?? maxPrice × weight / 100` — the backend's `chapterPrice` in `services/buildPricingPolicy.ts:62`, minus the backend's `toPaise`.
- `chaptersTotals` (177) and `wholeCourseLine` (196): Σ chapter price and `max − Σ offered extras' value` — the backend's `subtotal` and `extrasOff` sum (`buildPricingPolicy.ts:75, 80–86`) for the two trivial picks.
- `isWeightsTotalComplete` (165, `|total − 100| < 0.001`) and `sellBlocked = unfiled > 0 && !draft.enabled` (`CourseBuilderMode.tsx:279`) — `courseBuilderError`'s rules at `utils/courseBuilderConfig.ts:60` and `:88`.

This is bounded (about 25 lines) and the header comment at lines 6–8 is honest about it, so I would not call it wrong; a column that re-prices per keystroke should not round-trip. But the file should say which rule is authoritative *for which cell*, and the duplication should be one function, not three: `chaptersTotals.price` can be `topicIds.map(chapterPrice).sum`, and `wholeCourseLine`'s off-sum is the same `offeredExtras(draft)` walk that `offeredExtrasLabel` (190), `defaultPreviewPicks` (303) and `buildQuoteBody` (314) each redo with `EXTRA_KEYS.filter((key) => draft.extras[key].offered…)`. One `offeredExtras(draft): ExtraKey[]` helper deletes four filters.

The larger smell is the text draft. `BuilderDraft` keeps every number as a string (so a field can be empty), and the consequence is `fieldNumber(...)` at nine call sites (`weightsTotal`, `chapterPrice` ×3, `chaptersTotals`, `builderSaveBody` ×3 plus `numberOrNaN`, `previewChapterGroups`, `pricedChapterIds`, `wholeCourseLine` ×2) and the `numberOrNaN → NaN → JSON null → zod names the field` trick at lines 206–227. A single `draftValues(draft): { minPrice: number|null, maxPrice: …, weights: Record<string, number|null>, … }` memoised in `useCourseBuilderDraft` would let every rule below it take numbers, and `builderSaveBody` becomes a one-line map over that (with the `?? NaN` in one place). Same behaviour, fewer parse sites, and the rules become testable with plain numbers.

Four separate walks of `sections → topics → topicId once` exist in this file: `outlineChapterIds` (89), `testChapterOptions` (105, own `seen` Set), `unfiledClassCount` (128), `previewChapterGroups` (282, own `seen` Set). One `outlineChapters(sections): { sectionId, sectionName, topicId, topicName }[]` (de-duplicated once) would feed all four and delete both `seen` Sets.

## 5. Chapter tag on Assign Tests: a copied handler and a second naming rule (Low)

`AssignedTestsView.tsx:105–111 saveChapter` is `saveCustomTag` (96–103) with the field name changed:

```ts
const saveCustomTag = (t, tag) => { if (tag === (t.customTag ?? '')) return; updateMutation.mutate({ courseId, testId: t.testId, customTag: tag }, { onSuccess: …, onError: … }) }
const saveChapter   = (t, topicId) => { if (topicId === (t.topicId ?? '')) return; updateMutation.mutate({ courseId, testId: t.testId, topicId: topicId || null }, { onSuccess: …, onError: … }) }
```

A `saveField(t, patch, title)` collapses both and the next per-row field. More important: `testChapterOptions` (`lib/course-builder.ts:105`) builds "Section › Topic" labels with its own fallbacks (`"Untitled chapter"`, `"Unknown chapter"`, `section.sectionName ? … : name`), while `lib/course-outline.ts:46–49` already exports `sectionTitle` and `topicTitle` (`"Untitled topic"`, `"No topic"`) that `AssignedClassesView` uses for the same nodes. The same topic can now be named two ways on two tabs of one course. `testChapterOptions` should call those two helpers (and, with finding 4, iterate `outlineChapters`). Nothing else is duplicated between the two views for this task: the tag is correctly a backend field (`topicId` on the assignment) and `use-course-tests.ts` only threads it.

## 6. Hooks: conventions mostly followed; three spellings of the error envelope and a stringify-debounce (Low)

`hooks/api/use-course-builder.ts` follows the neighbour's shape well: a `courseBuilderKeys` object like `courseClassKeys`, typed `queryFn` returns, no `any`, no normalise layer (the backend's `serializeBuilder` already returns the exact `CourseBuilderSettings` shape), `setQueryData` on save instead of a blanket invalidate, and `useSetPlacementsRevision` patching the outline cache through the pure `withPlacementsRevision`. `useGrantBuild` toasts inside the hook, which is `use-orders.ts`'s own convention (lines 362–395), so the two styles are each consistent with their file. Three small things:

- The backend error envelope is read three ways in one diff: `result.msg` (`use-course-builder.ts:42, 61, 82`), `errorData.message || errorData.msg` (`use-course-tests.ts:271`), `body.message || body.msg` (`use-orders.ts:326`). The controller only ever sends `msg`. One `readError(response, fallback)` in `lib/utils` next to `authGet` ends this.
- `useSaveCourseBuilder:42` and `useSetPlacementsRevision:61` throw `Object.assign(new Error(…), { status })`; nothing reads `.status`.
- `BuilderPricePreview.tsx:76–80` debounces by `JSON.stringify(body)` then `JSON.parse`s it back and feeds the object into the query key. The comment explains why (an equal draft re-rendered is a new reference). But `draft` and `picks` are state objects that only change on edits and `chapterIds` is already memoised, so `useMemo(() => buildQuoteBody(draft, chapterIds, picks), [draft, chapterIds, picks])` is reference-stable per edit and `useDebounce(body)` works directly; the stringify/parse pair and the `sentText !== bodyText` staleness check become `sent !== body`.

## Measurements

```
$ wc -l (worktree, HEAD)
 1586 components/admin/assign-classes/AssignedClassesView.tsx   (base 1474, +112)
  536 components/admin/assign-classes/CourseBuilderMode.tsx     (new)
  243 components/admin/assign-classes/BuilderPricePreview.tsx   (new)
  322 lib/course-builder.ts                                     (new)
   92 hooks/api/use-course-builder.ts                           (new)
  176 components/admin/OrderBuildCard.tsx                       (new)
  483 components/admin/assign-tests/AssignedTestsView.tsx       (+30)
  493 hooks/api/use-orders.ts                                   (+56)
 2449 components/admin/assign-classes/AssignedClassesView.test.tsx

$ git diff --stat origin/vidyagram-admin...HEAD   → 19 files, +2452 −14

$ grep -c builderMode  AssignedClassesView.tsx    → 13
$ grep -c builderCells AssignedClassesView.tsx    → 6
$ grep -n "builderMode &&\|!builderMode ?\|builderMode ?" AssignedClassesView.tsx
  822, 861, 960, 1008, 1093, 1134, 1323, 1430     → 8 mode conditionals
$ grep -n "^export" CourseBuilderMode.tsx | wc -l  → 13 exports; AssignedClassesView imports 12

$ grep -rn "EXTRA_LABELS\s*[:=]" components hooks lib (non-test)
  lib/course-builder.ts:61, components/admin/OrderBuildCard.tsx:17, components/admin/CoursePurchasersList.tsx:30
$ grep -rn "formatRupees = " → lib/course-builder.ts:183, OrderBuildCard.tsx:14 ; OrderDetail.tsx:32 formatCurrency (0 dp)
$ grep -rn "'notes' | 'tests'\|\"notes\" | \"tests\"" → lib/course-builder.ts:39, hooks/api/use-orders.ts:18, hooks/api/use-course-purchasers.ts:9
$ grep -rn beforeMinimum components hooks lib (excluding lib/course-builder.ts, tests) → none
$ grep -c "fieldNumber(" lib/course-builder.ts → 12 (9 distinct call sites outside its definition)
$ grep -n "\.msg\|\.message" hooks/api/use-course-builder.ts hooks/api/use-course-tests.ts hooks/api/use-orders.ts → three envelope spellings (see finding 6)

Backend reference (read-only): services/buildPricingPolicy.ts 109 lines (chapterPrice at :62, extrasOff :80–86);
utils/courseBuilderConfig.ts 93 lines (100 % rule :60, unfiled rule :88); controllers/adminCourseBuilderController.ts 247 lines.
```

## Verified / not verified

Verified by reading at HEAD and at `origin/vidyagram-admin`: every line reference above; the `builderCells` slot's three call sites; the three type declarations of the build shape and of the extras union; that `beforeMinimum` and the thrown `status` are unread; that `sectionTitle`/`topicTitle` exist in `lib/course-outline.ts` and are not used by `testChapterOptions`; that `usePersistedState` exists and is in-memory by design; that the backend's `priceBuild`, `courseBuilderError` and `serializeBuilder` match the client's `chapterPrice`, 100 % check, unfiled check and `CourseBuilderSettings` type.

Not verified: no test suite was run and no browser was opened, so the two refactors proposed (the outline extension object, the numeric draft) are sketched, not proven to keep the 2,449-line test file green; whether `useDebounce(body)` on a memoised object is reference-stable in practice depends on `useCourseBuilderDraft.update` always producing a new draft object (it does: `{ ...current, draft: change(current.draft) }`), which I read but did not execute; the task-02 mockup link was not opened, so whether the in-outline columns were mandated by design or chosen here is taken from the task text ("Topic rows gain Weight %, Custom ₹ and Chapter price"), which does mandate them — finding 1 is about where the decision code lives, not about the columns themselves.
