# Vidyagram Course Builder: teacher toggle per chapter (app guide)

For the app team. **Live on `https://backend.vidyagramar.com/api` since 2026-11-20 14:16 IST.** This adds to the
main builder guide ([`vidyagram-course-builder-app-guide.md`](vidyagram-course-builder-app-guide.md)); everything
there still holds. Examples are real responses from the live course.

Some chapters are taught by two teachers. The builder shows such a chapter as **one row** with a toggle
"Aditya Sir / Abhinay Sir", pre-set to the suggested teacher. The student can switch. They buy the chapter with
**one** teacher and get only that teacher's classes in it. **The price is the same whichever teacher.**

| What | Value |
|---|---|
| Course | `6aff1280d8f488b0916b2f98`, "Course builder v2" (on sale; hidden from the regular course lists) |
| Chapters | 39: 27 with a teacher toggle, 12 with one teacher (no toggle) |
| Teachers | Aditya Sir `6ada06b0ab837d7b99531da3` (suggested on every chapter), Abhinay Sir `6af82ced78ca0c03c5968bb8` |
| Payments | Razorpay test mode, as in the main guide |

A course whose builder has no teachers set (every other builder course) answers exactly as before: no toggle
fields, nothing new to send.

---

## 1. Builder screen: `GET /courses/:courseId/builder`

New at the top level, the toggle's teachers in display order:

```json
"teachers": [
  { "id": "6ada06b0ab837d7b99531da3", "label": "Aditya Sir", "name": "Aditya Ranjan Sir",
    "imageUrl": "https://hranker-server-v2.b-cdn.net/781/faculty/1794822812168-21-removebg-preview.webp" },
  { "id": "6af82ced78ca0c03c5968bb8", "label": "Abhinay Sir", "name": "Abhinay Sir",
    "imageUrl": "https://hranker-server-v2.b-cdn.net/781/faculty/1794822708727-VidyaGram_Professional_Portrait-removebg-preview.webp" }
]
```

A chapter with two teachers also carries `suggestedTeacherId` and `teacherOptions` (live example):

```json
{ "topicId": "6af686ba94392f7fb3fa3293", "topicName": "Algebra",
  "weight": 5, "customPrice": null, "price": 39.95,
  "classCount": 41, "revisionClassCount": 0, "durationSeconds": 138298, "hours": 38.4,
  "suggestedTeacherId": "6ada06b0ab837d7b99531da3",
  "teacherOptions": [
    { "teacher": { "id": "6ada06b0ab837d7b99531da3", "label": "Aditya Sir", "name": "Aditya Ranjan Sir", "imageUrl": "…" },
      "classCount": 20, "revisionClassCount": 0, "durationSeconds": 76907, "hours": 21.4, "suggested": true },
    { "teacher": { "id": "6af82ced78ca0c03c5968bb8", "label": "Abhinay Sir", "name": "Abhinay Sir", "imageUrl": "…" },
      "classCount": 21, "revisionClassCount": 0, "durationSeconds": 61391, "hours": 17.1, "suggested": false }
  ] }
```

- Show the toggle only when `teacherOptions` is present. Label the buttons with `teacher.label`.
- Pre-select the option with `suggested: true` (its id is also `suggestedTeacherId`).
- When the student switches, show **that option's** `classCount` / `hours`. The chapter's own `classCount` /
  `hours` count both teachers, so don't show them on a toggle row.
- `price` and `weight` belong to the chapter and **do not change** with the teacher. Price the build exactly as
  before.
- A chapter without `teacherOptions` has one teacher: show it as today.
- `ownership` (signed-in student) gains `ownedTeachers`: `{ "<topicId>": ["<facultyId>"] }` for each owned
  chapter that was bought with one teacher. Show "Owned · Abhinay Sir" there and don't let the student switch
  (a teacher change after purchase is done by support, not in the app).

**View (the chapter's class list before buying):** use `GET /courses/:courseId/classes` (section 3). Show the
chapter's group, filtered to classes whose `teacherId` is the selected teacher. Also show classes with
`teacherId: null`: a buyer of either teacher gets those.

---

## 2. Checkout: `POST /orders/build-checkout`

One new optional field, `teachers`: the picked teacher per toggle chapter, by topic id.

```json
{ "courseId": "6aff1280d8f488b0916b2f98",
  "topicIds": ["6af686ba94392f7fb3fa3293", "6ad5f9c3308a95d039c32783"],
  "teachers": { "6af686ba94392f7fb3fa3293": "6af82ced78ca0c03c5968bb8" },
  "extrasOn": ["notes", "tests"],
  "validity": null }
```

- Send an entry for every picked toggle chapter. A toggle chapter left out is bought with its suggested
  teacher, which is what an older app version gets.
- An entry for a chapter without a toggle, or one that wasn't picked, is ignored.
- The response is unchanged. The price is the same whichever teacher.

New errors (`state` = HTTP status, show `message`):

| Status | message | What to do |
|---|---|---|
| 400 | That teacher does not teach Algebra. Reload and pick again. | Re-fetch the builder screen |
| 409 | You already have Algebra with Aditya Sir. Contact support to switch teacher. | Untick the chapter, or point to support |

---

## 3. Class lists: every class has its teacher

Every class card on these lists now has two more fields:

```json
"teacherId": "6af82ced78ca0c03c5968bb8",
"teacherLabel": "Abhinay Sir"
```

They appear on `GET /courses/:courseId/classes`, `POST /courses/:courseId/class-tabs`, today's classes,
`GET /topics/:topicId/classes` and course search; the shared class card used by watch history and the timetable
also has `teacherId`. Both are `null` for a class with no teacher, or on a course without teachers.

- **Not bought (or signed out):** every class of the chapter comes back, both teachers, each tagged.
- **Bought with one teacher (token sent):** the server already **leaves out** the other teacher's classes of that
  chapter. The student sees one group with only their teacher's classes (plus any with no teacher).
- **Today's classes:** the field order changed by addition only: `teacherId` comes after `isRevision`, and
  `teacherLabel` after `topic`. Check your parser if it relies on key order.

---

## 4. Locks after purchase

The course card (every listing, as in section 2 of the main guide) gains `ownedTeachers` next to
`ownedTopicIds` on a partial owner:

```json
"isPartial": true,
"ownedTopicIds": ["6af686ba94392f7fb3fa3293"],
"ownedTeachers": { "6af686ba94392f7fb3fa3293": ["6af82ced78ca0c03c5968bb8"] }
```

The main guide's `classIsOpen` keeps working, because the class list already drops the other teacher's classes
for a buyer. If you show a class from somewhere else (timetable, watch history, search), add the teacher check:

```js
function classIsOpen(course, chapterTopicId, cls) {
  if (cls.isFree) return true;
  if (course.is_buy !== 1) return false;
  if (!course.isPartial) return true;                                   // whole course
  if (!course.ownedTopicIds.includes(chapterTopicId)) return false;    // chapter not bought
  if (course.revisionTopicIds.includes(chapterTopicId)) return cls.isRevision === true;
  const teachers = (course.ownedTeachers || {})[chapterTopicId];       // NEW
  if (teachers && cls.teacherId && !teachers.includes(cls.teacherId)) return false;
  return true;
}
```

- A class with `teacherId: null` in a bought chapter is open to every buyer of it.
- Class notes, the course's PDFs and tests follow the chapter, not the teacher: same rules as the main guide.
- The server enforces all of this. Playback of the other teacher's class answers
  `403 "You do not have access to this class."`, so a wrong lock in the app can never open it.

---

## 5. Orders and invoices

An order view's build chapters carry `teacher: { id, label }` for a toggle chapter (otherwise `null`), and the
invoice / My Purchases line reads `Chapters: Algebra (Abhinay Sir), Boat & Stream`.

---

## 6. Checklist

- [ ] Toggle shown only on rows with `teacherOptions`, pre-set to `suggested`.
- [ ] Class count / hours follow the selected option; price doesn't change.
- [ ] View lists the selected teacher's classes (plus `teacherId: null`).
- [ ] Checkout sends `teachers` for every picked toggle chapter; 400 and 409 handled.
- [ ] Owned toggle chapter shows the bought teacher and can't be switched.
- [ ] After purchase, the course screen shows only the bought teacher's classes in that chapter.
- [ ] Today's classes parser accepts the two new keys.
