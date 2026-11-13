# Admin-ops agent brainstorm (2026-10-10)

Read-only investigation. Four explorers mapped the admin app (qta @ 27b2d7e), the backend (qtb @ f1d6095f2), the ops history in this repo and memory, and the runtime options. Three designers proposed shapes, a judge synthesized, and a fact-checker tried to refute the load-bearing claims. Nothing was built.

## Today

Admin ops run on two tracks today. Client-team operators work in the quicktricks-admin Next.js app on Vercel. It calls the prod LMS REST API straight from the browser with a localStorage admin JWT. The app has no server-side auth (no `middleware.ts`) and hard-codes the prod backend (qta `config.ts:15-16`), so every preview branch also reads and writes prod. Raghav handles everything the screens cannot do: entitlement and missing-content diagnosis, notification forensics, bulk catalogue edits, Mongo health and incidents. He does this with ad-hoc node scripts against prod Mongo from the Mac or the box (`reference/scripts/*`, dry-run then `--commit` then `--restore`) and logs each bulk write by hand in memory `prod-data-changes.md` (8 dated sections, 09-21 to 10-08). Some grants and 523 voids went through unauthenticated REST routes instead (memory `test-account-cleared`).

Server-side control is thin, and that decides the agent's shape. The global `authenticateToken` is commented out (qtb `src/app.ts:488`). `requireAdmin` checks only the `admin_id` claim (`authMiddleware.ts:93-104`), so the password-only OTP `preAuthToken` passes every admin route. The order grant routes have no auth at all (`orderRoutes.ts:72-80,94-96`). There is no admin audit log, and the request logger writes the first 500 characters of every body to the pm2 log, login passwords included (`app.ts:239-259`). The retro puts the real cost in re-finding recipes, checkouts and environments (`docs/retro-2026-10-06.md` §1, §2, §4), plus classifier denials in 8 of 12 sessions. The runbook it proposed (`reference/quicktricks-prod-ops.md`) was never written.

## Operations inventory

| Domain | Key operations | Class | How done today | Server auth guard (qtb @ f1d6095f2) |
|---|---|---|---|---|
| Courses, classes, placements | list/filter, CRUD, assign/move/copy-to placements, reorder, taxonomy, duplicate | R / W / BULK / DESTRUCTIVE (hidden in UI) | Admin screens (`courses`, `courses/v2`, `classes`); bulk end-date fix by script | Course/class CRUD and `/api/admin/courses/*` are `requireAdmin`. `course-classes`, `course-tests` and `course-folders` writes are open (`courseClassRoutes.ts`) |
| PDFs | CRUD, upload sessions, attach to class/course, `isDownloadable` | R / W / BULK | Admin screens; the 10-06 `isDownloadable` backfill by script | `requireAdmin` on CRUD and upload sessions; `pdfUploadRoutes` upload/delete open |
| Orders, entitlements | view, assign-plan(s), extend validity, exchange, status change (void), soft delete | R / W (grants access) / DESTRUCTIVE | `OrderAdjustDialogs` (plain Dialog, no confirm); voids by REST script | `GET /`, `POST /`, assign-plan, assign-plans, `GET/PUT /:id`: none. Exchange, extend, delete: any token (`orderRoutes.ts:72-97`) |
| Users | list/search (PII), export, edit, soft delete, register | R (bulk PII) / W / DESTRUCTIVE | `users` screen; account-delete reversal by hand | `GET /`, `POST /search`, `PUT /:id`, `DELETE /:id`: none (`userRoutes.ts:410,462,626-627`) |
| Coins | add/deduct | W | Coins dialog in `users` | `POST /api/user-coins`: none (`userCoinsRoutes.ts:8`) |
| Notifications | send/schedule, resend, stop/resume, delete, audience estimate | BULK-WRITE, irreversible push | `notifications`, `advance-notifications` screens; stuck-row cleanup by hand `updateOne` | Any token, mount-level only (`app.ts:588-590`) |
| Q-Hub, support chat, chat bans | broadcast, pin, delete (tombstone), reply, ban/unban | W / DESTRUCTIVE | `messages`, `support-chat`, `banned-users` screens; `qhub_repair.js` | v1 channel routes not traced; `banned-users` has `requireScreenPermission` |
| Plans, coupons, bulk sales | CRUD, price, scheduled sale with snapshot revert | W / scheduled BULK | Screens; plan duration and course price by script | `requireAdmin` |
| Dashboard, GST, reports | revenue tiles, records, GST export, hourly trend | R (revenue, PII) | `dashboard`, `gst` screens; `dashboard_hourly.js` | Dashboard analytics: any token (`app.ts:614`). GST: `requireScreenPermission('gst')` |
| Taxonomy | sections/topics/tags CRUD, dedupe audits | W / DESTRUCTIVE | Screens; read-only audit CSV/XLSX (`sections-reconciliation`) | Mostly none |
| Tests, practice batches | questions import, series, packages, practice-batch assign | W / BULK | Screens | Mixed; practice-batch writes any token |
| Admin management | admin CRUD, screen permissions | W / DESTRUCTIVE | `admins` screen; one-off grant scripts | `requireAdmin` only; non-`admin` roles can change another admin's `Psw` (`adminController.ts` `updateAdmin`) |
| APX | sessions, migrate, catch-up | W / BULK | Crons plus fleet scripts | Open; `GET /api/apx-sessions` returns session cookies |
| Diagnosis (Raghav) | entitlement, content, notification, Mongo health | R | Mac or box node scripts, `mongosh`, pm2 log `tail` | Direct Mongo with full-write `MONGO_URI`; no read-only user exists |
| Engineering ops | deploy, env flags, index builds, `killOp`, pm2 restart | W | Surgical dist deploy, ssh, `!` lines after classifier denials | ssh key; classifier is the only gate |

## Recurring ops jobs

| # | Job | Frequency (from dated memory, estimated) | Pain | Risk if an agent does it | Agent fit |
|---|---|---|---|---|---|
| A | Why can't student X see course/PDF Y (is_buy, special price, practice batch) | 5+ incidents 09-18 to 09-26 | High. Mixed-type `Plans.course`, upgrade/extension precedence, a separate practice-batch axis. `why_unpaid.js` is already wrong: ObjectId-only plan query (`why_unpaid.js:20`) | Low as a read. A wrong verdict leads to a wrong grant | Best first slice |
| B | Missing class/PDF/video triage | Near-daily 09-25 to 10-06 | Highest. Placement state, asset keys, APX session expiry, deleted-in-AppX items | Read low. Attach/placement writes medium | Read side in slice 2; fixes stay scripted |
| D | Notification stuck/never fired/wrong audience | 3-4 incidents 09-28 to 10-01 | Medium-high. The second-sender fingerprint recipe lives only in a handoff | Read low. Sending is irreversible | Read side in slice 2; no sends ever |
| C | Bulk field edits (duration, validity, priority, price, isDownloadable, endDate, playbackCdn) | 8 ledger sections in 18 days | Medium. Each script re-implements backup/filter/read-back unevenly (`plan_extension_backdate.js` has no dry-run) | High: bulk prod write | Gated slice 3 (changeset engine) |
| G | Mongo health: indexes on PRIMARY, stuck builds, currentOp | Several incidents incl. the 10-01 outage | Medium. Recovering the scripts once took 14 calls | Read low. Builds and `killOp` dangerous | Read tool in slice 2 |
| F | Revenue/usage/impact reports | Weekly-ish | Low. Scripts exist | Low | Does not earn a tool; keep scripts |
| H | Taxonomy/content audits | 4 sessions 10-05 to 10-09 | Medium | Merges very high (20,997 changes) | Out of scope |
| E | Grant/void entitlements | Bursty (09-19 to 09-25) | Medium | Highest: never-remove rule, Razorpay sync resurrects voids | Human-only |
| I | Login/account complaints | Occasional | Low-medium | Low read, small write | Later, via `find_user` |
| J/K | Q-Hub repair, pm2 log forensics | Rare | High | Logs hold JWTs and passwords; Q-Hub writes broadcast | Out of scope |

## Options

| | D1 In-dashboard Copilot | D2 qtops Mac agent + changeset engine | D3 Read-only diagnostician | Recommended hybrid |
|---|---|---|---|---|
| Who it serves | Client-team operators in admin.quicktricksbysahilsir.com | Raghav only | Raghav only | Raghav only; an operator screen later if the verdict function proves out |
| Value | Potentially widest, unproven. No evidence yet of which operator requests dominate. Answers A and B at the screen | High. Covers A, B, D, G and turns C into one audited primitive | Medium. Covers A, B, D. May be beaten by a written runbook alone | High. D3's reads first, D2's engine only after measured value |
| Safety | Weak today. Its writes go through routes that are open or any-token (`orderRoutes.ts:77,80,86`). PII goes to Gemini on a free gateway tier. Every preview hits prod | Medium. The read server holds a full-write credential behind a driver patch until a read-only user exists. The write server is real write power, but gated by code invariants plus a prompt | Strongest. Read-only Mongo user, plus driver guard, plus no Bash for the subagent. No HTTP, no writes | Strong for reads. Writes gated on a read-only user for reads, a field allowlist, `reducesAccess`, filter-on-old-value and a ledger |
| Prerequisites | Heavy, on the client fork: authz on order/user routes after a caller audit, the `purpose` check, actor attribution, the new course-access endpoint, gateway credits, CORS origin | Origin fix, read-only Mongo user (recommended, not blocking), settings credentials cleanup | Read-only Mongo user, runbook + scripts README, settings cleanup (~1 day) | Runbook + README, settings cleanup, read-only Mongo user before reads auto-run |
| Effort | ~2 weeks plus fork-churn coordination | ~1 week | 2-3 days slice 1, +2 days reads | 0.5 day step 0, 2 days slice 1, 2 days slice 2, 2-3 days slice 3 if earned |
| Where it runs | Vercel route in qta + panel in `LayoutShell`, plus a backend branch | Mac: Claude Code subagent + 2 stdio MCP servers in system-brain | Mac: subagent + 1 stdio MCP server in system-brain | Mac: system-brain branch `agent/qt-ops`; no client fork touched in slices 0-2 |
| Score (value / safety / prereq burden / effort, 5 = best) | 3 / 2 / 1 / 2 | 4 / 3 / 4 / 4 | 3 / 5 / 4 / 5 | 4 / 4.5 / 4 / 4 |

## Recommendation

Recommend a hybrid: D3's read-only diagnostician as the base, using D2's tool design (verdicts from deployed `dist` code, the same import pattern as `dashboard_hourly.js`). D2's changeset engine comes later as a gated third slice. D1 is deferred. It lives on a new branch `agent/qt-ops` in system-brain, Raghav's own repo, so neither client fork is touched and nothing is deployed.

Why this shape:
1. The toil is Raghav's, not the operators'. Every recorded diagnosis and bulk write ran through Raghav's scripts. Operator demand for a chat panel is a guess.
2. The platform cannot hold a REST-acting agent to account. `requireAdmin` is claim-only, the OTP `preAuthToken` passes it (no `purpose` check anywhere in `authMiddleware.ts`), grant routes are open, and there is no audit log. Any HTTP tool is a write tool in disguise.
3. The reusable rule is clean to load out of process. `courseAccessState.service` and `classAccessAuthz` pull in 21 files (models, config, offer services), with no Redis, socket, FCM, cron or Razorpay imports. Compiled copies ship in `dist/src/services/`. `addIsPaidToCourses` delegates to the same function (`courseUtils.ts:18-23`). The current hand-copy (`why_unpaid.js:20`) has the exact Mixed-id bug memory `plan-entitlement-id-cast` recorded.

Sequencing:
- **Step 0 (half a day, no agent).** Write `reference/quicktricks-prod-ops.md` and `reference/scripts/README.md` (retro §4, §6). Remove the embedded Bearer JWT and key pair from `.claude/settings.local.json` and rotate them. That file has 108 allow rules and 0 deny rules, including `ssh *`, `curl *`, `node *` and `git push *`. The runbook is both the subagent's prompt source and the no-agent baseline it must beat.
- **Slice 1 (about 2 days).**
  - Pieces: `.claude/agents/qt-ops.md` with `tools: mcp__qt-ops__*, Read, Grep, Glob` (no Bash, Write, Edit or WebFetch). `tools/qt-ops-mcp/server.mjs` preloads `readonly-guard.cjs`, never requires `dist/src/app.js`, and sets `DISABLE_CRONS=true`. It imports dist from a pinned origin-tip worktree and refuses to run off tip. A single redactor sits at the tool boundary, and every call appends an audit JSONL line.
  - Tools: `find_user` and `explain_access` only.
  - Verify: a write canary must fail. 30 (user, course) pairs must match `addIsPaidToCourses` in parity. Four closed incidents must be replayed (voided upgrade source order, Mixed-id plan, ungranted Apple IAP, practice-batch axis). A grep must find no phone numbers, emails or `eyJ` in transcripts.
  - Then measure tool calls and minutes on the next 3 real complaints against the runbook alone. If it does not clearly win, stop there.
- **Slice 2 (about 2 days).** Add `explain_content`, `explain_notification` (including `list_orphan_sending`) and `mongo_health` (on primary). All read-only.
- **Slice 3, only if slices 1-2 earn it and a read-only user serves the reads.**
  - Add D2's changeset engine as a separate write-server process with `ask` permission. It uses one primitive, `{collection, rows:[{_id, before, after}]}`, written with the filter `{_id, ...before}`.
  - Guarantees: a pure, tested `reducesAccess` refusal; a registered field allowlist from the 8 ledger kinds; read-back on primary; restore as the inverse changeset; `ops/ledger.jsonl` appended by the engine.
  - The engine must write through the raw driver, not Mongoose models. `CourseClass` registers notification-scheduling hooks on `save`, `findOneAndUpdate` and `insertMany` (`courseClassNotificationMiddleware.ts:13-345`, `CourseClass.ts:254`). Each registered kind must say which model hooks it bypasses.
  - This path does not depend on the REST authz fixes. It uses the same credential the scripts use today, with more invariants. Start with `pdfs.isDownloadable` and `courseclasses.endDate`.

What does not earn its place:
- The in-dashboard copilot (D1), until operators are confirmed as the users and the backend gates the order and user routes. What D1 gets right is worth grafting later as a plain admin "Access explainer" screen over the same verdict function, not a chat panel.
- D2's generic `find` escape hatch and `run_report` wrapper. Reports already exist as scripts.
- Any HTTP or admin-JWT tool, any notification send, any order grant or void, pm2 log reading, a Slack or WhatsApp bot, an Agent SDK app, and any LLM code in the backend.

Contradictions resolved by reading the code:
- The ledger has 8 sections, not 10.
- `extend-validity` is at `orderRoutes.ts:86` and uses `authenticateToken` only.
- The `NODE_ENV=testing` versus cron-gate disagreement does not matter for this design. `DISABLE_CRONS` returns before the `NODE_ENV` check (`app.ts:667-671`), and the server never boots `app.js`.

Separate from the agent: the `preAuthToken` OTP bypass and the logger writing login passwords to the pm2 log are live security holes on the client fork. They should be raised with the client team now.

## Guardrails

- The subagent has no Bash, Write, Edit or WebFetch. Its only reach into prod is `mcp__qt-ops__*`. This keeps it away from the 108-allow / 0-deny `settings.local.json` and the full-write `MONGO_URI` in `../quicktricks-backend/.env.development`.
- Three independent read-only layers: a Mongo user with `read` + `clusterMonitor`, the `readonly-guard.cjs` driver patch, and the tool allowlist. A startup canary must see a write fail, or the server refuses to start.
- The server never requires `dist/src/app.js` and sets `DISABLE_CRONS=true`. It starts no crons, Redis, sockets or FCM, so it cannot repeat the duplicate-push incident (memory `local-backend-disable-crons`).
- No HTTP to prod, no admin JWT, no use of `JWT_SECRET`, no OTP-less admin as a service account.
- Verdicts come from deployed dist functions at a stated commit, never from the model reading raw orders. Every answer cites record ids and the commit. The server refuses to run off origin tip.
- One redactor on every tool output: phone, mobile, email, password, otp, token, fcmToken, session_id and the JWT pattern. Tools return ids, not contact details. No pm2 log access.
- Bounded load: indexed lookups only, limit ≤ 50, `maxTimeMS` 5000, `secondaryPreferred` labelled; primary only for index and health checks.
- All tool output is untrusted data (student names, notification text, chat). Because v1 cannot write or send, an injection can at worst produce a wrong diagnosis.
- Fix proposals are text: an existing `reference/scripts/*` command in dry-run form. The agent never adds `--commit`.
- Permanently human-only: notification send, resend, stop or delete; order grant, void or status change; coins; user edits or deletes; index builds; `killOp`; env flags; pm2; deploys.
- Slice 3 writes only: registered (collection, field) pairs; a write filter on the old values; a `reducesAccess` refusal with no override; raw driver writes, not Mongoose model hooks; backup = the committed changeset file; read-back on primary; an engine-appended ledger line with the restore call; `ask` permission plus `confirm = <id>:<rowCount>`.
- Commits on the branch use `raghavsharma@hranker.com` with no co-author trailers (memory `git-identity-work-email`, `no-coauthor-trailers`).

## Fact-check

- **confirmed.** The global authenticateToken middleware is commented out, so every route's auth is per route or per mount.
  - Evidence. qtb src/app.ts:488 `// app.use(authenticateToken);` (same in dist/src/app.js:440). The only other global middlewares (app.ts:219-259, 470-487) are timeouts, compression, CORS and loggers. Auth is applied per mount (app.ts:588-590, 614) or per route. No router in src/routes calls router.use(authenticateToken): searchRoutes.ts:17 has it commented out, and learnLibrary, grammar and editorialJournal routes use only optionalAuthenticateToken. None of the routers mounted at '/api' (courseClass, coursePdf, courseTest, legacyApi) adds auth that would cascade.
- **confirmed.** GET/POST /api/orders, POST assign-plan, POST assign-plans and GET/PUT /api/orders/:id have no auth middleware; exchange, extend-validity and delete need only authenticateToken.
  - Evidence. qtb src/routes/orderRoutes.ts:72-74, 77, 80, 94-96 have no middleware; :83, :86 and :97 have authenticateToken only. The handlers (orderController.ts:1249, 1313, 1619, 1721, 1754, 1798, 1859, 1931, 2060) never read req.user or admin_id. deleteOrder checks only customer_id === CUSTOMER_ID. The only req.user check in the file is downloadOrderInvoice at :2039. No other route file defines '/orders' paths that would take precedence.
  - Correction. Understated: /stats, /filter-options, /history, /my-orders, POST /user, /course/:courseId and /by-razorpay/:id (orderRoutes.ts:48-67) are also unauthenticated. Any user token, not only an admin's, passes exchange, extend-validity and delete.
- **confirmed.** requireAdmin is claim-only (admin_id present), and authenticateToken never checks `purpose`, so the password-only preAuthToken {admin_id, purpose:'admin_login_otp'} passes every requireAdmin route.
  - Evidence. authMiddleware.ts:93-104 gates only on user.admin_id. authenticateToken (:24-82) calls UserAuthService.verifyToken, which is a bare jwt.verify against JWT_SECRET (userAuthService.ts:46-48). In all of src, `.purpose` is read only at adminController.ts:185 (and userController.ts:674 for user login_otp). The preAuthToken (adminController.ts:104-106) carries no session_id, so the session check is skipped. Its expiry is JWT_EXPIRES_IN (default '1d', userAuthService.ts:10).
  - Correction. Two caveats. requireScreenPermission (screenPermissionMiddleware.ts:77) also keys on req.user.admin_id, so the preAuthToken passes screen-gated routes too, within that admin's own permissions. Admins with no mobile on record get a full token from the password alone (adminController.ts:133-150).
- **confirmed.** The request logger writes the first 500 characters of every POST/PUT/PATCH body unredacted to stdout (the pm2 out log), including admin login bodies.
  - Evidence. qtb src/app.ts:240-259 does JSON.stringify(req.body).slice(0,500) and console.log on res 'finish', with no redaction. The only skips are /uploads, /_next and /api/whatsapp/webhook. The same code is in dist/src/app.js:277-278, and ecosystem.config.js runs dist/src/app.js under pm2. /api/admins is mounted after express.json (app.ts:565), so the {email,password} body is parsed and logged. No console.log override exists; redactCredentials is used only in sockets/socketDiagnostics.ts.
  - Correction. Worse than stated: POST /api/admins/verify-login-otp bodies carry the preAuthToken plus the OTP, so the log also captures tokens that pass requireAdmin (see claim 3). app.ts:477-482 also logs every req.url, query string included.
- **confirmed.** The hand-written entitlement probe queries plans only by ObjectId course and prints phone, mobile and email, so it misses string-stored plan bundles and leaks PII.
  - Evidence. system-brain reference/scripts/why_unpaid.js:20 queries plans with `{ course: new Types.ObjectId(C) }` only. :13 projects name, phone, mobile, email and user_id. Memory plan-entitlement-id-cast.md says Plans.course is Mixed, has some string entries, and is flipped to strings on every admin save.
  - Correction. Also: :19 prints the last 5 orders of any user on the course, with razorpay/payment ids. :23 filters active orders by `userId: U` (string form only). Its comment calling that 'the exact entitlement filter addIsPaidToCourses uses' is stale, since that now goes through resolveCourseAccessStates. The script is untracked in git.
- **partly.** addIsPaidToCourses delegates to resolveCourseAccessStates. The access services' transitive imports (21 files) contain no Redis, socket, FCM, cron or Razorpay packages, and compiled copies exist in dist.
  - Evidence. courseUtils.ts:2 and :23 delegate as claimed. A static import walk from courseAccessState.service.ts plus classAccessAuthz.ts gives exactly 21 files, with only mongoose as an external package. dist/src/services/courseAccessState.service.js, classAccessAuthz.js and dist/src/utils/courseUtils.js all exist. But CourseClass.ts is in that set and statically loads courseClassNotificationMiddleware.ts, whose hooks run `await import('../cron/classNotificationScheduler')`.
  - Correction. Counting dynamic imports, the closure is 44 files. It includes node-schedule (the cron scheduler), firebase-admin (FCM, via Notificationcontroller then config/firebase-admin) and S3 config. They load lazily, only when a hooked CourseClass write fires. Pure reads stay clean; any write through these models does not.
- **partly.** CourseClass registers Mongoose hooks on save, findOneAndUpdate, findOneAndDelete, deleteMany and insertMany that import the class notification scheduler, so a model-level write from an agent process can schedule notifications.
  - Evidence. The hooks are registered at the cited lines (courseClassNotificationMiddleware.ts:13 post-save, :55/:150 pre/post findOneAndUpdate, :278 findOneAndDelete, :314 deleteMany, :345 post insertMany; wired at CourseClass.ts:254). Neither file gates on DISABLE_CRONS or NODE_ENV. However, the post('save') branch requires `this.isNew`, and Mongoose 8.24.3 (the lockfile version) sets isNew to false right after dispatching insertOne, before post hooks run (node_modules/mongoose/lib/model.js:384).
  - Correction. Only findOneAndUpdate (post hook) and insertMany actually schedule. The save/create path is effectively dead. findOneAndDelete and deleteMany only cancel. updateOne, updateMany and bulkWrite are not hooked at all. Scheduled jobs are in-process node-schedule timers: they fire a push from the agent process only if it is still alive at T-10 min.
- **confirmed.** A driver-level read-only guard already exists that rejects collection writes, index builds and $out/$merge aggregations.
  - Evidence. reference/scripts/automatic-plan-extension-local/readonly-guard.cjs works as follows. :23-34 patch mongodb Collection.prototype write, index and bulk ops. :37-45 block $out/$merge in aggregate. :47-49 block Db create/drop. :52-64 add an allow-list on Db.prototype.command. :13-14 turn off autoIndex and autoCreate.
  - Correction. Caveats: it is an untracked preload, wired only by run-prod-readonly.sh:37 and resolved from the cwd's mongoose. It does not patch MongoClient.prototype.bulkWrite (driver 6.20.0 mongo_client.js:173) or Admin.prototype.command (admin.js:60), and both bypass the patched methods.
- **partly.** DISABLE_CRONS=true returns before the NODE_ENV==='production' cron gate, so a second process on the prod DB starts no crons regardless of NODE_ENV.
  - Evidence. qtb src/app.ts:667-671 return before the :671 production gate, which holds every startup cron, the dashboard prewarm and the daily-facts cron (dist/src/app.js:604 matches). But warmSegmentEstimateCache (:663) runs before the return. Module-level startup still calls Pdf, ChannelMute, Subscription and PdfImpression createIndexes against the DB (app.ts:275-295+) and connects RabbitMQ (:265).
  - Correction. No startup crons start, but the process is not inert. It builds indexes and warms a cache at boot. Any CourseClass findOneAndUpdate or insertMany it serves schedules node-schedule notification jobs in that process (see claim 7).
- **partly.** The brain's local settings have 108 allow rules and 0 deny rules, including ssh/scp/curl/node/git push wildcards and one embedded Bearer JWT. No .mcp.json, runbook or scripts README exists.
  - Evidence. system-brain .claude/settings.local.json has 108 allow rules, 0 deny and 0 ask. It includes Bash(ssh *), Bash(scp *), Bash(curl *), Bash(node *) and Bash(git push *), and exactly one rule holds a Bearer JWT (a curl to localhost:5100 .../playback). There is no .claude/settings.json, and ~/.claude/settings.json has 0 allow and 0 deny. .mcp.json, reference/quicktricks-prod-ops.md and reference/scripts/README.md are all absent.
  - Correction. A runbook does exist: docs/plans/launch-runbook-quicktricks-v2.md (407 lines, launch-specific, not general prod ops). settings.local.json is gitignored globally (~/.config/git/ignore:1), so the JWT is not committed.
- **partly.** The admin app has no server-side auth, hard-codes the prod backend, and hides every destructive row action for all roles by product decision.
  - Evidence. Confirmed in part. qta config.ts:15-16 hard-codes the backend.quicktricksbysahilsir.com API with no env override. There is no middleware.ts or proxy.ts. ADR 0005 states that the app/api routes are unauthenticated proxies and that lib/auth.ts is client-only (localStorage). lib/jwt.ts is a 'use server' action that mints Streamer tokens with no caller check. data-table.tsx:106-110 filters out variant 'destructive' actions for everyone ('per request').
  - Correction. Only the shared DataTable hides them. Destructive buttons still render elsewhere: AssignedCoursesView.tsx:247, assign-pdfs/AssignedPdfsView.tsx:711, assign-tests/AssignedTestsView.tsx:210 and :392, grammar subtopics page.tsx:185, PlanCouponDialog.tsx:200. The AI route has an Origin check and a rate limit, which is not auth.
- **partly.** The prod bulk-write ledger has 8 dated sections (09-21 to 10-08), each a single-collection field $set, which one changeset primitive can cover.
  - Evidence. memory prod-data-changes.md has 8 '##' sections at lines 16, 23, 32, 38, 49, 60, 75 and 84, dated 09-21 to 10-08. However, line 39 sets two fields (price and discountPrice) to per-course values derived from Plan.amount, which needs a cross-collection read. Line 64 is a guarded per-row $set. Lines 78 and 89 restore with $unset.
  - Correction. An unheaded ledger entry at lines 80-82 records inserting 4,122 docs into a new collection (dashboard_daily_facts), which is not a $set. A single changeset primitive would need per-row values, $unset restores and a filter guard, and it still would not cover that insert.

## Open questions

- Who is this agent for: only you in Claude Code, or the client's admin operators as well? If operators, the next step after slice 1 is an Access-explainer admin screen plus backend authz fixes, not a chat panel.
- Should slice 1 wait for a read-only Mongo user, or ship on the driver guard with the current full-write credential and add the read-only user later?
- May tool output show student contact details in transcripts, or should tools return ids only while you look up contacts in the admin UI?
- Do you want reads to auto-run without prompts (allow `mcp__qt-ops__*`) as a recorded trust decision, with any write always asking?
- If slice 3 is earned, which fields belong on the write allowlist? Is there anything from the 8 ledger kinds you would rather keep manual?
- Should an engine-written `ops/ledger.jsonl` in system-brain replace adding sections to memory `prod-data-changes.md`?
- The `preAuthToken` OTP bypass and the logger writing admin login passwords to the pm2 log are live on the client fork. Do you want to raise and fix them now as a separate backend change, ahead of any agent work?
- The brain's `.claude/settings.local.json` holds an embedded Bearer JWT and a B2/AWS key pair inside allow rules. Remove and rotate them now, as step 0?

## Candidate designs (raw)

### Ops Copilot: a side panel in the Quicktricks admin that acts as the signed-in admin

A chat panel in the quicktricks-admin dashboard. It answers operator questions using admin API reads made with the signed-in admin's own token, and for the two additive writes it supports (extend validity, assign plan) it only prepares a preview card. The write runs when the operator clicks Confirm, through the same browser hook the existing dialog uses.

Primary user. The client-team operators who work in admin.quicktricksbysahilsir.com every day: course and content managers, support staff answering students in the `support-chat` screen, and QA (e.g. Apoorva's 11-defect round, memory course-qa-round-tasks). Teachers are excluded; their only screen is `live-classes` (qta lib/permissions.ts TEACHER_SCREENS). Today an operator who hears "I paid but can't see the course" or "this class/PDF is missing" either clicks through 187 pages and 49 sidebar links, or escalates to Raghav, who runs reference/scripts/why_unpaid.js on the prod box. What changes for them: they ask in plain language (Hinglish too, since that is how requests arrive per the course-timetable and multi-faculty handoffs). They get an answer that cites the actual order, plan and course rows, with deep links into the existing screens (/admin/orders/user/[userId], course edit, class manage-courses) so they can check it. For the two additive fixes they see a before/after card, and nothing is written until they press Confirm. What changes for Raghav: the 'can't access' and 'where is X' escalations (ops-toil jobs A and B, near-daily from 09-18 to 10-06) stop arriving as script runs.

Architecture.

WHERE IT RUNS
- A new Node-runtime route in the admin fork, app/api/ai/ops/route.ts, beside the existing app/api/ai/course-description/route.ts.
- A collapsible panel mounted in components/LayoutShell.tsx, hidden for role teacher and for admins outside a pilot allowlist.
- Built on a feature branch of quicktricks-admin pushed to Raghav's `fork` remote, so Vercel makes a preview deploy and the production branch is not touched.
- A small companion branch on quicktricks-backend carries the server prerequisites.
- Both forks stay off the slice-branch sync (BRANCHES.md, repos.manifest).

MODEL AND SDK
- Reuses the installed Vercel AI SDK (ai 7.0.83, @ai-sdk/gateway 4.0.67) and the ADR-0005 seam: AI_GATEWAY_API_KEY and AI_MODEL, read server-side only.
- Adds @ai-sdk/react for the chat hook.
- streamText runs a short tool loop with explicit stopWhen and maxDuration.
- Needs a model with reliable tool calling. The current default, google/gemini-2.5-flash, may do. Claude on the gateway returns 403 on the free tier (qta lib/ai/course-description.ts:33-37), so this is an open question.

AUTHENTICATION (the agent acts as the signed-in admin, never as itself)
- The panel sends the admin's existing bearer token from getAuthHeaders() (qta lib/auth.ts:156) to the route.
- On every request the route:
  - (a) rejects tokens with a `purpose` claim;
  - (b) decodes admin_id and calls GET /api/admins/:id with the forwarded token. That route is requireAdmin (qtb src/routes/adminRoutes.ts:29), so the backend verifies the signature, and the response gives role, status and permissions;
  - (c) refuses status 0, role teacher, and admins not on the pilot list;
  - (d) builds the tool list from allowedScreensForAdmin (qta lib/permissions.ts:125). A data_entry admin without the `orders` screen never sees the order tools.
- The token is forwarded on each backend call and never logged. Sentry beforeSend scrubs Authorization, per memory prod-logs-contain-jwts.
- The rate limit is keyed per admin_id, not per IP.

TOOLS (an allowlist; there is no generic HTTP tool)
Read tools execute in the route against https://backend.quicktricksbysahilsir.com/api with the forwarded token:
- find_user → POST /users/search
- list_user_orders → GET /orders?userId=
- explain_course_access → NEW GET /api/admin/users/:userId/course-access?courseId=
- find_course → GET /courses/search and POST /admin/courses/filter
- find_class → POST /classes/filter
- class_courses → GET /classes/:id/courses
- pdf_courses → GET /pdfs/:id/courses
- course_pdf_outline → GET /admin/courses/:id/pdf-outline
- find_plan → GET /plans/all

Before tool results reach the model, the route masks PII: phone becomes the last 4 digits, email is dropped, and opaque ids are kept. Full details are shown only in the panel, from the browser's own fetch.

Write tools have no server-side execute. They are AI SDK client-side tools:
- propose_extend_validity {orderId, days, reason}
- propose_assign_plans {userId, planIds, duration?, giveForFree, remarks}

The model's call becomes a Proposal card in the panel showing:
- the read-back current state (current expireDate and daysLeft, or the user's active orders for those plans);
- the computed after-state;
- the exact request.

On Confirm, the browser:
- re-reads the target and aborts if it changed since the preview (filter on the old value);
- runs the existing TanStack mutation that calls PUT /orders/:id/extend-validity or POST /orders/assign-plans (qta hooks/api/use-orders.ts:361 and :260) with the x-admin-client: copilot header, so the write takes the same path as the UI and invalidates the open screens' queries;
- returns the outcome to the model with addToolOutput.

So the route never holds write capability. The human click is the write.

DATA ACCESS PATH
- Browser → admin route (Vercel) → LMS REST, for reads.
- Browser → LMS REST directly, for confirmed writes.
- No Mongo, no scripts, no box access, no service account.
- Conversations live in component state only. Nothing about them is persisted.

First slice.

Read-only 'Why can't this student see this course?' for two pilot admins (Raghav plus one client-team operator) on a Vercel preview of the feature branch.

BACKEND (quicktricks-backend feature branch, deployed by the surgical dist path)
- One new route: GET /api/admin/users/:userId/course-access?courseId=, guarded by requireAdmin and requireScreenPermission('orders').
- It wraps loadCourseAccessRecords and resolveCourseAccess (qtb src/services/courseAccessState.service.ts:24,57).
- It returns the state flags, plus each candidate order and plan with the reason it does or doesn't count: voided, expired, status 0, plan lacks course, id-type mismatch.
- Unit tests sit beside the existing courseAccessState tests.

ADMIN (quicktricks-admin feature branch)
- app/api/ai/ops/route.ts with the identity check and four read tools: find_user, find_course, list_user_orders, explain_course_access.
- A panel in LayoutShell.
- Answers end with a deep link to /admin/orders/user/[userId].
- No write tools yet.

VERIFICATION
- (1) Replay the recorded incidents: the plan-entitlement-id-cast user, a voided-source-order case from plan-upgrade-offer, the ungranted Apple IAP student, and two currently expired buyers. For each, compare the copilot's verdict and named cause against why_unpaid.js output for the same userId and courseId. Pass means all of them match.
- (2) Auth negative tests against the route: no token, a forged token, a preAuthToken, a teacher token and a status-0 admin all get 401/403, and the gateway logs show no model call for them.
- (3) Grep the route's Vercel and Sentry logs for 'Bearer' and for full 10-digit phone numbers. Expect zero hits.
- (4) The pilot operator answers three real support-chat 'can't access' tickets in a week without escalating to Raghav.

Slice 2, once the auth prerequisites are deployed: add propose_extend_validity with the confirm card. Slice 3: add propose_assign_plans.

Effort. About 2 weeks of focused work for v1 (reads plus both additive writes). Backend prerequisites take 2–3 days including the caller check and a surgical dist deploy. Slice 1 (read-only explainer and the find tools, route, panel and replay eval) takes 3–4 days. The extend-validity proposal with the confirm card takes about 2 days. The assign-plans proposal with the duplicate-grant check takes 1–2 days. A pilot week with one client-team operator follows before widening the allowlist.

Prerequisites.

- Backend: add requireAdmin plus requireScreenPermission('orders') to POST /api/orders/assign-plan, POST /api/orders/assign-plans and PUT /api/orders/:id/extend-validity. Add requireAdmin to GET /api/orders and POST /api/users/search. First confirm no tokenless legitimate caller uses them (qtb src/routes/orderRoutes.ts:72-96, src/routes/userRoutes.ts:410,462; the middleware already exists in src/middleware/screenPermissionMiddleware.ts).
- Backend: requireAdmin must reject tokens carrying `purpose`. Today the password-only preAuthToken (adminController.ts:104-106) passes every requireAdmin route because only verifyAdminLoginOtp checks purpose (:185). This is a one-line fix that also closes an existing OTP bypass.
- Backend: actor attribution for the two copilot write routes. Stamp the admin_id on assign-plan orders (today only assignedByAdmin:true plus remarks) and append an adjustment entry {by, at, days, via} on extend-validity. Add a minimal AdminAction record (actor, route, target, body, status, x-admin-client header) for these routes, since no admin audit model exists (backend explorer; only the unattributed 500-char body log at src/app.ts:239-260).
- Backend: the new read endpoint GET /api/admin/users/:userId/course-access, wrapping loadCourseAccessRecords and resolveCourseAccess, with reasons per order and plan.
- Admin: server-side identity check in the new route (decode admin_id → GET /api/admins/:id with the forwarded token → status, role, screens), per-admin rate limit, Sentry Authorization scrubbing, maxDuration, and the @ai-sdk/react dependency.
- Ops: gateway credits or a chosen model with a spend cap. Add the feature-branch preview origin to CORS_EXTRA_ORIGINS on the box env. Set a pilot admin allowlist.

Explicitly not.

- Not an engineering-ops agent. No incident or perf diagnosis, Mongo top/live, index builds, log forensics, pm2, env flags or deploys. Those are Raghav's Mac-side work and a different shape.
- No deletes of any kind, and no order void, exchange or status change. Nothing that removes or narrows granted access.
- No sending: notifications, advance notifications, WhatsApp /send, Q-Hub broadcasts and support-chat replies all stay manual. Pushes have no cancel (memory manual-scheduled-notifications-never-fire, plan-broadcast-exclude-buyers).
- No bulk catalogue edits (priority, validity, price, isDownloadable) in v1. Those stay on the dry-run → --commit → --restore scripts and the prod-data-changes ledger.
- No coins, coupons, plan/price edits, bulk sales, admin management or permission changes, and no APX routes.
- No service account, no agent-owned credentials, no background or scheduled runs. It acts only as the signed-in admin while the panel is open.
- No generic 'call any endpoint' tool and no reuse of the ApiTester pattern.
- No conversation storage or long-term memory holding student PII.
- Not for the teacher role, and not a video player (the admin never plays video in-dashboard, per memory admin-video-read-side).

Risks.

- The endpoints the copilot writes through are open today. POST /orders/assign-plans has no auth and PUT /orders/:id/extend-validity accepts any student token (qtb src/routes/orderRoutes.ts:80,84). Until they are gated, 'acts with your permissions' is only true inside the copilot, so slices 2 and 3 are blocked on the prerequisites.
- Gating those routes could break an unknown caller. The student app, the thedhronas site or another off-box LMS client may call GET /orders, POST /users/search or assign-plan without a token. This has to be checked (prod request-log sample by path and auth header, redacted) before adding requireAdmin.
- A confident wrong diagnosis leads to a wrong grant. This is reduced by sourcing the verdict from the deployed resolveCourseAccess rule, citing the rows, and requiring Confirm, but operators may still rubber-stamp.
- Model choice and cost: the gateway is on the free tier, and Claude there returns 403. Gemini Flash tool-calling quality on Hinglish requests is unproven. No maxDuration is set on any admin route today.
- Student PII goes to a third-party model provider even when masked: names, and the order and plan context.
- Fork churn: the client team pushes to quicktricks-admin many times a day, and LayoutShell is a shared file. A long-lived feature branch will conflict, so the panel should mount through one small import.
- Every preview talks to prod. qta config.ts hard-codes the prod backend, so the 'separate branch' preview reads prod data and, from slice 2 on, writes it. The preview origin must also be added to CORS_EXTRA_ORIGINS on the box for browser-side confirms.
- Adoption: the real daily user may turn out to be Raghav, not the client team. Then the Mac-side shape wins and this panel is mostly UI cost.

### qtops: a Mac-local ops agent for Raghav (a Claude Code subagent plus two typed MCP servers in system-brain)

A `qt-ops` Claude Code subagent that has no shell. Its only reach into prod is two stdio MCP servers on Raghav's Mac. A read server is write-proof at the driver level and answers questions about access, notifications, content and Mongo health by calling the deployed backend `dist` code. A write server can do one thing: apply or restore a reviewed field-level changeset. The engine takes the backup, filters each write on the old value, reads back on primary and appends the ledger line.

Primary user. Raghav, alone. Today a prod ops question costs re-deriving a recipe (2–5 calls, re-derived in at least 2 sessions; retro §4), finding a usable checkout (retro §1–2), and a classifier denial followed by a pasted `!` line (8 of 12 sessions; retro §5). Changes for him:
- He asks the `qt-ops` subagent in plain words ("why can't 98xxxx see Science Prime?", "why is notification 48f9… stuck in sending?", "set isDownloadable on the PDFs missing it"). It answers in 1–2 typed tool calls.
- The verdict comes from the same deployed function prod runs, not a hand-mirrored filter.
- A bulk edit arrives as a changeset he approves once in a Claude Code permission prompt. The backup, restore command and ledger entry are produced by code, not remembered.
- The client team and the admin operators gain nothing in v1. That is deliberate (see explicitly_not).

Architecture.

**Where it runs**
Raghav's Mac, inside the Claude Code he already uses (Opus 5.5, subscription auth). There is no Agent SDK app, no hosted service and no API key. Everything lives in system-brain on a new branch `agent/qtops`. That is Raghav's own repo, so no client fork is touched.

1. **`.claude/agents/qt-ops.md`.** The frontmatter sets `tools: mcp__qtops-read__*, mcp__qtops-write__*, Read, Grep, Glob`. Leaving out Bash, Write and Edit is the structural guarantee: this agent cannot ssh, run node, curl the unauthenticated REST routes, or read `.env` through a shell. Contrast `task-implementer.md:19`, which forbids prod in prompt text only while holding Bash. The body carries the decision trees: which tool answers which complaint, and the known false leads.

2. **`ops/qtops/read-server.mjs`** (stdio MCP, `@modelcontextprotocol/sdk` + zod).
   - Started with `node -r reference/scripts/automatic-plan-extension-local/readonly-guard.cjs`. That guard already patches the mongoose driver: every write, index build, `$out`/`$merge` and non-allowlisted command rejects.
   - cwd is a dedicated backend worktree `~/Projects/worktrees/qtops-backend`, pinned at the tip of `origin/quicktricks-admin` with `node_modules` symlinked (mongoose 8.24.3 is present locally). Tools `require` `dist/src/services/*` and `dist/src/models/*` exactly as `dashboard_hourly.js` and `playback_walk.cjs` already do. `dist` is the deploy artifact, so this is the code prod runs.
   - It never requires `dist/src/app.js`. It asserts this at startup and sets `DISABLE_CRONS=true` anyway. No crons, Redis, sockets or FCM.
   - Tools: `explain_access`, `explain_notification`, `list_orphan_sending`, `explain_content`, `mongo_health`, `run_report(name, params)`, `find(collection, filter, projection, limit)`, and `plan_change(kind, params)`.
     - `find` is an escape hatch with an explain-first COLLSCAN refusal on large collections, `maxTimeMS`, and a 200-row cap.
     - `plan_change` builds and saves a changeset file. It writes nothing to Mongo.
   - Every result carries `evaluatedAtCommit`, `readFrom` (secondary or primary) and the non-secret env flags used (the `LAPSED_EXTENSION_*` key values).

3. **`ops/qtops/write-server.mjs`** (separate process, no readonly guard, `readPreference=primary`, `w:majority`). It exposes only `apply_changeset(id, confirm)` and `restore_changeset(id, confirm)`, where `confirm` must equal `<id>:<rowCount>`. It has no query tool and no free-form update.

4. **`ops/changesets/*.json`** (committed) and **`ops/ledger.jsonl`** (engine-appended). These replace hand-written ledger sections. Memory `prod-data-changes.md` then just points at the ledger.

5. **`.mcp.json`** registers both servers. A project settings entry allows `mcp__qtops-read__*` and sets `ask` for `mcp__qtops-write__*`, so every apply surfaces a native permission prompt showing the changeset id and row count.

**Auth and data path**
- Direct MongoDB only, which is the path every current prod-ops script uses. No admin JWT and no REST, which sidesteps:
  - the SMS OTP, the 1-day expiry and the lack of refresh or service accounts;
  - `requireAdmin` being claim-only;
  - the unauthenticated order and user routes (`orderRoutes.ts:77-96`).
- The servers read `MONGO_URI` from `../quicktricks-backend/.env.development` at startup and never return it.
- The read server should move to a dedicated read-only Mongo user as soon as one exists (prerequisite). Until then the driver guard is the control.
- Deferred to v2: a fixed, argument-free `box_status` tool (pm2 id 27 uptime, restarts and memory over the existing ssh key) for the OOM job.

First slice.

**Scope: `explain_access` only, end to end, on branch `agent/qtops` in system-brain.**

Pieces:
- `ops/qtops/read-server.mjs` with the readonly-guard preload and the redactor.
- A `qtops sync` script (run once by Raghav as a `!` line) that fetches `origin/quicktricks-admin` via the `raghav-hranker` alias, creates or updates the pinned worktree and symlinks `node_modules`.
- `.mcp.json` registering the read server.
- `.claude/agents/qt-ops.md` with no Bash.

The tool resolves the user and target, then calls `resolveCourseAccess` plus `authorizeClassAccess`/`authorizeCourseAccess` with `mongoAuthorizationDeps`. It returns the verdict, the orders (newest first), plans in both id forms, placements and isFree flags, and the trap checks that fired.

**Verify:**
1. **Unit tests.**
   - A write attempted through the server's mongoose handle rejects with `READ-ONLY GUARD`.
   - The redactor removes phone, email and JWT patterns from a fixture.
   - The server refuses to start if `app.js` is required.
2. **Replay recorded incidents** read-only against prod. The tool must name the same cause memory recorded:
   - The test account `6a7eb7ce…` with \"explore test 2\" names a voided source order (`plan-upgrade-offer.md`).
   - A plan whose `course` is stored as strings is found where `why_unpaid.js`'s ObjectId-only query misses it (`plan-entitlement-id-cast.md`).
   - A practice-batch PDF is reported as the separate batch axis.
3. **Parity.** For 20 random (user, course) pairs, the tool's `is_buy` must equal what `addIsPaidToCourses` computes via the existing local read-only server (`run-prod-readonly.sh`, port 3110, `GET /api/courses/by-id-2`).
4. **Cost check.** In a fresh session, ask `qt-ops` one real complaint. Pass if it answers in ≤2 tool calls, with no Bash prompt and no classifier denial, against today's 2–5 calls plus a `!` handoff.

**Slice 2** is the changeset engine with the `pdfs.isDownloadable` and `courseclasses.endDate` kinds. Verify by replaying the 10-06 isDownloadable fix as a dry plan (expect 0 rows now), then apply and restore against a test course's placement.

Effort. About 1 week of focused work in total:
- Slice 1 (read server, `explain_access`, subagent, sync script, tests and replay checks): 1–1.5 days.
- Changeset engine with `reducesAccess`, ledger, the write server and 3 registered kinds: 2–3 days.
- `explain_notification`, `explain_content` and `mongo_health`: about 1.5 days.
- Wrapping 2–3 existing reports: about 0.5 day.

The read-only Mongo user is minutes of work for whoever holds the rs0 admin credentials, but it is a dependency outside the code.

Prerequisites.

- **Fix the backend fork's origin** to the `git@raghav-hranker:` alias (retro §1, still unapplied) so `qtops sync` can fetch the deployed tip reliably.
- **Create a read-only MongoDB user on `quicktricksdb`** for the read server, and rotate the prod password. This is the open retro item "rotate the prod Mongo password + a read-only prod helper" (`docs/retro-2026-10-06.md:171`).
- **Remove the embedded credentials from `system-brain/.claude/settings.local.json`** (a Bearer JWT and a B2 key pair inside allow rules). That repo becomes the prod-ops workspace, and the subagent can Read files.
- **Decide the ledger's home.** `ops/ledger.jsonl` would be committed in the brain, replacing new sections in memory `prod-data-changes.md`.
- **Not required:** the backend authz fixes, an admin audit-log model, or an admin service account. v1 never touches the REST API.

Explicitly not.

- Not an in-dashboard chat for the client's admin operators. qta has no server-side admin auth: ADR-0005's AI route is guarded only by a same-origin check and an IP limit, and `lib/auth.ts` is client-only.
- Not a REST client acting with an admin JWT. There is no service account, OTP blocks headless login, tokens last 1 day with no refresh, `requireAdmin` is claim-only, and many order and user writes are unauthenticated. An agent there would inherit those holes instead of guarding against them.
- Not a Claude Agent SDK app, a hosted service, or a Slack or WhatsApp bot. There is one user, Claude Code is already the harness, the SDK is not installed, and there is no `ANTHROPIC_API_KEY`.
- No notification sends, broadcasts, resends or Q-Hub publishes. These have no cancel and reach every token.
- No order or entitlement writes in v1: no grant, void, assign-plan, extend or exchange. The Razorpay sync cron resurrects voided orders, and the never-remove rule applies.
- No deploys, pm2 restarts, env-flag edits, index builds, `killOp`, or box shell.
- No reading of the pm2 out log. It holds JWTs and login bodies.
- No generic `updateMany` or `aggregate`-with-write tool, and no taxonomy merges (the 20,997-change reconciliation stays a human-reviewed project).
- Not run on the prod box or test-uday. That would add another cron-capable client on a shared, multi-tenant box.
- Not a backend code change and not a fix for the LMS authz gaps. Those are real, but they are a separate project.

Risks.

- **The Mac's prod `MONGO_URI` is a full read-write credential.** Until a read-only user exists, the in-process guard is the only thing between a read tool bug and a prod write. A driver path the guard misses, such as a future mongoose method, would write.
- **The pinned dist can differ from what the box runs.** The client team pulls about 7 times a day, and retro §1 (origin cannot fetch) is still unfixed: the local origin is still `git@github.com:abhi092515/…`. Output carries `evaluatedAtCommit`, but a stale worktree gives confidently wrong verdicts.
- **Env drift.** `getLapsedExtensionConfig()` reads `LAPSED_EXTENSION_*` from the Mac's `.env.development`, which may not match the box's, so extension and upgrade states could differ from what students see.
- **Direct Mongo writes bypass the API.** No `createdBy`, no request-log line, and no in-process caches are refreshed. The registered fields are not Redis-cached (Redis use is series, questions and dashboard only), but an open admin tab shows stale data for up to 5 minutes because of the TanStack staleTime.
- **Reachability of prod Mongo from the Mac has varied** (27017 was refused 09-23 and reachable 09-28).
- **PII enters Claude transcripts** whenever a tool returns user data. Masking reduces this but does not remove it: names and order amounts stay.
- **The auto-mode classifier's treatment of MCP tool calls is untested here.** If it still prompts or denies on qtops calls, the time saved shrinks.
- **Bus factor of one.** It helps only Raghav, and the client team's ops stay manual.

### qt-ops-diagnostician: a read-only Claude Code subagent backed by a typed, read-only MCP tool server. No writes until the platform can hold an agent to account.

Most of the proposal does not earn its place yet. What does: a subagent for Raghav only that turns a vague complaint ("student can't see X", "class missing", "notification stuck") into ids, runs 5 bounded read-only probes that reuse the deployed entitlement code, names the cause with record ids, and hands back the existing dry-run script command for Raghav to run himself. It has no write tool, no HTTP tool and no Bash.

Primary user. Raghav only, from Claude Code in system-brain. Today an incident session re-derives the prod-Mongo recipe (retro-2026-10-06 §4: 2–5 calls each, in at least 2 sessions), gets denied by auto mode (8 of 12 sessions, §5), then pastes `!` commands. With the subagent, one call to `ops-diagnostician` returns: the facts, the deciding records (order/plan/class ids), the cause matched against the known false leads, and the next step as a command such as `node reference/scripts/set_course_priority.js … (dry-run)`. Raghav still runs every write himself. The client's admin operators (Apoorva QA, Uday, Deepak) are deliberately NOT users. If they need "why can't this student see X", the right answer is an admin screen over the same deterministic function, not a chat agent sitting on an admin token that can't be revoked.

Architecture.

WHERE: system-brain only, on branch `agent/ops-diagnostician`. That is Raghav's repo, so no client fork is touched and nothing is deployed. It runs on Raghav's Mac inside Claude Code, the existing session and subscription model. No Agent SDK, no API key, no new LLM dependency in the backend or on Vercel.

PIECES (about 400 lines total):
(1) `tools/qt-ops-mcp/server.mjs`: a local stdio MCP server (Node 22, @modelcontextprotocol/sdk), registered in brain `.mcp.json` as `qt-ops`.
(2) `.claude/agents/ops-diagnostician.md`: a subagent with `tools: mcp__qt-ops__*, Read, Grep, Glob`. It deliberately has NO Bash, Write, Edit or WebFetch, because the subagent would otherwise inherit `.claude/settings.local.json`'s 108 allow rules and 0 deny rules (ssh *, curl *, node *, git push *). Its prompt carries the false-lead decision trees and points at the runbook.

TOOLS (5, all bounded with limit + maxTimeMS, indexed lookups only):
- `find_user(mobile|email|id)` returns id, status, createdAt, with contact fields masked.
- `explain_access(userId, courseId|planId|practiceBatchId)` imports the compiled `dist/src/services/courseAccessState*.js` from a fresh origin/quicktricks-admin worktree, the same reuse-the-deployed-code pattern as `reference/scripts/dashboard_hourly.js`. It returns the state plus the granting or denying order and plan ids, and the commit hash it ran against.
- `content_status(classId|pdfId|courseId)`
- `notification_status(id|titleQuery)`
- `db_health(collection?)`: currentOp top-N redacted with the same regex as `mongo-live.js`, getIndexes, and rs status, all on primary.
Every tool output passes through one redactor (mobile/email/phone/password/otp/token/fcmToken/session_id fields, plus a JWT regex).

DATA PATH: the MCP server process alone holds `QT_RO_MONGO_URI`, for a new Mongo user with `read` on quicktricksdb and `clusterMonitor`. The model never sees the URI. Default readPreference is secondaryPreferred; health and index tools use primary. Defence in depth: the server preloads `reference/scripts/automatic-plan-extension-local/readonly-guard.cjs` (patches the driver so every write, index build and $out/$merge rejects). It never boots `src/app.ts`, so no crons, Redis or Rabbit start, and it imports only pure dist modules.

AUTH: none toward the LMS API. Deliberately no admin JWT and no HTTP tool. With global auth commented out (qtb `src/app.ts:488`) and `POST /api/orders/assign-plan`, `PUT /api/orders/:id`, `PUT|DELETE /api/users/:id` and `POST /api/user-coins` open (`orderRoutes.ts:77,80,93-96`, `userRoutes.ts:626-627`, `userCoinsRoutes.ts:8`), any HTTP tool is a write tool in disguise.

AUDIT: the server appends one JSONL line per call (ts, tool, args with ids only, rows returned, ms) to `~/.qt-ops/audit.jsonl`. This is the only audit trail in the system, and it covers reads only.

PERMISSIONS: one narrow allow, `mcp__qt-ops__*`, replaces the ad-hoc `ssh`/`node`/`!` path for diagnosis. That allow is a conscious decision, not a classifier workaround.

First slice.

Build only `find_user` + `explain_access` + the subagent definition + the redactor + the audit JSONL, on branch agent/ops-diagnostician in system-brain. Verify in four checks, all read-only:
(1) Canary: on startup in `--selftest` mode the server attempts an insertOne into a scratch collection. It must fail twice: once by Mongo authorization (RO user) and once by READ-ONLY GUARD. Otherwise the server refuses to start.
(2) Parity: sample 30 (user, course) pairs read-only: 10 plan-bundle buyers, 10 direct-course buyers, 5 practice-batch holders, 5 never-held. `explain_access` must agree 30/30 with an independent call to the deployed `addIsPaidToCourses` (qtb src/utils/courseUtils.ts:18) loaded from the same origin-tip dist, and must name at least one granting order id for every is_buy=1.
(3) Known-state replay: ask the subagent in plain language about the test account in test-account-cleared.md. It must report exactly the two active orders that memory records (the ₹500 upgrade and the free practice-batch grant) and explain why Railway Prime Batch is still open via the upgrade plan's bundle. Then rewrite 4 closed incidents as complaints (voided source order on an upgrade offer, Mixed-id plan bundle, ungranted Apple IAP, practice-batch axis). It must name the right axis in ≥ 3/4, with zero tool calls outside mcp__qt-ops__*.
(4) Grep the audit JSONL and the transcript: no 10-digit mobile, email or `eyJ` token appears.
Then measure the value: on the next 3 real 'can't access' complaints, record tool calls and minutes against the retro baseline (2–5 calls of recipe re-derivation plus classifier denials). If it doesn't clearly beat the runbook alone, stop.

Effort. The v1 prerequisites take about a day: the read-only user and password rotation (about 1 hour), the runbook and scripts README (about half a day), and the settings.local.json cleanup (about 1 hour). The first slice (find_user + explain_access + subagent + redactor + audit + the 4 checks) is 2–3 days. Adding content_status, notification_status and db_health is about 2 more days. The before-any-write platform prerequisites are about 1.5–3 weeks of backend work on the client team's fork (authz on roughly 40 routes, purpose check, log redaction, AdminAction middleware, agent identity, a staging DB). It has to be coordinated with a team that deploys about 7×/day, and app or script callers that rely on the open routes may break. The write-capable agent itself should not be estimated until those land and v1 has shown measured value.

Prerequisites.

- FOR v1: create a read-only Mongo user (`read` on quicktricksdb + `clusterMonitor`) and rotate the shared prod password. This is the open item 'rotate the prod Mongo password + a read-only prod helper' in docs/retro-2026-10-06.md:171.
- FOR v1: write reference/quicktricks-prod-ops.md and reference/scripts/README.md (retro §4/§6). The subagent prompt cites them, and they are the no-agent baseline the slice must beat.
- FOR v1: remove the literal credentials the explorers reported in .claude/settings.local.json (a Bearer JWT and a B2/AWS key pair; I did not open the file to avoid printing them) and add deny rules. The subagent's sandbox should not rest on a file holding live secrets.
- BEFORE ANY WRITE, server-side authz on the qtb fork: requireAdmin (not open, not any-token) on orders POST /, assign-plan, assign-plans, PUT/GET /:id, GET / (orderRoutes.ts:71-96); users GET /, POST /search, PUT/DELETE /:id, update-user, change-password (userRoutes.ts:410,462,626-627); POST /api/user-coins (userCoinsRoutes.ts:8); course-classes, course-tests and course-folders writes; notifications, advance-notifications and class-notifications (app.ts:588-590 are any-token); dashboard-analytics GETs (dashboardAnalyticsRoutes.ts:12-16). Plus requireScreenPermission on every route an agent would call, since today only gst and banned-users have it.
- BEFORE ANY WRITE: close the OTP bypass. The preAuthToken {admin_id, purpose:'admin_login_otp'} is signed by the same generateToken (adminController.ts:104-106), and authenticateToken/requireAdmin never check `purpose` (authMiddleware.ts:24-82, 93-104). So the password alone yields a token that passes every requireAdmin route. Verified in code.
- BEFORE ANY WRITE: redact the request logger (app.ts:240-260). It writes /api/admins/login {email,password} and verify-login-otp {otp, preAuthToken} bodies to the pm2 out log. Verified in code.
- BEFORE ANY WRITE: an append-only admin audit log (actor admin_id, route, target ids, redacted body, backup or before-image reference) written by middleware on every admin write. None exists among the 175 models. Today the only record is an unattributed 500-character body preview in the log.
- BEFORE ANY WRITE: a revocable, least-privilege agent identity. Either a dedicated Admin record whose status and screens are checked in the DB per request, or a route-allowlisted machine secret on the requireTranscoderSecret pattern. Also close updateAdmin letting non-'admin' roles change other admins' Psw, Email and admin_mobile (PRIVILEGED_ADMIN_FIELDS strips only role, permissions, customer_id, status and admin_type).
- BEFORE ANY WRITE: a non-prod data environment. None exists today: local, test-uday and every admin preview hit prod quicktricksdb.
- BEFORE ANY WRITE: writes exist only as named, reviewed operations that follow the reference/scripts contract (dry-run → backup JSON → human approval of the diff → --commit filtered on the old value → read-back on primary → prod-data-changes.md ledger → --restore). They must be additive-only, and grants, voids and notification sends stay human-only permanently.

Explicitly not.

- An in-dashboard chat agent for the client's admin operators. The admin app verifies no admin token server-side (qta lib/auth.ts is client-only; ADR-0005 says so). The existing AI route is guarded only by same-origin plus an in-memory per-IP limit, and every preview talks to the prod backend (qta config.ts:15-16).
- Any write tool: grants (assign-plan/assign-plans), voids or order status, exchange and extend-validity, coins, user edits or deletes, catalogue and placement edits, bulk-sales, taxonomy merges, Q-Hub repair.
- Sending, resending, stopping or deleting notifications, WhatsApp sends or Q-Hub publishes. These have no cancel and push to every token.
- Calling the prod REST API with any method, even GET, because the same routes accept unauthenticated writes.
- Minting admin tokens with JWT_SECRET, or using an Admin record with no mobile to skip OTP as a 'service account'.
- Reading or tailing the 12–30 GB pm2 out log, ssh to webserver2-2, or anything on the shared multi-tenant box.
- Index builds, killOp, env-flag flips, pm2 restarts, deploys. Those are engineering ops and belong in the runbook and scripts.
- A reports/analytics agent. Recurring reports belong in saved scripts or dashboard screens (dashboard_hourly.js, search-usage.js already exist).
- A WhatsApp or Slack bot, or a scheduled autonomous agent. Slack has zero integration, and 'alerts' are console.warn lines (staleStreamSweep.ts).
- Any LLM dependency or agent route inside the backend. It is a single fork-mode process with a recent OOM history, and its request logger would write agent bodies to the log.
- Browser automation of admin.quicktricksbysahilsir.com as an agent runtime.

Risks.

- The premise may not pay back. Retro §1, §2, §4 and §7 show the cost is finding things (env, checkout state, recipes, code location), not writing queries. The unwritten runbook reference/quicktricks-prod-ops.md plus reference/scripts/README.md (both verified absent) may capture most of the value with no agent. The job frequencies are estimated from memory dates, not measured.
- Prompt injection through user-controlled data (names, notification text, chat messages). Contained only because the tool set is read-only with no egress. Adding one HTTP or write tool removes that containment.
- PII in transcripts and Anthropic-side logs: student mobiles and emails if redaction misses a field name. Mitigated by returning ids and a regex redactor, but not eliminated.
- Rule drift: if the dist import comes from a stale checkout (quicktricks-admin was 179 commits behind), verdicts are confidently wrong, and a human then runs a write on that basis. Mitigated by refusing to run off origin tip and printing the commit hash.
- Load on a fragile prod DB from one more direct client on public-IP members. The Mac is already one of several off-box clients (memory notification-stuck-sending-second-sender.md).
- Scope creep to 'just one write' before the prerequisites. With the authz gap, a write tool's own guardrails would be the only control, and an LLM's judgement is not a security boundary.
- False confidence: a fluent wrong diagnosis is worse than a raw script dump. The agent must quote the deciding records so Raghav can check them.
- Bus factor and access: only Raghav can use it. That is intended, but it means it does nothing for the client team's operational load.
- The auto-mode classifier may still deny MCP prod reads unless explicitly allowed. The narrow allow is a deliberate trust decision that should be recorded.

## Revision after "so nothing for the user of the admin?"

The first recommendation ranked the admin-user copilot last because the evidence came from the engineer's memory notes, which only
record work that reached Raghav. The "can't access" and "where is this class" escalations start with operators and support chat,
so the same jobs serve admin users directly.

Revised lead: the in-dashboard panel's read-only slice 1 (see "Ops Copilot" in the raw designs), piloted by Raghav plus one
client-team operator. It needs one new backend endpoint (`GET /api/admin/users/:userId/course-access`, wrapping
`resolveCourseAccess`), an identity check in the new admin route that refuses `purpose` tokens, and a model choice. Writes come later
as confirm cards for additive fixes only, after the order routes are gated and record the actor. The Mac-side agent is deferred to
engineering-only jobs (Mongo health, notification forensics, bulk edits).

Verified 2026-10-10: the admin app already runs an AI SDK route (`app/api/ai/course-description`, `ai` ^7.0.83, `@ai-sdk/gateway`
^4.0.67) with default model `google/gemini-2.5-flash`. Its comment says Anthropic models on the gateway need paid credits (free tier 403).
