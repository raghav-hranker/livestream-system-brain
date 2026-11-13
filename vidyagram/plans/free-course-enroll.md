---
tenant: vidyagram
status: ready-for-agent
created: 2026-11-07
---

# Free courses: enroll to unlock, and Paid / Free tabs in My Courses

## Goal

An admin decides which free courses a student must enroll in. The student taps Enroll on the course page,
which unlocks its classes and PDFs and puts the course in a new Free tab of My Courses. Paid courses stay in
the Paid tab. The other free courses stay open to everyone, as today, and never appear in My Courses.

Decided with the user 2026-11-07: tenant Vidyagram; two free types, "open" and "enroll"; an enroll course is
locked until the student enrolls.

## Domain

`Course.freeAccess?: 'open' | 'enroll'`. Absent means `'open'`, so every existing course keeps today's
behaviour on deploy. The field means something only when `isFree` is true.

One function owns the reading of those two fields, and every reader goes through it:

```ts
type CourseFreeMode = 'paid' | 'open' | 'enroll';
courseFreeMode({ isFree, freeAccess }): CourseFreeMode
// isFree !== true → 'paid'; freeAccess === 'enroll' → 'enroll'; else 'open'
```

`CourseEnrollment { userId: ObjectId, courseId: ObjectId, enrolledAt: Date }`, unique on
`{ userId: 1, courseId: 1 }`, plus `{ courseId: 1 }`. It is a separate collection, not a ₹0 Order, so
enrollees never count as buyers (push audiences that exclude buyers, admin purchasers, `studentCount`,
order history, dashboards) and no order-expiry rule applies. Prod Mongo never auto-builds indexes: the
unique index is a manual deploy step, and the write is an upsert so a missing index cannot double-enroll in
the normal path.

## Backend (`quicktricks-backend`, branch off `origin/vidyagram-admin`)

1. **Store and author.** `Course.freeAccess` in the model; `z.enum(['open','enroll'])` in
   `createCourseSchema` (default `'open'`) and `updateCourseSchema` (optional), both `.strict()`, with a
   string preprocess for multipart; `createCourse` writes it by hand (it builds an explicit object).
   Template: Combo commit 680f92c62.
2. **Expose.** `getBaseCourseProjection` emits `freeAccess` normalised to `'open' | 'enroll'`, which reaches
   `/:id`, `/filter`, `/batch-filter`, `/by-id-2`, `/my-courses`. Course-folder serializer too.
   `isEnrolled: boolean` on `/by-id-2` and the catalogue listings, for the **bearer-token** student only
   (false without a token, false unless the course is in `'enroll'` mode).
3. **Enroll.** `POST /api/courses/:courseId/enroll`, student token required. 404 when the course is missing
   or not active; 409 `NOT_ENROLLABLE` unless `courseFreeMode` is `'enroll'`; otherwise upsert
   (`$setOnInsert: { enrolledAt }`) and return `{ courseId, isEnrolled: true, enrolledAt }`. Repeat taps
   return 200 with the first `enrolledAt`. No unenroll.
4. **Access** (`classAccessAuthz.ts`). Placements carry the course's mode instead of `courseIsFree`.
   - `authorizeClassAccess`: a free placement, `Class.isFree`, or an `'open'` course passes everyone, as
     today. When any placement's course is `'enroll'`, read the student's enrollments for those course ids
     (new dep) and pass if any; this runs **before** the zero-orders 403. Orders then apply as today, so a
     paid placement or an admin-granted order still opens the class.
   - `authorizeCourseAccess` (course PDFs, course feedback): `'open'` passes; `'enroll'` passes when
     enrolled, else falls through to orders.
   - `realtimeTokenController` builds its deps by hand: add the new dep there.
5. **My Courses.** `data[0]` gains `freeCourses`: courses in `'enroll'` mode that the student is enrolled in
   **or** holds through an order (AppX `free_course*` ₹0 orders), newest first, same card shape and per-card
   fields as the other lists. `liveCourses` and `recordedCourses` are unchanged and form the Paid tab, so
   old app builds see no change. `MY_COURSES_COURSE_MATCH` stays as is.
6. **Timetable** (`courseClassController` `effectiveIsFree`): an `'enroll'` course counts as free only for
   an enrolled student, so its classes stop appearing in everyone's timetable.

Out of scope, left as today and reported: search `canPlay` hint, certificate free bypass, catalogue Free
tab (lists both kinds; the course page shows Enroll), the nightly AppX importer (new courses default to
`'open'`), tests inside free courses (the test gate never read `Course.isFree`).

## Admin (`quicktricks-admin`, branch off `origin/vidyagram-admin`)

`CourseForm.tsx`: zod `freeAccess: z.enum(['open','enroll']).default('open')`, both defaults blocks (create
defaults and edit reset), and a control shown only while "Is Free" is ticked: "Who can watch" with
"Everyone" (`open`) and "Students who enroll" (`enroll`). `hooks/api/use-courses.ts` interfaces. A test in
`CourseForm.test.tsx`. Template: Combo commit ddaa2b86. Deploy only after the backend, because the backend
schemas are strict and reject an unknown field.

## Enrollment expiry (added 2026-11-07, branch `feat/vg-enroll-expiry`)

Decided with the user: an enrollment stops unlocking its course once the course's **current** `Course.validity`,
counted from `enrolledAt`, has passed (`enrollmentExpiresAt` in `courseFreeMode.ts`; unreadable or lifetime =
never). Admin edits to Validity reach existing enrollments; nothing new is stored. An expired course stays in
`freeCourses` with `isExpired: true`, locked. Enroll never resets an enrollment. Cards gain `enrollmentExpiresAt`,
the enroll answer gains `expiresAt` and `isExpired`. Orders unchanged; whether an expired order on an enroll course
should lock is open with the user (recommended: yes, for enroll courses only; 168 students hold 810 already
expired orders platform-wide, which only the global `ENFORCE_ORDER_EXPIRY` would lock).

## Rollout

Backend deploy, create the unique index, admin deploy, then the admin flips chosen courses to "Students who
enroll". Students with AppX free-course orders keep access through those orders. App guide goes to the app
team with the endpoint, the two course fields and `freeCourses`.
