# Admin sessions + logout + "session ended" in the admin panel

**Type**: AFK
**Blocked by**: 06
**Repo**: backend + admin

## What to build

Every admin login becomes a session the server knows about. Ending it, by logout, disabling the admin or a role
change, cuts the login off on the next request.

- **`AdminSession` collection:** session id, admin id, IP, browser, created, last seen, ended at, end reason. Add an
  index script for `{ adminId: 1, endedAt: 1 }` and `{ sessionId: 1 }` unique. Task 09 builds them by hand on prod.
- **Admin session module.** `start(admin, ip, browser)`, `check(sessionId, adminId)` (active, or ended with a
  reason), `end(sessionId, reason)`, `endAllFor(adminId, reason)`.
  - The reasons are `logged_out`, `ended_by_admin`, `admin_disabled`, `role_changed` and `expired`.
  - `check` also updates last seen, at most once a minute.
- **Settings.** `ADMIN_SESSION_MULTI_DEVICE` defaults to on; when it's off, a new login ends the admin's other
  sessions. `ADMIN_TOKEN_TTL` defaults to `1d`.
- **Login.** A full admin login (after the OTP, or without it when `ADMIN_OTP_REQUIRED` is off) starts a session and
  puts `session_id` in the token.
- **`requireAdmin`.**
  - A token with no `session_id` gets 401 `ADMIN_SESSION_REQUIRED`. This forces one re-login on deploy.
  - An ended session gets 401 `ADMIN_SESSION_ENDED` with its reason.
  - An admin whose `status` is no longer active gets refused, and their sessions end.
- **`POST /api/admins/logout`** ends the caller's session.
- **Role or status changes.** Every admin-update path that changes `role`, `admin_type` or `status` calls
  `endAllFor`.
- **Admin panel.**
  - One shared response handler on every API call. On 401 with either code it clears the stored token and goes to
    the login page with "Your session has ended. Please log in again."
  - Today only a few callers handle 401. Find the shared fetch helpers and the screens that use `fetch` directly, and
    make them all go through the handler.
  - Logout calls the new route, then clears the browser, even if the call fails.

## Acceptance criteria

- [ ] Integration: login creates a session, and the token works.
- [ ] Integration: logout makes the same token get 401 `ADMIN_SESSION_ENDED` (`logged_out`).
- [ ] Integration: an old token without `session_id` gets 401 `ADMIN_SESSION_REQUIRED`.
- [ ] Integration: disabling an admin ends their sessions on the next request (`admin_disabled`). A role change does
      the same (`role_changed`).
- [ ] Integration: with `ADMIN_SESSION_MULTI_DEVICE` off, a second login ends the first. With it on, both work.
- [ ] Admin component: a 401 with either code from any API call lands on the login page with the message. Logout
      calls the route.
- [ ] Report lists every admin-panel call site moved onto the shared handler, and any left out with a reason.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 31, 32, 34, 35, 36, 38, 39
