# Mark uncomplete clears every session

**Type**: AFK
**Blocked by**: None — can start immediately

PRD: `docs/plans/prd-course-class-tabs.md` → "Watch status (Resolve)". Glossary: `CONTEXT.md` →
"Watch status" and the flagged ambiguity on "Completed".

## What to build

`POST /api/course-progress/mark-class-as-uncomplete` (the `markClassAsUncomplete` handler) currently
resets only the first matching `ClassProgress` row. Make it set `duration: 0` and
`manualCompleted: false` on **every** row for (userId, classId, courseId), so a class the student
un-completes resolves as Not watched regardless of older sessions. Keep the response shape.
Mark complete is unchanged.

## Acceptance criteria

- [ ] With three session rows plus a manual completion, uncomplete leaves every row at `duration: 0`, `manualCompleted: false`.
- [ ] Rows for the same class in another course, or another user, are untouched.
- [ ] Response envelope unchanged; 400/404 paths unchanged.
- [ ] Integration test (memory Mongo); `npx tsc --noEmit` clean.

## User stories covered

29
