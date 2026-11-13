# Vidyagram admin history, admin sessions and route login checks: tasks

PRD: [`../../prd-vidyagram-admin-audit-trail.md`](../../prd-vidyagram-admin-audit-trail.md).

Repos:
- the Vidyagram backend (fork of quicktricks-backend, branch `vidyagram-admin`)
- the Vidyagram admin (fork of quicktricks-admin, branch `vidyagram-admin`)
- system-brain, for scripts under `reference/scripts/` with a `vidyagram-` prefix
- ops-console, for the alert

Start every task from a fresh `origin/vidyagram-admin`; the local worktrees were 132 (backend) and 43 (admin) commits
behind on 2026-10-29. Nothing here touches quicktricks. The quicktricks fixes are copied as source, never merged.

Baselines: the first task to start captures `baseline-backend.txt` (`npm run test:all`) and `baseline-admin.txt` in
this folder from a fresh `origin/vidyagram-admin`, the way the certificates tasks did. "`NO NEW FAILURES`" means no
test fails that passed in the baseline.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Real visitor IP + blank secrets in logs](01-real-ip-and-log-redaction.md) | AFK | None |
| 02 | [Route login gate + change-password lock](02-route-gate-and-change-password.md) | AFK | None |
| 03 | [Locks on user edit/delete and student list/search](03-user-route-locks.md) | AFK | 02 |
| 04 | [Locks on order reads/writes and assign plan](04-order-route-locks.md) | AFK | 02 |
| 05 | [Deploy wave 1: groundwork + urgent locks](05-deploy-wave-1.md) | HITL | 01–04 |
| 06 | [Admin login hardening](06-admin-login-hardening.md) | AFK | None |
| 07 | [Admin sessions + logout + "session ended" in the panel](07-admin-sessions.md) | AFK | 06 |
| 08 | [Session controls for the allowlist](08-session-controls.md) | AFK | 07 |
| 09 | [Deploy wave 2: admin logins](09-deploy-wave-2.md) | HITL | 05, 06–08 |
| 10 | [History, first working version](10-history-first-version.md) | AFK | 01, 07 |
| 11 | [History coverage](11-history-coverage.md) | AFK | 10 |
| 12 | [Job runner + script label](12-job-runner-and-script-label.md) | AFK | 10 |
| 13 | [Writes that skip the hook (1): class assignment, exchange](13-bypass-writes-class-and-exchange.md) | AFK | 10 |
| 14 | [Writes that skip the hook (2): bulk, sales, plan sync, gaps](14-bypass-writes-bulk-and-gaps.md) | AFK | 10 |
| 15 | [Full lookup script + failure alert](15-lookup-script-and-alert.md) | AFK | 10 |
| 16 | [Undo script](16-undo-script.md) | AFK | 10, 12 |
| 17 | [Remaining open routes, report mode](17-remaining-open-routes-report-mode.md) | AFK | 02, 10 |
| 17b | [Admin writes any student token can call, plus leftovers](17b-student-token-admin-writes.md) | AFK | 17 |
| 18 | [Deploy wave 3: the history](18-deploy-wave-3.md) | HITL | 09, 10–17, 17b |

**Order:**
1. 01, 02 and 06 run in parallel.
2. Then 03 and 04 (parallel), and 07.
3. Then 05 (deploy the urgent locks) and 08.
4. Then 09.
5. 10 can start once 01 and 07 are merged locally; it doesn't wait for the deploys.
6. After 10: 11, 12, 13, 14, 15 and 17 in parallel. 13 and 14 touch different files. 11 and 14 both touch the
   plugin, so merge 11 first.
7. Then 16.
8. Then 18.

Each deploy wave needs the user's go-ahead to push to prod, and again to switch any gate from `report` to `enforce`.

**Done:**
- **Setup** (2026-10-29):
  - Integration worktrees `~/Projects/worktrees/vg-audit-backend` and `vg-audit-admin` on `feat/vg-admin-audit`, cut
    from `origin/vidyagram-admin` (backend 505e55646, admin be406388).
  - Baselines captured there: backend 93 failures, admin 94. They were captured under load from parallel agents, so
    a few may be flaky.
- **01** (2026-10-29): backend 67d4eb3a0, merged as 60395e2a8.
  - `trust proxy` is `'loopback'`. `getClientIp` walks X-Forwarded-For only through loopback hops and no longer reads
    X-Real-IP.
  - Cloudflare does NOT front backend.vidyagramar.com: DNS-only record, `Server: Apache`.
  - `utils/redact` handles the request logger, the error handler and the socket helper. Admin login, OTP and
    change-password log no body.
  - After deploy, check that a new `UserLoginSession.ip_address` is public. If Apache sends only X-Real-IP, the IP
    stays 127.0.0.1.
- **02** (2026-10-29): backend 7a8c60ee3, merged as 97cc98f38.
  - `middleware/routeGate.ts`: `gate({ group, allow, self })`. `ROUTE_GATE_<GROUP>` is unset → report; a typo →
    report plus a warning; off → no token read.
  - Report line: `ROUTE_GATE_WOULD_REFUSE group= route= method= reason= ip= ua= referer=`.
  - change-password is `self-or-admin`, and a logged-in student always changes only their own password.
  - The Vidyagram admin panel never calls change-password. No Vidyagram app or website source is on this machine,
    so task 05's log check decides.
  - The gate reads tokens via `optionalAuthenticateToken`. Task 07 must add the admin-session check there too.
  - `feat/vg-student-auth-gate` also gates change-password: remove the double gate when the second one lands.
- **06** (2026-10-29): backend eb428712a, merged as 840f94c54; admin dba53ead, merged as 362b5d82.
  - The half-way token is refused in `authenticateToken`, `authenticateUserOrStreamer` and
    `optionalAuthenticateToken`, not only `requireAdmin`.
  - `ADMIN_OTP_REQUIRED` (default on): an admin with no mobile gets 403 `ADMIN_MOBILE_REQUIRED`.
  - The OTP step re-checks status.
  - Script `reference/scripts/vidyagram-admins-without-mobile.js` lists admins with no mobile or a mobile that isn't
    10 digits, and refuses quicktricks. Not run on prod.
  - Deploying this locks out admins with no mobile: run the script first (task 09), or ship with
    `ADMIN_OTP_REQUIRED=off`.
- **Integration heads** after 01, 02 and 06: backend 840f94c54, admin 362b5d82. Both suites gave `NO NEW FAILURES`.
  Nothing has been pushed.
- **04** (2026-10-30): backend c5c99051d, merged as 029b1bb79.
  - `ROUTE_GATE_ORDER_READ` / `ORDER_WRITE`, with owner lookups in the order and package-order controllers.
  - A student may create only an unpaid order. success, givenForFree and assignedByAdmin are admin-only.
  - Also gated: `/filter-options`, `/my-orders`, `/by-razorpay/:id`, `/invoice-orders` (it leaked other students'
    paid orders), `DELETE /orders/:id`, and package-order reads and delete.
  - The payment routes are not gated: get-razorpay-order, website order, payment-link, the webhooks and IAP submit.
  - **Before enforcing ORDER_WRITE:** a code comment says the frontend confirms checkout via `PUT /orders/:id`.
    Watch the `group=ORDER_WRITE route=/api/orders/:id method=PUT` lines first.
  - The admin panel's order calls all send the admin Bearer (`hooks/api/use-orders.ts`).
  - The unit test "today reads newest first" (liveSchedule) fails after midnight IST on the untouched head too. It's
    time-of-day flake, not this change.
- **03** (2026-10-30): backend c7913676e, plus b75682f2f (`USER_FIELDS_DROPPED` log, field names only); merged as
  8d206b3da.
  - `USER_LIST` (admin): `GET /api/users`, `POST /search`.
  - `USER_WRITE` (admin): `PUT /:id`, `DELETE /:id`.
  - `USER_SELF_EDIT` (self-or-admin): `POST /update-user`, which is the app's profile edit. Keep it in report until
    the log shows whether the app sends a token.
  - Field rules apply in every gate mode:
    - A caller other than an admin writes only profile fields.
    - Email needs the student's own login.
    - Status, coins, mobile and password are admin-only.
    - update-user never writes a password.
  - `GET /users/:id` and `/users/profile/:id` are left open, as the quicktricks rollback lesson says.
  - The admin panel's user calls all send the admin Bearer.
- **07** (2026-10-30): backend fd2ada176, admin e2fdaacf; merged as 6553637ce (backend) and d6a6ca58 (admin).
  - Backend:
    - `AdminSession` (`adminsessions`) and `services/adminSession.ts`.
    - One `tokenSessionRefusal` check in authMiddleware, used by authenticateToken, optionalAuthenticateToken,
      authenticateUserOrStreamer, the route gate and the support-chat socket. The socket also refused no half-way
      token before this.
    - Codes: `ADMIN_SESSION_REQUIRED`, `ADMIN_SESSION_ENDED` + reason.
    - The status check runs on every admin request. Session and status reads go to the primary.
    - `POST /api/admins/logout`.
    - `updateAdmin` and `deleteAdmin` end sessions.
  - Admin:
    - `lib/session-ended.ts` runs in the auth helpers, a new `apiFetch` and the upload XHR.
    - About 30 direct-fetch callers were moved onto it.
    - Callers that send no token at all (ClassesDashboard, ClassForm, CourseForm, use-sections and others) are
      listed in the agent report. Task 17 will surface them.
  - Index script `reference/scripts/vidyagram-admin-session-indexes.cjs`: dry run by default, refuses quicktricks.
  - Test helper `src/tests/support/adminLogin.ts` `adminLoginToken()`. Any admin token in a test must come from it.
- **Gate tests moved onto real sessions** (2026-10-30): 668934386 on the integration branch (03 and 04's tests minted
  sessionless admin tokens). 54/54 route-gate tests pass.
- **08** (2026-10-30): backend e97cf05a4, merged as b95042c0f.
  - `GET /api/admin/sessions`, `POST /api/admin/sessions/:id/end`, `POST /api/admin/admins/:id/end-sessions`.
  - Each route runs `requireAuditAdmin` itself (not router-level, so other `/api/admin/*` routes are unaffected).
  - `isAuditAdmin(req)` is in `middleware/auditAdmin.ts`. `AUDIT_ADMIN_IDS` is read on every call; empty means
    nobody.
  - Each end call logs an `ADMIN_SESSION_ENDED_BY_ADMIN` line.
  - Runbook: `vidyagram/reference/admin-sessions-runbook.md`.
- **10** (2026-10-30): backend 190dc301c, merged as cea8c29df.
  - `services/audit/`: `requestContext` (`runAs` awaits fn inside the context), `policy` (`CHANGE_POLICY`,
    `REQUEST_POLICY`; today classes × admin), `recorder`, `plugin`, and `register`, which is app.ts's first import
    and warns `AUDIT_PLUGIN_LATE`.
  - `middleware/auditContext`: re-enters the context on `req.emit`, so multer uploads keep it. `models/AuditLog`.
  - The admin actor comes from the row the session check already reads, with no extra read.
  - Rows are written with `AuditLog.collection.insertOne`, after `setImmediate`. No-op writes are skipped.
  - In a transaction, rows are written only on `TRANSACTION_COMMITTED`.
  - Outcome: 4xx is refused, 5xx is failed.
  - A refused admin token's write attempt still gets a request row, with `refusal`.
  - Scripts: `reference/scripts/vidyagram-audit-lookup.js` and `vidyagram-audit-indexes.cjs` (5 indexes, TTL
    34,560,000 s). Tested only on in-memory Mongo.
  - Not wired yet: other entry points (usertestapp, dlqConsumerRunner, crons, scripts). That's task 12.
- **Boot smoke test** (2026-10-30) of the integration head on a throwaway in-memory replica set, with throwaway
  secrets and crons off:
  - `GET /` → 200, with 0 `AUDIT_PLUGIN_LATE` lines.
  - `GET /api/admin/sessions` with no login → 401.
  - `GET /api/users` with no login → 200 in report mode, logging
    `ROUTE_GATE_WOULD_REFUSE group=USER_LIST … ip=203.0.113.9` (the IP forwarded over loopback).
  - Harness: scratchpad `boot.cjs`. It isn't kept; rerun it by hand.
- **Integration heads after 01–04, 06, 07:** backend 668934386, admin d6a6ca58. Both suites gave `NO NEW FAILURES`.
  Nothing has been pushed. system-brain holds two uncommitted scripts and their README lines:
  `vidyagram-admins-without-mobile.js` and `vidyagram-admin-session-indexes.cjs`.
- **Integration heads after 01–04, 06, 07, 08, 10:** backend cea8c29df, admin d6a6ca58. The backend suite gave
  `NO NEW FAILURES`. Nothing has been pushed. Uncommitted in system-brain: the 4 scripts, the runbook, their README
  lines, and this folder.
- **15** (2026-10-30): no backend change.
  - The lookup script was rewritten with modes `--collection --id`, `--admin`, `--deletes`, `--request` and `--actor`,
    plus `--json`. Times are in IST, and it shows field-level differences.
  - Alert: ops-console `feat/vg-audit-alert` 011656a (worktree `~/Projects/worktrees/ops-console-vg-audit`).
    - `checks/vg-audit-failures.{js,sh}` runs every 5 min. It reads the vidyagram-backend out AND error logs (the
      failures go to stderr) and stores byte offsets.
    - It will conflict with the uncommitted vg-purchases and stuck-classes edits in the main ops-console checkout
      (adjacent lines in format.mjs, runbook.md and crontab).
    - Deploy needs Kuma pushes `vg-audit-failures(-run)` plus their entries in `push-urls.env`.
    - The bulk and read display shapes were guessed from the PRD. Re-check them against 11.
- **13** (2026-10-30): backend 0266f88be, merged as 396758f21.
  - `services/audit/bypassWrite.ts` `recordedWrite(model, target, write)` covers the placement taxonomy, move,
    assign, duplicate, `followClassTitle` and `rewriteOrderGrant` (exchange plus undo).
  - Only admin actors are recorded (`recordedContext`). Switch it to 11's `recordsChange` after 11 merges.
  - Bulk changes are recorded as one row per record (200 max) plus an `AUDIT_BULK_SAMPLED` log line. Switch to 11's
    bulk shape.
- **17** (2026-10-30): backend 466730880, merged as 9b99af0e9.
  - 151 gate lines in groups COURSE_FOLDERS, TAXONOMY, CATEGORIES, APX_COURSES, UPLOADS, COURSE_ASSIGN,
    TEST_CONTENT, CONTENT, LEARN_CONTENT, QR_CODES (self-or-admin) and CHAT_CHANNELS. All are report by default.
  - Inventory: `vidyagram/plans/admin-route-inventory-2026-10-30.tsv` (369 open writes, each with an owner).
  - **Before enforcing UPLOADS:**
    - `ChannelForm.tsx:51` needs the Bearer.
    - The Next routes `editorial-media-upload` and `question-media-upload` must forward `Authorization`.
    - `NoticeForm` and `UserForm` send no token to them.
  - Overlap with the student gate is limited to the 02–04 routes. The route gate should own those, and the student
    gate drops them.
  - Leftovers went to task 17b: 122 student-token admin writes, batch-register, and the apx-ingest secret.
  - `origin/vidyagram-admin` has moved: backend cb61a7b42, admin 7d64f3f8. Sync the integration branch before any
    deploy.
- **11** (2026-10-30): backend cc21a8e73, merged as 56e4580bd.
  - `policy.ts`:
    - `CHANGE_POLICY`: 25 collections, each with owner, quiet fields and softDelete.
    - `ACTOR_POLICY`: a student is recorded only for someone else's record, or for a delete or soft-delete.
    - `SENSITIVE_READS` table: rows hold `read = {what, filter, count}`. The count comes from wrapping `res.json` /
      `res.send`.
  - Bulk rows: `target.id` null, `bulk = {filter: EJSON string, count, sampled}`, before/after as arrays (200 max).
  - Quiet fields are never recorded on their own: last login, fcm/device tokens, view counts, usedCount, LastLogin,
    lastSeenAt.
  - Every no-login `GET /api/users/:id` writes a read row. Watch the volume after deploy.
- **Redaction** (2026-10-30, the user's call): b4772ee93, merged as 329fa19cb.
  - Before/after copies (single and bulk) go through `redactSecrets`: `<redacted>` and `<jwt>`.
  - Single rows get `secretsChanged`.
  - Test: no bcrypt hash anywhere in `auditlogs`.
- **12** (2026-10-30): backend 1467ad18f, merged as 8af7ff59b.
  - `jobRunner.ts`: `runJob`, `scheduleJob`, `countChange`, plus `countWriteResult` (added by 14). Job actors are in
    count mode and read nothing; job deletes keep copies.
  - Wired: 60 cron sites, 12 `run*.ts`, and 95 scripts with `runAs('script:<file>')`.
  - Guard test `auditJobWiring`.
  - `flushAuditWrites` and a wrapped `Connection.close`, so a script that disconnects keeps its last rows.
  - Large APX scripts now record full copies (2 reads per write). Use `AUDIT_TRAIL=off` for a big one-off run.
  - The AppX nightly sync is only on local `feat/vg-nightly-sync` (a0aae70c9). When it lands: import `register`
    first and wrap it in `runJob('vidyagram-nightly')`.
- **16** (2026-10-30): backend 31020c338, merged as 5552cdf7f.
  - `src/scripts/audit-undo.ts`, `--row <id> [--commit] [--force]`. Preview by default.
  - A delete re-inserts the record. An update restores only the changed top-level fields.
  - It refuses: bulk, insert, job and request rows, truncated rows, and rows changed since (unless `--force`).
  - Blanked secrets are skipped with a warning. The undo's own row is `script:audit-undo`.
  - Wrapper `reference/scripts/vidyagram-audit-undo.sh` (ssh to webserver2-2), never run against the box.
- **14** (2026-10-30): backend c092f9f23 plus ae19cf842 (merges 12 and the redaction; count mode); merged as
  1c3f49044.
  - `Model.bulkWrite` is shadowed by an audited static. bulkSave goes through it too. Each call writes at most 3
    bulk rows: updates, deletes, inserts.
  - Task 13's `recordedWrite` now follows the policy, uses the bulk shape and handles count mode.
  - planOrderSync and the two APX backfills are wrapped.
  - Gaps note: `vidyagram/reference/admin-history-known-gaps.md`. The lookup script is fixed to the real row shapes.
- **Integration head after 01–04, 06–08, 10–17, redaction:** backend 1c3f49044, admin d6a6ca58.
  - Full suite: 4 "new" failures, all in `courseBuilderData.integration.test.ts`. The cause was
    `Port "50105" already in use` from in-memory Mongo; the file passes 4/4 alone. So it's infrastructure flake, not
    a regression.
  - Boot smoke test OK: 0 `AUDIT_PLUGIN_LATE`, gate report line with the forwarded IP.
  - Nothing has been pushed.
  - **Remaining:** 17b (not started), then the HITL deploy waves 05, 09 and 18.
  - Before any deploy, merge `origin/vidyagram-admin` (backend cb61a7b42 or later, admin 7d64f3f8 or later) into the
    integration branches.
- **Wave 1 DEPLOYED** 2026-10-30 16:18 IST (see the deploy entry below). Branch `release/vg-audit-wave-1`, worktree
  `~/Projects/worktrees/vg-audit-wave1`, cut from origin d66f2d9bb.
  - Contents: 01–04, cherry-picked (4b441bfd3, 5b2baa501, 24c4e5257, 821e72641, 3f4c0241b), plus:
    - a29cdb1b2: new group `ORDER_ADMIN`; `USER_LIST`, `USER_WRITE` and `ORDER_ADMIN` enforce by default
      (`DEFAULT_MODE` in routeGate.ts).
    - 303d9674e: `inactivePlanClosedToNewBuyers` sends an admin token on assign-plan.
  - Fresh baseline on origin d66f2d9bb: `baseline-backend-wave1.txt` (93).
  - Suite: the only new failures were those two assign-plan tests, now fixed. 20/20 in that file and 55/55 gate
    tests.
  - Boot: with no login, `GET /api/users` → 401.
  - The split was carried onto the integration branch as 415b88eab (62/62 gate tests).
  - When the integration branch merges origin, `inactivePlanClosedToNewBuyers` needs the same admin-token fix,
    using `adminLoginToken`.
- **Wave 1 deploy** (2026-10-30 16:18 IST, on the user's go-ahead).
  - Origin had moved to d7c87f821 (my-plans and tests-screen work). Rebased cleanly: 01–04 + split are now
    0ca9dd179..6302f686e. 112/112 wave-1 tests pass on the rebased source.
  - Dist: `scripts/qt-surgical-dist.sh` wrote 22 files (13 changed, 9 new, 0 foreign); 108/108 pass from `dist/`.
    Committed as 6803eeee2 and pushed `vidyagram-admin` d7c87f821..6803eeee2 (fast-forward).
  - Box: backup `~/vg-dist-backup-20261030-1617-wave1.tar.gz` (+ `.commit` = d7c87f821), env copy
    `.env.development.bak-20261030-1617-pre-audit-wave1`. `git pull --ff-only`, `pm2 restart 92` (restart 247). No env
    lines added.
  - Passwordless allowlist: the default id 6a44b54a3aed5ba9f311e600 is not a user in `vidyagramdb`, so it matches
    nobody there. Env left alone.
  - Checks: with no login, user list/search/edit/delete, order list/stats/filter-options/assign-plan(s)/delete and
    package-order list/delete all give 401 on `backend.vidyagramar.com`. No password or OTP in the out log.
  - Before the deploy, all 45 recent login sessions stored a loopback IP.
  - Not new: `[user-login-session-indexes] IndexKeySpecsConflict` on `session_id_1` (77 earlier occurrences), and
    `GET /api/users/search` → 500 (it hits `GET /users/:id`; search is POST).
  - Rollback: on the box, `git checkout d7c87f821 -- dist` is not enough (new files); use
    `git reset --hard d7c87f821` or untar the backup, then `pm2 restart 92`. One group: `ROUTE_GATE_<GROUP>=report`.
- **Wave 1 admin-panel check** (2026-10-30 ~16:40 IST, user signed in, I drove the Browser pane).
  - Users: list (2,403,205), phone search (1 hit) and the edit page all load; `POST /api/users/search` and
    `GET /api/users/:id` → 200. Not saved: edit save and delete use `authPut`/`authDelete`, the same helpers.
  - Orders: list (1,754,031) and By User (698,085) load; `GET /api/orders` → 200 (~2–5 s). Assign plan(s) and delete
    use `authPost`/`authDelete` (hooks/api/use-orders.ts); not submitted. The admin never calls `/package-order`.
  - Real IP: the gate logged `ip=148.113.47.103`, the caller's public IP. `userloginsessions` holds only 45 rows in
    all, so a fresh session row is not a usable check.
  - **Report lines go to the pm2 ERROR log** (`console.warn`): `~/.pm2/logs/vidyagram-backend-error.log`. In the first
    25 min the only one was my own test call.
- **17b** (2026-10-30): f2ed8c891, merged as e8a9ac761. 55 student-token admin writes gated (report), USER_BULK,
  APX_INGEST_SECRET_GATE; 66 left alone with reasons in the inventory TSV.
- **Waves 2 and 3 DEPLOYED** 2026-10-30 (backend 261bc2355 at 17:32 IST, admin 9f6c90ca via Vercel 17:43, history on
  ~17:45). Prod proof: Hranker rename and rename-back show in the lookup with session, IP and before/after; logout
  ends the session. Full report: `vidyagram/reports/admin-audit-waves-2-3-2026-10-30.md`. Open: 48 h watch, enforce
  decisions for the report-mode groups, apx-ingest worker secret, 17b's owner-check follow-ups.
