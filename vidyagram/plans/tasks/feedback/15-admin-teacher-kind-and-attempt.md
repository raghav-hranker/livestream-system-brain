# Admin: direct teacher ratings and test attempt

**Type**: AFK
**Blocked by**: 13
**Repo**: admin (backend only if `/teachers` needs the direct numbers)

## What to build

The admin shows the new kind and field from task 13.

- **Kind tab.** The Feedback page gets a "Teacher ratings" kind tab for `teacher`, built from `FEEDBACK_KINDS` like the
  others: ranked worst first, with a drawer. The existing class-based tab is renamed "Teachers (from classes)" so the
  two can't be confused.
- **Direct ratings on the Teachers tab.** Each row of the class-based tab shows the teacher's direct student rating
  (average and count) beside the class score, never mixed into it. Add `directAverage` and `directCount` to
  `GET /api/admin/feedback/teachers` in `feedbackRanking.ts` if they are not there.
- **Faculty page.** The faculty page's Feedback section shows the direct rating too.
- **Attempt.** Test rows in the list and the drawer show "Attempt N" when `attempt` is set.
- **Tags page.** The Tags page shows a Teacher section, which comes from the kinds list.

## Acceptance criteria

- [ ] Admin component tests cover these:
  - The Teacher ratings tab renders ranked rows.
  - A Teachers (from classes) row shows the direct average beside the score.
  - A test row shows "Attempt 2".
  - The Tags page has a Teacher section.
- [ ] Backend integration test, if `/teachers` changed: the direct average and count come from teacher-kind rows only,
      and `score` is unchanged.
- [ ] `NO NEW FAILURES` against `baseline2-admin.txt` (and `baseline2-backend.txt` if the backend is touched).

## User stories covered

- Admin visibility for the app team spec's teacher and test changes.
