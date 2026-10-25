# Course-complete switch

**Type**: AFK
**Blocked by**: None, can start immediately
**Repo**: backend + admin

## What to build

An admin marks a course complete, or reopens it. Certificates (later tasks) only exist for courses marked complete.
The look and copy follow prototype variant C plus variant B's badge:
[`../../../prototypes/certificate-batch-switch/index.html`](../../../prototypes/certificate-batch-switch/index.html).

- **Course field.** Courses gain `certificate: { courseCompleteAt, courseCompleteBy, notifiedAt }`, all empty by
  default. The admin course reads return it. The student course reads need not.
- **`PUT /api/admin/courses/:id/course-complete`** with body `{ complete: boolean }`. It is admin-only.
  - Switching on sets `courseCompleteAt` to now and `courseCompleteBy` to the admin.
  - Switching off clears both but keeps `notifiedAt`.
  - It returns the `certificate` block.
  - Repeating the current state is a no-op that returns 200.
  - Leave `notifiedAt` and the push to task 05, but return a `firstTime` boolean (true when `notifiedAt` is empty
    at switch-on), so task 05 has its hook.
- **Assign Classes banner.** This is the Courses – New outline page.
  - In progress: a "Course in progress" banner with a "Mark course complete" button.
  - Complete: an amber banner reading "Course complete — certificates open" and "Marked since <date> by <admin>.",
    with a "Reopen course" button.
- **Confirm dialogs.** Both actions confirm first, with the prototype's wording.
  - The switch-on dialog says students at 100% get one push only when `notifiedAt` is empty. Otherwise it says no
    push will be sent this time.
- **Add-class warning.** On a complete course, every admin flow that adds a class placement to that course first
  shows the prototype's warning dialog. Cancel adds nothing.
  - Find each flow: the course outline's assign, Classes → Manage courses, and any class-duplicate-into-course path.
  - Name the ones covered in the report.
- **Courses list badge.** Courses – New shows a read-only gold "Course complete" badge under the title of a complete
  course.

## Acceptance criteria

- [ ] Integration: a student token gets 403 and an admin token gets 200. Switching on sets the time and the admin;
      switching off clears them and keeps `notifiedAt`. A repeat call is a no-op.
- [ ] Integration: `firstTime` is true only on a switch-on while `notifiedAt` is empty.
- [ ] Admin component: the banner renders both states, and each button confirms before calling the route.
- [ ] Admin component: the push sentence appears only on a first switch-on.
- [ ] Admin component: adding a class to a complete course shows the warning. Cancel adds nothing; confirm assigns.
- [ ] Admin component: the Courses list badge shows only for complete courses.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 28, 29, 30, 31, 32
