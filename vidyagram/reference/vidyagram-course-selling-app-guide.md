# Vidyagram course selling: app and website guide

> How the app and website show what a course sells: pricing plans, the coupon timer, the Sub Courses tab, add-ons and
> upgrades, and the warning before an upgrade payment.
>
> Base URL: `https://backend.vidyagramar.com/api`.
>
> **Status (2026-11-06): draft, not sent.** The fields below are built on the backend branch `feat/vg-course-selling`
> and are **not deployed**. Sending this guide to the app and website teams is the user's call.
>
> Every sample below comes from a real local run of the backend against the in-memory test database:
> `src/tests/integration/courseSellingAppGuidePayloads.integration.test.ts` in the backend. Run it with
> `PRINT_GUIDE_PAYLOADS=1` to print them again. Samples are trimmed to the fields this guide discusses, and ids
> differ on every run.

---

## 1. What changed, in one paragraph

An admin now sells a course from one form. The course makes its own plans: one per length, one per add-on and one per
upgrade. The app keeps buying plans exactly as today: it lists plans with `filter-active`, then checks out a plan id.
What is new is a picker when a course has several lengths, a countdown on a timed discount code, a Sub Courses tab on
combos, offers on the page of a course the student owns, and a **required warning before an upgrade**, because an
upgrade takes the old course away.

---

## 2. Pricing plans: several lengths per course

A course can be sold for several lengths, for example 2 years at ₹449 or 3 years at ₹549. Each length is its own plan,
and `POST /api/plans/filter-active/:userId` with `{ "courseId": "<id>" }` lists them, the first length first.

```json
{
  "state": 200,
  "data": [
    {
      "id": "6aed2a14fa62e8bc44133ebb",
      "name": "Maths Champions 5.0",
      "amount": "449",
      "mrp": 999,
      "duration": 731,
      "priceIOS": 449,
      "apple_product_id": "",
      "couponCode": "DIWALI20",
      "coupon_end_date": "2026-12-31T18:29:59.000Z",
      "showTimer": true,
      "is_buy": 0,
      "isUpgrade": 0
    },
    {
      "id": "6aed2a14fa62e8bc44133ebd",
      "name": "Maths Champions 5.0",
      "amount": "549",
      "mrp": 1299,
      "duration": 1096,
      "priceIOS": 549,
      "apple_product_id": "",
      "couponCode": "DIWALI20",
      "coupon_end_date": "2026-12-31T18:29:59.000Z",
      "showTimer": true,
      "is_buy": 0,
      "isUpgrade": 0
    }
  ]
}
```

**The picker.** When the list has more than one plan for the course, show one row per plan with its length (from
`duration`, in days) and `amount`, the first one selected. Checkout sends the picked plan's `id` as `planId` and its
`duration`. Both plans have the same `name`, so label the rows by length, not by name. The course card keeps showing
the course's `price` / `discountPrice`, which are the first length's.

**An owner can't buy another length.** A student who owns one length sees only that plan, with `is_buy: 1`:

```json
{
  "state": 200,
  "data": [
    { "id": "6aed2a14fa62e8bc44133ebb", "name": "Maths Champions 5.0", "amount": "449", "duration": 731, "is_buy": 1 }
  ]
}
```

Checking out the other length anyway answers **403**:

```json
{ "state": 403, "message": "You already own this course. Extend it to get more time.", "data": null }
```

Show the message as it is. To get more time, the student uses Extend on My plans.

**The switch stays off until checked.** Lengths are behind the backend switch `DURATION_PRICING_ENABLED`, which is
off. Until the app and website have been checked with two plans on one course (task 01 of the plan), every course
has one plan and the picker never appears. Build the picker so it shows only when there are two or more plans.

---

## 3. The coupon timer

A course's discount code is attached to all of its length plans. `filter-active` already sent `couponCode` and
`coupon_end_date` (ISO 8601, UTC). It now also sends **`showTimer`**:

| `showTimer` | What the page shows |
|---|---|
| `true` | The code, and a countdown to `coupon_end_date`, for example "Offer ends in 2d 04:12:09". |
| `false` | The code without a countdown, as today. |

`showTimer` is `false` whenever `couponCode` is `''` (no live code), and on every plan not made by a course. When the
countdown reaches zero, hide the code and refresh the listing. The code has expired, so checkout will refuse it.

---

## 4. The Sub Courses tab

`POST /api/courses/by-id-2` now has `data.subCourses`. For a combo it lists the combo itself first, then the courses
inside, in the order the admin set. The standalone guide `vidyagram-combo-sub-courses-api-guide.md` has a real sample. Only active courses are listed: a draft, an inactive (`status: 0`) or a deleted sub course is left out. For any
other course it is `[]`.

```json
"subCourses": [
  {
    "_id": "6aed2a15fa62e8bc44133ef3",
    "id": "6aed2a15fa62e8bc44133ef3",
    "title": "Quant Foundation",
    "banner": null,
    "bannerWebsite": null,
    "shortDescription": "",
    "price": 999,
    "discountPrice": 499,
    "validity": "1 Year",
    "status": 1,
    "isLive": false,
    "isRecorded": true,
    "isFree": false
  },
  {
    "_id": "6aed2a15fa62e8bc44133f05",
    "id": "6aed2a15fa62e8bc44133f05",
    "title": "English Grammar Pro",
    "banner": null,
    "bannerWebsite": null,
    "shortDescription": "",
    "price": 799,
    "discountPrice": 399,
    "validity": "1 Year",
    "status": 1,
    "isLive": false,
    "isRecorded": true,
    "isFree": false
  }
]
```

Show a **Sub Courses** tab when the array is not empty, one row per entry with `banner` and `title` and a "View
course" action that opens that course's page by `id`. The tab needs no token.

---

## 5. Attached products

An admin can attach other courses, test series and books to a course. They come free with it. **Nothing new is
needed in the app.** The course's plan carries them, so after a purchase they show in My courses and in the test
series and ebook lists as any purchase does. The course page doesn't list them.

---

## 6. Offers on the page of a course the student owns

A course the student owns can offer two kinds of follow-on purchase:

- **Add-on.** The student buys another course at a special price and **keeps** this one.
- **Upgrade.** The student moves to another course at a special price and **loses** this one with everything that
  came with it: for a combo every course inside it, and any test series and ebooks attached to the course.

`POST /api/courses/by-id-2` now has `data.offers`. **Send the student's bearer token on this call**
(`Authorization: Bearer <token>`). The list is built for the student the token names. A body `userId` is ignored for
it, because the endpoint is public. Without a token, with an admin token, or for a student who doesn't own the course,
`offers` is `[]`. An expired or invalid token, or one whose session has ended (the student logged out), silently gives
`offers: []` too, with no error; the rest of the page loads as usual.

Sample: the owner of the combo "SSC CGL Combo (Quant + English)", which offers an add-on and an upgrade:

```json
"offers": [
  {
    "kind": "addon",
    "planId": "6aed2a15fa62e8bc44133f3c",
    "targetCourseId": "6aed2a15fa62e8bc44133f17",
    "targetTitle": "Reasoning Batch",
    "price": 149,
    "duration": 183,
    "removes": []
  },
  {
    "kind": "upgrade",
    "planId": "6aed2a15fa62e8bc44133f3e",
    "targetCourseId": "6aed2a14fa62e8bc44133eb7",
    "targetTitle": "Maths Champions 5.0",
    "price": 349,
    "duration": 365,
    "removes": [
      { "kind": "course", "id": "6aed2a15fa62e8bc44133f31", "courseId": "6aed2a15fa62e8bc44133f31", "title": "SSC CGL Combo (Quant + English)" },
      { "kind": "course", "id": "6aed2a15fa62e8bc44133ef3", "courseId": "6aed2a15fa62e8bc44133ef3", "title": "Quant Foundation" },
      { "kind": "course", "id": "6aed2a15fa62e8bc44133f05", "courseId": "6aed2a15fa62e8bc44133f05", "title": "English Grammar Pro" },
      { "kind": "test", "id": "6aed2a15fa62e8bc44133f23", "title": "SSC CGL Mock Test Series" },
      { "kind": "book", "id": "6aed2a15fa62e8bc44133f24", "title": "Polity Notes" }
    ]
  }
]
```

| Field | Meaning |
|---|---|
| `kind` | `addon` or `upgrade`. Word the row from it, see below. |
| `planId` | The plan to check out. |
| `targetCourseId`, `targetTitle` | The course the student gets. Open its page from `targetCourseId`. |
| `price` | Rupees. **Exactly what checkout charges**, so show it as it is. |
| `duration` | Days of access the purchase gives, counted from the day of payment. |
| `removes` | Everything the student loses by paying. `[]` for an add-on. Each entry is `{ kind, id, title }`, where `kind` is `course`, `test` (a test series) or `book` (an ebook). Course entries also carry `courseId`, equal to `id`, as before. For an upgrade: the course itself, for a combo each course inside it, then the course's attached test series, then its attached ebooks. Anything the student also holds through another purchase, or that the new course includes, stays open and is not listed. |

**Order.** Show the offers in the order sent: add-ons first, then upgrades, each in the order the admin dragged them.

**Suggested wording** (yours to change):

| `kind` | Row | Line under it | Button |
|---|---|---|---|
| `addon` | "Add **{targetTitle}**" | "{duration as months or years}. You keep this course." | "Add for ₹{price}" |
| `upgrade` | "Upgrade to **{targetTitle}**" | "{duration as months or years}. Replaces this course." | "Upgrade for ₹{price}" |

**What the list already leaves out.** A course the student can already open, an offer that is off sale, and, while
the backend switch `UPGRADE_REMOVAL_ENABLED` is off (today), every upgrade. When two courses the student owns offer
the same kind of offer into the same course, only the cheaper is listed, on the page of the course it comes from. On a
price tie both are listed. The cheapest rule applies within a kind only: an add-on and an upgrade into the same course
are both listed, because the add-on lets the student keep their course.

### The same offers on My plans

`GET /api/users/me/plans` already sent `upgradeOffers` on each card. Each entry now also has `kind` and `removes`,
with the same meaning, and its `price` is the same as on the course page:

```json
{
  "planId": "6aed2a15fa62e8bc44133f38",
  "name": "SSC CGL Combo (Quant + English)",
  "daysLeft": 365,
  "courseId": ["6aed2a15fa62e8bc44133f31", "6aed2a15fa62e8bc44133ef3", "6aed2a15fa62e8bc44133f05"],
  "upgradeOffers": [
    {
      "id": "6aed2a15fa62e8bc44133f3c",
      "kind": "addon",
      "name": "Reasoning Batch (Add-on)",
      "days": 183,
      "price": 149,
      "mrp": 149,
      "appleProductId": "",
      "courseId": ["6aed2a15fa62e8bc44133f17"],
      "removes": []
    },
    {
      "id": "6aed2a15fa62e8bc44133f3e",
      "kind": "upgrade",
      "name": "Maths Champions 5.0 (Upgrade)",
      "days": 365,
      "price": 349,
      "mrp": 349,
      "appleProductId": "",
      "courseId": ["6aed2a14fa62e8bc44133eb7"],
      "removes": [
        { "kind": "course", "id": "6aed2a15fa62e8bc44133f31", "courseId": "6aed2a15fa62e8bc44133f31", "title": "SSC CGL Combo (Quant + English)" },
        { "kind": "course", "id": "6aed2a15fa62e8bc44133ef3", "courseId": "6aed2a15fa62e8bc44133ef3", "title": "Quant Foundation" },
        { "kind": "course", "id": "6aed2a15fa62e8bc44133f05", "courseId": "6aed2a15fa62e8bc44133f05", "title": "English Grammar Pro" },
        { "kind": "test", "id": "6aed2a15fa62e8bc44133f23", "title": "SSC CGL Mock Test Series" },
        { "kind": "book", "id": "6aed2a15fa62e8bc44133f24", "title": "Polity Notes" }
      ]
    }
  ]
}
```

- `kind` on `upgradeOffers` used to be `upgrade` on every entry. It is now `upgrade` only for an offer that removes
  the course. Every other entry, including the older hand-made upgrade offers that leave the course alone, is
  `addon`. Don't filter `upgradeOffers` by `kind`; use it only for wording and the warning.
- `id` is the plan to check out, as before.

### The same offer on the destination's page

When the student opens the page of the course on offer (Maths Champions 5.0 above), `filter-active` lists the offer
plan at the offer price, as before (`isUpgrade: 1`, `isUpgradeOffer: true`). Those rows now also carry `offerKind`,
and, **when the call sends the student's bearer token**, `removes`:

```json
{
  "id": "6aed2a15fa62e8bc44133f3e",
  "name": "Maths Champions 5.0 (Upgrade)",
  "amount": "349",
  "mrp": null,
  "duration": 365,
  "priceIOS": 349,
  "apple_product_id": "",
  "couponCode": "",
  "coupon_end_date": "",
  "showTimer": false,
  "is_buy": 0,
  "isUpgrade": 1,
  "isUpgradeOffer": true,
  "originalAmount": "349",
  "offerKind": "upgrade",
  "removes": [
    { "kind": "course", "id": "6aed2a15fa62e8bc44133f31", "courseId": "6aed2a15fa62e8bc44133f31", "title": "SSC CGL Combo (Quant + English)" },
    { "kind": "course", "id": "6aed2a15fa62e8bc44133ef3", "courseId": "6aed2a15fa62e8bc44133ef3", "title": "Quant Foundation" },
    { "kind": "course", "id": "6aed2a15fa62e8bc44133f05", "courseId": "6aed2a15fa62e8bc44133f05", "title": "English Grammar Pro" },
    { "kind": "test", "id": "6aed2a15fa62e8bc44133f23", "title": "SSC CGL Mock Test Series" },
    { "kind": "book", "id": "6aed2a15fa62e8bc44133f24", "title": "Polity Notes" }
  ]
}
```

Without a token the row has `offerKind` but no `removes`. A row sold at its normal price has neither field. The same
fields come back when `filter-active` is called with `subscriptionId`.

---

## 7. The warning before an upgrade payment (required)

Before starting payment for any offer with `kind: "upgrade"` (or a listing row with `offerKind: "upgrade"`), show a
confirm step that **names every item in `removes`**: courses, test series and ebooks. The student must confirm before
checkout starts. Suggested copy, for the sample above:

> **Upgrade to Maths Champions 5.0 for ₹349?**
> You will lose access to:
> - SSC CGL Combo (Quant + English)
> - Quant Foundation
> - English Grammar Pro
> - SSC CGL Mock Test Series (test series)
> - Polity Notes (ebook)
>
> Your order history and invoices for them stay.

Label each line from its `kind`: nothing for `course`, "(test series)" for `test`, "(ebook)" for `book`.
>
> [Cancel] [Upgrade and pay ₹349]

For an add-on, no warning is needed. A line such as "You keep SSC CGL Combo (Quant + English)" is enough.

**Checkout needs the student's own token for an upgrade.** Send `Authorization: Bearer <token>` on the order call
(`POST /api/orders/get-razorpay-order`, `/get-website-razorpay-order` or `/payment-link`), with the student's own
`userId` in the body. Without it, or with someone else's token, the call answers **401** and no order is made:

```json
{
  "state": 401,
  "message": "Log in to buy this upgrade. It removes the course you upgrade from, so only you can buy it.",
  "data": null
}
```

With the token, checkout goes on as for any plan:

```json
{
  "status": 201,
  "data": {
    "razorpayOrderId": "order_guide_5",
    "orderNumber": "ORD-1793927701348-509",
    "grandTotal": 349,
    "currency": "INR",
    "orderStatus": "initiated"
  }
}
```

(`razorpayOrderId` here is the test run's stand-in; a real one looks like `order_P...`.)

Send `grandTotal` equal to the offer's `price`, minus any coupon, as today. When the payment succeeds, the old
course's purchase stops giving access, and so do the test series and ebooks listed in `removes`. Refresh My courses
and My plans after payment. The old course leaves My courses, its card leaves My plans, and its page answers
`offers: []`.

---

## 8. Order history and invoices after an upgrade

The old purchase stays in the student's history, labelled, with its invoice. Send the student's bearer token on both
calls below, for their own `userId`. `invoice-orders` answers 401 without it. `history` still answers without one
today, but it will refuse such calls once its lock is switched on.

`GET /api/orders/history?userId=<id>` rows have **`upgraded`** and **`upgraded_at`**:

```json
[
  {
    "id": "6aed2a15fa62e8bc44133fbc",
    "name": "Maths Champions 5.0",
    "amount": "349",
    "order_status": "success",
    "invoice_url": "https://s3.example/invoices/781/INV-ORD-1793927701348-509.pdf",
    "upgraded": false,
    "upgraded_at": null
  },
  {
    "id": "6aed2a15fa62e8bc44133f5b",
    "name": "SSC CGL Mock Test Series",
    "amount": "799",
    "order_status": "success",
    "invoice_url": "https://s3.example/invoices/781/INV-ORD-1793927701218-958.pdf",
    "upgraded": true,
    "upgraded_at": "2026-11-06T01:15:01.425Z"
  }
]
```

`GET /api/orders/invoice-orders?userId=<id>` rows have `upgraded` and **`upgradedAt`** (camelCase on this one):

```json
[
  {
    "id": "6aed2a15fa62e8bc44133fbc",
    "name": "Maths Champions 5.0 (Upgrade)",
    "amount": 349,
    "orderNumber": "ORD-1793927701348-509",
    "orderDate": "2026-11-06T01:15:01.358Z",
    "expireDate": "2027-11-06T01:15:01.375Z",
    "invoiceNumber": "INV-ORD-1793927701348-509",
    "upgraded": false,
    "upgradedAt": null
  },
  {
    "id": "6aed2a15fa62e8bc44133f5b",
    "name": "SSC CGL Combo (Quant + English)",
    "amount": 799,
    "orderNumber": "ORD-1793927701218-958",
    "orderDate": "2026-11-06T01:15:01.227Z",
    "expireDate": "2027-11-06T01:15:01.242Z",
    "invoiceNumber": "INV-ORD-1793927701218-958",
    "upgraded": true,
    "upgradedAt": "2026-11-06T01:15:01.425Z"
  }
]
```

In this run the combo's row is named "SSC CGL Mock Test Series", its attached test series, not the combo. That is a
backend naming bug in `history` for a course with an attached test series, reported for a fix; `invoice-orders` names
it correctly.

When `upgraded` is `true`, show an "Upgraded" tag on the row, for example "Upgraded on 6 Nov 2026", and keep the
invoice download. The order no longer gives access, so don't offer "Open course" from it. Every other row has
`upgraded: false`.

---

## 9. iPhone

Plans a course makes have **`apple_product_id: ""`** on `filter-active` and `appleProductId: ""` on My plans, unless
an admin set a product id on the Plans page. Only a course's main plans (its lengths) can get one there. Add-on and
upgrade plans never have one. As before, **don't start Apple checkout for a plan with an empty product id.** On
iPhone, either hide the buy action for such a plan or send the student to the website, whichever the app does today
for plans with no product id. No Vidyagram plan had an Apple product id on 22 Oct either, so this is today's
behaviour, but the picker and the offers make it more visible. It still needs a check on a real iPhone.

---

## 10. Checklist

- [ ] Pricing plans: show a length picker when `filter-active` lists two or more plans for the course; check out the
      picked plan's `id`; show the 403 message for an owner.
- [ ] Coupon timer: show a countdown to `coupon_end_date` when `showTimer` is `true`.
- [ ] Sub Courses tab from `by-id-2` `subCourses`, in order (the combo first), when it is not empty.
- [ ] Send the bearer token on `POST /api/courses/by-id-2`.
- [ ] Offers on the owned course's page from `offers`, in order, worded by `kind`.
- [ ] My plans: word `upgradeOffers` by `kind`; don't filter on it.
- [ ] Destination page: read `offerKind` and `removes` on `isUpgrade: 1` rows; send the bearer token on
      `filter-active`.
- [ ] **Before any `upgrade` payment, a confirm step that names every item in `removes`: courses, test series and
      ebooks.**
- [ ] Send the student's own bearer token on the order call for an upgrade; handle 401.
- [ ] Refresh My courses and My plans after an upgrade.
- [ ] Order history and invoices: send the student's token; an "Upgraded" tag from `upgraded` / `upgraded_at`
      (`upgradedAt` on invoice-orders).
- [ ] iPhone: no Apple checkout for an empty `apple_product_id` / `appleProductId`.

---

## 11. Before turning upgrades on

Upgrades stay off (`UPGRADE_REMOVAL_ENABLED`) until the app and the website show the warning in section 7. Lengths
stay off (`DURATION_PRICING_ENABLED`) until the two-plan check in section 2 passes. Both are backend switches, so the
app needs no release to follow them. Fields simply start appearing.
