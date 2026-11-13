# Vidyagram scale readiness audit — 2026-11-12

Scope: notifications, student APIs, admin, for a launch at 3–5x quicktricks. Backend code read at `vidyagram-admin`
6487caa05 (the commit on the box). Live numbers were read from webserver2-2 and rs0 on 11-12, read-only.

**Verdict: not ready.** The code and data can be made ready in about a week of focused work. The hosting shape
(one Node process per tenant on a shared box, a two-and-a-half-member Mongo cluster) is the larger risk and needs a
decision before launch.

How to read the evidence: **measured** = read from prod today. **code** = read in the source by a reviewer; I
spot-checked the top items. **estimate** = arithmetic from the two.

## 1. The load we are sizing for

Quicktricks, measured from the request log, 11-11 21:00 IST to 11-12 19:30 IST:

| | quicktricks today | Vidyagram at 3–5x |
|---|---|---|
| Requests per day | about 5.5 million | 16–27 million |
| Busy-hour average | 6,000–10,000 per minute | 20,000–50,000 per minute |
| Typical peak minute (p99) | 12,300 | 37,000–62,000 |
| Worst minute | 83,000 (six separate hours had a minute above 47,000) | 250,000–400,000 |
| Share of the worst minute that is `POST /api/app-events` | 90% (61,179 of 68,257 at 18:02 IST) | same |
| Latency | 95.1% under 100 ms, 0.04% over 10 s | |

The worst minutes are all the same event: a push goes out and every phone reports `NOTIFICATION_RECEIVED`.
Nearly half of all quicktricks requests (1.74M of 3.2M sampled) are app-events.

Data already in `vidyagramdb` (measured): 2.5M users (quicktricks 0.8M), 1.9M orders (1.2M), 164M
`userquestionanswers` (76M), 5.76M scores (1.44M). So the data is already 1.5–4x quicktricks before any student
logs in. The activity collections are still empty: 186 login sessions, 308 views, 0 delivery logs.

## 2. Platform (affects all three areas)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| P1 | **One Node process serves the whole Vidyagram API and runs every cron.** pm2 92 is fork mode, 1 instance, 2 GB restart cap. Quicktricks' single process sits at 15–50% of one core at 1x; 3–5x does not fit in one core. The box has 16 cores at load 0.5, so the capacity exists but the process cannot use it. | measured | Move crons and warmers into their own pm2 process (`DISABLE_CRONS=true` on the API), then run the API in cluster mode ×4. The in-memory leaderboards and rate limiters must move to Redis first. |
| P2 | **Vidyagram shares the box with quicktricks and 37 other pm2 processes**, one local Redis and one local RabbitMQ. A Vidyagram spike takes Apache, Redis and CPU from quicktricks. | measured | Own box for Vidyagram, or at least its own Redis db/prefix and an Apache `max=` per-vhost connection limit. Decision for the team. |
| P3 | **rs0 is the shared database for every tenant and has been on two members since 11-09.** `.241` has died three times in a week from a full disk and was `RECOVERING` today. With two members, one more failure stops writes for all tenants. Each member has a 14 GB cache against 263 GB of Vidyagram data alone. | measured | Server team fixes `.241`'s disk (log rotation, verbosity 0) before launch. Add `maxStalenessSeconds=90` to both tenants' URIs. Longer term: Vidyagram on its own replica set. |
| P4 | **17 indexes that quicktricks has are missing on Vidyagram's large collections** (list in section 6). The boot log shows 172 `An existing index has the same name` errors, so `createIndexes()` aborts part-way at every start. Missing ones include the unique `mobile` and `email` on users, so two accounts can share a mobile. | measured | Build by hand with `commitQuorum: 'majority'`, biggest collections off-peak. Check duplicate mobiles first (`tenant-push-audience-check.cjs`). |
| P5 | **Every route accepts a 200 MB JSON body, and the logger stringifies the whole body.** A few large POSTs block the process. | code, `app.ts:661`, `requestLogger.ts:38` | 1 MB default, higher only on upload routes. |
| P6 | **Four synchronous `console.log` lines per request.** At 150k requests a minute that is 10,000 blocking writes a second. Quicktricks' log is already 139 GB. | code, `app.ts:673-677` | Delete the three debug lines; add pm2-logrotate. |
| P7 | **No query time limits, and a 10-minute request timeout.** One slow aggregate holds a connection for minutes; enough of them starve the session lookup every request needs. Pool is 200 (from the URI). | code, `app.ts:316`; measured URI | `maxTimeMS` on the heavy pipelines, 30 s default timeout. |
| P8 | **Restart drops in-flight requests** (no `server.close`). Vidyagram restarted 91 times in 8 days, mostly deploys. | code; measured | Graceful close; with cluster mode use `pm2 reload`. |

## 3. Notifications

| # | Finding | Evidence | Fix |
|---|---|---|---|
| N1 | **Vidyagram's backend holds quicktricks' Firebase credential** (`project_id: quick-tricks-sahil-sir` in both checkouts). Tokens from a Vidyagram app in its own Firebase project will all fail. | measured | Confirm which Firebase project the Vidyagram app ships with and install that service account. Blocks all push testing. |
| N2 | **A broadcast is sent as fast as FCM accepts it**: batches of 500, 10 in flight, no rate cap. 300k devices land in 1–2 minutes and each one calls back. That is 150k–300k app-event requests a minute into one process; 50k a minute stalled quicktricks on 10-16. The event buffer starts answering 503 past 50k queued. | code, `notificationTokenDelivery.service.ts:64-65, 1073`; estimate | Send in waves (1–2k tokens a second, env-tunable). App side: jitter the `NOTIFICATION_RECEIVED` post and use `/bulk`. Biggest single win in this audit. |
| N3 | **Class reminders read every token user to find a course's buyers**, once per course-class, and several reminders due in the same minute run at once. One class in five courses = five full passes over 2.5M users and up to five pushes to one student. | code, `:966`, `classNotificationScheduler.ts:219` | Add the existing `buildTargetUserFilter` to the cursor query; one reminder per class; claim with `findOneAndUpdate` so a second process cannot send twins. |
| N4 | **Audience estimate keeps every token user in the heap and groups all of `classprogresses` and `usertestdatas`**, refreshed every 5 minutes while an admin composes. At 2.5M users this is several hundred MB against a 2 GB cap. | code, `:219, 291-311, 512` | Count in Mongo; precompute segment facts nightly. |
| N5 | **Plan-broadcast "exclude buyers" builds an id list** that passes Mongo's 16 MB query limit at about 500k buyers. | code, `:687-694, 1149` | Materialise the audience into a collection. |
| N6 | **A send that fails to start, or is cut by a restart, stays `sending`** until an admin clicks Resume. The start reads a secondary right after the insert. Quicktricks has 13 such rows today. | code, `Notificationcontroller.ts:721`; measured | Read the primary there; resume stalled sends at boot. |
| N7 | Invalid-token cleanup scans users (no `customer_id` in the filter). Tokens that get a 429 are logged failed and never retried. | code, `:825, 996` | Add `customer_id`; retry non-success on resume. |
| N8 | Daily quiz reminders can be marked sent without being pushed (claim, then read from a secondary). Advance "send later" is accepted but its scheduler is never started. | code, `dailyQuizReminders.ts:87`, `app.ts` | Read primary; start or hide the feature. |
| N9 | Delivery logs: 12 of 13 indexes are present on Vidyagram; only the `expiresAt` TTL is missing, so the inbox table grows forever (quicktricks: 66M rows, 18 GB of indexes). | measured | Build the TTL on both tenants. |

Working as intended: batching, bulk delivery-log writes, cancel (now polled), the manual send-later cron with an
atomic claim.

## 4. Student APIs

| # | Finding | Evidence | Fix |
|---|---|---|---|
| A1 | **Every authenticated request does a session read plus a `last_activity` write on the primary.** At target load that is 300–500 primary writes a second for nothing. A fresh login can get a 401 while the secondary lags. | code, `authMiddleware.ts:72-78` | 30–60 s in-process session cache; write `last_activity` at most every 5 minutes. |
| A2 | **`/api/home/continue` flushes the shared app-event buffer on every call** and then reads from the primary. It turns each Home open back into an insert, undoing the 10-21 flood fix. | code, `homeContinue.service.ts:154, 59, 85` | Drop the flush; read secondaries. |
| A3 | **Timetable aggregates every active placement in the system with six lookups per row**, then filters to the student's courses in JavaScript. `POST /api/timetable` is already a top-20 route. | code, `courseClassController.ts:1050-1176` | `$match` the student's courses first. |
| A4 | **Top picks and onboarding stats rebuild on every concurrent request when their cache expires.** Top picks loads 30 days of paid orders; busiest-city groups all 2.5M users and is unauthenticated. | code, `topPicksService.ts:79`, `onboardingSignals.service.ts:29` | Use the existing single-flight `apiCache` pattern. |
| A5 | **Search runs an unanchored regex over classes and placements, uncached, unthrottled, no login needed.** | code, `titleSearch.ts:175` | 60 s Redis cache on the normalised query; rate limit. |
| A6 | **`$lookup` over 100 MB is already failing on Vidyagram**: 20 errors in the last 3 MB of error log, plus 9 `distinct too big`. Two courses hold 155k and 190k orders. | measured | The known by-id-2 fix; the users-list fix in D2. |
| A7 | Heavy uncached lists: `POST /api/courses/filter` (the top student route on both tenants), `GET /api/courses/:id/classes` (unpaginated), `GET /api/topic-and-section` (393 calls over 2 s on quicktricks in a day). | code; measured | 60 s cache keyed by body. |
| A8 | Playback mint is about 10 operations, including an `$inc` on one Class document, which is hot at live-class start. | code, `viewController.ts:93` | Buffer the view counter. |
| A9 | Warmers in the API process: Vidyagram leaderboards group all 5.76M scores every 5 minutes. | code, `vgLeaderboardService.ts:89` | Goes away with P1. |
| A10 | Quicktricks' slowest routes will be worse on Vidyagram's data: `razorpay/website-webhook` (4,851 calls over 2 s in a day), `user-stats/test-series-summary` (591). | measured | Profile both against vidyagramdb before launch. |

Security items found on the way (not scale, but launch blockers in their own right; all **code**):

- `GET /api/users/sendOtp/:mobileNo` has no throttle, OTPs are 4 digits, and `/mobile-login` does not count
  attempts. The login rate limiter exists but is not mounted.
- `GET /api/course-classes/:courseId/reverse-priority` needs no login and rewrites class order.
- `POST /api/class-progress` needs no login and takes `userId` from the body.
- The inbox route takes `userId` from the URL, so any student can read another's notifications.

## 5. Admin

Every admin request runs in the same process as student traffic, so one heavy admin page slows students.

| # | Finding | Evidence | Fix |
|---|---|---|---|
| D1 | **Users list and search scan all 2.5M users twice per page** (unanchored regex on names and email, `$expr` on mobile, plus a full count). | code, `userController.ts:1185-1398` | Exact mobile match, prefix search on lowercased fields, capped count. |
| D2 | **Users list with an order filter** builds a distinct list of buyer ids; past roughly 500k ids it errors (the `distinct too big` errors in A6). | code, `:1205, 1331`; measured | Flag on the user, or lookup from a capped page. |
| D3 | **Orders date filter converts the date per row**, so the list and its count scan all 1.9M orders. Search is six unanchored regexes. | code, `orderController.ts:1504-1627` | Backfill `orderDate` to a real date (script exists), index `{customer_id, orderDate}`. |
| D4 | **Orders "by user" export fires every page at once from the browser.** For a 190k-buyer plan that is about 3,800 simultaneous requests, each grouping 190k orders. | code, `OrdersDashboard.tsx:391-410` | Server-side export job; until then a pool of 3. |
| D5 | **GST export builds up to six months of orders and the Excel file in memory.** | code, `gstReport.service.ts:334-367` | Streamed workbook, or a background job writing to the bucket. |
| D6 | Course purchased-users groups all of a course's orders on every page; sales report, coupon analytics and product leaderboards recompute on every view. | code | Cache for a few minutes. |
| D7 | Polling: analytics dashboard runs 5 heavy queries every 60 s per open tab; class list re-searches every 15 s; support inbox every 15 s with a lookup before the limit. | code | Longer intervals; pause when the tab is hidden. |
| D8 | Uploads to memory with no size limit on ebook, question-import, section and topic routes; `/uploads/files` takes 200 MB into memory. | code | Size limits; presigned upload for large files. |

Fine: video and PDF uploads go straight to the bucket; no bulk action writes across many users in one request;
admin auth and the audit trail are cheap at admin volumes.

## 6. Indexes missing on vidyagramdb (measured)

Present on quicktricksdb, absent on vidyagramdb:

- `userquestionanswers` (164M rows): `{userId, seriesId, createdAt}`, `{customer_id}`, `{customer_id, seriesId, attempted_count}`, `{customer_id, createdAt}`
- `scores` (5.76M): `{seriesId, userId, createdAt}`, `{test_type, userId, createdAt}`
- `usertestdatas` (5.76M): `{customer_id, test_type, createdAt}`
- `users` (2.5M): `{customer_id, createdAt}`, unique partial `{email}`, unique partial `{mobile}`
- `orders` (1.9M): `{trxId, customer_id}`, `{courseId}`
- `classprogresses`: `{userId, courseId, classId}`
- `userstreaks` (301k, `_id` only): `{userId}`
- `searchlogs`, `searchclicklogs`, `usertracks`: every index except `_id`, including the TTLs
- `notificationdeliverylogs`: `{expiresAt}` TTL
- `apx_orders_new` `{user_id}`, `apx_transactions` `{event, created_at}` (import-only)

Whether each `customer_id` index is needed on a single-tenant database should be checked against the query before
building on 164M rows. The first `userquestionanswers` index and both `scores` indexes back per-student test pages.

## 7. Order of work

Before launch, in this order:

1. N1 Firebase project. Nothing about push can be tested until this is right.
2. P4 indexes, and duplicate-mobile check.
3. N2 wave sending, plus the app-side jitter ask to the Flutter team.
4. P5, P6, P7: body limit, log lines, timeouts. Small changes, large effect.
5. A1, A2: session cache and the Home flush.
6. P1: crons out of the API process, then cluster mode.
7. N3, A3, D1, D3: the four queries that scan whole collections per call.
8. OTP throttle and the three open routes.
9. P3: `.241` repaired and `maxStalenessSeconds` set.
10. A load test at 30k requests a minute steady with a 200k-a-minute app-events burst, against a staging copy.
    Nothing here has been load-tested; every capacity figure above is an estimate from quicktricks' numbers.

After launch: N4–N8, A4–A9, D2, D4–D8, own box and own replica set.

## 8. Not covered

Live class sockets and the encoder at 3–5x concurrent viewers, the test-submission services (pm2 101/102,
RabbitMQ), CDN and playback, payment internals, and the Flutter app. Push-token counts and duplicate mobiles were
not read (the read was blocked in this session): run `reference/scripts/tenant-push-audience-check.cjs`.
Most findings sit in code shared with quicktricks; per the tenant rule they are reported here and not changed there.

Scripts added: `reference/scripts/tenant-scale-compare.cjs`, `reference/scripts/tenant-push-audience-check.cjs`.
