# Vidyagram Home "Continue where you left": app team guide

> The backend half of `doc/pending_api_specs/home_continue_backend_spec.md`, and the answer to its Appendix A.
>
> Base URL: `https://backend.vidyagramar.com/api`. **Live since 11 November 2026, 19:16 IST.** Nothing in the app
> needs to change: the endpoint follows the spec's contract. Sections 4 and 5 are the places it differs or adds detail.

---

## 1. The endpoint

```http
GET /api/home/continue
Authorization: Bearer <student token>
```

| Case | Response |
|---|---|
| A student who owns a course | `200`, `data.title` = `"My Courses"`, `data.courses[]` with `continueAction: "resume"` |
| A student who owns none | `200`, `data.title` = `null`, `data.courses[]` with `"watch_demo"` or `"buy"` |
| Nothing to show | `200`, `{ "title": null, "courses": [] }`. Hide the section |
| No token, bad token, expired token | The usual 401s, same message text as every other route |
| Anything else | `{ "state": 500, "msg": "..." }`. Hide the section |

The envelope is `{ "state": 200, "msg": "OK", "data": { "title", "courses" } }`. The student is always read from the
token. At most 10 courses come back.

---

## 2. What each card carries

Each course in `data.courses[]` is a full course object, so the course page opens from it the way it does elsewhere.

- A `watch_demo` or `buy` card is the `POST /courses/filter` course object, plus `continueAction`.
- A `resume` card is the `POST /courses/my-courses` course object, plus `continueAction`.

The fields the section reads:

| Field | Notes |
|---|---|
| `id`, `title`, `banner` | As on every course object |
| `continueAction` | `"watch_demo"`, `"buy"` or `"resume"` |
| `isPaid`, `is_buy` | `true` / `1` on every `resume` card, `false` / `0` on the others |
| `isFree` | `true` only on a `resume` card for an enrolled free course. Never on `watch_demo` or `buy` |
| `price`, `discountPrice` | On every card |
| `demoVideos[]`, `introVideo` | On `watch_demo` and `buy` cards. Shape `{ id, title, url, image, isChat }`, as the banners send. See 4.1 |
| `progress_percentage` | On `resume` cards. A whole number, 0 to 100 |

---

## 3. Which courses, and which button

**Owner.** A student owns a course when they hold an active purchase of it (a full purchase or a course-builder
purchase) or have enrolled in a free course. An owner gets only owned courses, all `resume`. The course they watched
most recently (latest `WATCH_VIDEO` in the last 30 days) comes first. The rest follow by most recent purchase.

**Not an owner.** The student gets the courses they showed interest in during the last **30 days**, newest first:

| The student's events on the course | `continueAction` |
|---|---|
| `WATCH_DEMO`, or `SCREEN_VIEW` with `screenName: "Checkout"`, or `PAYMENT_STARTED` | `buy` |
| Only `COURSE_VIEW`, and the course has a demo | `watch_demo` |
| Only `COURSE_VIEW`, and the course has no demo | `buy` |

A course is left out when it is unpublished, free, or has no plan a new buyer can take. A card never moves back from
`buy` to `watch_demo` within the 30 days. Buying any course makes the student an owner, so the next call returns the
owned list.

---

## 4. Where the backend adds to the spec

### 4.1 Which demo

`demoVideos` and `introVideo` on these cards are the course page's demo, the same pair `POST /courses/by-id-2` sends:
the course's free classes and its intro video. They are **not** the `demoVideos` field `POST /courses/filter` sends
elsewhere. Watch demo therefore plays the same video as the course page and the Home banner's "Free demo".
`watch_demo` is sent only when one of the two is present, so a `watch_demo` card always has something to play.

Many current courses have no free class and no intro video. Those show **Buy now** straight away.

### 4.2 Enrolled free courses

An enrolled free course makes the student an owner and appears with `resume`. In `POST /courses/my-courses` the same
course reads `isEnrolled: true` and `isPaid: false`. On this section it is sent with `isPaid: true` and `is_buy: 1`, as
spec 3.2 asks, and `isFree: true`.

### 4.3 Expired purchases

An expired purchase does not count as owned. A student whose only course has expired gets the non-owner list, which
can include that course again as a `watch_demo` or `buy` card.

### 4.4 `progress_percentage`

Whole number on this route, rounded (`0.24` → `0`, `42.6` → `43`). `POST /courses/my-courses` still sends the
unrounded value, which can be a decimal. If the same parser reads both, read it as a number, not an int.

### 4.5 Freshness

The section counts an event the app sent a moment before the call. The app needs no delay between flushing its
event queue and calling this endpoint.

---

## 5. What the app must send

The section is only as good as the events. Each of these needs the top-level `courseId`:

| Event | When | Status on 11 November 2026 |
|---|---|---|
| `COURSE_VIEW` | A course page opens | All 677 in the last 30 days carry `courseId` |
| `WATCH_VIDEO` | A class plays | 176 of 205 carry `courseId`. Those without it do not move their course up the owner list |
| `WATCH_DEMO` | A demo plays: from a paid course's class list, the Home banner ("Free demo", quick preview), and this section's Watch demo button | Send `courseId`, `classId`, `videoId` |
| `SCREEN_VIEW`, `screenName: "Checkout"` | The payment page opens for a course | New in this app version. Only the exact name `"Checkout"` counts. The router's own `ExplorePurchaseRoute` view is ignored |
| `PAYMENT_STARTED` | Razorpay checkout opens | Send `courseId` from this version. Older builds' events still count: the backend finds the course from `orderId` (the Razorpay `order_…` id) |

Students on app builds that send no events get an empty section, which the app hides.

---

## 6. Real responses

Taken 11 November 2026 from the live service for every student who sent course events in the last 30 days (17
students): 10 get the owner list, 6 the non-owner list, 1 an empty section. Trimmed to the fields the section reads.
`banner`, `demoVideos` and `introVideo` are shown as present or a count. The live objects carry the full course object.

A student who owns no course (both courses have no demo, hence `buy`):

```json
{
  "title": null,
  "courses": [
    { "id": "6ad5fa4c308a95d039c360fe", "title": "🎯. Maths VOD Batch by Aditya Ranjan Sir | Arithmetic + Advance (Pre to Mains) | For all Govt Exams.",
      "continueAction": "buy", "isPaid": false, "is_buy": 0, "isFree": false, "price": 999, "discountPrice": 699,
      "banner": "yes", "demoVideos": 0, "introVideo": "no" },
    { "id": "6ad5fab3308a95d039c391c1", "title": "Maths Special - SSC CGL Mains Batch 2026 🔥",
      "continueAction": "buy", "isPaid": false, "is_buy": 0, "isFree": false, "price": 899, "discountPrice": 899,
      "banner": "yes", "demoVideos": 0, "introVideo": "no" }
  ]
}
```

An owner, first 3 of 10 courses. This was captured before progress was rounded at 19:24 IST, so the first card now
reads `0`, not `0.24`.

```json
{
  "title": "My Courses",
  "courses": [
    { "id": "6ad73b8ac90f6da685048d8c", "title": "Course Builder Demo · Maths by Aditya Ranjan Sir (test)",
      "continueAction": "resume", "isPaid": true, "is_buy": 1, "isFree": false, "progress_percentage": 0.24 },
    { "id": "6ad5fa97308a95d039c3886e", "title": "AI Mastery Mobile Edition Batch By Aditya Sir",
      "continueAction": "resume", "isPaid": true, "is_buy": 1, "isFree": false, "progress_percentage": 0 },
    { "id": "6ad5fa96308a95d039c38833", "title": "Mobile Graphic Design Mastery Course By Aditya Sir",
      "continueAction": "resume", "isPaid": true, "is_buy": 1, "isFree": false, "progress_percentage": 4 }
  ]
}
```

Some stored course titles contain HTML entities (one owned title reads `&amp;`). That comes from the course data, as
on every other course endpoint.

---

## 7. How to try it

1. Sign in as a test student who owns no course. Open a course page, return to Home: the course appears.
2. On a course with a free class or an intro video it shows Watch demo. Tap it, play the demo, return to Home: it now
   shows Buy now.
3. Open the payment page for another course, return to Home: that course shows Buy now and sits first.
4. Buy any course: the next Home shows "My Courses" with Resume cards only.

Or call it directly:

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://backend.vidyagramar.com/api/home/continue
```

---

## 8. Not built

The two titles are fixed in the backend (`null` and `"My Courses"`). Spec 4.3's optional admin setting is not built.
Ask if you want it.
