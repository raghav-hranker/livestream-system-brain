# Vidyagram Course Builder — app integration guide

For the app and website team. The backend is live on `https://backend.vidyagramar.com/api` (2026-10-20). Every
example below is a real response shape; ids are from the demo course.

A student can buy **chosen chapters** of a course instead of the whole course. They can also switch off
**Notes** and **Tests** to pay less, or pick **Revision only** (every chapter, only the classes marked as
revision, at a discount). The server prices every build; the app shows the price and the server charges its own.

---

## 1. Test straight away

| What | Value |
|---|---|
| Base URL | `https://backend.vidyagramar.com/api` |
| Demo course | `6ad73b8ac90f6da685048d8c` — "Course Builder Demo · Maths by Aditya Ranjan Sir (test)" |
| Its settings | max ₹699, min ₹149, struck-out ₹1999, Notes ₹60 off, Tests ₹90 off, Revision only ₹250 off |
| Content | 41 chapters (2 free to tick), 422 classes with real video and class notes; 41 revision classes; 26 free classes |
| Payments | Razorpay **test mode** (`rzp_test_…` key comes back from checkout): use Razorpay test cards |

**Not testable yet on live:** the Tests extra. No Vidyagram course has tests assigned yet (AppX import), so
there is nothing for it to open. The toggle and the price still work.

To get a build onto a test account without paying, ask Raghav for an admin grant (section 7), or run a test-mode
checkout. A Postman collection with every call is in `system-brain/reference/postman/vidyagram-course-builder.*`.

---

## 2. Course cards (every listing)

`GET /courses/active`, `POST /courses/filter`, `POST /courses/batch-filter`, folders, `POST /courses/my-courses`,
`POST /courses/by-id-2` — every course card now has:

```json
"isBuilderEnabled": true,
"builderFromPrice": 149
```

- `isBuilderEnabled` → show the **Build your own** entry for this course.
- `builderFromPrice` → "Build from ₹149". `null` when the builder is off.

When the signed-in student **bought a build** of the course, the same card also has (and `is_buy` is 1):

```json
"is_buy": 1, "isPaid": true, "isExtension": false, "isExpired": false, "daysLeft": null,
"isPartial": true,
"ownedTopicIds": ["6ad4cce38edc65f31e7c769f"],
"revisionTopicIds": [],
"ownedExtras": ["notes", "tests"],
"revisionOnly": false
```

| Field | Meaning |
|---|---|
| `isPartial` | only present (always `true`) for a build buyer. **Missing = not a build buyer** → use `is_buy` as today (1 = whole course, 0 = not bought) |
| `ownedTopicIds` | chapters (topic ids) the student owns, across all their builds |
| `revisionTopicIds` | owned chapters where **only revision classes** open (from Revision only) |
| `ownedExtras` | `"notes"`, `"tests"`, both or none |
| `revisionOnly` | `true` when every owned chapter is revision-only |
| `daysLeft` | `null`: builds are lifetime |

A whole-course owner never gets these keys, even if they also bought a build.

---

## 3. The builder screen

`GET /courses/:courseId/builder` — no login needed; send the student's token to also get `ownership`.
`404 { "msg": "This course has no Course Builder." }` when the builder is off.

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
        "sectionId": "…", "sectionName": "Maths", "weight": 100,
        "chapterCount": 41, "classCount": 422, "revisionClassCount": 41,
        "durationSeconds": 1420387, "hours": 394.6,
        "chapters": [
          { "topicId": "6ad5f9c2308a95d039c3276f", "topicName": "Calculation Videos", "weight": 2, "customPrice": null,
            "price": 13.98, "classCount": 8, "revisionClassCount": 1, "durationSeconds": 30944, "hours": 8.6 }
        ]
      }
    ],
    "ownership": { "ownsAll": false, "isPartial": true, "ownedTopicIds": ["…"], "revisionTopicIds": [],
                   "ownedExtras": ["notes"], "revisionOnly": false }
  }
}
```

How to render it:

- **Sections** → expandable rows: `sectionName`, "`weight`% of syllabus", "`n` of `chapterCount` chapters", `classCount`
  classes. **Chapters** → checkboxes with `topicName`, `classCount`, `hours`.
- A chapter with `price: 0` is free to tick (here "Work & Wages" and "Circular Motion").
- **Toggles**: show Notes / Tests only when `offered`; start them at `defaultOn`. Show **Revision only** only when
  `revisionOnly.offered`. Label it exactly "Revision only" so students know it means fewer classes.
- **Revision only ON** → tick **and lock** every chapter (it is the whole course, revision classes only).
  Turning it off restores the student's earlier picks.
- **Select all / Clear** act on chapters. Disable **Continue** while no chapter is picked.
- `ownership.ownsAll` → the student owns the whole course: show "You already own this course", no checkout.
  `ownership.ownedTopicIds` → mark those chapters "Owned" (they can still buy other chapters).
- Footer: "`n` chapters · `classes` classes · `hours` hours · `x`% of syllabus", where `x` = sum of picked chapter weights.

---

## 4. The price (show it instantly, the server charges its own)

Run this on every tap. The numbers come from the builder response; `chapter.price` is already
`customPrice ?? maxPrice × weight / 100`.

```js
function priceBuild(b, { topicIds, notesOn, testsOn, revisionOnly }) {
  const picked = b.sections.flatMap(s => s.chapters).filter(c => topicIds.includes(c.topicId));
  const chapters = revisionOnly && b.revisionOnly.offered
    ? b.maxPrice - b.revisionOnly.discount
    : Math.min(picked.reduce((sum, c) => sum + c.price, 0), b.maxPrice);   // the max caps chapters only
  let price = chapters;
  if (b.extras.notes.offered && !notesOn) price -= b.extras.notes.value;
  if (b.extras.tests.offered && !testsOn) price -= b.extras.tests.value;
  const final = Math.round(Math.max(price, b.minPrice));                  // the min is a hard floor
  return {
    final,
    atMinimum: price <= b.minPrice,
    struckOut: b.mrp ? Math.round(final * b.mrp / b.maxPrice) : null,
  };
}
```

Check your implementation against the demo course (these are the backend's own results for the live settings):

| Picks | Price |
|---|---|
| every chapter, Notes + Tests on | **₹699** |
| every chapter, Notes off | **₹639** |
| every chapter, Notes + Tests off | **₹549** |
| Revision only, Notes + Tests on | **₹449** |
| Revision only, Notes + Tests off | **₹299** |
| one small chapter (e.g. Pipe & Cistern, ₹3.50) | **₹149** (`atMinimum`) |

When `atMinimum` is true, switching more extras off does not lower the price: show
"Already at the minimum price" under the toggles. Show `struckOut` struck through next to the price when it is
higher than `final`.

---

## 5. Checkout

`POST /orders/build-checkout` — **login required** (`Authorization: Bearer <student token>`).

```json
{ "courseId": "6ad73b8ac90f6da685048d8c",
  "topicIds": ["<topicId>", "<topicId>"],
  "extrasOn": ["notes", "tests"],
  "revisionOnly": false }
```

- `extrasOn` lists the extras the student kept **on**. With `revisionOnly: true`, `topicIds` is ignored (send `[]`).
- Never send an amount or a userId: the server ignores both. Coupons are not supported on builds yet (400).

`201` response:

```json
{ "state": 201, "message": "Razorpay order created successfully",
  "data": { "razorpayOrderId": "order_…", "rzp_key": "rzp_test_…", "orderNumber": "…",
            "grandTotal": 549, "currency": "INR", "orderStatus": "initiated", "breakdown": { "final": 549, "…": "…" } } }
```

Open Razorpay Checkout with `key = rzp_key`, `order_id = razorpayOrderId`, amount `grandTotal × 100` paise.
If `grandTotal` differs from what you showed (settings changed meanwhile), show the server's number before paying.
Payment success is recorded by the Razorpay webhook; after it, refresh My Courses / the course page.

Errors (`state` = HTTP status, show `message`):

| Status | message |
|---|---|
| 401 | Access token required |
| 400 | This course is not sold as a Course Builder. / This course is not on sale. |
| 400 | Pick at least one chapter. |
| 400 | Topic … is not a chapter of this course's builder. Reload and try again. (re-fetch the builder screen) |
| 400 | This course does not offer Notes / Tests / Revision only. |
| 400 | Coupons cannot be applied to a Course Builder build yet. |
| 409 | You already own this whole course. |

---

## 6. After purchase: locking content on the course screen

Use the course card fields (section 2) plus the class list, which is grouped by chapter:

`GET /courses/:courseId/classes` → `data.classes` is a list of `{ topicId, topicName, classes: [...] }`; every class
card has `isFree` and **`isRevision`** (also on class tabs and today's classes).

```js
function classIsOpen(course, chapterTopicId, cls) {
  if (cls.isFree) return true;
  if (course.is_buy !== 1) return false;
  if (!course.isPartial) return true;                                   // whole course
  if (!course.ownedTopicIds.includes(chapterTopicId)) return false;    // chapter not bought
  if (course.revisionTopicIds.includes(chapterTopicId)) return cls.isRevision === true;
  return true;
}
const notesOpen = (course, open) => open && (!course.isPartial || course.ownedExtras.includes('notes'));
const testsOpen = (course) => course.is_buy === 1 && (!course.isPartial || course.ownedExtras.includes('tests'));
```

- Locked chapter → show "Buy this chapter" (opens the builder with that chapter pre-ticked).
- Revision-only chapter, non-revision class → "Not in Revision only".
- Notes / Tests tabs → locked with "Add Notes / Tests" when the extra was not bought.

The server enforces the same rules on every class, PDF and test, so a wrong lock in the app can never open
paid content: playback answers `403 "You do not have access to this class."`, a class PDF answers 403, and the
test gate answers `restrict: true`.

Test gate: prefer the token-only form `GET /user-test/allow-user-test-course/:seriesId/:courseId` (the old
`/:userId/:seriesId/:courseId` form still works: with a token, a different userId is refused with 403; without a token it
still trusts the URL userId, which will be closed, so always send the token).

---

## 7. For testing: grant a build without paying (admin only)

```sh
curl -X POST https://backend.vidyagramar.com/api/orders/build-grant \
  -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" \
  -d '{ "userId": "<student _id>", "courseId": "6ad73b8ac90f6da685048d8c",
        "topicIds": ["<topicId>"], "extrasOn": ["notes"], "revisionOnly": false }'
```

A grant is a real zero-amount order; deleting the order in admin removes the access again.

---

## 8. Checklist

- [ ] Course cards: "Build your own" from `isBuilderEnabled`; "from ₹`builderFromPrice`".
- [ ] Builder screen renders sections, chapters, counts, hours; toggles follow `offered` / `defaultOn`.
- [ ] Revision only ticks and locks every chapter; turning it off restores picks.
- [ ] Local price matches the table in section 4; "Already at the minimum price" when `atMinimum`.
- [ ] Owned chapters marked; `ownsAll` blocks checkout.
- [ ] Checkout sends picks only; Razorpay opened with the response's key and order id; server price shown if it differs.
- [ ] Course screen locks chapters, revision-only classes, Notes and Tests per section 6.
- [ ] Missing `isPartial` treated as "not a build buyer".
