# Route login gate + change-password lock

**Type**: AFK
**Blocked by**: None, can start immediately
**Repo**: backend

## What to build

One reusable login lock for open routes, and its first use: only the student themself, or an admin, can change a
password. Today `POST /api/users/change-password` takes any `user_id` from the body with no login.

- **Gate.** `gate({ group, allow })`, where `allow` is `admin` or `self-or-admin`.
  - `self-or-admin` passes the student whose id is in the route or body, and any admin.
  - The mode comes from a per-group setting, `ROUTE_GATE_<GROUP>`, set to `off`, `report` or `enforce`. The default is
    `report`.
  - `report` lets the call through. It also writes one line,
    `ROUTE_GATE_WOULD_REFUSE group=… route=… reason=… ip=… ua=… referer=…`, with the route as a pattern, never the raw
    URL.
  - `enforce` answers 401 when there is no login and 403 when the caller is the wrong student.
  - A bad token counts as no login.
  - The gate uses task 01's client IP if it has landed, and `req.ip` otherwise.
- **Change-password group** (`ROUTE_GATE_CHANGE_PASSWORD`, `self-or-admin`). Port the logic of the quicktricks fix
  `7c94ef898` (branch `fix/change-password-require-self` in `quicktricks-backend`). Port the source, never the `dist`
  commits. The handler must use the logged-in student's id, not a body id that differs from it.
- **Callers.** List who calls change-password on Vidyagram: the admin panel (search
  `~/Projects/worktrees/vidyagram-admin-ui` on a fresh `origin/vidyagram-admin`), the website and the app, as far as
  this machine shows. Also say whether each sends a Bearer token. Write it in the report. The prod log check happens
  in task 05.

## Acceptance criteria

- [ ] Integration (real router, in-memory Mongo): in `off` every call passes; in `report` every call passes and a
      would-refuse line is written for no-login and wrong-student calls; in `enforce` no login gives 401, another
      student 403, the same student 200 and an admin 200.
- [ ] Integration: the password actually changes for the allowed caller and not for a refused one.
- [ ] The report lists change-password callers and whether they send a token.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 40, 44, 45
