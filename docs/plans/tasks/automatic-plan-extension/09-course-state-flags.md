# Course state flags on every course endpoint (`is_buy`, `isPaid`, `isExtension`, `isExpired`, `daysLeft`)

**Type**: AFK
**Blocked by**: None, can start immediately
**Status**: done 2026-09-25, `6c744aa86` (local)
**Decisions**: design record D13, D14, D16(b), D17(1–2); fork `CONTEXT.md` → *Effective course expiry*,
*Extension eligibility*, *Retired plan*; ADR 0023 → "Amendment 2026-09-25".

## Why

The app and the website draw a course button from `is_buy` and (new) `isExtension`:
`1/false` Resume · `1/true` buy extension (still holding) · `0/true` buy extension (lapsed) ·
`0/false` never held or expired (the frontend tells these apart with `isExpired`). Today:

- `POST /api/courses/my-courses` (`getUserCourses`) hard-codes `isPaid: {$literal: true}`, `is_buy: {$literal: 1}`,
  so a lapsed course reads "Resume".
- Every other endpoint uses `src/utils/courseUtils.ts` → `addIsPaidToCourses`. It knows nothing about
  expiry dates, and it only counts **active** (`status: 1`) plans, so an active holder of an *inactive*
  plan reads as unpaid (contradicts CONTEXT *Inactive plan*).
- Nothing sends `isExtension`, `isExpired` or `daysLeft`.

## What to build

One read-time rule, a **pure function** (orders + the plans those orders reference + per-plan
"extension offer buyable now" + now → per course state), wired into **every endpoint that sends
`is_buy`**. Do it by **replacing `addIsPaidToCourses`'s body** (keep its name and call sites) plus
`getUserCourses`'s `$literal`s. Don't add a second rule beside it:

- `GET /api/courses/active` (`getCourseData`, ~l.1251)
- `POST /api/courses/filter` + `/batch-filter` (`sendFilteredCourses`, ~l.2117)
- `POST /api/courses/my-courses` (`getUserCourses`)
- `POST /api/courses/by-id-2` (`getCourseById2`; only the flags here, the offer price is task 10)

Per course, for a signed-in user:

- **Effective course expiry** = the furthest expiry among the user's successful orders
  (`orderStatus: 'success'`, `status != 0`) that grant the course. A grant is the order's `courseId` /
  `latestCourseId` snapshot, **or** the `course` list of the order's plan **whatever the plan's status**.
  `Plans.course` is Mixed: match string **and** ObjectId forms (`mixedIdVariants`, memory "plan
  entitlement id cast").
- An order is active/lapsed per `isActiveOrder` / `isExpiredOrder` in `planExtension.service.ts` (do not
  invent a third rule; only 3 of 1.07M prod success orders lack `expireDate`).
- **Retired plans** (`retiredPlan.ts` → `retiredPlanIdsForUser`): their grants are ignored. A course
  reached only through a retired plan reads as **never held**.
- `isExtension` = the user can buy an **Extension offer** right now on at least one plan that grants
  this course. Resolve it through the existing seam, **`resolvePlanOffersForUser` / the offer policy in
  `planOffer.service.ts`**, never a re-implementation. It rides `LAPSED_EXTENSION_ENABLED`: off means
  `false` everywhere. With the window closed (task 12 adds it), it can only be true on an expired course.
  Only an `extension` offer counts, not an `upgrade`.

| State | `is_buy` | `isPaid` | `isExtension` | `isExpired` | `daysLeft` |
|---|---|---|---|---|---|
| Never held / signed out / only via a retired plan | 0 | false | false | false | `null` |
| Resume (active) | 1 | true | false | false | n |
| Expired, offer buyable | 0 | false | true | true | 0 |
| Expired, no offer (switch off, empty or ₹0 plan, inactive never-paid) | 0 | false | false | true | 0 |

`daysLeft` = whole days from now to the Effective course expiry, **rounded up** (expires later today = 1),
`0` when expired, `null` when never held. If an active grant has no computable date (legacy
`daysLeft > 0` with no `expireDate`), send `is_buy: 1` and `daysLeft` = that order's `daysLeft`.

`/my-courses` keeps its current membership (task 07's retired filter stays). Only the flags become truthful.

Performance: `/filter` and `/active` return the whole catalogue. Keep it to a constant number of queries
per request (one orders query for the user, one plans query, and offer resolution only for plans that
grant an **expired** course). No per-course queries.

## Acceptance criteria

- [ ] Pure function with unit tests covering: every table row; furthest-expiry-wins (course on plan A
      10 d left and plan B 200 d left ⇒ Resume, 200); inactive-plan active holder ⇒ `is_buy: 1`;
      retired-only ⇒ never held; ObjectId-and-string `Plans.course`; `daysLeft` rounding (expires in 2 h ⇒ 1).
- [ ] Integration test(s) (`src/tests/integration`, the harness already mounts `courseRoutes`, see
      `retiredPlans.integration.test.ts`) asserting the same flags on `/filter`, `/my-courses`, `/active`
      and `/by-id-2` for one seeded user with an active, a lapsed-with-offer, a lapsed-no-offer and a
      never-held course; switch on vs off flips only `isExtension`.
- [ ] `/my-courses` no longer hard-codes `is_buy: 1`.
- [ ] `npm test` and `npm run test:integration`: failure lists identical to the base commit
      (28 unit / 8 integration pre-existing at `e9d273233`). No new failures. `tsc` clean on touched files.
- [ ] CONTEXT.md unchanged unless a term had to move (the glossary was already updated in the grilling session).

## Done (2026-09-25, `6c744aa86`)

- Pure rule `src/services/courseAccessState.ts` (`courseAccess`, `extensionOfferCandidatePlanIds`), loader
  `courseAccessState.service.ts` (one orders query, one plans query of any status; offers only via
  `resolvePlanOffersForUser`, `extension` kind only). `addIsPaidToCourses` delegates to it.
  `/my-courses` reuses the same records for membership and flags.
- Also changes `GET /api/course-folders/:id/courses` (it calls `addIsPaidToCourses` too). Signed-out
  `/filter` and `/active` now send all five flags as never held (previously only `isPaid: false`).
- Interpretations: `isExtension` only counts a plan whose **current** `course` list holds the course (an
  Extension order snapshots `plan.course`, so a snapshot-only plan would not bring it back). An order with
  a past `expireDate` but `daysLeft > 0` counts as active (follows `isActiveOrder`; **0 such orders on prod**
  2026-09-25).
- Tests: `courseAccessState.test.ts` (23), `courseStateFlags.integration.test.ts` (10). The old case
  "inactive plan grants nothing" in `courseUtilsPlanEntitlement.test.ts` was rewritten (D14 reverses it).
  Combined tip `aa9025447`: unit 1710 / 28 fail, integration 345 / 8 fail (= base), `tsc` clean.
- For task 12: the loader resolves offers only for plans granting an **expired** course. Widen
  `extensionOfferCandidatePlanIds` to plans whose furthest grant is inside the window.
