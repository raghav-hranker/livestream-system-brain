# Eligibility policy, usage reader and exchange options

**Type**: AFK
**Blocked by**: 02
**Repo**: backend

## What to build

A student asks "can I exchange this order, and for what?" and gets the banner numbers and the target list.
Nothing is written.

- **Exchange policy.** A pure module with one entry point. It takes the order facts, the source plan's
  shape, the usage numbers, now and the config. It returns either `{ eligible: true, watchedPct,
  daysSincePurchase, daysLeftToExchange }` or `{ eligible: false, reason }`. The reasons are checked in the
  PRD's fixed order:
  `not_owner`, `order_inactive`, `excluded_order_kind`, `combo_plan`, `no_targets`, `already_exchanged`,
  `window_passed`, `watched_too_much`, `test_attempted`, `pdfs_opened`.
  - The excluded order kinds are: Apple, total 0, admin-assigned or free, AppX import, upgrade, extension
    and build.
  - The purchase time is `expireDate − duration` days, falling back to `createdAt` when `duration` is
    missing.
- **Usage reader.** It returns `{ watchedPct, pdfsOpened, testsAttempted }` for one user and course.
  - The watch % reuses the existing course watch-time calculation, with classes that have no length
    counted 0 in both the watched time and the total.
  - PDFs opened counts the distinct course PDFs that have a `PdfImpression` for the user.
  - Tests attempted counts `UserTestData` rows with that `courseId`.
- **Config.** It is read in one place: `EXCHANGE_ENABLED` (default false), `EXCHANGE_WINDOW_DAYS` (30),
  `EXCHANGE_MAX_WATCH_PCT` (5) and `EXCHANGE_MAX_PDFS_OPENED` (2).
- **Route.** `GET /api/orders/:id/exchange-options` sits behind `authenticateToken`, with the user taken
  from the JWT. Another user's order returns 404, and so does any request while `EXCHANGE_ENABLED` is off.
  It returns the PRD wire shape, including the source course and `targets` with plan id, course id, title
  and banner.
  - The targets drop plans the student already actively holds, plans with `status` 0, and plans that are
    no longer single-course.

## Acceptance criteria

- [ ] Unit (table-driven): each reason fires on its own fixture.
- [ ] Unit: with two reasons true, the earlier one wins.
- [ ] Unit: the boundaries 4.9% vs 5.0%, day 30 vs 31, and 2 vs 3 PDFs.
- [ ] Unit: purchase time from `expireDate − duration`, not `createdAt`.
- [ ] Unit (usage reader): a class with no length does not raise the %; a PDF opened twice counts once;
      a test in another course does not count.
- [ ] Integration: an eligible student gets eligible options with the right numbers. The targets exclude a
      plan they hold and a `status` 0 plan.
- [ ] Integration: combo, Apple, ₹0, APX and expired orders each return `eligible: false` with the right
      reason.
- [ ] Integration: another user's order returns 404, and with the flag off the route returns 404.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 2, 3, 4, 5, 6, 7, 8, 16, 17, 23, 32, 35, 36
