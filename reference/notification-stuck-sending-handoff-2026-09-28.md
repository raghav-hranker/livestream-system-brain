# Handoff — "Class Has Started" notification stuck in `sending` (2026-09-28)

**Status:** open, cause unknown. Students were NOT affected — every targeted phone got the push.
Only the admin row is wrong. Related fix already live: the delivery-log indexes
(memory `notification-delivery-log-indexes`).

## The row

| field | value |
|---|---|
| `_id` | `48f9086f84e0d259d15dd1fc` (quicktricksdb.notifications) |
| title / course | "Class Has Started! 🔴" — Class 129, Reasoning Prime Batch (2026-27), course `6a4558e3ebb42f585d9a9b0f` |
| class | `6ab73b5dddd6e0349b12fc01` |
| created | 10:33:20.896Z (16:03:20 IST), `status:'scheduled'`, `classLifecycleEvent:'started'` |
| last write | `updatedAt` 10:33:33.940Z → `status:'sending'` (the atomic claim), never touched again |
| deliveries | 504 delivery-log rows, all `success`, `sentAt` 10:34:08Z (4) + 10:34:13Z (500) — the full paid audience (the "Starting Soon" reminder for the same course reached 505) |
| counters | `recipientCount/successCount/failureCount` all 0, no `sentAt`, no `error` |

Siblings from the same webhook, both fine: `c70386f511e55d5e927ed6e3` (Railway, claimed 16:03:20 by
the webhook dispatch) and `4fcaef22c853d283ed7b3aa8` (Maths+Reasoning, claimed 16:04:00 by the cron);
both marked `sent` together at 16:11:15 IST, right after the index build.

## How these rows move (code, quicktricks-backend)

- `src/services/classLifecycleNotification.service.ts` — on stream-status `live`, upserts one
  notification per course assignment (`_id` = sha256 of class/assignment/event), `status:'scheduled'`,
  then `dispatch()` → `processScheduledNotifications({classLifecycleOnly:true})`.
- `src/cron/notificationScheduler.ts` — claim loop: `findOneAndUpdate({status:'scheduled',…},{status:'sending'})`,
  logs `--- Processing notification <id> ---`, then `runNotificationSendJob` → `markAsSent` / `markAsFailed`.
- `src/cron/classNotificationCron.ts` — the same claim loop every minute (:00), **and once at process boot**.
- Every send-path log line carries `[notification-<id>]`.

A row stuck in `sending` with complete deliveries means: something claimed it, ran the FCM send to
completion (or nearly), then never reached `markAsSent` **or** `markAsFailed` — i.e. the process died or
hung after sending. Nothing recovers `sending` rows (same shape as orphan `6ab114528c5c58798e7da890`,
"testing", 2026-09-21, 0 deliveries).

## Ruled out (with evidence)

- **pm2 27 `quicktricks-backend` did not process it.** `grep -c 48f9086f84e0d259d15dd1fc
  ~/.pm2/logs/quicktricks-backend-{out,error}.log` = 0/0, while its siblings appear (16 and 10 lines).
  Its only claims in the window: c703… at 16:03:20 (dispatch) and 4fca… at 16:04:00 (cron). Uptime
  since 2026-09-27 16:22Z — no restart.
- **Only one `live` webhook** for the class: 16:03:20 in pm2 27 (`stream_status.write … "live"`), plus
  `preparing` at 16:03:14. No retry reached pm2 27.
- **No other log on the prod box** (148.113.49.18) mentions the id — searched every pm2 `*out*.log`
  (last 800 MB each). pm2 28 socket restarted 10:39:27Z, but the livestream repo has no notification code.
- **test-uday** (`gcloud compute ssh --zone asia-south1-a test-uday --project genial-analogy-477417-r7`):
  `grep -lF <id> ~/.pm2/logs/*.log` — no hit.
- **Not a test-Firebase laptop:** all 504 sends succeeded, so the sender held the **prod** FCM key
  (`quick-tricks-sahil-sir`); a test-ranker key would fail every prod token with mismatched-credential.
- Replica set healthy at the time (3 members up).

## Hypotheses (ranked)

1. **A second LMS instance with prod DB + prod FCM creds and crons on**, started (or cron-ticked on a
   skewed clock) at ~10:33:33Z, then stopped/killed before `markAsSent`. The boot-time
   `processScheduledNotifications` call makes "process started at 16:03:33" a perfect fit. Candidates:
   a client-team machine or server running the fork with the prod `.env.development`, a canary, a
   one-off script that imports the cron module. *Prediction:* the mongod slow-query log shows the
   10:34:08–13Z delivery-log upserts from a `remote` IP that is not 148.113.49.18.
2. **pm2 27 claimed it but its log lines were lost** (9.8 GB log, heavy app-events spam). *Prediction:*
   the slow-query `remote` IS 148.113.49.18 — then look at why pm2 27 never called `markAsSent`
   (an exception in `markAsSent` itself would land in `markAsFailed`… which would also have written).
3. **Claim succeeded server-side but the client saw an error** (pool starvation under the COLLSCAN load),
   and a different loop iteration or process sent it. Weakest — something still had to run the send.

## Next step (the decisive one)

The delivery-log writes for this row were COLLSCANs on ~635k docs (indexes were built only at ~10:40Z),
so they are certainly in mongod's **slow-query log** with the client address:

- On the Mongo primary at 2026-09-28 10:33–10:35Z, find `"Slow query"` entries with
  `"ns":"quicktricksdb.notificationdeliverylogs"` and `notificationId` `48f9086f84e0d259d15dd1fc`
  (also the claim: `findAndModify` on `quicktricksdb.notifications` near 10:33:33Z). Read `attr.remote`.
- Mongo access: prod primary is reached from the OCI bastion (memory `reference_oci_mongo_bastion`,
  `~/pdf-migration/uri.primary`, directConnection). mongod's own log file needs a shell on the DB host;
  `db.adminCommand({getLog:'global'})` only holds the last ~1024 lines — too short now.
- Then map the IP → host, and on that host find the process and its log for 10:33Z.

## Follow-up findings (2026-09-28 ~11:20–11:50Z, read-only)

**Verdict so far: a process other than pm2 27 sent it (hypothesis 1).** Hypothesis 2 is effectively out.
The sender's host is still not named, because the two decisive reads were blocked by the auto-mode classifier (below).

- **The slow-query log is gone.** `getLog global` on the primary (.241) covers only 11:22:15–11:22:16Z (946M lines written).
  Profiling is off (`was:0`). The mongod log file on the DB host is the only remaining copy, and we have no shell there.
- **Delivery-log `_id`s identify nothing.** Every delivery-log row since 09-26 carries the same ObjectId process part `c27ac1b3e9`,
  including rows from before pm2 27's last restart, so the server generates these ids on upsert.
- **Timing fingerprint shows a different writer.** For every one of the 504 rows, `createdAt − sentAt` is 2–3 ms (avg 2.99).
  Across ~70 class-lifecycle sends since 09-26, all by pm2 27, the average never goes above 1.23 ms, and that includes both siblings
  (0–1 ms over 3,606 rows).
- **It also used a separate connection pool.** The server inserted this row's logs 2–39 s after they were built
  (built 10:34:09→13Z, inserted 10:34:11→52Z per `_id` timestamps). At the same moment pm2 27's writes queued 4–7 min
  (c703: built 10:33:23, inserted 10:37:32; 4fca: built 10:34:02, inserted 10:39:27–10:41:15).
  One process with one backlogged pool would not show both patterns.
- **The claim time (10:33:33.94Z) is not a cron tick** (node-cron fires at :00). So this was a boot-time pass, a
  webhook `dispatch()` in another LMS (a stream-status `live` arriving ~13 s after the box's), or a skewed clock.
- **Ruled out: this Mac.** Its egress is 148.113.47.103. Two local LMS servers point at prod: :3110
  (`worktrees/qt-csearch-local-test`, since 09:42Z) and :3113 (`quicktricks-backend-wt-videopos`, since 09-26). Both run
  `DISABLE_CRONS=true` under `readonly-guard.cjs`, which rejects `findOneAndUpdate`/`bulkWrite` at the driver.
  `/tmp` holds no log with the id, and no Claude session started a server between 10:20 and 10:36Z.
- **Other LMS-shaped clients on `quicktricksdb` right now** (a `$currentOp` sample of IP + namespace only):
  - **test-uday 34.47.203.51**: 72 Mongoose 8.24.3 connections, touching `apxingestjobs`. It runs
    `quicktricks-backend` (up since 09-19), `quicktricks-vod`, `dlqConsumerRunner` and `usertestapp`. It has a single
    pm2 home, `/home/raghav/.pm2`, plus pm2-logrotate, so rotated or compressed logs may have escaped the earlier `grep *.log`.
  - **testing-server-selectionway 34.131.242.233**: touching `apxtestusertokens` / `apxunresolvedtestusers`.
  - **178.63.88.34**: unidentified (not in the GCP project), touching `apxingestjobs`.

  Any of these that runs the notification crons or receives the class webhook, holds the prod FCM key, and died or hung
  after ~10:34:52Z fits the evidence.

**Blocked, needs the user (run with `!` or allow):**
1. On test-uday, for `quicktricks-backend` and `quicktricks-vod`: the DB name in `MONGO_URI`, `DISABLE_CRONS`,
   the Firebase `project_id`, pm2 restart times, and `zgrep -l 48f9086f84e0d259d15dd1fc ~/.pm2/logs/*` (rotated `.gz` included).
   Repeat on 34.131.242.233, and identify 178.63.88.34.
2. Recipient diff between this row (504) and the same course's "Starting Soon" `6aba3f50213713cbd1349010` (505).
   A different token-selection result would also fingerprint a different code version.

**Whatever the host turns out to be:** a non-prod LMS on the prod DB needs `DISABLE_CRONS=true`. It also
still runs the webhook `dispatch()` path when a class webhook reaches it, so point it at a non-prod DB and drop the prod FCM key.

## Cleanup (needs a go — prod write)

Mark the row with its real outcome so the admin page stops spinning:
```js
db.notifications.updateOne(
  { _id: ObjectId('48f9086f84e0d259d15dd1fc'), status: 'sending' },
  { $set: { status: 'sent', sentAt: ISODate('2026-09-28T10:34:13Z'),
            recipientCount: 504, successCount: 504, failureCount: 0 } })
```
Do the slow-log lookup first if you want untouched evidence (the row itself is not evidence the log needs).

## Systemic follow-ups (not this row)

- No reaper for orphaned `sending` rows (this one + `6ab114528c5c58798e7da890`): e.g. a sweep that marks
  `sending` rows older than N minutes `failed`/`sent` from delivery-log counts.
- `DISABLE_CRONS=true` is the only guard against a second instance claiming prod jobs — any fork checkout
  run with the prod `.env.development` competes for them.
