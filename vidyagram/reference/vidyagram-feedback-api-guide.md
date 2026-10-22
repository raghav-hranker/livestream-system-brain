# Vidyagram feedback: app team guide

> How the app's **Rate** sheet works on course, practice batch, class, PDF, test and ebook screens. Three
> endpoints, all behind the student's login. Not deployed yet: verified against the integration backend
> (branch `feat/vg-feedback` at d29e08699, in-memory Mongo, starter tags seeded) on 2026-10-22; the error
> messages in §5 and §7 were re-run on `feat/vg-feedback-msg` at d46be69fe the same day.
> Base URL once deployed: `https://backend.vidyagramar.com/api`.
>
> Sample ids below are placeholders (`<courseId>`, `<classId>`…) in place of the real ObjectIds the
> calls returned. Everything else is the real response.

---

## 1. Auth and response shape

Every call, including the tag list, needs the student's token:

```
Authorization: Bearer <token from login>
```

| Status | `msg` | When |
|---|---|---|
| 401 | `Access token required` | no header |
| 401 | `Invalid token` | bad token |
| 401 | `Token expired. Please call /api/users/refresh-token to get a new token.` | refresh and retry |
| 401 | `Session has been terminated. Please login again.` | logged out elsewhere |
| 403 | `Student login required` | an admin token on `mine` or `PUT` |

Every response is `{ "state": <status>, "msg": "...", "data": ... }`. Body validation errors add an
`errors` array of `{ path, message }`. Note `msg`, not `message`.

## 2. The Rate sheet

One component for all six kinds.

1. **Open.** Call `GET /api/feedback/mine?kind=<kind>&id=<id>`. `data: null` means not rated yet: empty
   stars. Otherwise prefill stars, tags and note, and title the sheet "Edit your rating".
2. **Stars.** 1 to 5, whole numbers.
3. **Tags, only at 1 to 3 stars.** Show that kind's complaint tags from the cached list (§3) as chips;
   the student picks zero or more. At 4 or 5 stars hide the chips.
4. **Note.** Optional at any rating, max 1000 characters (count after trimming). Show a counter.
5. **Submit.** `PUT /api/feedback` (§4). On 200 close the sheet and keep `data` as the new "mine".

**Raising a rating to 4 or 5.** The student had 2 stars with tags and taps 5. Clear the selected tags in
the sheet and send `"tags": []`. Sending any tag with 4 or 5 stars is a 400.

**Editing is a full replace.** `PUT` writes exactly what you send. A missing or empty `note` deletes the
earlier note; a missing `tags` means no tags. Always send the whole sheet: stars, the selected tags and
the note text as it stands in the box.

One student has one rating per item. A second `PUT` changes the same row (`id` and `createdAt` stay,
`updatedAt` moves).

## 3. Tags: fetch once, cache

`GET /api/feedback/tags` returns every kind's active tags, grouped by kind and in display order. Fetch it
once after login (it needs the token), cache it, and refresh it on the next app start. Tags are edited by
the admin without an app release, so do not hard-code them.

```json
{
  "state": 200,
  "msg": "Feedback tags fetched",
  "data": {
    "course": [
      { "code": "classes_missed", "label": "Classes missed or late" },
      { "code": "content_outdated", "label": "Content outdated" },
      { "code": "not_worth_price", "label": "Not worth the price" }
    ],
    "practiceBatch": [
      { "code": "too_few_tests", "label": "Too few tests" },
      { "code": "questions_repeat", "label": "Questions repeat" },
      { "code": "not_worth_price", "label": "Not worth the price" }
    ],
    "class": [
      { "code": "audio_unclear", "label": "Audio unclear" },
      { "code": "video_quality", "label": "Video quality" },
      { "code": "too_fast", "label": "Too fast" },
      { "code": "too_slow", "label": "Too slow" },
      { "code": "hard_to_follow", "label": "Hard to follow" },
      { "code": "teacher_hard_to_understand", "label": "Teacher hard to understand" },
      { "code": "started_late", "label": "Started late" }
    ],
    "pdf": [
      { "code": "typos", "label": "Typos or errors" },
      { "code": "hard_to_read", "label": "Hard to read" },
      { "code": "incomplete", "label": "Incomplete" }
    ],
    "test": [
      { "code": "wrong_answer_key", "label": "Wrong answer key" },
      { "code": "unclear_question", "label": "Unclear question" },
      { "code": "too_hard", "label": "Too hard" },
      { "code": "too_easy", "label": "Too easy" },
      { "code": "technical_issue", "label": "Technical issue" }
    ],
    "ebook": [
      { "code": "typos", "label": "Typos or errors" },
      { "code": "hard_to_read", "label": "Hard to read" },
      { "code": "outdated", "label": "Outdated" },
      { "code": "incomplete", "label": "Incomplete" }
    ]
  }
}
```

- Show `label`, send `code`. Codes never change; labels may.
- Look tags up by kind: the same code can exist under two kinds (`typos` on pdf and ebook), and a code
  from another kind is refused.
- Every kind key is always present, with `[]` if the admin retired all its tags. An empty list means no
  tag chips; stars and note still work.
- `?kind=pdf` returns only `{ "pdf": [ ... ] }`, same shape. Use it only if you need to refresh one kind.
- A retired tag drops out of the list. If a student's earlier rating holds a tag that is no longer listed,
  drop it from the sheet before saving, or the save is a 400.

## 4. Save: `PUT /api/feedback`

```json
{
  "kind": "class",
  "id": "<classId>",
  "parent": { "kind": "course", "id": "<courseId>" },
  "rating": 2,
  "tags": ["audio_unclear", "too_fast"],
  "note": "Mic kept cutting out after 20 minutes"
}
```

| Field | Rule |
|---|---|
| `kind` | `course` `practiceBatch` `class` `pdf` `test` `ebook` |
| `id` | the item's 24-character id |
| `parent` | required for `class`, `pdf`, `test`; must be absent (or `null`) for the other three; see §5 |
| `rating` | integer 1 to 5 |
| `tags` | codes for this kind; only at 1 to 3 stars, else `[]`; duplicates are dropped |
| `note` | optional, trimmed, max 1000 |

The student is always the token's user. Never send a user id.

### Which id is which

| `kind` | `id` is |
|---|---|
| `course` | the course id |
| `practiceBatch` | the practice batch id |
| `class` | the class id |
| `pdf` | the PDF id from the course's or batch's PDF list |
| `test` | the test (series) id |
| `ebook` | the learn-library ebook id (the one `GET /api/learn-library/<id>/access` takes) |

### Sample response per kind

Course, 2 stars:

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"course","id":"<courseId>"},"parent":null,"rating":2,"tags":["classes_missed"],"note":"Two live classes were cancelled this week","consumed":true,"createdAt":"2026-10-22T10:33:37.993Z","updatedAt":"2026-10-22T10:33:37.993Z"}}
```

Practice batch, 5 stars, no note:

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"practiceBatch","id":"<batchId>"},"parent":null,"rating":5,"tags":[],"note":"","consumed":true,"createdAt":"2026-10-22T10:33:38.012Z","updatedAt":"2026-10-22T10:33:38.012Z"}}
```

Class from a course:

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"class","id":"<classId>"},"parent":{"kind":"course","id":"<courseId>"},"rating":2,"tags":["audio_unclear","too_fast"],"note":"Mic kept cutting out after 20 minutes","consumed":false,"createdAt":"2026-10-22T10:33:38.030Z","updatedAt":"2026-10-22T10:33:38.030Z"}}
```

PDF from a course:

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"pdf","id":"<pdfId>"},"parent":{"kind":"course","id":"<courseId>"},"rating":3,"tags":["typos"],"note":"","consumed":false,"createdAt":"2026-10-22T10:33:38.048Z","updatedAt":"2026-10-22T10:33:38.048Z"}}
```

Test from a practice batch:

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"test","id":"<testId>"},"parent":{"kind":"practiceBatch","id":"<batchId>"},"rating":1,"tags":["wrong_answer_key"],"note":"Q14 answer key says B, the solution says C","consumed":false,"createdAt":"2026-10-22T10:33:38.066Z","updatedAt":"2026-10-22T10:33:38.066Z"}}
```

Ebook, 4 stars:

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"ebook","id":"<ebookId>"},"parent":null,"rating":4,"tags":[],"note":"Clear and short","consumed":false,"createdAt":"2026-10-22T10:33:38.089Z","updatedAt":"2026-10-22T10:33:38.089Z"}}
```

`consumed` is for the admin (did the student watch, open or attempt it before rating). The app can ignore
it. `note` comes back as `""` when there is none.

### Editing: 2 stars raised to 5

The class above, reopened. Send the note again and clear the tags:

```json
{ "kind": "class", "id": "<classId>", "parent": { "kind": "course", "id": "<courseId>" }, "rating": 5, "tags": [], "note": "Mic kept cutting out after 20 minutes" }
```

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"class","id":"<classId>"},"parent":{"kind":"course","id":"<courseId>"},"rating":5,"tags":[],"note":"Mic kept cutting out after 20 minutes","consumed":false,"createdAt":"2026-10-22T10:33:38.030Z","updatedAt":"2026-10-22T10:33:38.118Z"}}
```

The same call without `note` returns `"note": ""`: the note is gone.

## 5. Which screen sends which parent

A class, PDF or test is rated from the container the student opened it in. Pass the container you
navigated from; do not look it up.

| Screen | `kind` | `parent` |
|---|---|---|
| Course page | `course` | none |
| Practice batch page | `practiceBatch` | none |
| Class player opened from a course | `class` | `{ "kind": "course", "id": "<courseId>" }` |
| Class player opened from a practice batch | `class` | `{ "kind": "practiceBatch", "id": "<batchId>" }` |
| PDF opened from a course's PDF list | `pdf` | `{ "kind": "course", ... }` |
| PDF opened from a practice batch's PDF list | `pdf` | `{ "kind": "practiceBatch", ... }` |
| Test opened from a course | `test` | `{ "kind": "course", ... }` |
| Test opened from a practice batch | `test` | `{ "kind": "practiceBatch", ... }` |
| Ebook screen | `ebook` | none |

- The item must be placed in that container, or the save is a 403 ("This class is not in that course or
  practice batch.").
- A class the student rated inside a course and later inside a practice batch is still one rating.
  `mine` takes only `kind` and `id` and returns it with the latest `parent`.
- A notes PDF attached to a class (not in the course's PDF list) has no Rate. Students rate the class.

## 6. Read back: `GET /api/feedback/mine?kind=&id=`

Not rated yet:

```json
{"state":200,"msg":"Feedback fetched","data":null}
```

Rated:

```json
{"state":200,"msg":"Feedback fetched","data":{"id":"<feedbackId>","target":{"kind":"class","id":"<classId>"},"parent":{"kind":"course","id":"<courseId>"},"rating":2,"tags":["audio_unclear","too_fast"],"note":"Mic kept cutting out after 20 minutes","consumed":false,"createdAt":"2026-10-22T10:33:38.030Z","updatedAt":"2026-10-22T10:33:38.030Z"}}
```

`data` has the same shape as the `PUT` response. Missing `kind` or `id` is a 400
(`Invalid query parameters`, `errors: [{"path":"id","message":"Required"}]`).

## 7. Errors and what to show

400s on `PUT` are bugs in the request, not something the student did. Log `msg` and `errors`, and show
"Could not save your rating. Please try again." The two exceptions are worth catching in the sheet before
sending: the note length and tags at 4 or 5 stars.

| Status | `msg` (and `errors`) | Cause | Show |
|---|---|---|---|
| 400 | `Invalid feedback`, `rating`: `Number must be greater than or equal to 1` / `less than or equal to 5` / `Expected integer, received float` | rating not 1 to 5 | generic |
| 400 | `Invalid feedback`, `tags`: `Tags are only for ratings of 1 to 3 stars` | tags sent with 4 or 5 stars | generic (clear tags, §2) |
| 400 | `Invalid feedback`, `note`: `String must contain at most 1000 character(s)` | note too long | "Keep your note under 1000 characters." |
| 400 | `Invalid feedback`, `kind`: `Invalid enum value. Expected 'course' \| 'practiceBatch' \| 'class' \| 'pdf' \| 'test' \| 'ebook', received 'faculty'` | unknown kind | generic |
| 400 | `Invalid feedback`, `id`: `must be an id` | id not 24 hex characters | generic |
| 400 | `Invalid feedback`, `parent.kind`: `Invalid enum value. Expected 'course' \| 'practiceBatch', received 'class'` | bad parent kind | generic |
| 400 | `Rate this class from the course or practice batch it is in.` (also `this PDF`, `this test`) | parent missing | generic |
| 400 | `Rate this course on its own, not from a course or practice batch.` (also `this practice batch`, `this ebook`) | parent sent where none belongs | generic |
| 400 | `boring cannot be used on a class.` (several codes are comma-separated; `audio_unclear cannot be used on an ebook.`) | code not an active tag of this kind (unknown, retired, or another kind's) | generic; refresh the tag cache |
| 403 | `You need access to this course to rate it.` (one per kind: `this practice batch`, `this class`, `this PDF`, `this test`) | the item, or the course or batch it was opened from, not bought or the order expired | `msg` |
| 403 | `Buy this ebook to rate it.` | paid ebook not bought | `msg` |
| 403 | `This class is not in that course or practice batch.` (also `This PDF ...`, `This test ...`) | wrong `parent` | `msg`; this is an app bug, log it |
| 403 | `Student login required` | not a student token | log in again |
| 404 | `That class was not found.` (one per kind: `That course`, `That practice batch`, `That PDF`, `That test`, `That ebook`) | item deleted, or ebook inactive | `msg` |
| 500 | the server's internal error text | server fault | never `msg`: "Could not save your rating. Please try again." |

Every 403 and 404 `msg` is written for the student, names the item the way the student sees it, and never
carries the internal access reason, so show it as is. Do not show a 500's `msg`: it is raw server error
text. Better still: show Rate only on items the student can already open, and the 403s rarely reach the
student.

## 8. Quick checks

```bash
curl -s https://backend.vidyagramar.com/api/feedback/tags -H "Authorization: Bearer $TOKEN"
```

```bash
curl -s "https://backend.vidyagramar.com/api/feedback/mine?kind=class&id=$CLASS_ID" -H "Authorization: Bearer $TOKEN"
```

```bash
curl -s -X PUT https://backend.vidyagramar.com/api/feedback -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"kind":"class","id":"'$CLASS_ID'","parent":{"kind":"course","id":"'$COURSE_ID'"},"rating":5,"tags":[],"note":""}'
```
