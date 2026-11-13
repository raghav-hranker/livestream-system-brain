# Vidyagram free courses: enroll and the Paid / Free tabs, app team guide

> How the app shows an **Enroll** button on some free courses, and splits My courses into **Paid** and **Free** tabs.
>
> Base URL: `https://backend.vidyagramar.com/api`. Backend branch `feat/vg-free-enroll`; not deployed yet.

---

## 1. The rule in one paragraph

Free courses now come in two kinds. An **open** free course plays for every student, as today, and never appears in
My courses. An **enroll** free course is locked until the student taps **Enroll**. Enrolling unlocks its classes and
PDFs at once and puts the course in the new **Free** tab of My courses. The admin picks the kind per course. Every
existing free course is open, so nothing changes for students until an admin switches one.

---

## 2. The two new course fields

Every course object from `GET /api/courses/:id`, `POST /api/courses/filter`, `POST /api/courses/batch-filter`,
`POST /api/courses/by-id-2`, the course-folder course cards and every My courses card now carries:

| Field | Value |
|---|---|
| `freeAccess` | `"open"` or `"enroll"`. It is `"open"` on paid courses too, so read it together with `isFree`. |
| `isEnrolled` | `true` only when the course is in enroll mode and the logged-in student has enrolled, even if the enrollment has since expired. `false` without a login token. |
| `enrollmentExpiresAt` | When the student's enrollment stops unlocking the course (ISO date), or `null` when not enrolled or the course is lifetime. It follows the course's current Validity, counted from the day the student enrolled, so it can move when an admin edits Validity. |

`isEnrolled` is not on the offer zone, top picks or search cards yet. Use the course page (`by-id-2`) for the button.

**Send the student's bearer token** (`Authorization: Bearer <token>`) on these calls. The body `userId` never sets
`isEnrolled`.

---

## 3. What the course page shows

| `isFree` | `freeAccess` | `isEnrolled` | `isPaid` | Show |
|---|---|---|---|---|
| `false` | any | any | any | The usual buy flow. |
| `true` | `"open"` | any | any | Play, as today. No button. |
| `true` | `"enroll"` | `false` | `false` | **Enroll** button. Classes locked. |
| `true` | `"enroll"` | `true`, `enrollmentExpiresAt` null or in the future | any | Play. Show "Enrolled" and, when set, "Valid till <date>". |
| `true` | `"enroll"` | `true`, `enrollmentExpiresAt` in the past | `false` | Locked. Show "Expired". No Enroll button: enrolling again does not restart it. |
| `true` | `"enroll"` | `true`, `enrollmentExpiresAt` in the past | `true` | Play. An older purchase still covers the course. |
| `true` | `"enroll"` | `false` | `true` | Play. The student already holds the course through an older purchase. |

A locked class answers playback and PDF calls with 403, the same as an unbought paid class.

---

## 4. Enroll

```
POST /api/courses/:courseId/enroll
Authorization: Bearer <student token>
```

No body. Answers:

| Status | Body | Meaning |
|---|---|---|
| 200 | `{ "state": 200, "data": { "courseId": "…", "isEnrolled": true, "enrolledAt": "2026-11-07T07:30:00.000Z", "expiresAt": "2027-11-07T18:30:00.000Z", "isExpired": false } }` | Enrolled. `expiresAt` is `null` for a lifetime course. A repeat tap gives 200 again with the first `enrolledAt`, so retrying is safe. After expiry a tap answers `"isExpired": true` and the course stays locked. |
| 401 | `{ "state": 401, … }` | No student token. Send the student to login. |
| 404 | `{ "state": 404, "message": "Course not found" }` | Missing or inactive course. |
| 409 | `{ "state": 409, "reason": "NOT_ENROLLABLE" }` | The course is open or paid. Refresh the course page. |

After a 200, set `isEnrolled` to `true` on the page and play. There is no unenroll.

---

## 5. My courses: Paid and Free tabs

`POST /api/courses/my-courses` is the call the app already makes. `data[0]` gains a third list:

```json
{
  "state": 200,
  "data": [
    {
      "liveCourses": [ … ],
      "recordedCourses": [ … ],
      "freeCourses": [ { "id": "…", "title": "…", "isFree": true, "freeAccess": "enroll", "isEnrolled": true, … } ]
    }
  ]
}
```

| Tab | Lists |
|---|---|
| **Paid** | `liveCourses` and `recordedCourses`, unchanged. |
| **Free** | `freeCourses`: enroll-mode courses the student enrolled in or already holds, newest first. Cards have the same fields as the paid cards. An expired course stays here with `"isExpired": true`: show it locked with an "Expired" mark. |

Open free courses appear in neither tab. An older app build ignores `freeCourses` and keeps working. Error and empty
answers carry `"freeCourses": []`.
