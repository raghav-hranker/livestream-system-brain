# My courses: exchange flag on every card

**Type**: AFK
**Blocked by**: None
**Repo**: backend (Vidyagram, branch `vidyagram-admin`)
**Status**: done, deployed 2026-10-26 (vidyagram-admin e2cd15bd2).

## What to build

The app team asked for the Exchange action on the My courses list, not only on the course page. Every card in
`POST /api/courses/my-courses` (`liveCourses` and `recordedCourses`) gets the same `exchange` field the course page
(`POST /api/courses/by-id-2`) already sends, with the same shape and the same rules:

```
exchange: { orderId, eligible: true } | { orderId, eligible: false, reason } | null
```

- **One rule, two callers.** Add a batch `loadCourseExchangeSignals(userId, courseIds, now?, config?)` in
  `services/courseExchange.service.ts` that returns `Map<courseId, CourseExchangeSignal | null>`. Rewrite
  `loadCourseExchangeSignal` as a one-element call of it, so the course page and My courses cannot disagree.
- **Keep it cheap.** It makes one plans query over every card's course (`course` in both id forms, non-empty
  `exchangeToPlanIds`, single-course only) and one orders query for those plans. Then it runs `assessOrder` only for
  the courses that have a candidate order. With no candidates (nearly always today), that is two small reads and
  nothing more. Pick the newest active order per course, as now (D14).
- **Student token only.** Fill `exchange` only when the request's token has a `user_id` equal to the resolved
  student. That matches `by-id-2`, which reads the student from the bearer token only, because an exchange is a
  student action. Admin tokens, no token, and the switch being off all give `exchange: null` on every card.
- **Where.** In `getUserCourses`, beside the invoice and certificate blocks (`src/controllers/courseController.ts`).
  It adds no query per card.

## Acceptance criteria

- [ ] Integration, real routers, in-memory Mongo, switch on:
  - [ ] A student with a token and an eligible single-course order on a plan with a swap list: that card has
        `{ orderId, eligible: true }`, and every other card has `null`.
  - [ ] The same student over the watch limit: `{ orderId, eligible: false, reason: 'watched_too_much' }`.
  - [ ] A combo-plan card and a card whose plan has no list: `null`.
  - [ ] After a real `exchange-self`, the new course's card is `null` (its plan has no list), and the old course is
        gone from the list.
  - [ ] Two eligible orders on one course: `orderId` is the newer one by purchase time.
  - [ ] No token (body `userId`) and an admin token: `null` on every card, and the course list is otherwise
        unchanged.
  - [ ] Switch off: `null` on every card.
  - [ ] For the same student and course, the card's field deep-equals `by-id-2`'s `data.exchange`.
- [ ] The existing course page signal tests (`courseExchangeSignal`), exchange tests, and my-courses
      invoice/certificate/login tests still pass.
- [ ] `NO NEW FAILURES` against a baseline recorded on the base commit before you start.

## Notes

- Base: `origin/vidyagram-admin` 9716d1d5b. Worktree `~/Projects/worktrees/vg-mycourses-exchange`, branch
  `feat/vg-mycourses-exchange`.
- Guide: add a short section to `vidyagram/reference/vidyagram-course-exchange-api-guide.md`, "The same field on My
  courses cards", and update its checklist.
