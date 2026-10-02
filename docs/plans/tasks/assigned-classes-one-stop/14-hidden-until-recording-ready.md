# Hidden until the recording is ready

**Type**: AFK
**Blocked by**: — (round 2 is merged)

## What to build

PRD Round 3 decisions 27 and 28, plus the row tag from decision 31. Backend + admin.

**Backend**
- `CourseClass.waitingForRecordingSince?: Date`, documented like `apxSyncDeactivatedAt` (its presence
  is the licence for the stream-status write to turn the placement on).
- In-place create (`adminCourseClassInPlaceController.ts`, recorded classes only): placement
  `status: 0` + `waitingForRecordingSince: now`. Live in-place creates are unchanged.
- `streamStatusController.ts`: after `ended` with an `hlsAsset` is persisted, `updateMany` the
  placements of that class carrying the field → `status: 1`, unset the field. Put it behind an injected
  dependency like `notifyClassLifecycle`, so the controller tests can see it. Log and swallow a failure
  (the class write already succeeded; the webhook must not 500 because of it). A repeat delivery finds
  nothing to flip.
- Every admin write of a placement `status` unsets the field: `PATCH /course-classes/:id`,
  `PATCH /course-classes/bulk-update-overrides`, and any other path the In course switch uses (find
  them; the switch was built in task 07).
- Copy to another course (`adminCourseCopyController.ts`) copies the field with the status.
- Outline rows: `waitingForRecording: boolean`.

**Admin**
- On an outline row with `waitingForRecording`: the tag "Hidden from students until the recording is
  ready" (eye-off icon), and "On when ready" under the switch. Flipping the switch works as today; after
  the refetch the tag is gone.
- The add dialog's footer states the rule for recorded classes: "Students see this class once its
  recording is ready. Until then it stays off in this course."

## Acceptance criteria

- [ ] A recorded class made in place starts off in the course, tagged; a live one is visible.
- [ ] A stream-status `ended` with an `hlsAsset` turns on every waiting placement of that class (and
      only those), and a repeat is a no-op.
- [ ] `ended` without an `hlsAsset`, or any other status, turns nothing on.
- [ ] An admin switch write clears the field, either way; the next `ended` changes nothing.
- [ ] A copy of a waiting class waits in the target course too.
- [ ] Tests: backend integration for create, the flip (all placements, idempotent, failure swallowed),
      the admin-write clear, copy, the outline field. Admin: the tag and caption render from the field.
- [ ] Baselines stay green.

## User stories covered

- 46
