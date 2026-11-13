# Admin audit trail: waves 2 and 3 deployed (2026-10-30)

Tenant: Vidyagram (781). Box webserver2-2, pm2 92, `/var/www/backend.vidyagramar.com/vidyagram-backend`.

## What shipped

- **Backend**: `vidyagram-admin` 6803eeee2..261bc2355. That covers the integration branch `feat/vg-admin-audit` with
  tasks 06–08, 10–17 and 17b, the origin merge c797b7636, the fixes ee50f20d5, and a surgical dist of 293 files
  (0 foreign). The box pulled at 17:32 IST. At 17:46 the client team fast-forwarded it to 50f6b81c (their commits on
  top of ours) and restarted pm2 92, 100, 101 and 102. 261bc235 is an ancestor of that head.
- **Admin**: `vidyagram-admin` 48f0e267..9f6c90ca, which adds the session-ended handler, logout ending the server
  session, and the ADMIN_MOBILE_REQUIRED message. Vercel `vidyagram-admin` reported success at 17:43.
- **Env** (backups `.env.development.bak-20261030-1731-pre-audit-wave2` and `…-pre-audit-wave3`):
  - `AUDIT_ADMIN_IDS=6ace3e03c69d76f22d52f83d`: Hranker only, the user's choice.
  - `AUDIT_TRAIL=on`: off for wave 2 at 17:32, on at about 17:45.
  - `APX_INGEST_SECRET_GATE=off`: the worker sends no `X-Transcoder-Secret` yet.
  - The admin OTP-required, multi-device and 1-day token settings use the code defaults.
- **Indexes** (built about 17:20; listed in the ledger in memory `prod-mongo-cluster`):
  - `adminsessions`: `sessionId_1` (unique) and `adminId_1_endedAt_1`.
  - `auditlogs`: 5 indexes, including the `at_1` TTL of 400 days.
- **Data**: Hranker `admin_mobile` was unset and is now set (recorded in `prod-data-changes`). Afterwards, 0 of 6
  admins lack a mobile.
- **Crons**: pm2 92 runs NODE_ENV=production with no DISABLE_CRONS, so crons run in-process through the job runner.

## Tests before deploy

- Backend suites: `NO NEW FAILURES` against baseline-backend.txt.
- Admin suites: `NO NEW FAILURES` against baseline-admin.txt.
- Two tests broken by the origin merge were fixed in ee50f20d5:
  - the api-cache cron now goes through the job runner
  - the history test for no-login user edits now sets USER_WRITE to report
- From dist: 151/152 pass. The one failure scans `.ts` source, so it can't run against JS.
- The dist boots on in-memory Mongo: no `AUDIT_PLUGIN_LATE`, and admin and user routes give 401 with no login.

## Prod checks

| Check | Result |
|---|---|
| No login on `/api/admin/sessions`, `/api/admins`, `/api/admins/logout`, `/api/users` | 401 |
| Admin token issued before the deploy | 401 `ADMIN_SESSION_REQUIRED`; the panel goes to `/login?session=ended` with the message |
| Fresh login, password + OTP to 96****29 | session row, real IP 148.113.47.103, new token → 200 |
| Second login from another browser | second session; both live (multi-device) |
| Rename Hranker → "Hranker (test)" → "Hranker" (PUT /api/admins/:id, name only) | lookup shows 2 change rows: admin, session, IP, route, `Name` before → after |
| Logout from the panel | old token → 401 `ADMIN_SESSION_ENDED reason=logged_out`; session row `endedAt` set |
| `AUDIT_WRITE_FAILED` / `AUDIT_PLUGIN_LATE` | 0 / 0 |
| Half-way (OTP) token on an admin route | not tried on prod (it needs the password); covered by the task 06 integration tests |

## Rollback

- **Stop the history only:** `AUDIT_TRAIL=off` in `.env.development`, then `pm2 restart 92 --update-env`.
- **Make the OTP optional:** `ADMIN_OTP_REQUIRED=false` and restart.
- **Whole backend:** `git reset --hard 6803eeee2`, or untar `~/vg-dist-backup-20261030-1731-wave2.tar.gz`, then restart.
  This drops the client team's later commits too, so redo them.
- **Admin panel:** promote the previous deployment in Vercel `vidyagram-admin`.

## Open

- **48-hour watch:** `auditlogs` growth per day, `AUDIT_WRITE_FAILED`, admin-route response times, pm2 92 memory.
  First 5 minutes: 11 rows.
- **Wave 1 report groups:** read `ROUTE_GATE_WOULD_REFUSE` in `~/.pm2/logs/vidyagram-backend-error.log` and decide
  enforce per group. That covers wave 1's four groups plus the groups from tasks 17 and 17b.
- **APX ingest worker:** make `apx-ingest-container` `lms-client.js` send `X-Transcoder-Secret` (env
  `TRANSCODER_SECRET`), then set `APX_INGEST_SECRET_GATE=enforce`.
- **Student-owned routes with no owner check (from 17b):** the in-app notification `:userId` routes, and the
  test-results / saved-questions / user-question-answers writes.
- **Small history quirks:**
  - The OTP-verify request and the session it creates are recorded as `no-login`.
  - A row's actor name is the name at request time, so the rename-back row shows "Hranker (test)".
