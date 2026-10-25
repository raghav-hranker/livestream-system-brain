# myRating on My courses, and students' teacher ratings in the catalogue

**Type**: AFK
**Blocked by**: None (reads `feedbacks` by `target.kind`, which needs no code from task 13)
**Repo**: backend

Source: the app team's `feedback_backend_spec.md` §0.2 items 1 and 3 (the blend half), §4.4 and §4.5.

## What to build

1. **`myRating`** on every card of `liveCourses[]` and `recordedCourses[]` in `POST /api/courses/my-courses`
   (`getUserCourses` in `courseController.ts`). It holds the caller's course rating (1 to 5), or `null`.
   - Use one query per request over `feedbacks`: `{ userId, 'target.kind': 'course', 'target.id': { $in: cardIds } }`,
     which the unique index serves.
   - Every response shape of that endpoint carries it, including the empty ones.
   - Guest or no user means `null` everywhere.
2. **Teacher catalogue blend.** `GET /api/faculty/catalogue` and `/catalogue/:id` keep `rating` and `reviewCount`
   with the same types, now blended with students' direct teacher ratings (`target.kind: 'teacher'`):
   ```
   adminCount  = admin reviewCount when the admin rating is set, else 0
   reviewCount = adminCount + n            (n, sum = count and sum of students' teacher ratings)
   rating      = round1((adminRating × adminCount + sum) / reviewCount)
   ```
   - Both are `null` when `reviewCount` < 5.
   - "Top rated first" sorts on the blended rating, with unrated last as today.
   - Hidden notes still count, since hiding moderates only the text.
   - Do it with one aggregate over the page's teacher ids, not one query per teacher.
   - Put the pure blend in its own function with unit tests.
   - The admin faculty form and list still show and edit the raw admin numbers.

## Acceptance criteria

- [ ] Integration: a student who rated course A 4 stars sees `myRating: 4` on A and `null` on B. Another student sees
      `null` on A. The empty-list response shape still parses.
- [ ] Unit: the blend with admin 4.5 × 10 plus students (n 2, sum 6) gives 4.25, rounded to 4.3, with 12 reviews.
      Admin unset with n 3 gives null and null. Admin unset with n 5 and sum 20 gives 4.0 and 5. An admin rating with
      no count counts as unset.
- [ ] Integration: the catalogue returns blended numbers, the detail route matches the list, and the order follows
      the blended rating.
- [ ] Response time of `my-courses` for a student with many courses is recorded before and after in the report.
- [ ] `NO NEW FAILURES` against `baseline2-backend.txt`.

## User stories covered

- App team spec §0.2 item 1 (needed for release) and item 3's catalogue blend.
