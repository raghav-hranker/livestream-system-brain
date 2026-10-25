# App team changes: teacher kind, test attempt, eligibility on mine, note length

**Type**: AFK
**Blocked by**: None (the feedback backend is live as b933359d5)
**Repo**: backend

Source: the app team's `feedback_backend_spec.md` §0.2 (25 Oct 2026), items 2 to 5. The user overrode the PRD on
2026-10-25: students may now rate a teacher directly, in addition to the class-based teacher view.

## What to build

The live student API gains a seventh kind, an optional test attempt, an eligibility answer on `mine`, a
"class has started" rule, and a note limit counted the way the app counts.

1. **`teacher` kind.** `id` is a `FacultyDetails` id. It takes no parent. A student may rate a teacher when at least
   one course in their My courses lists that teacher (`Course.faculties`, falling back to `facultyDetails` when
   `faculties` is absent, as `kinds/course.ts` does). "My courses" is the rule `POST /api/courses/my-courses` lists
   by, so whole-course and Course Builder buyers both count. Reuse that rule, don't copy it. `facultyIds` is
   `[teacherId]` and `consumed` is always true. The kind lives in `kinds/teacher.ts` and registers in `KIND_RULES`.
   A teacher with `status` off counts as not found. Seed four complaint tags for it, appended to the seed script so
   a prod re-run inserts only these: `too_fast` "Too fast", `hard_to_follow` "Hard to follow", `not_interactive`
   "Not interactive", `misses_classes` "Misses classes". Tags stay complaint-only and allowed only at 1 to 3 stars.
2. **`attempt` on tests.** `PUT /api/feedback` accepts an optional `attempt`, a whole number ≥ 1, on `kind: "test"`
   only. Sending it on another kind is a 400 ("attempt is only for tests"). It is stored on the row, returned in the
   save and `mine` responses (`null` when absent), and returned on the admin rows. A save without it clears it,
   because a save replaces the whole rating.
3. **Eligibility on `mine`.** `GET /api/feedback/mine` takes optional `parentKind` and `parentId` and returns
   `canGiveFeedback` (bool) and `reason` (string or `null`) at the top level beside `data`. `data` keeps its meaning.
   It runs the same checks as a save, minus the body checks, and never 403s. A 404 for a missing item stays a 404.
   The same `reason` is added to the 403 body of `PUT` as `data: { reason }`. Reasons are a closed set, one per
   refusal class:
   - `parent_required`: a class, PDF or test asked about without a parent;
   - `not_placed`: not in that course or practice batch;
   - `no_access`: no entitlement;
   - `needs_purchase`: paid ebook not bought;
   - `not_started`: class not started yet (item 4);
   - `no_course_with_teacher`: teacher rule (item 1).
   Map them from the registry's refusal classes, with no per-kind branching outside the registry.
4. **A class can be rated only once it has started.** For `kind: "class"`, refuse with `not_started` when the class's
   start time is in the future. Use the class's `startDate`, or the placement's `startDate` in the parent course or
   batch when the class has none. Treat a class with neither as started. Say in the report which field decided it.
   Message: "You can rate this class once it has started."
5. **Note length counts what a person sees.** The 1000 limit counts grapheme clusters
   (`new Intl.Segmenter('en', { granularity: 'grapheme' })`) on the trimmed note, not UTF-16 units. The message
   stays the same.

## Acceptance criteria

- [ ] Integration: a student who owns a course listing teacher T rates T (200, `facultyIds` = [T]); a student
      without such a course gets 403 `no_course_with_teacher`; a build buyer of that course may rate T; a teacher
      tag at 4 stars is 400; `parent` on teacher is 400; an unknown faculty id is 404.
- [ ] Integration: `attempt: 2` on a test is saved and returned by `mine`; `attempt` on a class is 400; `attempt: 0`
      and `1.5` are 400; a later save without it returns `attempt: null`.
- [ ] Integration: `mine` returns `canGiveFeedback: true, reason: null` when allowed. It returns each reason in the
      set above in a case that triggers it, with `data` unchanged (null or the row). A missing item is still 404.
- [ ] Integration: `PUT` 403 bodies carry `data.reason`.
- [ ] Integration: a class whose start is tomorrow is refused `not_started` on `PUT`, and `mine` says so. A class
      that started yesterday is allowed.
- [ ] Integration: a note of 1000 emoji (each one grapheme, several UTF-16 units) saves; 1001 graphemes is 400.
- [ ] Seed: a re-run on a database with the 25 old tags inserts exactly the 4 teacher tags.
- [ ] All existing feedback tests still pass. `NO NEW FAILURES` against `baseline2-backend.txt`.

## User stories covered

- App team spec §0.2 items 2, 3 (teacher kind, not the catalogue blend), 4, 5.
