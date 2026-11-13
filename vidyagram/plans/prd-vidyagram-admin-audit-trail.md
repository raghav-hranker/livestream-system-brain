# PRD: Vidyagram admin history, admin sessions and route login checks

Status: ready-for-agent, drafted 2026-10-29 from the grilling session of the same day (Q1–Q12, Q17–Q28).
Vidyagram only (backend branch `vidyagram-admin`, admin branch `vidyagram-admin`, database `vidyagramdb`).
Nothing here ships to quicktricks. Facts below were read on `origin/vidyagram-admin` (backend 8da77b5eb, admin d5893f78).

## Problem Statement

When something in Vidyagram changes or disappears (a class drops out of a course, an order loses its plan, a price
moves, a student says their access vanished), nobody can say for certain who did it, when, or what it looked like
before. The backend keeps no history of admin actions. The only trace is the pm2 out log, which holds the first 500
characters of some request bodies, no admin name, and an IP that is always the proxy's own `127.0.0.1`.

The question "was it an admin, a scheduled job, or someone outside?" can't be answered either, because:

- Several write routes need no login at all. Anyone who knows a student's id can change their password, edit or
  delete their account, read the whole student list with phone numbers, or create and assign orders.
- An admin login can't be ended. Admin tokens have no session, logout only clears the browser, and a leaked token
  works until it expires a day later.
- The half-way login token (issued after the password, before the OTP) is accepted as a full admin login, and an
  admin with no mobile number skips the OTP entirely.
- The server log writes the admin password, the OTP and that half-way token in plain text.

The developer, who is also the main admin, wants every action in the system to be traceable to a person, a job or an
address, with enough detail to put things back.

## Solution

Four pieces, shipped in this order:

1. **Groundwork.** The backend records each visitor's real IP, and the server log stops writing passwords, OTPs and
   tokens.
2. **Urgent login checks.** The routes that let anyone take over or delete a student account, read the student list,
   or create and change orders get the same login checks quicktricks got this week. Each check has an
   off / report / enforce switch, so it can be watched before it starts refusing calls.
3. **Admin sessions.** Every admin login becomes a session the server knows about. Logout ends it on the server, the
   developer can end any admin's sessions, and a disabled admin is cut off on the next request. The half-way token
   no longer works as a login, and every admin passes the OTP.
4. **The admin history.** Every admin write, every sensitive read, every write from a no-login caller, job or script,
   and every delete from any source gets a row. A row says who did it (admin, session, IP, browser), what they did,
   which record changed, and holds a copy of that record from before and after. Nobody can edit or delete rows through
   the system. Rows are kept about 13 months. The developer reads the history with a lookup script; an undo script
   that restores a record from its "before" copy follows.

After the history has run for a while, the remaining routes with no login (course folders, taxonomy, AppX builds,
uploads) are locked one group at a time. Each starts in report mode and the history shows who really calls it.

## User Stories

### Tracing what happened

1. As the developer, I want to look up everything that happened to one record (a class, a course, an order, a user),
   so that I can answer "where did this go?" with a name and a time.
2. As the developer, I want to see everything one admin did in a time range, so that I can review their work after a
   complaint.
3. As the developer, I want to list every delete in the last N days, so that I can spot a deletion nobody admits to.
4. As the developer, I want each row to show the admin's name and email as they were at the time, so that the row
   still reads correctly after that admin is renamed or removed.
5. As the developer, I want each row to show which login session, IP and browser did the action, so that "admin X did
   this" is proven, not assumed.
6. As the developer, I want a copy of the record before and after each change, so that I can see exactly what changed.
7. As the developer, I want the request body stored with secrets blanked out, so that I can see what the admin sent
   without the history leaking passwords.
8. As the developer, I want failed and refused attempts recorded too, so that "someone tried to delete this and was
   refused" is visible.
9. As the developer, I want writes from callers with no login recorded with their IP, so that changes through
   still-open routes are not invisible.
10. As the developer, I want writes by scheduled jobs labelled with the job's name, so that I can tell a job's change
    from an admin's.
11. As the developer, I want writes from one-off scripts on prod labelled with the script's name, so that scripted
    fixes show up in the same history.
12. As the developer, I want every delete recorded whatever its source, so that nothing can disappear without a row.
13. As the developer, I want a bulk action (for example assigning a course to 5,000 users) recorded as its filter,
    its count and a sample of 200 before/after copies, so that the history stays readable and small.
14. As the developer, I want a job that changed nothing to leave no row, so that every-minute jobs don't bury the
    history.
15. As the developer, I want a job that did change something to leave one summary row (what it changed and how many),
    so that job changes are visible without thousands of copies.
16. As the developer, I want reads of the student list, a student's profile, exports, order lists, "who bought this
    course" and anything that hands out another account's login recorded (who, what filter, how many rows came back),
    so that I can answer "who pulled our student data?".
17. As the developer, I want writes the automatic copy can't see to call an explicit "record this", so that class
    assignment, course exchange and undo, bulk sale and plan-order sync are covered too.
18. As the developer, I want a list of anything still not covered, so that I never assume the history is complete
    when it isn't.

### Putting things back

19. As the developer, I want an undo script that restores a record from its "before" copy, so that recovering a
    deleted or damaged record takes one command.
20. As the developer, I want undo to show what it would change before it writes, and to write only with `--commit`,
    so that a mistake in the undo can't make things worse.
21. As the developer, I want the undo itself recorded as a `script:` row, so that restores are traceable too.

### Protecting the history

22. As the developer, I want no route that edits or deletes history rows, so that the people it records can't tidy
    it up.
23. As the developer, I want only admin ids on a short list in the server settings to read the history or end other
    admins' sessions, so that loose admin roles don't open it to everyone.
24. As the developer, I want rows to expire on their own after about 13 months, so that the history doesn't grow
    forever.
25. As an admin, I want my work to go through even if the history briefly fails to save, so that a history hiccup
    never blocks my job.
26. As the developer, I want an alert when a history row fails to save, so that gaps don't go unnoticed.
27. As the developer, I want a single switch that turns the history off, so that I can stop it at once if it ever
    causes trouble.

### Admin logins

28. As the developer, I want the half-way token from the password step refused everywhere except the OTP step, so
    that nobody can act as an admin without passing the OTP.
29. As the developer, I want every admin to pass the OTP, controlled by a setting that is on by default, so that a
    password alone is never enough.
30. As an admin with no mobile number, I want a clear "add a mobile number" message instead of a login, so that I know
    what to fix.
31. As the developer, I want each admin login to create a session (admin, IP, browser, time), so that every action
    can point to the exact login.
32. As an admin, I want Logout to end my session on the server, so that a copied token stops working.
33. As the developer, I want to see every active admin session and end any one, or all of one admin's, so that I can
    cut off a leaked login or a departing admin at once.
34. As the developer, I want a disabled admin's sessions to end on their next request, so that disabling an admin
    takes effect immediately.
35. As the developer, I want an admin's sessions to end when their role changes, so that old permissions don't linger.
36. As the developer, I want "several devices at once" and "login length" to be settings, with today's behaviour
    (several devices allowed, 1 day) as defaults, so that I can tighten them later without a code change.
37. As the developer, I want the OTP step to check that the admin is still enabled, so that an admin disabled between
    the password and the OTP doesn't get in.
38. As an admin, I want to be told my session has ended and taken to the login page whenever any screen gets that
    answer, so that I'm never stuck on a broken screen.
39. As an admin, I want to log in again once when this ships, so that every admin login after the release has a
    session.

### Login checks on open routes

40. As a student, I want only myself (or an admin) to be able to change my password, so that nobody can take over my
    account by knowing my id.
41. As a student, I want only an admin to be able to edit or delete my account, so that strangers can't change my
    phone, email or access.
42. As a student, I want my phone number and email hidden from anyone without an admin login, so that the student list
    can't be scraped.
43. As the developer, I want order reads and writes, including assign plan, to need a login (the student's own, or an
    admin's), so that nobody can grant themselves a course.
44. As the developer, I want each new check to have an off / report / enforce switch, so that I can watch who would be
    refused before refusing them.
45. As the developer, I want to know which client calls each route (the app, the website, the admin panel) before it
    is locked, so that locking a route doesn't break the app the way the quicktricks profile lock did.
46. As the developer, I want a route the app uses to accept the student's own login as well as an admin's, so that
    students keep working.
47. As the developer, I want the remaining open routes (course folders, topics, subtopics and sections, AppX course
    builds, uploads) locked one group at a time, each starting in report mode, so that the history decides each lock.

### Groundwork

48. As the developer, I want the real visitor IP in sessions, history rows and logs, so that an IP means something.
49. As the developer, I want passwords, OTPs, half-way tokens and the Authorization header blanked in every server
    log line, so that logs stop leaking credentials.

## Implementation Decisions

### Modules

**Request context (new, deep).** Carries the current actor for the life of one request or one job run, using Node's
async-local storage. The actor is one of `admin` (id, name, email, role, session id), `student` (user id), `no-login`,
`job:<name>` or `script:<name>`, plus IP, browser, request id, method and route pattern. A middleware opens the
context for each HTTP request. Jobs and scripts open it through a `runAs(actor, fn)` call. Everything downstream (the
history recorder, the database hook, the log) reads the actor from here instead of from `req`. The branch already uses
async-local storage once (dashboard facts), so the pattern is not new.

**Client IP (extend).** One function returns the real visitor IP. It respects the proxy chain in front of the backend
(Apache on webserver2-2; check whether Cloudflare also sits in front of `backend.vidyagramar.com` and, if it does,
trust its connecting-IP header only from Cloudflare ranges). Express `trust proxy` is set to match, so `req.ip` is
right everywhere. The existing helper used by playback and downloads becomes this function.

**Redactor (new or reused, deep).** One function blanks secrets in any object: passwords, OTPs, tokens, the half-way
token, Authorization and cookie headers, and keys matching those names at any depth. The request logger, the error
handler and the history recorder all use it. If the `redactCredentials` helper used for traces exists on the branch,
it becomes this module; otherwise it is created. The request logger's no-body list gains the admin login and OTP
routes and change-password as an extra guard.

**Admin session (new, deep).** A new `AdminSession` collection: session id, admin id, IP, browser, created, last
seen, ended at, end reason. The interface:
- `start(admin, ip, browser)` returns a session id.
- `check(sessionId, adminId)` returns active, or ended with a reason (logged out, ended by the developer, admin
  disabled, role changed, expired).
- `end(sessionId, reason)`.
- `endAllFor(adminId, reason)`.

Settings: `ADMIN_SESSION_MULTI_DEVICE` (default on; when off, a new login ends the admin's other sessions) and
`ADMIN_TOKEN_TTL` (default `1d`). Admin tokens gain a `session_id` claim. `check` is one indexed read per admin
request, and there are few admins, so no cache. Ending a session must take effect on the next request.

**`requireAdmin` (modify).**
- Refuses tokens that carry the half-way `purpose` claim.
- Refuses admin tokens with no `session_id`. This forces one re-login on deploy.
- Calls `check` and refuses an ended session with 401 and a machine-readable code: `ADMIN_SESSION_ENDED` (with the
  reason) or `ADMIN_SESSION_REQUIRED`.
- Refuses an admin whose `status` is no longer active, ending their sessions.
- Fills the request context with the admin actor.

**Admin login (modify).**
- `ADMIN_OTP_REQUIRED` (default on): an admin with no mobile gets 403 `ADMIN_MOBILE_REQUIRED` instead of a token.
  Before release, list Vidyagram admins with no mobile so numbers can be added.
- The OTP step re-checks `status`.
- A full login starts a session.
- A new `POST /api/admins/logout` ends the caller's session.
- Changing an admin's role or status ends their sessions.

**Admin session controls (new routes).** List active sessions, end one session, end all of one admin's sessions.
Only admin ids in `AUDIT_ADMIN_IDS` can call them.

**History recorder (new, deep).** The single entry point for history rows: `recordRequest(...)`,
`recordChange(...)`, `recordJobSummary(...)`. Saving never runs on the request's own path: the action goes through
first, and a failed save writes an `AUDIT_WRITE_FAILED` log line with the row's key fields, so the line itself still
holds who and what. `AUDIT_TRAIL=on|off` (default on) turns the recorder off entirely. The recorder applies the
redactor, the size caps and the bulk sample cap, and stamps the actor from the request context.

**Database hook (new, part of the recorder).** One global Mongoose plugin registered before the models compile.
- It covers query middleware for `findOneAndUpdate`, `findOneAndDelete`, `updateOne`, `updateMany`, `deleteOne`,
  `deleteMany` and `replaceOne`, document middleware for `save` and `deleteOne`, and model middleware for
  `insertMany`. Whether Mongoose 8.15 also fires middleware for `bulkWrite` is checked first; if it doesn't, bulkWrite
  call sites are covered like the other bypass sites.
- When the actor is recorded (see the audit policy), the "pre" side reads the matching records (up to the sample cap
  for multi-record operations, plus the total count) and the "post" side reads them again, then calls `recordChange`.
- When the actor is a student acting on their own data, the hook does nothing.
- The extra reads only happen for recorded actors, so student traffic pays nothing.

**Explicit records at bypass sites (modify about 15 call sites).** Writes that go straight to the driver (`Model.collection.*`)
or otherwise skip the hook call the recorder themselves, with before/after copies. Known sites on 2026-10-29:
- class-in-course assignment, groups, duplicate and rename
- course exchange and its admin undo
- bulk sale price changes
- plan-order sync
- the APX backfills
- model `bulkWrite` (43 calls) and `insertMany` (14 calls) in catalogue code, if the hook can't see them (course copy,
  topic ordering, plans, course PDFs, class insert)

The PRD's task for this produces the final list. Anything left uncovered goes in a "known gaps" section of the
Vidyagram reference note for this feature.

**Audit policy (new, data-driven).** One table that decides what gets recorded:
- **Collections:** which ones the hook records. Catalogue and commerce: courses, classes, course-class links, course
  topics and placements, PDFs and course PDFs, plans, orders, users, coupons, banners, course folders, taxonomy,
  extension settings, feedback moderation, certificates, admins.
- **Sensitive reads:** which routes count:
  - user list and search, a user's profile
  - every export or CSV route
  - order lists and order reads
  - "who bought this course"
  - the admin feedback lists
  - the passwordless-login path
- **Actors:** which are recorded. Admin, no-login, job and script always. Student only for deletes, or when the
  student writes to a record that isn't their own.

**Job runner (new, thin).** Each cron is started through `runJob(name, fn)`. It opens a `job:<name>` context and
counts changed records through the hook, which saves no per-record copies for jobs. The runner writes one summary
row only if something changed. Deletes inside a job are still recorded per record. One-off scripts open a
`script:<name>` context the same way. The AppX nightly sync runs as a systemd timer on test-uday from a script that is
not on `origin/vidyagram-admin` yet; it is a listed gap until its code lands on the branch.

**Route login gate (new, deep).** One middleware factory for the open routes: `gate({ group, mode, allow })`.
- `mode` comes from a per-group setting: `off`, `report` (log the would-be refusal with caller IP, browser and
  referer, then let it through) or `enforce`.
- `allow` is `admin`, or `self-or-admin` (the student whose id is in the route or body, or any admin).

Groups for the urgent piece:
- change-password (`self-or-admin`)
- user edit and delete (`admin`, plus `self-or-admin` on fields a student may change, if the app uses it)
- user list and search (`admin`)
- order reads (`self-or-admin`; lists `admin`)
- order writes and assign plan (`self-or-admin` for a student's own purchase, `admin` for assign)

The quicktricks fixes for these routes are the source. Copy their logic, not their `dist` commits. Before each group
is set to `enforce`, read who calls it on Vidyagram: the app, the website, the admin panel. The gate overlaps the
unpushed student auth gate (`feat/vg-student-auth-gate`); whichever lands second must not double-gate a route.

**History collection.** `auditlogs` in `vidyagramdb`. One `request` row per recorded HTTP call or job run, and one
`change` row per changed record, linked by request id.

Fields:
- `at`
- `kind` (request, change, job-summary)
- `actor` (type, admin id, name, email, role, user id, job or script name)
- `sessionId`, `ip`, `userAgent`, `requestId`
- `method`, `route` (the pattern, not the raw URL), `path`, `statusCode`, `outcome` (succeeded, failed, refused),
  `durationMs`
- `body` (redacted, capped at 16 KB)
- `read` (filter and row count, for sensitive reads)
- `target` (collection and id)
- `op` (insert, update, delete, replace)
- `before` and `after` (each capped at 256 KB, with a `truncated` flag)
- `bulk` (filter, total count, sampled count)

Indexes, built by hand on prod because autoIndex never builds there:
- `{ 'target.collection': 1, 'target.id': 1, at: -1 }`
- `{ 'actor.adminId': 1, at: -1 }`
- `{ requestId: 1 }`
- `{ kind: 1, op: 1, at: -1 }` for "every delete"
- a TTL index on `at` with roughly 400 days of expiry

No route writes, edits or deletes rows. Reads are only through the scripts for now.

**Lookup script (new).** `vidyagram-audit-lookup` in system-brain `reference/scripts/`. It is read-only and answers by
record (`--collection --id`), by admin (`--admin --from --to`), by kind (`--deletes --days`) and by request id. It
prints a readable timeline and the field-level difference between "before" and "after".

**Undo script (new, follows the lookup).** `vidyagram-audit-undo --row <id>` restores a record from a change row's
"before" copy: re-inserts a deleted record or reverts the fields an update changed. It shows the plan first and
writes only with `--commit`. It refuses when the record has changed again since that row, unless told otherwise. It
runs as `script:audit-undo` so the restore is itself recorded.

**Admin panel (modify).**
- One shared response handler on every API call: a 401 with `ADMIN_SESSION_ENDED` or `ADMIN_SESSION_REQUIRED` clears
  the stored token and goes to the login page with a message.
- A 403 with `ADMIN_MOBILE_REQUIRED` on login shows "add a mobile number".
- Logout calls the new logout route before clearing the browser.

**Alert on history failures.** An ops-console check counts `AUDIT_WRITE_FAILED` lines in the Vidyagram pm2 log and
posts to Telegram when it sees any.

### Release order

1. Groundwork: client IP and the redactor.
2. Urgent login checks, in report mode, then enforced group by group once callers are known.
3. Admin login hardening and sessions, deployed together with the admin panel change. Admins are warned of the
   one-time re-login.
4. Request context, history recorder, database hook, audit policy, request rows and sensitive reads. History indexes
   built by hand before this deploy.
5. Bypass sites and the job runner.
6. Lookup script, session controls, the failure alert.
7. Undo script.
8. Remaining open route groups, one at a time, report then enforce.

## Testing Decisions

- A good test drives the real router or the real model through its public surface and checks what a caller or the
  developer would see: the status code and error code, the rows in `auditlogs`, the record's state. It does not check
  which internal function was called.
- Tests use `node:test` with in-memory Mongo, like the existing integration tests. Prior art: the order-adjust admin
  gate integration test (a real router mounted on an Express app over in-memory Mongo), the class-access and
  practice-batch authz tests, and the realtime-token auth test.
- Recommended coverage:
  - **Admin session + `requireAdmin`** (integration): the half-way token is refused; a token without a session is
    refused; logout ends the session; a disabled admin is refused and their sessions end; a role change ends
    sessions; the multi-device setting off ends older sessions; the OTP-required setting and the no-mobile answer.
  - **History recorder + database hook** (integration):
    - an admin update stores before and after
    - an admin delete stores before
    - a bulk update stores filter, count and a 200-copy sample
    - a student editing their own data stores nothing
    - a no-login write stores the IP
    - a job that changes nothing stores nothing; one that changes something stores one summary
    - a failed save doesn't fail the request and logs `AUDIT_WRITE_FAILED`
    - `AUDIT_TRAIL=off` stores nothing
    - secrets in the body are blanked
  - **Bypass sites:** one test per explicit-record site, checking a change row appears.
  - **Route login gate** (integration): off, report and enforce for both `admin` and `self-or-admin`, using the
    quicktricks change-password tests as the starting point.
  - **Redactor and client IP** (unit): nested secrets, header names in any case, the proxy chain and spoofed
    forwarding headers.
  - **Lookup and undo scripts:** run against in-memory Mongo seeded with history rows. Undo previews without
    `--commit`, restores with it, and refuses when the record has changed since.
- Admin panel: check the session-ended and no-mobile paths by hand on the Vercel preview, unless the admin repo has
  a test setup for its API client.

## Out of Scope

- Detecting misuse of student accounts (sharing, scraping, credential stuffing). That is the parked piece "B", with
  open questions on data source, signals, where it runs and a device id from the app.
- A history screen in the admin panel. It's a later piece, visible only to `AUDIT_ADMIN_IDS`.
- Quicktricks. The same holes exist in shared code and are tracked in the quicktricks authz ledger. Nothing here
  merges into or deploys to `quicktricks-admin`.
- Recording a student's changes to their own data (profile, their own purchases, progress, ratings).
- History for the AppX nightly sync until its script is on `origin/vidyagram-admin`.
- Changes to the Vidyagram student app, except where a login check needs the app to send its token (found during the
  caller check, raised to the user then).

## Further Notes

- The local worktrees are behind origin: backend by 132 commits, admin by 43 (as of 2026-10-29). Start every task
  from a fresh `origin/vidyagram-admin`.
- The auth-gate route inventory (`vidyagram/plans/auth-gate-route-inventory.tsv`) was built at ab7d7b4e0 and is
  stale. For example, course writes are now `requireAdmin`. Use it only as a hint.
- The passwordless-login allowlist has a code default of one built-in user id, and an unauthenticated
  `GET /users/:id` for that id mints a real student token. Check whether that id exists in `vidyagramdb`. If it
  doesn't, drop the default for Vidyagram.
- The open order reads return `Order.exchange`, so exchange history is exposed until the order-read group is enforced.
- `Order.assignedByAdmin` is only a boolean and `assignPlanToUser` stores no admin. After this PRD, the history row is
  the record of who assigned.
- Whether node-cron runs inside pm2 92 depends on `NODE_ENV=production` and `DISABLE_CRONS` in its environment, which
  hasn't been checked. Check this before testing the job runner on prod.
- Quicktricks lesson: the profile lock there was rolled back within 16 minutes because the app called the route
  without a token about 37% of the time. That's why every gate starts in report mode and the callers are read first.
