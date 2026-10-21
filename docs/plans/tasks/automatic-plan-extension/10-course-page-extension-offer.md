# Course page shows the Extension offer (`by-id-2`)

**Type**: AFK
**Blocked by**: 09 — Course state flags on every course endpoint
**Status**: done 2026-09-25, `aa9025447` (local); 08 re-checked and superseded
**Decisions**: design record D15; ADR 0023 → "Amendment 2026-09-25"; CONTEXT → *Selling price* / *MRP*.

## Why

A lapsed holder opening a course they used to own on the student website sees the list price
(e.g. "jeet roy" on "MATHS SPL FOUNDATION (LIVE + VOD) @": ₹599, "12 Months"), not the half-price
extension they would actually pay on the plan page. The site's "Buy Securely" opens
`/user/plans/{courseId}/{type}`, which is plan checkout and already price-checked by
`admitPlanPurchase`, so the course-page price is **display only**.

## What to build

In `getCourseById2`'s response only (the stored course is never written):

- When the user has an Extension offer (per task 09's `isExtension`) on one or more plans that grant this
  course, take the **cheapest** such offer and set:
  - `discountPrice` = offer price (the "you pay" slot, see CONTEXT *Selling price*)
  - `price` = that plan's list `amount` (the struck-through MRP slot)
  - `validity` = a months string derived from `LAPSED_EXTENSION_DAYS` (183 ⇒ `"6 Months"`; round
    days / 30.44, "1 Month" singular)
- Otherwise the response is unchanged from today (and task 08's derivation, if it lands, still applies).
- Reuse task 09's offer resolution; do not query offers twice per request.

Also re-check task 08 against prod (read-only): the 2026-09-25 backfill (memory `course-price-from-plans`)
set prices on 67 courses. Record in 08 whether it is still needed.

## Acceptance criteria

- [ ] Integration test: lapsed holder with offer ⇒ `discountPrice` = offer, `price` = plan list,
      `validity` = "6 Months", `isExtension: true`; same course for a stranger ⇒ unchanged response;
      two eligible plans ⇒ cheaper offer wins; switch off ⇒ unchanged.
- [ ] The course document in Mongo is unchanged after the request.
- [ ] Suites: failure lists identical to base; `tsc` clean on touched files.
- [ ] Task 08 annotated: still needed or superseded.

## Done (2026-09-25, `aa9025447`)

- `by-id-2`: cheapest eligible Extension offer ⇒ `discountPrice`, that plan's list ⇒ `price`,
  `validity` from `extensionValidityLabel(offer.duration)` (183 ⇒ "6 Months", floor "1 Month"). Stored
  course unchanged (asserted). Two eligible plans: cheaper wins and carries its own plan's list price.
- Task 08 re-checked against prod afterwards: superseded (see 08).
