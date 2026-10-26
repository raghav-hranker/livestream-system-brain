# A test can be rated without a course or practice batch

**Type**: AFK
**Blocked by**: None (round 2 is live as 00724ddf7)
**Repo**: backend

The user asked on 2026-10-26 for a test to be ratable with no parent. Tests are also sold and taken outside
courses (test series packages, PYQ, AI tests, quizzes, live tests), and the app's analysis screen does not always
know a course or practice batch.

## What to build

`parent` becomes **optional** for `kind: "test"`. It stays required for `class` and `pdf`, and stays absent for
the other kinds.

- **With a parent:** exactly today's rule. The test must be placed in that course or practice batch, and the
  container's access rule decides.
- **Without a parent:** the student may rate the test when they have at least one **submitted** attempt on that
  series. Find what "submitted" means in this codebase, for example a `Scores` row, or a `UserTestData` row that
  is final and not a paused attempt (compare `UserPauseTestData`). Say in the report which collection and field
  decided it. A refusal is the new refusal class `no-attempt`, reason `no_attempt`, with the message "Submit this
  test before rating it." It is a 403 on `PUT` and `canGiveFeedback: false` on `mine`.
- **`mine`:** a test asked about without `parentKind` and `parentId` is no longer `parent_required`. It runs the
  no-parent rule instead.
- **The row:** a test rated without a parent stores no `parent`. A later save from inside a course overwrites
  `parent` (one rating per student per test, as today). `consumed` keeps its current meaning.
- **Registry:** model it as a third parent mode, `'optional'`, next to `'required'` and `'none'`, plus the kind's
  own no-parent rule. Do not add a `kind === 'test'` branch in the service or controller.

## Acceptance criteria

- [ ] Integration: a student with a submitted attempt rates a test with no parent (200, no `parent` on the row,
      `attempt` still accepted).
- [ ] Integration: a student with no attempt, or with only a paused or started attempt, gets 403 `no_attempt` on
      `PUT` and `canGiveFeedback: false, reason: "no_attempt"` on `mine`.
- [ ] Integration: a test rated with a course parent behaves exactly as before (placement and access rules, 403s
      unchanged).
- [ ] Integration: a class or PDF without a parent is still `parent_required`.
- [ ] Integration: rating the same test first with no parent and then from a course keeps one row with the
      course as `parent`.
- [ ] All existing feedback tests pass. `NO NEW FAILURES` against the baseline.

## User stories covered

- The user's request of 2026-10-26: tests rated from the analysis screen whatever the student opened them from.
