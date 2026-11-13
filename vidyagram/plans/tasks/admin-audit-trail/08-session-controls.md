# Session controls for the allowlist

**Type**: AFK
**Blocked by**: 07
**Repo**: backend

## What to build

The developer can see every active admin session and end any of them. No UI yet; the routes are called with curl or
a script.

- **Allowlist.** `AUDIT_ADMIN_IDS` is a comma-separated list of admin ids in the server settings. It's empty by
  default, which means nobody. A small `isAuditAdmin(req)` check reads it; task 10 and later reuse it for history
  access.
- **Routes,** all behind `requireAdmin` plus the allowlist (403 `NOT_AUDIT_ADMIN` otherwise):
  - `GET /api/admin/sessions?adminId=` lists active sessions (admin id, name, email, IP, browser, created, last seen).
  - `POST /api/admin/sessions/:sessionId/end` ends one, with reason `ended_by_admin`.
  - `POST /api/admin/admins/:adminId/end-sessions` ends all of one admin's sessions, with the same reason.
- Add a "how to end a leaked admin login" section to `vidyagram/reference/` with the curl lines.

## Acceptance criteria

- [ ] Integration: an allowlisted admin can list sessions, end one and end all. The ended tokens then get 401
      `ADMIN_SESSION_ENDED` (`ended_by_admin`).
- [ ] Integration: an admin not on the list gets 403, a student 403, no login 401. An empty list lets nobody in.
- [ ] The reference note exists.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 23, 33
