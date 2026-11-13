# 14 — eBooks extra, validity tiers, Revision only paused

Type: AFK (backend + admin). Tenant: **Vidyagram** (customer 781). Asked 2026-11-12 by the user, with a
screenshot of the student builder footer: extras `Notes ₹50 · Online tests ₹50 · eBooks ₹49` and a validity
menu `1 month · −₹50 … 1 year · Included … Lifetime · +₹100`.

Working copies (cut from `origin/vidyagram-admin` on 2026-11-12, branch `feat/vg-builder-ebooks-validity`):
- backend `~/Projects/worktrees/vg-bldv2-backend` (base dccee8feb)
- admin `~/Projects/worktrees/vg-bldv2-admin` (base 1238159f)

Task worktrees (where the work happens; `scripts/qt-tasks.sh mkwt vg-bldv2 14`): `vg-bldv2-backend-14`,
`vg-bldv2-admin-14`, branch `feat/vg-builder-ebooks-validity-14`; merged back with `qt-tasks.sh merge vg-bldv2 14`.

Baselines: `baseline-backend-v2.txt`, `baseline-admin-v2.txt` in this folder (fresh, from those bases).
Nothing is pushed or deployed from this task.

## What changes

### 1. Notes and eBooks are two extras

- **Notes** = the notes attached to each class (class notes, `ClassContentKind 'notes'`). Unchanged rule:
  a class's notes open when the chapter opens the class AND the build kept Notes on.
- **eBooks** (new extra, key `ebooks`) = the separate PDFs attached to the course (course PDFs, served by
  `issuePdfAccess` → `authorizeCourseAccess` → `ctx.notesChapter`). Today that path checks
  `scope.extras.has('notes')`; it must check `ebooks` instead. The chapter matching stays as it is
  (a course PDF opens when its chapter is bought).
- Old builds keep what they paid for: a build snapshot **without** `build.rules` (every order written before
  this task) whose `extrasOn` has `notes` also opens course PDFs. New snapshots carry `build.rules: 2` and
  open course PDFs only with `ebooks`. Do this once, in `scopeBuild` / `courseScopeFromOrders`
  (src/services/courseScope.ts), so every reader inherits it.
- `BUILD_EXTRAS` becomes `['notes', 'tests', 'ebooks']`. Everything keyed on it follows: settings schema
  (`extras.ebooks`, same `{ offered, value, defaultOn }`), Course model, Order `extrasOn` enum, picks
  schemas (error text "An extra must be notes, tests or ebooks."), `EXTRA_LABEL` (`ebooks: 'eBooks'`), the
  save rule that the switched-off values fit in max − min, the builder GET response, partial ownership's
  `ownedExtras`, the purchasers / order-view readers.
- Settings saved before this task have no `extras.ebooks`: read it as `{ offered: false, value: 0, defaultOn: false }`.
  The PUT accepts a body without `extras.ebooks` (same default) so an old admin build does not 400.

### 2. Validity tiers

Settings gain `builder.validity`:

```ts
validity: {
  included: ValidityKey;                       // the tier the maximum price buys
  options: { key: ValidityKey; offered: boolean; priceChange: number }[];  // priceChange in ₹, may be negative
}
type ValidityKey = '1m' | '3m' | '6m' | '1y' | '2y' | '3y' | '4y' | '5y' | 'lifetime';
```

Fixed list, one source of truth (backend `src/services/buildValidity.ts` or inside buildPricingPolicy; admin
mirrors it in `lib/course-builder.ts`):

| key | label | days |
|---|---|---|
| 1m | 1 month | 30 |
| 3m | 3 months | 90 |
| 6m | 6 months | 180 |
| 1y | 1 year | 365 |
| 2y | 2 years | 730 |
| 3y | 3 years | 1095 |
| 4y | 4 years | 1460 |
| 5y | 5 years | 1825 |
| lifetime | Lifetime | null (no expiry) |

- Unset (every course saved before this task) = `{ included: 'lifetime', options: [lifetime offered, ₹0] }`,
  which is today's behaviour (builds never expire). The PUT accepts a body without `validity` (same default).
- Save rules (first broken one is the message, in the existing style):
  - the included tier is offered; its `priceChange` is 0;
  - no key twice, keys only from the list;
  - every negative `priceChange` is smaller in size than the minimum price, so no build can cost ₹0 or less
    ("1 month takes off ₹150, which must be less than the minimum price (₹149).").
- **Pricing (user, 2026-11-12: "minimum is a floor"):** `final = round(max(max(price, minPrice) + priceChange, minPrice))`.
  A cheaper tier never takes a build below the minimum; a longer tier adds its change on top of the price raised to
  the minimum, so it is never free. (First built as "after the minimum, may go below"; changed in backend 3b55cb335,
  admin b4f69302.) Listing `builderFromPrice` stays the minimum. `priceBuild` takes `picks.validity`
  (a key; missing = the included tier) and returns `validity: { key, label, days, priceChange }` in the breakdown.
  `struckOutPrice` scales from the final as before.
- Picks (checkout, free grant, admin quote): optional `validity` key. Missing = included. A key the course does
  not offer → 400 "This course does not offer {label} validity."
- Snapshot: `build.validity = { key, days, priceChange }` (days null for lifetime) and `build.rules: 2`.
- Expiry: the build order is created with `duration: days ?? 0` and `durationType: 'days'`. Every success path
  already stamps `expireDate = now + duration` (razorpayController webhook, orderController `successValidity`),
  so a paid build expires; lifetime keeps no expiry. The free grant (`POST /api/orders/build-grant`) is written
  successful directly: stamp `expireDate`/`daysLeft` there from the same days. Update the "no expiry" comment.
- Builder GET (`GET /api/courses/:id/builder`) adds
  `validity: { included, options: [{ key, label, days, priceChange }] }` listing **offered tiers only**, in list
  order, and `validityDays` = the included tier's days (null for lifetime) — the field the app already waits for
  (app `doc/pending_apis/courses.md` §4.4).
- Listing `builderFromPrice` (src/services/courseBuilderOffer.ts) stays `minPrice` (the floor).
- Order view / purchasers: show the validity ("Validity: 1 year (included)" / "6 months, −₹25").

### 3. Revision only is paused

The user: "for now comment out the revision mode functionality". Pause it, keep the code:

- One flag `REVISION_ONLY_PAUSED = true` (backend, next to `priceBuild`; admin, in `lib/course-builder.ts`),
  with a comment saying it was paused 2026-11-12 and how to bring it back.
- Backend while paused: the builder GET sends `revisionOnly: { offered: false, discount: 0 }`; checkout, grant
  and quote refuse `revisionOnly: true` with the existing "does not offer Revision only" 400; the PUT stores
  `revisionOnly.offered: false` whatever it is sent (keep `discount`). Access for builds already bought as
  Revision only is untouched (`chapterOpensClass` stays).
- Admin while paused: the "Revision only" control in the Course Builder settings strip, the Revision only
  switch in the price preview drawer, and Builder mode's revision column / "Mark as revision" / "Unmark
  revision" buttons are hidden behind the flag (comment, not delete). Order view still shows Revision only on
  an old build that has it.

### 4. Admin screens

- Course Builder settings (`components/admin/assign-classes/CourseBuilderMode.tsx`, `lib/course-builder.ts`,
  `hooks/api/use-course-builder.ts`): an **eBooks** row beside Notes and Tests (Offered · value off · on by
  default), and a **Validity** block: the nine tiers in a compact table, each with Offered, a ₹ change field
  that takes negatives (shown as −₹50 / +₹100), and an Included radio (the included row's ₹ field is fixed at
  "Included"). The client-side save checks mirror the backend's messages.
- Price preview drawer (`BuilderPricePreview.tsx`): an eBooks switch and a validity select listing the offered
  tiers as `1 month · −₹50` / `1 year · Included` / `Lifetime · +₹100` (as in the student screenshot), default
  the included tier; the quote shows the validity line.
- Order build card (`OrderBuildCard.tsx`) and purchasers list: eBooks label and the validity line.
- Keep the admin's quiet look; no new colours. `DialogContent` needs `grid-cols-1` if you touch a dialog.

## Done when

- Backend: unit tests for the validity save rules, `priceBuild` with each tier (incl. at-minimum + negative,
  lifetime +), the legacy-notes-opens-PDF rule vs `rules: 2`, ebooks gating course PDFs, revision paused
  (GET/checkout/PUT). Integration tests updated where the builder/checkout responses changed.
  `npx tsc --noEmit` clean apart from the baseline; suites print `NO NEW FAILURES` against
  `baseline-backend-v2.txt`.
- Admin: `lib/course-builder.test.ts` + `BuilderPricePreview.test.tsx` cover ebooks and validity; tsc clean apart
  from baseline; suites `NO NEW FAILURES` against `baseline-admin-v2.txt`.
- Each side committed on `feat/vg-builder-ebooks-validity` in its worktree as raghavsharma@hranker.com, no
  co-author trailer, no dist commit, admin `config.ts` untouched.

## Not in this task

App changes (the app team reads the new fields from the updated app guide), deploy, the unmerged
"Build a course" playground (`feat/vg-course-playground`) which will need the same three changes when it is
rebased.
