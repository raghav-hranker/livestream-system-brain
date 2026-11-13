# Vidyagram Course Builder — client API reference

Base URL: `https://backend.vidyagramar.com/api` · Demo course: `6ad73b8ac90f6da685048d8c` (builder on; max ₹699,
min ₹149, struck-out ₹1999, Notes ₹60 off, Tests ₹90 off, Revision only ₹250 off). Razorpay is in test mode.

Every response is `{ "state": <HTTP status>, "msg" | "message": "...", "data": ... }`.

| # | Call | Login | Use |
|---|---|---|---|
| 1 | `GET /courses/active`, `POST /courses/filter`, `POST /courses/batch-filter`, folders | optional | course list cards |
| 2 | `POST /courses/my-courses` | yes | the student's courses |
| 3 | `POST /courses/by-id-2` | optional | course page |
| 4 | `GET /courses/:courseId/builder` | optional | the "Build your own" screen |
| 5 | `POST /orders/build-checkout` | **required** | pay for a build |
| 6 | `GET /courses/:courseId/classes` | optional | classes grouped by chapter, for locking |

---

## 1–3. Course cards

Every course card in calls 1, 2 and 3 carries:

```json
"isBuilderEnabled": true,
"builderFromPrice": 149
```

`isBuilderEnabled` → show "Build your own". `builderFromPrice` → "Build from ₹149" (`null` when the builder is off).

For a student who **bought a build** of that course, the card also carries the ownership fields (and `is_buy: 1`):

```json
"is_buy": 1, "isPaid": true, "isExtension": false, "isExpired": false, "daysLeft": null,
"isPartial": true,
"ownedTopicIds": ["<topicId>", "..."],
"revisionTopicIds": ["<topicId>", "..."],
"ownedExtras": ["notes", "tests"],
"revisionOnly": false
```

| Field | Meaning |
|---|---|
| `isPartial` | only present for a build buyer. **Missing → not a build buyer**: use `is_buy` (1 = whole course, 0 = not bought) |
| `ownedTopicIds` | chapters (topic ids) the student owns |
| `revisionTopicIds` | owned chapters where **only revision classes** play |
| `ownedExtras` | `"notes"` / `"tests"` the student bought |
| `revisionOnly` | `true` when every owned chapter is revision-only |

Request bodies (unchanged): `my-courses` → `{ "userId": "<student id>" }`; `by-id-2` → `{ "id": "<courseId>", "userId": "<student id>" }`.

### The four ownership cases

| Case | `isPartial` | `ownedTopicIds` | `revisionTopicIds` | `revisionOnly` | What the app shows |
|---|---|---|---|---|---|
| Picked chapters (e.g. Percentage + Algebra) | `true` | those chapters | `[]` | `false` | those chapters fully open; the rest locked |
| Revision only | `true` | every chapter | every chapter | `true` | every chapter open, but only `isRevision` classes play |
| Chapters + Revision only (Percentage, then Revision only) | `true` | every chapter | every chapter except Percentage | `false` | Percentage fully open; the rest revision classes only |
| Whole course / not bought | *(missing)* | *(missing)* | *(missing)* | *(missing)* | `is_buy` decides, as today |

---

## 4. Builder screen — `GET /courses/:courseId/builder`

`404 { "msg": "This course has no Course Builder." }` when the builder is off. Send the token to get `ownership`.

```json
{
  "state": 200,
  "data": {
    "course": { "id": "6ad73b8ac90f6da685048d8c", "title": "Course Builder Demo · Maths by Aditya Ranjan Sir (test)" },
    "version": 2,
    "minPrice": 149, "maxPrice": 699, "mrp": 1999,
    "extras": {
      "notes": { "offered": true, "value": 60, "defaultOn": true },
      "tests": { "offered": true, "value": 90, "defaultOn": true }
    },
    "revisionOnly": { "offered": true, "discount": 250 },
    "sections": [
      {
        "sectionId": "...", "sectionName": "Maths", "weight": 100,
        "chapterCount": 41, "classCount": 422, "revisionClassCount": 41, "durationSeconds": 1420387, "hours": 394.6,
        "chapters": [
          { "topicId": "6ad5f9c2308a95d039c3276f", "topicName": "Calculation Videos", "weight": 2, "customPrice": null,
            "price": 13.98, "classCount": 8, "revisionClassCount": 1, "durationSeconds": 30944, "hours": 8.6 }
        ]
      }
    ],
    "ownership": { "ownsAll": false, "isPartial": true, "ownedTopicIds": ["..."], "revisionTopicIds": [],
                   "ownedExtras": ["notes"], "revisionOnly": false }
  }
}
```

Screen rules:
- Notes / Tests switches only when `offered`; start at `defaultOn`. **Revision only** switch only when `revisionOnly.offered`.
- Revision only ON → tick **and lock** every chapter; OFF → restore the earlier picks.
- `price: 0` chapter = free to tick. No chapter ticked → Continue disabled.
- `ownership.ownsAll` → "You already own this course", no checkout. Mark `ownership.ownedTopicIds` as Owned.

### Price (show instantly; the server charges its own)

```js
function priceBuild(b, { topicIds, notesOn, testsOn, revisionOnly }) {
  const picked = b.sections.flatMap(s => s.chapters).filter(c => topicIds.includes(c.topicId));
  const chapters = revisionOnly && b.revisionOnly.offered
    ? b.maxPrice - b.revisionOnly.discount
    : Math.min(picked.reduce((sum, c) => sum + c.price, 0), b.maxPrice);
  let price = chapters;
  if (b.extras.notes.offered && !notesOn) price -= b.extras.notes.value;
  if (b.extras.tests.offered && !testsOn) price -= b.extras.tests.value;
  const final = Math.round(Math.max(price, b.minPrice));
  return { final, atMinimum: price <= b.minPrice, struckOut: b.mrp ? Math.round(final * b.mrp / b.maxPrice) : null };
}
```

Expected on the demo course: every chapter ₹699 · Notes off ₹639 · both off ₹549 · Revision only ₹449 ·
Revision only + both off ₹299 · one small chapter ₹149 (`atMinimum` → show "Already at the minimum price").

---

## 5. Checkout — `POST /orders/build-checkout`

Header `Authorization: Bearer <student token>`. Body:

```json
{ "courseId": "6ad73b8ac90f6da685048d8c",
  "topicIds": ["<topicId>"],
  "extrasOn": ["notes", "tests"],
  "revisionOnly": false }
```

`extrasOn` = extras kept ON. Revision only → `"revisionOnly": true`, `"topicIds": []`. Never send an amount or userId.

`201`:

```json
{ "state": 201, "message": "Razorpay order created successfully",
  "data": { "razorpayOrderId": "order_...", "rzp_key": "rzp_test_...", "orderNumber": "...",
            "grandTotal": 549, "currency": "INR", "orderStatus": "initiated", "breakdown": { "final": 549 } } }
```

Open Razorpay with `key = rzp_key`, `order_id = razorpayOrderId`, amount `grandTotal × 100`. Show `grandTotal` if it
differs from the screen. After payment (webhook), refresh My Courses / the course page.

| Status | message |
|---|---|
| 401 | Access token required |
| 400 | This course is not sold as a Course Builder. · This course is not on sale. |
| 400 | Pick at least one chapter. |
| 400 | Topic … is not a chapter of this course's builder. Reload and try again. |
| 400 | This course does not offer Notes / Tests / Revision only. |
| 400 | Coupons cannot be applied to a Course Builder build yet. |
| 409 | You already own this whole course. |

---

## 6. Classes by chapter — `GET /courses/:courseId/classes`

```json
{ "state": 200,
  "data": { "course": { "id": "...", "title": "..." },
            "classes": [
              { "topicId": "<chapter id>", "topicName": "Percentage",
                "classes": [ { "classId": "...", "title": "...", "isFree": false, "isRevision": true, "...": "..." } ] }
            ] } }
```

`isRevision` (and `isFree`) is also on class tabs (`POST /courses/:courseId/class-tabs`) and today's classes.

### Lock rule

```js
function classIsOpen(course, chapterTopicId, cls) {
  if (cls.isFree) return true;
  if (course.is_buy !== 1) return false;
  if (!course.isPartial) return true;                                         // whole course
  if (!course.ownedTopicIds.includes(chapterTopicId)) return false;          // chapter not bought
  if (course.revisionTopicIds.includes(chapterTopicId)) return cls.isRevision === true;
  return true;
}
const notesOpen = (course, classOpen) => classOpen && (!course.isPartial || course.ownedExtras.includes('notes'));
const testsOpen = (course) => course.is_buy === 1 && (!course.isPartial || course.ownedExtras.includes('tests'));
```

Locked chapter → "Buy this chapter". Revision-only chapter, non-revision class → "Not in Revision only". The server
enforces the same rules on playback, PDFs and tests (403 / `restrict: true`), so the lock is for display only.
