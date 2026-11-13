# Vidyagram course exchange: app team guide

> How the app shows the **Exchange course** sheet and makes a swap.
> 
> Base URL: `https://backend.vidyagramar.com/api`.
 
---

## 1. The rule in one paragraph

A student can exchange a course they bought, once, within 30 days of paying, while they have watched under 5% of it,
attempted no test in it and opened at most 2 of its PDFs. The swap is free and instant. The new course opens at once,
the old one leaves My Courses, and the end date stays the same. Only single-course purchases made through the app's
own checkout can be exchanged. Combos, iPhone (Apple) purchases, free or admin-given courses and purchases carried
over from AppX never show the action. The admin decides which courses each course can be swapped for.

The limits come from the server in `rule`. Never hard-code them.

---

## 2. When to show the Exchange action

The course page response already carries the answer.

`POST /api/courses/by-id-2`, the call the course page already makes, now has `data.exchange`:

```json
"exchange": { "orderId": "6adb33433a9a0c7e7d64dd7d", "eligible": true }
```

or, when the student holds a course that could be exchanged but can't be right now:

```json
"exchange": { "orderId": "6adb33433a9a0c7e7d64dd7d", "eligible": false, "reason": "watched_too_much" }
```

or `null`.

**Send the student's bearer token on this call** (`Authorization: Bearer <token>`). The field is computed only for the
student named by the token. A body `userId` is ignored for it, because this endpoint is public. Without a token the
field is always `null`, and the button never shows.

| `exchange` | What the app shows |
|---|---|
| `null` | No Exchange action. Signed out, switch off, not bought, a combo, or no swap list on this course. |
| `eligible: true` | The **Exchange course** action. Keep `orderId` for the next two calls. |
| `eligible: false` | No action. Optional: a muted line "Exchange no longer available" using the reason copy in section 5. |

### The same field on My courses cards

`POST /api/courses/my-courses` now puts the same `exchange` field on every card in `liveCourses` and
`recordedCourses`. It has the same shape, follows the same rules and gives the same answer as the course page for that
course:

```json
{
  "id": "6adb333542494a5ce4c89e91",
  "title": "Static GK 2.0 Batch",
  "invoiceId": "6adb33433a9a0c7e7d64dd7d",
  "certificate": null,
  "exchange": { "orderId": "6adb33433a9a0c7e7d64dd7d", "eligible": true }
}
```

Use it to show an Exchange action on the card, then open the sheet with `orderId` exactly as in section 3. The field
is filled only when the call carries the student's bearer token. A call with only a body `userId`, an admin token, or
the switch off gives `exchange: null` on every card. Most cards are `null`, because most courses have no swap list.

---

## 3. Open the sheet: `GET /api/orders/:orderId/exchange-options`

Send the bearer token. The student is taken from the token. Someone else's order, a missing order, and any request
while the switch is off all answer **404**.

**200, eligible** (real sample):

```json
{
  "state": 200,
  "data": {
    "eligible": true,
    "watchedPct": 0,
    "daysSincePurchase": 12,
    "daysLeftToExchange": 18,
    "rule": { "windowDays": 30, "maxWatchPct": 5, "maxPdfsOpened": 2 },
    "source": {
      "courseId": "6adb333542494a5ce4c89e91",
      "title": "Static GK 2.0 Batch",
      "banner": "https://cdn.vidyagramar.com/banners/static-gk-2-0-batch.jpg"
    },
    "targets": [
      {
        "planId": "6adb333542494a5ce4c89e94",
        "courseId": "6adb333542494a5ce4c89e92",
        "title": "3 in 1 Mastery - AI, Design & Editing",
        "banner": "https://cdn.vidyagramar.com/banners/3-in-1-mastery-ai-design-editing.jpg"
      },
      {
        "planId": "6adb333542494a5ce4c89e95",
        "courseId": "6adb333542494a5ce4c89e93",
        "title": "UPSSSC PET 2026 Crash Course",
        "banner": "https://cdn.vidyagramar.com/banners/upsssc-pet-2026-crash-course.jpg"
      }
    ]
  }
}
```

**200, not eligible.** This is still 200, with `eligible: false`, a `reason` and `targets: []`. `source` can be `null`.

How each part of the sheet maps to the response, following the mock:

- **Title.** "Exchange course", with `source.title` under it.
- **Green banner, when eligible.** "You can exchange this course. You've watched `{watchedPct}`% and bought it
  `{daysSincePurchase}` days ago. **`{daysLeftToExchange}` days left** to exchange." When `daysLeftToExchange` is 0,
  say "Last day to exchange".
- **List.** "Pick the course you want instead." Then one row per `targets[]` entry, with `banner` and `title`.
  - Show a **"Free swap"** tag on each row.
  - **Show no price.** No money moves, and a price reads like a charge.
  - The list already leaves out courses the student owns and courses that are off sale.
- **Button.** "Exchange course", enabled once a row is picked.
- **Footnote.** Build it from `rule`: "Eligible if under `{maxWatchPct}`% watched within `{windowDays}` days of
  purchase."

---

## 4. Confirm and swap: `POST /api/orders/:orderId/exchange-self`

Before calling, show one confirm step that names both courses:

> Exchange **Static GK 2.0 Batch** for **3 in 1 Mastery - AI, Design & Editing**?
> You'll lose access to Static GK 2.0 Batch. This can only be done once.

Body: `{ "targetPlanId": "<targets[i].planId>" }`, with the bearer token.

**200, swapped.** The response is the updated order (real sample, trimmed):

```json
{
  "state": 200,
  "message": "Order exchanged successfully",
  "data": {
    "_id": "6adb333542494a5ce4c89e98",
    "planId": "6adb333542494a5ce4c89e94",
    "planFor": "3 in 1 Mastery",
    "grandTotal": 499,
    "expireDate": "2027-10-11T10:13:09.988Z",
    "exchange": {
      "fromPlanId": "6adb333542494a5ce4c89e96",
      "fromCourseIds": ["6adb333542494a5ce4c89e91"],
      "toPlanId": "6adb333542494a5ce4c89e94",
      "at": "2026-10-23T10:13:10.069Z",
      "by": "student",
      "watchedPct": 0,
      "pdfsOpened": 0,
      "testsAttempted": 0
    }
  }
}
```

If the new course's plan also includes a test series or other extras, the student gets those too. The sheet shows
only the course. A line such as "Includes everything in this course's plan" is enough.

After a 200:

1. Close the sheet.
2. Show "Exchanged. **3 in 1 Mastery - AI, Design & Editing** is now in My Courses."
3. Refresh My Courses and open the new course.
4. The old course's page now answers `exchange: null`, and its classes and PDFs are locked.

**Retries are safe.** Sending the same `targetPlanId` again returns 200 with the same order and changes nothing. If
the network drops after the tap, retry the same call.

**Errors.** Each one has a `reason`:

| Status | `reason` | When | App copy |
|---|---|---|---|
| 400 | `target_not_allowed` | That course is not on the list now (the admin changed it), or `targetPlanId` is missing or bad | "That course is no longer available for exchange." Reload the options. |
| 409 | `already_exchanged` | This purchase was already exchanged, for example to a different course on another device | "This course has already been exchanged." Refresh My Courses. |
| 409 | any other reason in section 5 | Eligibility changed between opening the sheet and confirming | The reason copy from section 5. Close the sheet. |
| 404 | (none) | Not this student's order, or the switch was turned off | "Exchange isn't available right now." |
| 401 | (none) | No token, or the token has expired | Refresh the token as usual. |

---

## 5. Reason codes

The same codes appear on the course page field, in the options response and in 409 errors. The suggested copy is
yours to change.

| `reason` | Meaning | Suggested copy |
|---|---|---|
| `order_inactive` | The purchase is not active (expired, failed or removed) | "This purchase isn't active." |
| `excluded_order_kind` | An iPhone, free, admin-given, AppX-imported, upgrade, extension or build purchase | "This purchase can't be exchanged." |
| `combo_plan` | The purchase is a combo of several courses | "Combo purchases can't be exchanged." |
| `no_targets` | No course to swap to (none set, all owned or all off sale) | "No other course is available for exchange." |
| `already_exchanged` | This purchase was exchanged before, even if support later reversed it | "This course has already been exchanged." |
| `window_passed` | More than `windowDays` since purchase | "The exchange window has closed (30 days from purchase)." |
| `watched_too_much` | Watched `maxWatchPct`% or more | "You've watched too much of this course to exchange it." |
| `test_attempted` | A test in this course was attempted | "You've attempted a test in this course, so it can't be exchanged." |
| `pdfs_opened` | More than `maxPdfsOpened` of its PDFs opened | "You've opened too many of this course's PDFs to exchange it." |
| `not_owner` | Reserved; the app gets 404 instead | n/a |

---

## 6. Order history: "Exchanged from …"

`GET /api/orders/my-orders?userId=<id>` (and `/history`) is unchanged. Each row now has `exchangedFrom`. Real sample
row:

```json
{
  "id": "6adb33433a9a0c7e7d64dd7d",
  "name": "3 in 1 Mastery",
  "amount": "499",
  "duration": "365",
  "order_date": "11-10-2026 15:43:23",
  "order_id": "ORD-20261011-0001",
  "order_status": "success",
  "exchangedFrom": { "courseId": "6adb33423a9a0c7e7d64dd76", "title": "Static GK 2.0 Batch" }
}
```

When `exchangedFrom` is not null, show "Exchanged from **Static GK 2.0 Batch**" under the row. It is `null` for every
other order, and also after support undoes an exchange.

---

## 7. Checklist for the app

- [ ] Send the bearer token on `POST /api/courses/by-id-2`.
- [ ] Show the action only when `data.exchange?.eligible === true`.
- [ ] Optional: on My courses, show the action on a card when its `exchange?.eligible === true`. Send the bearer
      token on `POST /api/courses/my-courses`.
- [ ] Build the sheet from `exchange-options`: banner, `targets` rows with "Free swap" and no price, footnote from
      `rule`.
- [ ] Add a confirm step that names both courses.
- [ ] Call `exchange-self`. On 200, refresh My Courses and open the new course. Retry the same call on a network
      error.
- [ ] Handle 400, 409, 404 and 401 as in section 4.
- [ ] Show the "Exchanged from" line in order history.

---

## 8. Testing against production

The backend switch is on, but only test data has swap options, so no real student sees anything.

1. **Send the user id of your student test account** to the backend team. It is the `user_id` inside its login
   token, or the id the profile call returns.
2. **The backend team adds a test purchase to that account.** The purchase is on a hidden test plan for the course
   **Grammer Pro Batch by Jai Sir (Recorded Batch)**. Its one swap option is **UPSSSC PET 2026 Crash Course**.
3. **Test the flow as the guide describes:**
   - Sign in as that account and open the Grammer Pro course page. `data.exchange` should be
     `{ orderId, eligible: true }`.
   - Open the sheet, swap, then check My Courses and order history.
4. **Each test purchase can be swapped only once.** That is the real rule. After a swap, ask the backend team to reset
   it, and you get a fresh, eligible purchase on the same account.
5. **To see the "not eligible" states,** watch more than 5% of the Grammer Pro classes, attempt a test, or open 3 of
   its PDFs before swapping. The course page then shows `eligible: false` with the matching `reason`.

When testing is done, the backend team removes the test plan and purchases.

