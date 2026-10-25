# Vidyagram feedback: app team guide

> How the app's **Rate** sheet works on course, practice batch, class, PDF, test, ebook and teacher screens,
> plus the two stars that read the ratings back (My courses and the Teacher tab). The three feedback
> endpoints need the student's login.
>
> Round 1 (six kinds) is live on the Vidyagram backend as b933359d5 since 22 October. The round 2 changes
> below are live as 00724ddf7 since 25 October. Every sample in this guide is a real response from the integration backend
> (branch `feat/vg-feedback-2` at 9b074aff1, in-memory Mongo, starter tags seeded), re-run on 2026-10-25.
> Base URL: `https://backend.vidyagramar.com/api`.
>
> Sample ids below are placeholders (`<courseId>`, `<classId>`…) in place of the real ObjectIds the
> calls returned. Everything else is the real response.

## Changed on 25 October

1. **New kind `teacher`.** A student rates a teacher directly, with no parent. They may rate once at least
   one course in their My courses lists that teacher. Four complaint tags come with it (§3, §4, §5).
2. **`attempt` on tests.** A test save may send `attempt` (a whole number from 1). Every saved row now
   returns `attempt`, which is `null` on other kinds and on a test saved without one. Sending it on another
   kind is a 400 (§4).
3. **`mine` tells you whether the student may rate.** `GET /api/feedback/mine` takes optional `parentKind`
   and `parentId`, and returns `canGiveFeedback` and `reason` beside `data` (§6). For a class, PDF or test,
   send the parent. Without it the answer is `canGiveFeedback: false, reason: "parent_required"`.
4. **Every 403 on `PUT` carries `data.reason`**, the same codes `mine` returns (§7).
5. **A class can be rated only once it has started.** Before that, `PUT` is a 403 with
   `You can rate this class once it has started.` and `mine` says `not_started`.
6. **The note limit counts what the student sees.** 1000 characters is now 1000 user-visible characters
   (grapheme clusters), so an emoji with a skin tone counts as one (§2).
7. **`myRating` on My courses cards.** Every card of `POST /api/courses/my-courses` carries the student's own
   course rating, or `null` (§8).
8. **Teacher tab stars include students' ratings.** `rating` and `reviewCount` on
   `GET /api/faculty/catalogue` and `/catalogue/:id` now add students' teacher ratings to the admin's
   numbers. Both stay `null` under 5 reviews (§9).

---

## 1. Auth and response shape

Every feedback call, including the tag list, needs the student's token:

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

Every feedback response is `{ "state": <status>, "msg": "...", "data": ... }`. Body validation errors add an
`errors` array of `{ path, message }`. Note `msg`, not `message`. The My courses and Teacher tab endpoints
in §8 and §9 keep their own older shapes.

## 2. The Rate sheet

One component for all seven kinds.

1. **Open.** Call `GET /api/feedback/mine` with the item and, for a class, PDF or test, the container the
   student opened it from (§6).
   - `canGiveFeedback: false` means the student cannot rate it from here. Hide Rate, or show it disabled
     with the text for `reason` (§6).
   - `data: null` means not rated yet. Show empty stars.
   - Otherwise prefill stars, tags and note, and title the sheet "Edit your rating".
2. **Stars.** 1 to 5, whole numbers.
3. **Tags, only at 1 to 3 stars.** Show that kind's complaint tags from the cached list (§3) as chips. The
   student picks zero or more. At 4 or 5 stars hide the chips.
4. **Note.** Optional at any rating. The limit is 1000 characters after trimming, counted the way the
   student sees them (grapheme clusters). One emoji is one character, even `👍🏽`, which is 4 UTF-16 units.
   Count the same way in the counter (`String.count` in Swift, `text.characters.length` in Dart with
   `package:characters`). A note of 1000 `👍🏽` saves; 1001 is a 400.
5. **Submit.** `PUT /api/feedback` (§4). On 200 close the sheet and keep `data` as the new "mine".

**Raising a rating to 4 or 5.** The student had 2 stars with tags and taps 5. Clear the selected tags in
the sheet and send `"tags": []`. Sending any tag with 4 or 5 stars is a 400.

**Editing is a full replace.** `PUT` writes exactly what you send. A missing or empty `note` deletes the
earlier note, a missing `tags` means no tags, and a missing `attempt` clears the stored attempt. Always
send the whole sheet: stars, the selected tags, the note text as it stands in the box and, on a test, the
attempt.

One student has one rating per item. A second `PUT` changes the same row (`id` and `createdAt` stay,
`updatedAt` moves).

## 3. Tags: fetch once, cache

`GET /api/feedback/tags` returns every kind's active tags, grouped by kind and in display order. Fetch it
once after login (it needs the token), cache it, and refresh it on the next app start. The admin edits
tags without an app release, so do not hard-code them.

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
    ],
    "teacher": [
      { "code": "too_fast", "label": "Too fast" },
      { "code": "hard_to_follow", "label": "Hard to follow" },
      { "code": "not_interactive", "label": "Not interactive" },
      { "code": "misses_classes", "label": "Misses classes" }
    ]
  }
}
```

- Show `label`, send `code`. Codes never change; labels may.
- Look tags up by kind. The same code can exist under two kinds (`typos` on pdf and ebook, `too_fast` and
  `hard_to_follow` on class and teacher), and a code from another kind is refused.
- Every kind key is always present, with `[]` if the admin retired all its tags. An empty list means no
  tag chips; stars and note still work.
- `?kind=teacher` returns only `{ "teacher": [ ... ] }`, same shape. Use it only to refresh one kind.
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
| `kind` | `course` `practiceBatch` `class` `pdf` `test` `ebook` `teacher` |
| `id` | the item's 24-character id |
| `parent` | required for `class`, `pdf`, `test`; must be absent (or `null`) for the other four; see §5 |
| `rating` | integer 1 to 5 |
| `tags` | codes for this kind; only at 1 to 3 stars, else `[]`; duplicates are dropped |
| `note` | optional, trimmed, max 1000 user-visible characters |
| `attempt` | `test` only, optional, a whole number from 1 (a JSON number, not `"2"`); absent or `null` on other kinds |

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
| `teacher` | the faculty id: `id` of a Teacher tab entry (§9), or `faculties[].id` on a course card |

### Who may rate a teacher

A student may rate a teacher once at least one course in their My courses (§8) lists that teacher. My
courses counts whole-course buyers and Course Builder buyers, and keeps a course after its validity runs
out, so a student whose course expired can still rate its teachers. Otherwise the save is a 403
`You can rate this teacher once you are in one of their courses.` A teacher the admin switched off is a
404 `That teacher was not found.` Show Rate on a teacher profile only when `mine` says
`canGiveFeedback: true`.

### Sample response per kind

Course, 2 stars:

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"course","id":"<courseId>"},"parent":null,"rating":2,"tags":["classes_missed"],"note":"Two live classes were cancelled this week","consumed":true,"attempt":null,"createdAt":"2026-10-25T07:46:23.483Z","updatedAt":"2026-10-25T07:46:23.483Z"}}
```

Practice batch, 5 stars, no note:

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"practiceBatch","id":"<batchId>"},"parent":null,"rating":5,"tags":[],"note":"","consumed":true,"attempt":null,"createdAt":"2026-10-25T07:46:23.492Z","updatedAt":"2026-10-25T07:46:23.492Z"}}
```

Class from a course:

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"class","id":"<classId>"},"parent":{"kind":"course","id":"<courseId>"},"rating":2,"tags":["audio_unclear","too_fast"],"note":"Mic kept cutting out after 20 minutes","consumed":false,"attempt":null,"createdAt":"2026-10-25T07:46:23.501Z","updatedAt":"2026-10-25T07:46:23.501Z"}}
```

PDF from a course:

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"pdf","id":"<pdfId>"},"parent":{"kind":"course","id":"<courseId>"},"rating":3,"tags":["typos"],"note":"","consumed":false,"attempt":null,"createdAt":"2026-10-25T07:46:23.511Z","updatedAt":"2026-10-25T07:46:23.511Z"}}
```

Test from a practice batch, about attempt 2:

```json
{ "kind": "test", "id": "<testId>", "parent": { "kind": "practiceBatch", "id": "<batchId>" }, "rating": 1, "tags": ["wrong_answer_key"], "note": "Q14 answer key says B, the solution says C", "attempt": 2 }
```

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"test","id":"<testId>"},"parent":{"kind":"practiceBatch","id":"<batchId>"},"rating":1,"tags":["wrong_answer_key"],"note":"Q14 answer key says B, the solution says C","consumed":false,"attempt":2,"createdAt":"2026-10-25T07:46:23.519Z","updatedAt":"2026-10-25T07:46:23.519Z"}}
```

Ebook, 4 stars:

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"ebook","id":"<ebookId>"},"parent":null,"rating":4,"tags":[],"note":"Clear and short","consumed":false,"attempt":null,"createdAt":"2026-10-25T07:46:23.527Z","updatedAt":"2026-10-25T07:46:23.527Z"}}
```

Teacher, 2 stars:

```json
{ "kind": "teacher", "id": "<facultyId>", "rating": 2, "tags": ["too_fast", "not_interactive"], "note": "Explains well but never takes questions" }
```

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"teacher","id":"<facultyId>"},"parent":null,"rating":2,"tags":["too_fast","not_interactive"],"note":"Explains well but never takes questions","consumed":true,"attempt":null,"createdAt":"2026-10-25T07:46:23.533Z","updatedAt":"2026-10-25T07:46:23.533Z"}}
```

`consumed` is for the admin (did the student watch, open or attempt it before rating). The app can ignore
it. `note` comes back as `""` when there is none, and `attempt` as `null`.

### Editing: 2 stars raised to 5

The class above, reopened. Send the note again and clear the tags:

```json
{ "kind": "class", "id": "<classId>", "parent": { "kind": "course", "id": "<courseId>" }, "rating": 5, "tags": [], "note": "Mic kept cutting out after 20 minutes" }
```

```json
{"state":200,"msg":"Feedback saved","data":{"id":"<feedbackId>","target":{"kind":"class","id":"<classId>"},"parent":{"kind":"course","id":"<courseId>"},"rating":5,"tags":[],"note":"Mic kept cutting out after 20 minutes","consumed":false,"attempt":null,"createdAt":"2026-10-25T07:46:23.501Z","updatedAt":"2026-10-25T07:46:23.548Z"}}
```

The same call without `note` returns `"note": ""`, so the note is gone. In the same way, the test above
saved again without `attempt` returns `"attempt": null`.

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
| Teacher profile (Teacher tab or a course's teacher list) | `teacher` | none |

- The item must be placed in that container, or the save is a 403 ("This class is not in that course or
  practice batch.").
- A class the student rated inside a course and later inside a practice batch is still one rating. `mine`
  returns it with the latest `parent`, whichever parent you ask with.
- A notes PDF attached to a class (not in the course's PDF list) has no Rate. Students rate the class.
- A class whose start time is still ahead cannot be rated yet. The backend reads the class's own
  `startDate`, or its start date in that course or batch when the class has none. A class with neither
  counts as started.

## 6. Read back and eligibility: `GET /api/feedback/mine`

Query: `kind`, `id`, and for a class, PDF or test `parentKind` + `parentId` (the same container `PUT` would
send). Send `parentKind` and `parentId` together or not at all.

```
GET /api/feedback/mine?kind=class&id=<classId>&parentKind=course&parentId=<courseId>
GET /api/feedback/mine?kind=teacher&id=<facultyId>
```

The response has three fields that matter:

- `data` is the student's rating (the same shape as the `PUT` response) or `null`.
- `canGiveFeedback` is `true` when a save from this parent would be allowed.
- `reason` is `null` when allowed, else one code from the table below.

`data` and `canGiveFeedback` are independent. A student can hold a rating and still get
`canGiveFeedback: false`, for example after the course expired or when the parent is missing. Show the
saved rating read-only in that case.

Not rated yet, allowed:

```json
{"state":200,"msg":"Feedback fetched","data":null,"canGiveFeedback":true,"reason":null}
```

Rated, allowed:

```json
{"state":200,"msg":"Feedback fetched","data":{"id":"<feedbackId>","target":{"kind":"class","id":"<classId>"},"parent":{"kind":"course","id":"<courseId>"},"rating":2,"tags":["audio_unclear","too_fast"],"note":"Mic kept cutting out after 20 minutes","consumed":false,"attempt":null,"createdAt":"2026-10-25T07:46:23.501Z","updatedAt":"2026-10-25T07:46:23.501Z"},"canGiveFeedback":true,"reason":null}
```

A test returns its `attempt`:

```json
{"state":200,"msg":"Feedback fetched","data":{"id":"<feedbackId>","target":{"kind":"test","id":"<testId>"},"parent":{"kind":"practiceBatch","id":"<batchId>"},"rating":1,"tags":["wrong_answer_key"],"note":"Q14 answer key says B, the solution says C","consumed":false,"attempt":2,"createdAt":"2026-10-25T07:46:23.519Z","updatedAt":"2026-10-25T07:46:23.519Z"},"canGiveFeedback":true,"reason":null}
```

Refused, not rated (a class that starts tomorrow):

```json
{"state":200,"msg":"Feedback fetched","data":null,"canGiveFeedback":false,"reason":"not_started"}
```

Refused, rated (a class asked about without its parent):

```json
{"state":200,"msg":"Feedback fetched","data":{"id":"<feedbackId>","target":{"kind":"class","id":"<classId>"},"parent":{"kind":"practiceBatch","id":"<batchId>"},"rating":4,"tags":[],"note":"","consumed":false,"attempt":null,"createdAt":"2026-10-25T07:46:23.501Z","updatedAt":"2026-10-25T07:46:23.582Z"},"canGiveFeedback":false,"reason":"parent_required"}
```

`mine` carries no student-facing message for a refusal, only `reason`. The text in the last column is
what `PUT` returns as `msg` for the same refusal, so you can reuse it.

| `reason` | When | Text `PUT` uses |
|---|---|---|
| `parent_required` | class, PDF or test asked about without `parentKind` + `parentId` (an app bug) | `Rate this class from the course or practice batch it is in.` |
| `not_placed` | the item is not in that course or batch (also when that parent id does not exist) | `This class is not in that course or practice batch.` |
| `no_access` | the item, or the course or batch it was opened from, not bought or expired | `You need access to this class to rate it.` |
| `needs_purchase` | paid ebook not bought | `Buy this ebook to rate it.` |
| `not_started` | class whose start is still ahead | `You can rate this class once it has started.` |
| `no_course_with_teacher` | none of the student's My courses lists the teacher | `You can rate this teacher once you are in one of their courses.` |

Each message names the item by kind ("this PDF", "this test", "this practice batch"). Access is checked
before the start time, so a student who has not bought the course sees `no_access`, never `not_started`.

Errors on `mine`:

| Status | `msg` (and `errors`) | Cause |
|---|---|---|
| 400 | `Invalid query parameters`, `id`: `Required` | `kind` or `id` missing |
| 400 | `Invalid query parameters`, `parentKind`: `parentKind and parentId go together` | one of the pair sent |
| 400 | `Invalid query parameters`, `parentKind`: `Invalid enum value. Expected 'course' \| 'practiceBatch', received 'class'` | bad parent kind |
| 400 | `Rate this course on its own, not from a course or practice batch.` | a parent sent for course, practice batch, ebook or teacher |
| 403 | `Student login required` | not a student token |
| 404 | `That class was not found.` (one per kind) | item deleted, ebook inactive, teacher switched off |

## 7. Errors on `PUT` and what to show

400s on `PUT` are bugs in the request, not something the student did. Log `msg` and `errors`, and show
"Could not save your rating. Please try again." Two are worth catching in the sheet before sending, the
note length and tags at 4 or 5 stars.

| Status | `msg` (and `errors`) | Cause | Show |
|---|---|---|---|
| 400 | `Invalid feedback`, `rating`: `Number must be greater than or equal to 1` / `less than or equal to 5` / `Expected integer, received float` | rating not 1 to 5 | generic |
| 400 | `Invalid feedback`, `tags`: `Tags are only for ratings of 1 to 3 stars` | tags sent with 4 or 5 stars | generic (clear tags, §2) |
| 400 | `Invalid feedback`, `note`: `String must contain at most 1000 character(s)` | note over 1000 user-visible characters | "Keep your note under 1000 characters." |
| 400 | `Invalid feedback`, `kind`: `Invalid enum value. Expected 'course' \| 'practiceBatch' \| 'class' \| 'pdf' \| 'test' \| 'ebook' \| 'teacher', received 'faculty'` | unknown kind | generic |
| 400 | `Invalid feedback`, `id`: `must be an id` | id not 24 hex characters | generic |
| 400 | `Invalid feedback`, `parent.kind`: `Invalid enum value. Expected 'course' \| 'practiceBatch', received 'class'` | bad parent kind | generic |
| 400 | `Invalid feedback`, `attempt`: `Number must be greater than or equal to 1` / `Expected integer, received float` / `Expected number, received string` | attempt 0, 1.5 or `"2"` | generic |
| 400 | `attempt is only for tests` | `attempt` sent on another kind (no `errors` array) | generic |
| 400 | `Rate this class from the course or practice batch it is in.` (also `this PDF`, `this test`), `data: {"reason":"parent_required"}` | parent missing | generic |
| 400 | `Rate this course on its own, not from a course or practice batch.` (also `this practice batch`, `this ebook`, `this teacher`) | parent sent where none belongs | generic |
| 400 | `boring cannot be used on a class.` (several codes are comma-separated; `audio_unclear cannot be used on a teacher.`) | code not an active tag of this kind (unknown, retired, or another kind's) | generic; refresh the tag cache |
| 403 | `You need access to this course to rate it.` (one per kind: `this practice batch`, `this class`, `this PDF`, `this test`), `reason` `no_access` | the item, or the course or batch it was opened from, not bought or the order expired | `msg` |
| 403 | `Buy this ebook to rate it.`, `reason` `needs_purchase` | paid ebook not bought | `msg` |
| 403 | `You can rate this class once it has started.`, `reason` `not_started` | class start still ahead | `msg` |
| 403 | `You can rate this teacher once you are in one of their courses.`, `reason` `no_course_with_teacher` | no course in My courses lists the teacher | `msg` |
| 403 | `This class is not in that course or practice batch.` (also `This PDF ...`, `This test ...`), `reason` `not_placed` | wrong `parent` | `msg`; this is an app bug, log it |
| 403 | `Student login required` | not a student token | log in again |
| 404 | `That class was not found.` (one per kind: `That course`, `That practice batch`, `That PDF`, `That test`, `That ebook`, `That teacher`) | item deleted, ebook inactive, or teacher switched off | `msg` |
| 500 | the server's internal error text | server fault | never `msg`; show "Could not save your rating. Please try again." |

A 403 from the access rules carries the reason code in `data`:

```json
{"state":403,"msg":"You can rate this class once it has started.","data":{"reason":"not_started"}}
```

```json
{"state":403,"msg":"You can rate this teacher once you are in one of their courses.","data":{"reason":"no_course_with_teacher"}}
```

`Student login required` and every 400 except `parent_required` have `data: null`. Every 403 and 404 `msg`
is written for the student, names the item the way the student sees it, and never carries the internal
access reason, so show it as is. Do not show a 500's `msg`, which is raw server error text. Better still,
call `mine` when the sheet opens and show Rate only when `canGiveFeedback` is `true`; then the 403s rarely
reach the student.

## 8. My courses star: `myRating`

`POST /api/courses/my-courses` (body `{ "userId": "<userId>" }`) now puts `myRating` on every card of
`liveCourses[]` and `recordedCourses[]`. It is the student's own course rating (1 to 5), or `null` before
they rate the course. Use it for the star on the card and to prefill the course Rate sheet without an extra
`mine` call. After a successful course `PUT`, set the card's `myRating` from the response `rating`.

Trimmed real response. Each card has all its usual fields; only these fields are shown, here and inside `faculties`:

```json
{"state":200,"data":[{"liveCourses":[{"id":"<courseId>","title":"SSC Aditya Batch","isLive":true,"faculties":[{"id":"<facultyId>","name":"Aditya Ranjan"}],"myRating":4}],"recordedCourses":[{"id":"<courseId2>","title":"Reasoning Batch","isLive":false,"myRating":null}]}],"message":"success"}
```

Another student in the same course sees `"myRating": null` on it. A student with no courses still gets the
empty shape:

```json
{"state":200,"data":[{"liveCourses":[],"recordedCourses":[]}],"message":"success"}
```

This endpoint keeps its older shape, with `message` in place of `msg`.

## 9. Teacher tab stars: blended `rating` and `reviewCount`

`GET /api/faculty/catalogue` and `GET /api/faculty/catalogue/:id` keep `rating` and `reviewCount` with the
same types. They now add students' direct teacher ratings (§4) to the numbers the admin entered:

```
reviewCount = admin review count + number of student ratings
rating      = (admin rating × admin review count + sum of student stars) / reviewCount, rounded to 1 decimal
```

Both are `null` while `reviewCount` is under 5, so one early review does not show as "5.0". An admin rating
without a review count counts as unset. "Top rated" order uses the blended rating, with unrated teachers
last. The admin form still shows and edits the admin's own numbers. A new student rating counts on the
next fetch.

Real sample. Aditya Ranjan has an admin rating of 4.5 from 10 reviews, and two students rated him 2 and 3,
so (45 + 5) / 12 = 4.17, shown as 4.2 from 12. Neha Sharma has no admin numbers and one student rating of 5,
so both stay `null`.

```json
{"status":200,"message":"Teacher catalogue fetched","data":{"teachers":[{"id":"<facultyId>","name":"Aditya Ranjan","imageUrl":null,"designation":null,"subject":"Maths","rating":4.2,"reviewCount":12,"coursesCount":1,"mainCategories":[{"id":"<mainCategoryId>","name":"SSC","image":"https://cdn.example/ssc.png"}]},{"id":"<facultyId2>","name":"Neha Sharma","imageUrl":null,"designation":null,"subject":"Reasoning","rating":null,"reviewCount":null,"coursesCount":1,"mainCategories":[{"id":"<mainCategoryId>","name":"SSC","image":"https://cdn.example/ssc.png"}]}],"subjects":[{"name":"Maths","count":1},{"name":"Reasoning","count":1}]},"teachers":[ ...same list... ],"subjects":[ ...same list... ]}
```

The detail route returns the same numbers:

```json
{"status":200,"message":"Teacher fetched","data":{"id":"<facultyId>","name":"Aditya Ranjan","imageUrl":null,"designation":null,"subject":"Maths","rating":4.2,"reviewCount":12,"coursesCount":1,"mainCategories":[{"id":"<mainCategoryId>","name":"SSC","image":"https://cdn.example/ssc.png"}]}}
```

These endpoints keep their older shape, with `status` and `message`. Neither needs a token. The student's
own teacher rating is not in this response; read it with `mine?kind=teacher&id=<facultyId>`.

## 10. Quick checks

```bash
curl -s https://backend.vidyagramar.com/api/feedback/tags -H "Authorization: Bearer $TOKEN"
```

```bash
curl -s "https://backend.vidyagramar.com/api/feedback/mine?kind=class&id=$CLASS_ID&parentKind=course&parentId=$COURSE_ID" -H "Authorization: Bearer $TOKEN"
```

```bash
curl -s -X PUT https://backend.vidyagramar.com/api/feedback -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"kind":"class","id":"'$CLASS_ID'","parent":{"kind":"course","id":"'$COURSE_ID'"},"rating":5,"tags":[],"note":""}'
```

```bash
curl -s -X PUT https://backend.vidyagramar.com/api/feedback -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"kind":"teacher","id":"'$FACULTY_ID'","rating":5,"tags":[],"note":""}'
```

```bash
curl -s https://backend.vidyagramar.com/api/faculty/catalogue/$FACULTY_ID
```
