# Deploy wave 1: groundwork + urgent locks

**Type**: HITL
**Blocked by**: 01, 02, 03, 04
**Repo**: backend, the Vidyagram box (webserver2-2, pm2 92)

## What to build

Ship tasks 01–04 to Vidyagram prod. Then read who would be refused, and enforce each report-mode group once the user
agrees.

**Branch:** `release/vg-audit-wave-1` (worktree `~/Projects/worktrees/vg-audit-wave1`). It is cut from
`origin/vidyagram-admin` d66f2d9bb and carries only 01–04, cherry-picked, plus a29cdb1b2. It holds none of
06/07: those log every admin out and need mobiles, so they belong to wave 2.

**Group defaults (decided 2026-10-30):**
- **Enforce on day one:** groups only the admin panel calls, which always sends the admin token.
  - `USER_LIST`: the student list and search.
  - `USER_WRITE`: user edit and delete.
  - `ORDER_ADMIN`: order list, stats, filter options, orders by course, assign-plan(s), order delete, package-order
    list, by-package and delete.
- **Report:** groups the app or website may call.
  - `CHANGE_PASSWORD`.
  - `USER_SELF_EDIT`: update-user.
  - `ORDER_READ`: a student's own history, orders and package orders.
  - `ORDER_WRITE`: student order create, package-order create/update, and `PUT /orders/:id`. The app may confirm
    checkout through `PUT /orders/:id`.
- No env line is needed for these defaults. Any group can be set back with `ROUTE_GATE_<GROUP>=report|off` and a
  restart.

- **Before deploying:**
  - Look up the box in `reference/hosts.md`.
  - Check whether the passwordless-login allowlist's default user id exists in `vidyagramdb` (read-only). If it
    doesn't, set the allowlist empty for Vidyagram in the box env. Ask the user first.
  - Back up the env file and the current checkout commit.
- **Deploy (user's go-ahead):** fast-forward `vidyagram-admin` to `release/vg-audit-wave-1` (re-check origin
  hasn't moved, and rebase if it has). Commit a surgical dist (`scripts/qt-surgical-dist.sh <wt> origin/vidyagram-admin
  --write`; never build on the box), push, `git pull --ff-only` in `/var/www/backend.vidyagramar.com/vidyagram-backend`,
  `pm2 restart 92`. No `ROUTE_GATE_*` lines are needed.
- **Check:**
  - A fresh student login stores a real IP.
  - An admin login leaves no password, OTP or token in the pm2 out log.
  - The admin panel's Users list, search, edit and delete work.
  - The admin panel's Orders list, assign plan and order delete work. These three are enforced from the first
    minute.
  - With no login, `GET /api/users` and `GET /api/orders` give 401.
  - Change-password, purchase and the app's own order history still work.
  - If an admin screen breaks, set that group to `report` and restart, then look at why.
- **Read the report lines** for 24–48 h. They are `console.warn`, so they land in the pm2 error log
  (`~/.pm2/logs/vidyagram-backend-error.log`), not the out log. Write one table per group: route, callers by user-agent and referer, count
  of would-be refusals, and who they were (admin panel without a token? the app? unknown IPs?). Save it in
  `vidyagram/reports/route-gate-wave-1-<date>.md`.
- **Enforce (user's go-ahead per group):** flip that group's setting to `enforce`, restart, and check its callers
  still get 200. Any group the app still calls without a token stays in `report`. Raise it with the user as an app
  change.
- Record the state in the README's done list and in memory.

## Acceptance criteria

- [x] Deployed 2026-10-30 16:18 IST (6803eeee2) with the group defaults above. No-login 401s pass; real IP, admin
      screens and app flows: see the README deploy entry.
- [ ] Report table written for each group.
- [ ] Each group is enforced or knowingly left in `report`, with the user's decision recorded.
- [ ] Rollback steps (env flip to `off`, or checkout of the previous commit) written in the report.

## User stories covered

- Stories 44, 45 (and makes 40–43, 48, 49 live)
