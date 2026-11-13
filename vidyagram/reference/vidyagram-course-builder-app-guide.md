# Vidyagram Course Builder — app integration guide

For the app and website team. The backend is live on `https://backend.vidyagramar.com/api` (2026-10-20). Every
example below is a real response shape; ids are from the demo course.

> **Live since 12 Nov 2026:** an **eBooks** extra, **validity** tiers, and **Revision only** paused. A course
> whose builder settings were not saved again since then answers with eBooks not offered and Lifetime as its only
> validity, which is how builds worked before. What changed is listed in section 9.

A student can buy **chosen chapters** of a course instead of the whole course. They can switch off three
extras to pay less:

- **Notes**: the notes attached to each class.
- **Tests**: the course's tests.
- **eBooks**: the separate PDFs attached to the course.

They also pick a **validity** (for example 1 month, 1 year or Lifetime), each priced up or down from the one the
course includes. The server prices every build; the app shows the price and the server charges its own.

**Revision only** (every chapter, only the classes marked as revision, at a discount) is **paused**: the server
always reports it as not offered and refuses it at checkout. Keep your code for it, hidden.

---

## 1. Test straight away

| What | Value |
|---|---|
| Base URL | `https://backend.vidyagramar.com/api` |
| Demo course | `6ad73b8ac90f6da685048d8c` — "Course Builder Demo · Maths by Aditya Ranjan Sir (test)" |
| Its settings | max ₹699, min ₹149, struck-out ₹1999, Notes ₹60 off, Tests ₹90 off, eBooks ₹49 off; validity 1 month −₹50, 6 months −₹25, **1 year included**, Lifetime +₹100; Revision only paused |
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
| `revisionTopicIds` | owned chapters where **only revision classes** open (from Revision only; only builds bought before the pause) |
| `ownedExtras` | any of `"notes"`, `"tests"`, `"ebooks"`. A build bought before eBooks existed with Notes on also lists `"ebooks"` (it paid for both) |
| `revisionOnly` | `true` when every owned chapter is revision-only |
| `daysLeft` | days until the student's builds of this course end; `null` when any of them is Lifetime |
| `isExpired` | when every build of the course has run out, the card goes back to `is_buy: 0`, `isExpired: true`, `daysLeft: 0`, with no `isPartial` |

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
      "notes":  { "offered": true, "value": 60, "defaultOn": true },
      "tests":  { "offered": true, "value": 90, "defaultOn": true },
      "ebooks": { "offered": true, "value": 49, "defaultOn": true }
    },
    "revisionOnly": { "offered": false, "discount": 0 },
    "validity": {
      "included": "1y",
      "options": [
        { "key": "1m",       "label": "1 month",  "days": 30,   "priceChange": -50 },
        { "key": "6m",       "label": "6 months", "days": 180,  "priceChange": -25 },
        { "key": "1y",       "label": "1 year",   "days": 365,  "priceChange": 0 },
        { "key": "lifetime", "label": "Lifetime", "days": null, "priceChange": 100 }
      ]
    },
    "validityDays": 365,
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
                   "ownedExtras": ["notes", "ebooks"], "revisionOnly": false }
  }
}
```

How to render it:

- **Sections** → expandable rows: `sectionName`, "`weight`% of syllabus", "`n` of `chapterCount` chapters", `classCount`
  classes. **Chapters** → checkboxes with `topicName`, `classCount`, `hours`.
- A chapter with `price: 0` is free to tick (here "Work & Wages" and "Circular Motion").
- **Extras**: show Notes / Tests / eBooks only when `offered`; start each at `defaultOn`. Footer labels as in the
  design: "Notes ₹60", "Online tests ₹90", "eBooks ₹49" (`value` is what switching it off takes off).
- **Validity**: a menu of `validity.options` (only offered tiers come back, already in order), starting on
  `validity.included`. Label each "`label` · Included" for the included one, else "`label` · −₹50" / "· +₹100"
  from `priceChange`. Footer pill: the picked tier's `label` ("1 year validity", "Lifetime validity").
  `validityDays` is the included tier's days (`null` = Lifetime), for screens that only show the default.
- **Revision only** (paused): `revisionOnly.offered` is always `false` for now, so keep the switch hidden. When it
  comes back: label it exactly "Revision only"; ON ticks **and locks** every chapter, OFF restores the picks.
- **Select all / Clear** act on chapters. Disable **Continue** while no chapter is picked.
- `ownership.ownsAll` → the student owns the whole course: show "You already own this course", no checkout.
  `ownership.ownedTopicIds` → mark those chapters "Owned" (they can still buy other chapters).
- Footer: "`n` chapters · `classes` classes · `hours` hours · `x`% of syllabus", where `x` = sum of picked chapter weights.

---

## 4. The price (show it instantly, the server charges its own)

Run this on every tap. The numbers come from the builder response; `chapter.price` is already
`customPrice ?? maxPrice × weight / 100`.

```js
function priceBuild(b, { topicIds, extrasOn, validity }) {      // extrasOn: e.g. ['notes', 'tests', 'ebooks']
  const picked = b.sections.flatMap(s => s.chapters).filter(c => topicIds.includes(c.topicId));
  let price = Math.min(picked.reduce((sum, c) => sum + c.price, 0), b.maxPrice);   // the max caps chapters only
  for (const key of ['notes', 'tests', 'ebooks']) {
    const extra = b.extras[key];
    if (extra?.offered && !extrasOn.includes(key)) price -= extra.value;
  }
  const options = b.validity?.options ?? [];
  const tier = options.find(o => o.key === (validity ?? b.validity?.included));
  const change = tier ? tier.priceChange : 0;
  // The minimum is a hard floor: a cheaper tier never goes below it; a longer tier adds on top of it.
  const final = Math.round(Math.max(Math.max(price, b.minPrice) + change, b.minPrice));
  return {
    final,
    atMinimum: price <= b.minPrice,          // measured before validity: extras switched off no longer lower it
    struckOut: b.mrp ? Math.round(final * b.mrp / b.maxPrice) : null,
  };
}
```

Check your implementation against the demo course. These are the backend's own results for its live settings
(max ₹699, min ₹149, struck-out ₹1999, Notes ₹60, Tests ₹90, eBooks ₹49; validity 1 month −₹50, 6 months −₹25,
**1 year included**, Lifetime +₹100):

| Picks | Price | Struck-out |
|---|---|---|
| every chapter, all extras on, 1 year | **₹699** | ₹1999 |
| every chapter, eBooks off | **₹650** | ₹1859 |
| every chapter, Notes + Tests + eBooks off | **₹500** | ₹1430 |
| every chapter, all extras on, 1 month | **₹649** | ₹1856 |
| every chapter, all extras on, 6 months | **₹674** | ₹1928 |
| every chapter, all extras on, Lifetime | **₹799** | ₹2285 |
| every chapter, Notes only, 1 month | **₹510** | ₹1458 |
| one small chapter (Pipe & Cistern, 0.5%), 1 year | **₹149** (`atMinimum`) | ₹426 |
| one small chapter, 1 month | **₹149** (`atMinimum`; never below the minimum) | ₹426 |
| one small chapter, Lifetime | **₹249** (`atMinimum`; Lifetime adds on top) | ₹712 |

When `atMinimum` is true, switching more extras off does not lower the price: show
"Already at the minimum price" under the toggles. Show `struckOut` struck through next to the price when it is
higher than `final`.

---

## 5. Checkout

`POST /orders/build-checkout` — **login required** (`Authorization: Bearer <student token>`).

```json
{ "courseId": "6ad73b8ac90f6da685048d8c",
  "topicIds": ["<topicId>", "<topicId>"],
  "extrasOn": ["notes", "tests", "ebooks"],
  "validity": "6m",
  "revisionOnly": false }
```

- `extrasOn` lists the extras the student kept **on** (`"notes"`, `"tests"`, `"ebooks"`).
- `validity` is the picked tier's `key`. Leave it out (or send `null`) for the included tier.
- `revisionOnly` must be `false` while Revision only is paused (or leave it out).
- Never send an amount or a userId: the server ignores both. Coupons are not supported on builds yet (400).

`201` response:

```json
{ "state": 201, "message": "Razorpay order created successfully",
  "data": { "razorpayOrderId": "order_…", "rzp_key": "rzp_test_…", "orderNumber": "…",
            "grandTotal": 674, "currency": "INR", "orderStatus": "initiated",
            "breakdown": { "final": 674, "atMinimum": false,
                           "validity": { "key": "6m", "label": "6 months", "days": 180, "priceChange": -25 }, "…": "…" } } }
```

Open Razorpay Checkout with `key = rzp_key`, `order_id = razorpayOrderId`, amount `grandTotal × 100` paise.
If `grandTotal` differs from what you showed (settings changed meanwhile), show the server's number before paying.
Payment success is recorded by the Razorpay webhook; after it, refresh My Courses / the course page. Validity
starts at payment: a 6-month build ends 180 days after it is paid; Lifetime never ends.

Errors (`state` = HTTP status, show `message`):

| Status | message |
|---|---|
| 401 | Access token required |
| 400 | This course is not sold as a Course Builder. / This course is not on sale. |
| 400 | Pick at least one chapter. |
| 400 | Topic … is not a chapter of this course's builder. Reload and try again. (re-fetch the builder screen) |
| 400 | This course does not offer Notes / Tests / eBooks / Revision only. |
| 400 | This course does not offer 6 months validity. (re-fetch the builder screen) |
| 400 | validity must be one of 1m, 3m, 6m, 1y, 2y, 3y, 4y, 5y, lifetime. |
| 400 | An extra must be notes, tests or ebooks. |
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
// A class's own notes: open when the class is open and Notes was bought.
const notesOpen = (course, open) => open && (!course.isPartial || course.ownedExtras.includes('notes'));
const testsOpen = (course) => course.is_buy === 1 && (!course.isPartial || course.ownedExtras.includes('tests'));
// The course's separate PDFs (eBooks): open when the PDF's chapter is owned and eBooks was bought.
const ebookOpen = (course, pdfChapterTopicId) => course.is_buy === 1 &&
  (!course.isPartial || (course.ownedExtras.includes('ebooks') && course.ownedTopicIds.includes(pdfChapterTopicId)));
```

- Locked chapter → show "Buy this chapter" (opens the builder with that chapter pre-ticked).
- Revision-only chapter, non-revision class → "Not in Revision only" (old Revision-only builds only).
- Class notes / Tests / the course's PDFs → locked with "Add Notes" / "Add Tests" / "Add eBooks" when that extra
  was not bought.
- A build that has run out (`isExpired: true`, `is_buy: 0`) locks everything again; offer the builder.

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
        "topicIds": ["<topicId>"], "extrasOn": ["notes", "ebooks"], "validity": "1m", "revisionOnly": false }'
```

A grant is a real zero-amount order; deleting the order in admin removes the access again. A grant with a
validity ends after that tier like a paid build (a 1-month grant is the quick way to test expiry).

---

## 8. Checklist

- [ ] Course cards: "Build your own" from `isBuilderEnabled`; "from ₹`builderFromPrice`".
- [ ] Builder screen renders sections, chapters, counts, hours; Notes / Tests / eBooks follow `offered` / `defaultOn`.
- [ ] Validity menu lists `validity.options`, starts on `validity.included`, labels "· Included" / "· −₹50" / "· +₹100".
- [ ] Revision only switch stays hidden while `revisionOnly.offered` is `false`.
- [ ] Local price matches the table in section 4; "Already at the minimum price" when `atMinimum`.
- [ ] Owned chapters marked; `ownsAll` blocks checkout.
- [ ] Checkout sends picks, `extrasOn` and `validity` only; Razorpay opened with the response's key and order id; server price shown if it differs.
- [ ] Course screen locks chapters, revision-only classes, class notes, Tests and the course's PDFs per section 6.
- [ ] Course card shows `daysLeft` for an expiring build; an expired build reads as not bought.
- [ ] Missing `isPartial` treated as "not a build buyer".

---

## 9. What changed on 2026-11-12 (live)

| Area | Change |
|---|---|
| Extras | New **eBooks** extra (`extras.ebooks`, `"ebooks"` in `extrasOn` / `ownedExtras`) for the course's separate PDFs. **Notes** now means only the notes attached to each class. Builds bought before this keep both under Notes. |
| Validity | New `validity` and `validityDays` on `GET /courses/:courseId/builder`; checkout, grant and quote take a `validity` key; `breakdown.validity` names the tier. Builds now expire after their tier (Lifetime never); course cards show `daysLeft` and `isExpired` for builds. Courses not set up yet send Lifetime only, at no change: same as today. |
| Price | The validity change goes on top of the price raised to the minimum, then the minimum applies again (section 4). `builderFromPrice` stays the minimum. |
| Revision only | Paused: `revisionOnly.offered` is always `false`; checkout refuses `revisionOnly: true`. Old Revision-only builds keep their access and fields. |

