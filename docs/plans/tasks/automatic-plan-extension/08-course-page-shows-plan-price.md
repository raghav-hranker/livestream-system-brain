# Course page shows the real price, not ₹0

**Type**: AFK
**Blocked by**: none (independent of the offer; can ship before or after 04)
**Status**: wontfix (superseded 2026-09-25 by the course price backfill)

## Why

The student website's course page (thedhronas, `pages/user/courses/[slug]/[id]/index.tsx`) prints
the price from `POST /api/courses/by-id-2` (`getCourseById2`): selling price =
`discountPrice || price`, shown as `₹{sellingPrice}` beside "Buy Securely". When the course carries
no price of its own, the card reads **₹0**. The site also flags admission as closed whenever
`price` is falsy.

On prod, **72 of 123** courses have no price and aren't free, and **67** of those are sold through
an active paid plan. The price only exists on the plan. Example: course `6a455fa5…c650` "MATHS SPL
FOUNDATION (LIVE + VOD) @" has `price: null`, `discountPrice: 0`, `apxPrice: -1` (an APX price
sentinel); plan `6a4e2c13…18b7` sells it at ₹599 / 365 days.

Read CONTEXT.md → **Selling price** / **MRP** first: `Course.discountPrice` is the "you pay" slot
and `Course.price` is the struck-through MRP slot, which is the opposite of what the names suggest.

## What to build

Derive the price on read. Don't backfill it: the APX course sync owns those fields and would
overwrite a backfill.

- In `getCourseById2`'s response, when the course is not free (`isFree !== true`) and has no
  positive selling price, fill `discountPrice` **and** `price` with the lowest `amount` among
  **active** (`status: 1`), paid (`amount > 0`) plans whose `course` contains this course (use
  `mixedIdVariants`: `Plans.course` is Mixed, see memory "plan entitlement id cast"). Filling both
  keeps the site from showing a fake strike-through and clears its "admission closed" flag.
- Leave a course that has its own positive price untouched, and a course that no active paid plan
  sells untouched (it keeps today's behaviour).
- The stored document never changes; this is a response-shaping step.
- Also do this for the course listing endpoints the site renders price tiles from, if they read the
  same fields. Find them from the site's `CommonAPIService.ts`, and put the derivation in one
  helper so they can't drift.

This is the list price every visitor sees. A lapsed holder's renewal price is shown on the plans
page (the Extension offer), not here. An optional "Renew for ₹400" line on the course page is a
site change for the client team and is out of scope.

## Acceptance criteria

- [ ] Unit (helper): no own price + one active paid plan ⇒ that plan's amount; two plans ⇒ the
      lower; only inactive or ₹0 plans ⇒ unchanged; own positive `discountPrice` ⇒ unchanged;
      `isFree: true` ⇒ unchanged; string vs ObjectId course ids in `Plans.course` both match.
- [ ] Integration: `POST /api/courses/by-id-2` for a fixture shaped like `6a455fa5…` returns
      `discountPrice: 599` and `price: 599`, and the course document in Mongo is unchanged.
- [ ] Every listing endpoint changed gets the same integration check.
- [ ] Prod acceptance (with 04 or on its own deploy): the SPL Foundation course page shows ₹599 and
      "12 Months validity"; a course with its own price shows the same as before.

## Superseded (2026-09-25)

Prod re-check (read-only, secondary): 123 courses; only **5** are not free and have no positive
`price`/`discountPrice`, and **none** of those 5 is sold by an active paid plan. So they correctly read
"admission closed". The 67 plan-sold courses got stored prices from the 2026-09-25 backfill (memory
`course-price-from-plans`). The lapsed holder's half price on the course page is task 10. Caveat: a
course created later without a price and sold only through a plan will show ₹0 again; reopen this
(response-side derivation) if that starts happening.
