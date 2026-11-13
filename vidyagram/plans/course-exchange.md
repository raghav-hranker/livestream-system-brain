# Course exchange (Vidyagram): design record

Status: design agreed 2026-10-22. PRD `prd-vidyagram-course-exchange.md` and tasks `tasks/course-exchange/` 01–07 written 2026-10-23. The 10-22 combo count below was wrong (AppX import); see the PRD Further Notes. Vidyagram only (backend and admin branch `vidyagram-admin`).
Reference mock: the app bottom sheet "Exchange course", which shows an eligibility banner, a list of target courses and a CTA.

## Problem

A student who bought a course and barely started it wants a different course instead. Today only an admin can do this,
through `PUT /api/orders/:id/exchange`, and a student must ask support.

## Facts the design rests on (read 2026-10-22)

- Access comes from an Order. Its `planId` is read live against `Plans.course`
  (`courseAccessState.service.ts`, `courseScope.ts`). Students buy plans, not courses.
- On vidyagramdb, about 16k of the 33.5k paid Razorpay orders created in the last 30 days are on plans with 2 or more
  courses. 61 of the 88 active courses are sold by 2 or 3 plans. The window probably includes the 10-22 AppX order
  import. Probe: `reference/scripts/vidyagram-exchange-shape-probe.cjs`.
- `exchangeOrderPlan` (orderController.ts) already rewrites `planId` and the item ids. It keeps `grandTotal` and
  `expireDate` and clears `latestCourseId`. It writes no audit record. Its route has only `authenticateToken`, so any
  student token passes, and it has no owner check. `extend-validity` has the same gap. Both are live on both tenants.
- The Razorpay sync cron re-settles any non-success order whose payment was captured in the last 7 days, and
  restarts its validity. So voiding an order through `orderStatus` does not hold.
- `watchPercentage` (utils/courseProgressUtils.ts) already gives a per-course watch %. Classes with no length can
  inflate it. Migrated AppX history counts 0. `PdfImpression` counts opens per user per PDF. PDF downloads are not
  logged. `UserTestData` has `courseId`.

## Decisions

- **D1. The unit is the order, and only single-course plans can exchange.** The admin sets "Exchange to" on the source
  **plan**, as a list of target plan ids, using the same picker as Upgrade's source plans. The list exists only on
  plans with exactly one course. The backend also refuses to swap any order whose plan holds more than one course. The
  app shows the target course's title and banner, as in the mock. Combo (2+ course) buyers see no Exchange button.
  Combos were ruled out on 10-22: a whole-combo swap that starts from one course's screen surprises the student.
  Swapping one course inside a combo is a later phase, and it depends on the plans question
  (`vidyagram/reports/plans-keep-or-remove-2026-10-22.md`).
- **D2. Straight swap.** No money moves in either direction. The admin decides what is fair through the list. The
  sheet shows no target price. Each row carries a "Free swap" tag instead.
- **D3. Keep the original expiry.** The swap neither adds days nor takes them away.
- **D4. "Used" counts video, PDFs and tests.** A student is eligible when all of these hold:
  - the purchase was within `EXCHANGE_WINDOW_DAYS` (30);
  - the watch % across all the order's courses is below `EXCHANGE_MAX_WATCH_PCT` (5);
  - they made no test attempt in those courses;
  - they opened at most `EXCHANGE_MAX_PDFS_OPENED` of those courses' PDFs. The default of 2 is a guess, so tune it.

  The clock starts at the real purchase date, never the `createdAt` of an imported row.
- **D5. Edit the order in place.** The student route rewrites the order the way `exchangeOrderPlan` does. It also
  writes an `exchange` subdocument: `fromPlanId`, `fromCourseIds`, `at`, `watchPct`, `pdfsOpened`, `testsAttempted`.
  The order stays `success`, so the sync cron and the webhooks leave it alone.
- **D6. Once per order, and idempotent.** The update is conditional on the order still being on the source plan and
  having no `exchange` record. A retry or a double tap is a no-op that returns the current state.
- **D7. Version 1 leaves these orders out.** Apple IAP orders, because an Apple refund would revoke the new course and
  iOS prices are fixed. Also ₹0 and admin-granted orders, AppX-imported orders, upgrade and extension orders, and
  orders already exchanged.
- **D8. Eligibility is computed when the sheet is read, by one policy function.** It returns either a reason or the
  numbers the banner shows: % watched, days since purchase, days left. Nothing is stored ahead of time.
- **D9. Routes.** `GET /api/orders/:id/exchange-options` and `POST /api/orders/:id/exchange-self` take the owner from
  the JWT. The admin `PUT /:id/exchange` and `extend-validity` move behind `requireAdmin` first. That is a separate
  fix on each tenant.
- **D10. The swap is instant.** The student confirms and the target course opens at once. No admin approves it.
- **D11. The old course disappears.** It leaves `my-courses` and stops opening. Order history shows "Exchanged from
  <source course>". The user accepted removing the source course for a student-confirmed swap on 10-22, which settles
  the "never remove granted access" question for this case.
- **D12. An admin can undo a swap.** The admin order page gets "Undo exchange", which restores `exchange.fromPlanId`
  and the source item ids and stamps `exchange.undoneAt` (the record stays, so the order cannot be swapped again by
  the student). Students cannot undo. The undo is conditional, so it
  applies only while the order is still on the target plan.
- **D13. What the target list hides.** It drops targets the student already actively holds and target plans that are
  off-sale (`status` 0).
- **D14. A course held twice.** When two eligible orders grant the same course, the button acts on the newer one.

## Open

- `EXCHANGE_MAX_PDFS_OPENED` default 2 is a guess.
- The app contract: the Flutter sheet needs the options payload shape and the button rule. That is a guide for the
  app team, as with the catalogue-filters guide.
- Prerequisite: lock the admin `PUT /:id/exchange` and `extend-validity` behind `requireAdmin` on Vidyagram.
