---
tenant: vidyagram
status: step 2 refreshed 2026-11-12 onto dccee8feb (branch feat/vg-student-auth-gate-refresh, unpushed); not deployed
date: 2026-10-22
---

# Vidyagram auth gate: route inventory (step 1)

> **Refresh 2026-11-12.** The numbers below are the 10-22 snapshot. The gate now lives on
> `feat/vg-student-auth-gate-refresh` (worktree `~/Projects/worktrees/vg-auth-gate-refresh`, off
> `origin/vidyagram-admin` dccee8feb, tip `fe142fa21`, unpushed): the four old commits cherry-picked, plus the
> table brought up to date. **120 entries** now: 25 left because the per-group route gate (`ROUTE_GATE_*`, admin
> audit task 17) or a login covers them (orders, package-order, user list and writes, change-password, login
> sessions); 8 joined (`orders/get-temp-razorpay-order`, `user-test/attempted-by-types`,
> `user-test/generated-unattempted`, `saved-questions/sections|questions/:userId`,
> `report-questions/user/:userId/summary|questions`, and `courses/my-courses` from 10-25).
> Left open on purpose, and named in the script: `GET /api/users/:id`, `GET /api/typing-test/config`,
> `GET /api/user-test/allow-user-test-course/...`; `users/login-peers` is a pre-login card.
> Today's branch has 1,409 routes: admin 445, content 262, guarded 227, route-gate 166, student 119, guest 94,
> body-student 37 (1 gated), own-auth 23, auth-flow 22, chat 14. The TSV beside this file is regenerated.
> Verified: gate tests 36/36, inventory 0 problems, `npm test` has the same 25 failures as dccee8feb. No dist
> built. The deploy steps in "Next steps" still apply, from the new branch.

**Goal.** Require a login token on the student APIs that have none today, without touching public APIs or
admin APIs. The backend is `vidyagram-admin`, `backend.vidyagramar.com`, pm2 92. Quicktricks is out of scope.
The fork still has `// app.use(authenticateToken);` commented out at `src/app.ts:552`.

**Source.** [`auth-gate-route-inventory.tsv`](auth-gate-route-inventory.tsv) lists every route mounted after that
line, together with the auth middleware Express really runs for it (app-level, router-level and route-level). It was
generated from `vidyagram-admin` at `ab7d7b4e0` by:

```bash
node reference/scripts/route_auth_inventory.cjs ~/Projects/worktrees/vg-backend vidyagram/plans/auth-gate-route-inventory.tsv
```

Re-run it after every merge. Uday adds pre-login routes almost every day.

## The 1,069 routes, by category

| Category | Routes | What the gate does to it |
|---|---|---|
| `content`: no auth; catalogue reads plus content writes the admin makes | 383 (202 GET, 181 writes) | **Untouched.** Reads stay public. The 181 open writes are a separate gap, see below. |
| `admin`: `requireAdmin` or `/api/admin*` | 246 | **Untouched.** These routes already check for an admin token. |
| `guarded`: already runs `authenticateToken` | 152 | Nothing to change. |
| `student`: no auth; per-student data | 137 | **The target.** Add `authenticateToken`. |
| `guest`: optional auth by design (catalogue, search, practice batch) | 84 | **Untouched.** These must keep working when logged out. |
| `own-auth`: Transcoder secret, Streamer token, sync secret, ingest worker | 23 | **Untouched.** A user-token gate would 401 them (live hosting, stream-status, recordings, ingest). |
| `chat`: Q-Hub `/api/v1/*`, no auth | 23 | Held back until we know what headers the app sends. |
| `auth-flow`: login, OTP, register, refresh, the sign-up cards | 21 | **Untouched.** Must stay public. |

So "only the relevant APIs" comes to **137 student routes**, in these areas: `users` (all except the auth-flow
paths), `orders`, `package-order`, `user-test`, `user-test-dlq`, `user-stats`, `coins`, `user-coins`,
`user-points`, `streak(s)`, `typing-test`, `saved-questions`, `report-questions`, `course-progress`,
`class-progress`, `test-results`, `score`, `rank-scores`, `slot-machine`, `home-stats`, `daily-stats`,
`user-question-answers`, `room-test-leaderboard` and `views`. The TSV has every one of them.

## Why public and admin APIs are not affected

- **Public.** Only `student` routes get the gate. Every `content`, `guest`, `auth-flow` and `own-auth` route stays
  as it is today. No global `app.use` is added, so new routes, and 404s, behave as they do now.
- **Admin.** An admin token is a valid `authenticateToken` token, so `requireAdmin` routes are unchanged. The
  dashboard also calls some student routes (`users/search`, `users/:id`, `orders/assign-plan(s)`,
  `orders/user`, `orders/filter-options`), and it sends its token through the auth helpers there. The ~30 dashboard
  calls that send **no** token (in `vidyagram-admin-ui`) all hit `content`, `guest` or `chat` routes. None of them is
  a student route:
  - catalogue reads: `main-categories`, `categories`, `sections/dropdown`, `topics/dropdown`, `subtopics`,
    `classes/:id`, `classes/filter`, `courses/:id`, `courses/:id/available-classes`, `classes/:id/courses`
  - `courses/report-class`, `courses/:id/classes` (assign), `uploads/images`, `uploads/files`
  - `v1/messages/:id/poll-votes` (`PollVotesModal.tsx:52`). This one is why `chat` is held back.

## Still unknown: what the Vidyagram app sends

There is no app repo here, and the prod log does not record the `Authorization` header. We can't yet prove that the
app sends its token on all 137 routes. These look like they might be called logged-out or by a cron:

- `POST /api/views/track-class-view` (the router says anonymous view tracking)
- leaderboards: `user-test/all-toppers*`, `typing-test/all-toppers`, `typing-test/topper`, `rank-scores/leaderboard/:courseId`, `room-test-leaderboard/*`
- `GET /api/user-test/prepare-leaderboard-test-cron`, `POST /api/user-test-dlq/retry` (no caller found)
- `orders/get-razorpay-order`, `orders/get-website-razorpay-order`, `orders/payment-link` (checkout; the website may be logged-out)

That's why step 2 starts in report-only mode.

## Next steps

1. **Done:** inventory (this file).
2. **Built, not deployed.** The gate is on branch `feat/vg-student-auth-gate` (worktree `~/Projects/worktrees/vg-auth-gate`,
   off `origin/vidyagram-admin` 8755215dc, unpushed), in three commits: `a2fe5c857` declares `path-to-regexp`,
   `7f4f24a81` adds the route table, the gate and 27 tests, and `711522e29` mounts it in place of the commented line.
   - `src/middleware/studentAuthGate.ts` holds `STUDENT_ROUTES`, the 137 `'METHOD /path'` entries, compiled per
     method. Mode comes from `STUDENT_AUTH_GATE` (`off` when unset, a typo throws at boot). `enforce` delegates to
     the unchanged `authenticateToken`. `report` never blocks, and on a missing, expired or invalid token it logs
     `[student-auth-gate] would-401 <METHOD> <pattern> reason=<no-token|expired|invalid>`, with no URL and no header.
     Terminated sessions are not reported. HEAD is gated like GET.
   - Verified: `npm test` passes 2,747 with the same 19 failures as before. `route_auth_inventory.cjs` reports
     137 entries and 0 problems; the only overlaps are 2 routes that already demand a token. The real app, booted on
     a local Mongo in each mode, gives the same status on every probe in off and report. Enforce 401s only student
     requests without a valid token. Login, refresh, guest, catalogue, Transcoder-secret and admin routes stay unchanged.
   - Deploy (needs the user's OK): merge into `vidyagram-admin` after fetching Uday's latest; build `dist`;
     push; pull on the box in `/var/www/backend.vidyagramar.com/vidyagram-backend`; confirm
     `node -e "require.resolve('path-to-regexp')"` there; add `STUDENT_AUTH_GATE=report` to that checkout's env;
     `pm2 restart 92`; then grep the pm2 92 log for `[student-auth-gate]`. Rollback: unset the variable and restart.
     Let the app team use the app for a few days.
3. Read the would-401 lines. For each one, fix the caller, or move the route to `guest`.
4. Flip to `enforce`.
5. Later, as separate decisions: put `requireAdmin` on the 181 open content writes, add auth to the open `uploads`,
   switch the `:userId`-in-URL student routes to `req.user` (a token alone still lets one student read another's
   data), and decide the `chat` routes.
