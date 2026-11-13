# Locks on user edit/delete and student list/search

**Type**: AFK
**Blocked by**: 02
**Repo**: backend

## What to build

Put the task 02 gate on the user routes that let anyone edit or delete an account or read the whole student list.

- **`ROUTE_GATE_USER_WRITE`.**
  - `PUT /api/users/:id`: `admin`. The quicktricks fix (`d89206e7a`) also stops update-user from setting `password`.
    Port that too.
  - `DELETE /api/users/:id`: `admin`. Quicktricks fix `be05489b0`.
  - Check `POST /update-user` the same way. Today it spreads the body.
  - If the Vidyagram app or website edits its own profile through any of these, that route uses `self-or-admin`, with
    only the fields a student may change. Find out before choosing, and say which in the report.
- **`ROUTE_GATE_USER_LIST`.** `GET /api/users` and `POST /api/users/search`, both `admin`. They return phone, email,
  mpin and FCM token for every student.
- **Leave `GET /api/users/:id` and `/users/profile/:user_id` alone.** On quicktricks, locking them broke the app,
  which called them without a token about 37% of the time, and the lock was rolled back. List them in the report as
  still open.
- **Callers.** List each route's callers (admin panel, website, app) and whether they send a token, as in task 02.

## Acceptance criteria

- [ ] Integration: for each route, in `enforce`, no login gives 401, a student 403 (or 200 for their own record where
      `self-or-admin` was chosen), and an admin 200. `report` passes and logs.
- [ ] Integration: update-user can no longer set a password.
- [ ] Integration: a student self-edit, if allowed, can't change protected fields (status, coins, mobile, email,
      unless the app needs one; name it).
- [ ] The report lists callers per route, and the profile routes left open.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 41, 42, 45, 46
