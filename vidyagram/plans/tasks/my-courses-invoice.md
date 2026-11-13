# My courses: invoiceId and invoice per course

**Type**: AFK
**Blocked by**: None
**Repo**: backend (Vidyagram, branch `vidyagram-admin`)
**Status**: done, deployed 2026-10-26 (vidyagram-admin 9716d1d5b). Shape changed after review to `invoiceId` + `invoiceDownloadUrl`; see the guide.

## What to build

`POST /api/courses/my-courses` (`getUserCourses`) adds two fields to every course in `liveCourses` and
`recordedCourses`:

- **`invoiceId`** (string or `null`). The id of the purchase (Order) that gives the student this course.
  - Candidates are the user's orders that are `success`, `status != 0` and list the course. An order lists a course
    through `courseId`, `latestCourseId`, `build.courseId`, or its plan's `course` list (the plans in the loaded
    access records).
  - When several orders qualify, pick in this order:
    1. a paid order made through our own checkout;
    2. any paid order;
    3. any order.
  - Within each group, the newest by purchase time wins. Purchase time is `orderPurchaseTime` in
    `services/courseExchangePolicy.ts`: `expireDate − duration`, falling back to `createdAt`.
- **`invoice`** (`{ invoiceNumber, downloadUrl }` or `null`). It is filled only when the picked order is paid
  (`isPaidOrder`, the same check `downloadOrderInvoice` uses) **and** is not an AppX import (`isAppxImport` in
  `courseExchangePolicy.ts`; export it).
  - `invoiceNumber` is the order's stored `invoiceNumber`, or `null` if no invoice has been generated yet.
  - `downloadUrl` is the API path `/api/orders/<invoiceId>/invoice`.
  - Never return the stored `invoiceUrl`. It is a public S3 link to a PDF holding the student's details.

**Login token only.** The route takes the student from the login token (`myCoursesStudent`), but a caller with no
token can still name any user in the body. Fill `invoiceId` and `invoice` only when the request's token is that same
student (`req.user.user_id === userId`) or an admin (`req.user.admin_id`). Every other caller still gets the course
list, with both fields `null`.

**Make the invoice route agree.** `GET /api/orders/:id/invoice` (`downloadOrderInvoice`) must refuse AppX-imported
orders with 400 "Invoices are only available for purchases made in the app". Otherwise the app could create a
second invoice for an AppX sale by calling it directly. Decided 2026-10-26: AppX purchases were billed by AppX, so
we issue no invoice for them.

Keep the cost flat. Do it in memory from the orders and plans `loadCourseAccessRecords` already loads, with no query
per course. If that projection lacks fields you need (`grandTotal`, `gateway`, `orderNumber`, `invoiceNumber`,
`duration`, `expireDate`, `createdAt`, the AppX markers), extend it. Check that its other readers are unaffected.

## Acceptance criteria

- [ ] Integration, real router, in-memory Mongo:
  - [ ] A student with a token gets, for a course bought through our checkout, `invoiceId` = that order and
        `invoice.downloadUrl` = `/api/orders/<id>/invoice`.
  - [ ] `invoiceNumber` is `null` before any invoice exists, and is the stored number after one is generated.
  - [ ] A course granted only by an admin-given or ₹0 order: `invoiceId` set, `invoice: null`.
  - [ ] A course granted only by an AppX-imported paid order (`orderNumber` `APX-…`): `invoiceId` set,
        `invoice: null`.
  - [ ] A course covered by an older AppX order and a newer own-checkout order: `invoiceId` is the own-checkout one.
        With two own-checkout orders, the newer one by purchase time wins.
  - [ ] A course reached through the plan's `course` list (not the order's `courseId`) still gets its order.
  - [ ] With no token (body `userId` only), both fields are `null` on every course, and the course list is
        unchanged.
  - [ ] An admin token with a body `userId` gets the fields filled.
  - [ ] `GET /api/orders/<APX order>/invoice` as its owner returns 400 and uploads nothing.
  - [ ] An own-checkout paid order still downloads.
- [ ] The existing my-courses tests (`myCoursesLogin`, `myCoursesMyRating`, `myCoursesStudent`) still pass.
- [ ] `NO NEW FAILURES` against a baseline recorded on the base commit before you start.

## Notes

- Base: `origin/vidyagram-admin` a87e74506. Worktree `~/Projects/worktrees/vg-mycourses-invoice`, branch
  `feat/vg-mycourses-invoice`.
- App team guide: a new file, `vidyagram/reference/vidyagram-my-courses-invoice-guide.md`. Cover the two fields, the
  token requirement, when `invoice` is null, and how to download.
