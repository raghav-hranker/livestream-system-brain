# Deploy wave 2: admin logins

**Type**: HITL
**Blocked by**: 05, 06, 07, 08
**Repo**: backend + admin, the Vidyagram box (pm2 92), Vercel `vidyagram-admin`

## What to build

Ship admin login hardening and sessions. Every admin logs in again once.

- **Before deploying (read-only, then user's go-ahead):**
  - Run `vidyagram-admins-without-mobile` on `vidyagramdb`. Give the user the list, so mobiles can be added or the
    admins disabled. Don't deploy with `ADMIN_OTP_REQUIRED=true` while an active admin who still needs access has no
    mobile, unless the user says so.
  - Build the `AdminSession` indexes by hand on prod (autoIndex never builds there) and add them to the index ledger.
  - Set the box env: `ADMIN_OTP_REQUIRED=true`, `ADMIN_SESSION_MULTI_DEVICE=true`, `ADMIN_TOKEN_TTL=1d`,
    `AUDIT_ADMIN_IDS=<the user's admin id(s)>`. Back up the env first.
  - Draft a two-line message for the user to send admins: "You'll be logged out once at <time>; log in again with
    your OTP."
- **Deploy (user's go-ahead):** backend first (push `vidyagram-admin`, pull, build, `pm2 restart 92`), then push the
  admin branch so Vercel deploys within minutes. Until Vercel finishes, admins see the session message and log in
  again, which is expected.
- **Check on prod:**
  - Log in, see the session row, and confirm the token works.
  - Logout makes the old token get `ADMIN_SESSION_ENDED`.
  - Ending sessions through the controls works.
  - A half-way token is refused on an admin route.
  - The admin panel lands on login with the message.
- **Rollback:** the previous backend commit and a revert of the admin deploy on Vercel. Write both in the report.
- Record in the README's done list and in memory.

## Acceptance criteria

- [x] Admins without a mobile handled (Hranker given 9643713929, 10-30), with the user's decision recorded.
- [x] Indexes built and in the ledger. Env set and backed up.
- [x] Deployed backend and admin (10-30). Prod checks pass; the half-way token was checked by tests only.
- [x] Report in `vidyagram/reports/` with commits, checks and rollback.

## User stories covered

- Story 39 (and makes 28–38 live)
