# Vidyagram catalogue — app team guide

> How the app's **My courses** screen (All, Exams, Skills, Teacher, New, Live, VOD, Old, Free) and the
> teacher page are fed. Two public endpoints, no auth. Verified against production
> (`backend.vidyagramar.com`, backend branch `vidyagram-admin` at 597f1e11c) on 2026-10-21.
> Base URL: `https://backend.vidyagramar.com/api`.

---

## 1. One endpoint for every course tab

`POST /api/courses/filter` — JSON body, all fields optional.

| Field | Values | What it does |
|---|---|---|
| `tab` | `all` `exam` `skills` `new` `live` `vod` `old` `free` `combo` | which tab; see §2 |
| `search` | text | keeps courses whose **title or teacher name** contains it, case-insensitive; blank = no search |
| `mainCategory` | id | narrows to one Exams tile |
| `category` | id | narrows to one chip (Exams or Skills) |
| `userId` | user id | fills `is_buy`, `isPaid`, `isExpired`, `daysLeft` per course (send it whenever the student is signed in) |

Unknown `tab` → 400. Do not send `isOld` (400). The older flags `isLive`, `isRecorded`, `isFree`,
`showInBatchFilter` still work and AND with `tab`, and so does `isCombo`; new code should use `tab` only.

### Response

```json
{
  "state": 200,
  "message": "Courses filtered successfully",
  "courses":       [ ...course objects... ],
  "courseFolders": [ { "id", "title", "coursesCount", "priority", "thumbnail" } ],
  "groups":        [ ...only for tab exam and skills, see §3... ],
  "data": { "courses": [...], "courseFolders": [...], "groups": [...] }
}
```

`courses` and `data.courses` are the same list; use whichever you already read. Courses inside an active
course folder are not in `courses`; the folder appears in `courseFolders` with its count instead.

### Course object (fields the catalogue cards need)

```json
{
  "id": "6ad877e751296d7823391c23",
  "title": "SSC GK Free Batch",
  "banner": "https://…/banner.jpg",
  "price": 1999,
  "discountPrice": 799,
  "isLive": false,
  "isRecorded": true,
  "isFree": true,
  "isOld": false,
  "isCombo": false,
  "showInBatchFilter": true,
  "is_buy": 0,
  "isPaid": false,
  "isExpired": false,
  "daysLeft": null,
  "mainCategory": { "id": "…", "mainCategoryName": "SSC" },
  "category":     { "id": "…", "categoryName": "SSC CGL" },
  "faculties": [ { "id": "…", "name": "Aditya Ranjan Sir", "designation": "Maths faculty", "imageUrl": "…" } ],
  "tags": [ "Railway New Batches" ],
  "validity": "100 Years",
  "studentCount": 0
}
```

Card rules from the prototype:

| On the card | From |
|---|---|
| `LIVE` / `VOD` badge | `isLive` / `isRecorded` |
| `NEW` badge | `showInBatchFilter` |
| "Old batch · VOD" label | `isOld` (fixed text; there is no batch-year field) |
| ₹899 ~~₹1,999~~ 55% off | `discountPrice`, `price`, computed |
| "Enrolled" + Open vs Buy now | `is_buy === 1` (needs `userId`) |
| Free courses | `isFree` |

The full object carries more (descriptions, highlights, FAQ, builder fields); ignore what you don't draw.

## 2. What each tab returns

Every tab returns only current courses: status 1, not hidden, **and not old** (old batches appear on
`old` only). Counts in the UI are `courses.length`.

| `tab` | Courses | Prototype copy |
|---|---|---|
| `all` | everything current | sections built in the app, see below |
| `exam` | courses whose main category is an exam group (every main category except Skills) | tiles + chips from `groups` |
| `skills` | courses under the Skills main category | chips from `groups[0].categories` |
| `new` | `showInBatchFilter` | "12 new courses" |
| `live` | `isLive` (never free) | "6 live courses" |
| `vod` | `isRecorded` | "9 VOD courses" |
| `old` | `isOld` | "5 old courses" + the note "Full recordings of past batches at a lower price. No live classes." |
| `free` | `isFree` | "4 free courses" |
| `combo` | `isCombo`, ticked by hand on the admin course form; a combo also stays on its other tabs | none yet |

**All tab.** One call, `{ "tab": "all" }`, then bucket in the app: New = `showInBatchFilter`, Live =
`isLive`, VOD = `isRecorded`, Free = `isFree`. A course may sit in several sections (a live course that is
also new). "See all" switches to that tab and calls the API with it. The prototype also shows an **Old
courses** section on All; `tab: all` never returns old courses, so either drop that section or make one
extra `{ "tab": "old" }` call for it. "Suggested for you" has its own call, see §2a.

**Search.** Every tab except My courses has a search box. Send `search` with the current `tab` (and
`mainCategory` / `category` if a tile or chip is selected); on `exam` and `skills` the `groups` counts
follow the searched set.

## 2a. Suggested for you

> **Not live yet.** Built and tested locally on 2026-11-04; this call returns 404 until the backend is deployed.

`GET /api/courses/suggested`. Send the student's login token as `Authorization: Bearer <token>` when signed in; there
is no `userId` parameter.

```json
{ "state": 200, "msg": "ok", "data": { "courses": [ ...course objects... ] } }
```

- Each course is the same object as `POST /api/courses/filter` returns (§1), so the same card code draws it.
- `courses` is in the order the admin set, up to 20 courses. An admin picks them on the Suggested for You screen.
- A signed-in student never gets a course they currently hold. A course they held that has expired comes back.
- A course the admin picked that is now inactive or old is left out.
- `courses` can be empty: nothing picked yet, or the student holds them all. Hide the row and its heading then.
- A signed-out caller or an invalid token gets the full list.
- A change on the admin screen shows on the next call.

The row's `+` button (the "Improve suggestions" exam picker in the prototype) does nothing yet: exam picks do not
change this list.

## 3. Exams and Skills: `groups`

Present only for `tab: exam` and `tab: skills`. Counts are taken **before** `mainCategory` / `category`
narrowing, so a selected tile keeps every tile's total.

```json
"groups": [
  {
    "id": "6ad4cce38edc65f31e7c7696",
    "name": "SSC",
    "image": "https://…/ssc.png",
    "priority": 0,
    "coursesCount": 9,
    "categories": [
      { "id": "…", "name": "SSC CGL",  "coursesCount": 4 },
      { "id": "…", "name": "SSC CHSL", "coursesCount": 3 },
      { "id": "…", "name": "SSC GD",   "coursesCount": 2 }
    ]
  },
  { "id": "…", "name": "Railway", "image": "…", "priority": 1, "coursesCount": 3, "categories": [ … ] }
]
```

**Exams screen**

1. `{ "tab": "exam" }` → draw a tile per `groups[]` entry ("SSC · 9 courses"), ordered as returned.
   Groups with no current course are absent, so never draw an empty tile.
2. Tile tapped → `{ "tab": "exam", "mainCategory": "<group id>" }` → `courses` is that group; draw the
   chip row from that group's `categories` with an "All" chip first.
3. Chip tapped → add `"category": "<category id>"`.

**Skills screen**

1. `{ "tab": "skills" }` → `groups` has exactly one entry (Skills); its `categories` are the chips
   ("All skills" = `groups[0].coursesCount`, then AI, Design, Video editing with counts).
2. Chip tapped → `{ "tab": "skills", "category": "<id>" }`.
3. If no Skills main category exists the call returns `courses: []`, `groups: []`, status 200.

## 4. Teacher tab and teacher page

`GET /api/faculty/catalogue?subject=&search=` — teachers with at least one current course, **top rated
first** (rating desc, unrated last; then review count; then admin priority; then name).

```json
{
  "status": 200,
  "message": "Teacher catalogue fetched",
  "teachers": [
    {
      "id": "6ad894aa62a72d8c9b05e762",
      "name": "Aditya Ranjan Sir",
      "imageUrl": "https://…/aditya.jpg",
      "designation": "Maths faculty",
      "subject": "Maths",
      "rating": 4.9,
      "reviewCount": 18420,
      "coursesCount": 5,
      "mainCategories": [ { "id": "…", "name": "SSC", "image": "…" }, { "id": "…", "name": "Railway", "image": "…" } ]
    }
  ],
  "subjects": [ { "name": "Maths", "count": 1 }, { "name": "Reasoning", "count": 2 } ],
  "data": { "teachers": [...], "subjects": [...] }
}
```

| On screen | From |
|---|---|
| "12 teachers · top rated first" | `teachers.length` |
| Subject chips "All 12 · Maths 1 · Reasoning 2" | `subjects[]`, "All" = `teachers.length` before filtering |
| Chip tapped | `?subject=Maths` (exact value from `subjects[].name`); `subjects` counts stay whole |
| Search box | `?search=text` (teacher name or subject) |
| Row: name, subject pill, 4.9 ★★★★★ (18.4k reviews), exam-body chips, "5 courses" | `subject`, `rating`, `reviewCount`, `mainCategories[]`, `coursesCount` |
| No stars | `rating` is `null` (admin has not entered one); `reviewCount` may be `null` too |

`rating` and `reviewCount` are admin-entered numbers, not computed from student reviews.

**Teacher page** (after a tap):

1. Header card: the entry you already have from the list, or on a direct open
   `GET /api/faculty/catalogue/<id>` → `{ status, message, data: <one entry> }`. 404 when the teacher is
   inactive or has no current course; 400 for a malformed id.
2. "5 courses" and the cards: `POST /api/courses/filter { "facultyId": "<id>", "userId": "<user>" }`.
   `coursesCount` on the entry equals this call's `courses.length` (both use the same rule: current, not
   old), except that a course inside an active course folder counts for the teacher but is listed under
   `courseFolders`.
3. Search on that page: the same call with `search`.

## 5. Admin side, for context

- **Old batch** is a checkbox on the course form; ticking it turns Live off. Old courses show an "Old"
  badge in the admin lists.
- **Skills** is a fixed main category (cannot be deleted). Skill courses are filed by picking Skills then
  a category (AI, Design, Video editing) in the usual two dropdowns. Every other main category is an
  exam group.
- **Teacher** subject, rating and review count are three optional fields on the faculty form.

## 6. State of the production data (2026-10-21)

- Every imported course sits under main category "Vidyagram" and faculty "Vidyagram Team", so today
  `tab: exam` returns one tile and the Teacher tab one teacher with no subject or rating. Tiles for SSC /
  Railway and real teachers appear as the admin re-files courses and fills in teachers.
- The Skills main category exists with a placeholder image and no categories or courses yet.
- No course is marked old yet.

## 7. Quick checks

```bash
curl -s https://backend.vidyagramar.com/api/courses/filter -H 'content-type: application/json' -d '{"tab":"exam"}'
```

```bash
curl -s https://backend.vidyagramar.com/api/courses/filter -H 'content-type: application/json' -d '{"tab":"skills","search":"ai"}'
```

```bash
curl -s 'https://backend.vidyagramar.com/api/faculty/catalogue?subject=Maths'
```
