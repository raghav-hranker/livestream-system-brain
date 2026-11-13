# Retire the shared Redis `database-selectionway` (redis-19504)

Status: `needs-info` (D2–D4 + D6 open; D1 resolved 2026-10-29, D5 resolved 2026-11-11). Drafted 2026-10-29. Nothing changed in prod.

Redis Cloud subscription 2911808 / database 13562540, `redis-19504.c45830.ap-south-1-mz.ec2.cloud.rlrcp.com:19504`
(AWS Mumbai), Pro 11,500 ops/s, 5 GB, ~$234/month base. SelectionWay and quicktricks realtime have left it. The goal is
to move the remaining consumers off and then delete the database. Toppers is leaving too (user, 2026-10-29), so
SelectionWay and toppers get no move: the database is deleted once they stop using it.

Evidence: client map and per-process map in
[shared-redis-19504-stall-analysis-2026-10-14.md](../../reference/shared-redis-19504-stall-analysis-2026-10-14.md)
(sections "Client refresh" and "Per-process map", 2026-10-29).

## Who must move (excluding SelectionWay and toppers)

| Consumer | Where | Role on this Redis | State it needs |
|---|---|---|---|
| `b2-secure-job-manager` (pm2 13), `vid-transcoder-stats-server` (12) | GPU box 178.63.88.34 | **Transcoder job queue**: pops `queue:{critical,high,normal,low}`, writes `job:*`; containers write results back via `REDIS_HOST` / `CONTAINER_REDIS_HOST` | queued jobs + recent `job:*` |
| `video-listener` (21, `vg-upload-0165c25`) | GPU box | Vidyagram 781 upload lane: Cloudflare queue → `rPush queue:<priority>` | none |
| `b2-video-listener` (14, apx line) | GPU box | Polls `client-561-queue` → `queue:normal` | none. **D3: is this lane SelectionWay-only?** |
| Live encoders that push 1C HLS→MP4 jobs (`lib/ecs.js`, `GPU_REDIS_*` → falls back to `REDIS_*`) | quicktricks GCP encoder + socket `.env` on webserver2-2; Vidyagram encoder (VM currently TERMINATED) | `rPush queue:critical`, connects lazily per job | none |
| `futurekul` (2), `futurekul-obs` (15), `livestream-powermind-2` (16) | GPU box | Livestream pub/sub bus + room state | moderation keys (`rtmp:blocked:/<client>/…`, `privateMode:*`, `user:<n>:reports`) if they matter |
| `powermind` (1) | GCP `powermind-livestream` 34.131.108.130 | Same bus as `livestream-powermind-2`; the two must move **together** | as above |
| unknown, 3 conns | GCP `livestream-testing-raghav-clone` 34.131.70.79 (ssh + IAP time out) | publish/subscribe | **D2: what is it?** |
| 1 conn, EVAL every ~5 s, 58 d old | OCI bastion 92.4.88.60 | APX tooling or an ops-console monitor | **D4: identify** |

## What is in the database (RANDOMKEY sample, 3,000 keys, 2026-10-29)
4.62 M keys, 2.19 GB, 2,774 with a TTL. About 97% is historical chat/session data from every tenant ever on it:
`message:<uuid>` 75%, `private:chat:*` 10%, `private:user:*` 9%, `user:sessions:*` 4%. None of that is migrated.
Live state is small: `queue:normal` held 65 jobs at sample time (others 0), `job:*` a few thousand,
plus per-client moderation keys. **No bulk copy: start the new Redis empty, carry only the queue and wanted keys.**

## Target (decided 2026-11-11: share the quicktricks database)
**User, 2026-11-11: use the existing quicktricks database `database-quicktricks-gcp`** (Pro subscription `3451665`,
database `14696536`, `redis-14293.c72764.asia-south1-mz.gcp.cloud.rlrcp.com:14293`, GCP asia-south1, noeviction,
AOF every second, 1 GB, 3,000 ops/s). A second database in that subscription was priced at ~$125–250/month extra
(the subscription is already over its $200 minimum, so every added shard is billed) and turned down as too much.
Sharing costs nothing extra; deleting 19504 then saves ~$234/month.

The risks of sharing and the guard for each (all required before any 19504 client points here):

| Risk | Guard |
|---|---|
| The GPU box (unfixed root RTMP shell injection, memory `gpu-box-rtmp-shell-injection`) would hold a password that can read quicktricks chat, bans and the End path | **One ACL user per role, never `default`**: `transcoder` (GPU box manager, stats-server, listeners, 1C pushers) limited to the queue keys (`queue:*`, `job:*`, `processing:*`, plus whatever the manager touches, listed from `video-transcoder/gpu-server/job-manager/redis-client.js` before creating the rule) and no dangerous commands (`-@dangerous`: no `KEYS`, `FLUSHALL`, `CONFIG`). Set up under Redis Cloud Data Access Control. Confirm the console accepts key patterns per role before cutover. |
| `KEYS` blocks the quicktricks socket | Only one call is left: `redis-client.js:497` `keys('processing:client:*')`, run once at manager start (`manager.js:80`). On this ~130k-key database it takes milliseconds (the 2.4 s was on 19504's 4.6 M keys). Replace it with `SCAN` anyway, because the ACL above refuses `KEYS`. |
| futurekul/powermind cross-talk: livestream pub/sub channels `rtmp:endStream`, `rtmp:roomEvent`, `rtmp:streamUpdate` are global (`backend/lib/rtmpRedisHelper.js`, `backend/rtmpserver-2.js:414-470`). Every subscriber runs `blockStreamReconnect` and, when `sessionId` is missing, `doStreamCleanup` for every endStream on the database, so quicktricks' End would reach futurekul encoders and the reverse | **Do not move futurekul/powermind here until the channels take a namespace prefix** (env like `STREAM_STATUS_NAMESPACE`, default empty so quicktricks keeps today's names; futurekul/powermind set their own). Their keys (`rtmp:blocked:/<client>/…`, `privateMode:*`, rooms) are client- or class-scoped, so only the channels need it. Until then they stay on 19504, and 19504 cannot be deleted. |
| Vidyagram 781 upload lane (`video-listener`, Vidyagram encoder 1C pusher) would write to quicktricks' Redis, against the tenant rule "nothing for Vidyagram may affect quicktricks" | **D6, open:** needs the user's explicit OK. The transcoder queue is already one queue serving 472 and 781 (one job-manager), so it lives wherever the manager does; with the `transcoder` ACL user it never touches quicktricks keys. |
| Load against 3,000 ops/s | Read the database's ops/s and memory in the console before and for a week after the transcoder move. |
| Endpoint IP moves (11-11: 8.234.93.19 → 8.234.78.100 broke webserver2-2 for 60 min) | Nothing new for webserver2-2 (already allowlisted). The GPU box, powermind and encoders have no egress filter. |

Credentials stay out of chat: the user creates the ACL users in the console and puts each password in macOS Keychain
(`redis-qt-transcoder`, later `redis-qt-futurekul`), or straight into the box env.

## Cutover order
1. **Remove the silent fallback first.** `PubSubManager.js` hardcodes redis-19504 when `REDIS_HOST` is unset (every
   livestream checkout). Make it fail at boot instead, so nothing lands on the old db by accident after the move.
2. **Guards** (see Target): `KEYS` → `SCAN` in the job-manager; user creates the `transcoder` ACL user on
   database-quicktricks-gcp. Smoke test from the GPU box and the Vidyagram encoder with that user: PING, rPush + DEL of a
   test key under `queue:`, one refused `KEYS` and one refused read of a quicktricks key, latency.
3. **Transcoder (one window, low upload hour).** Stop both listeners → wait until `queue:*` is empty and the manager has
   no running job → copy any remaining `queue:*` and the last N days of `job:*` (DUMP/RESTORE) → point
   `REDIS_HOST` in manager, stats-server and listeners at the new Redis →
   start. Then switch `GPU_REDIS_*` on every 1C pusher (quicktricks socket `.env` + GCP encoder; Vidyagram encoder env).
   For a few days run a sweep that moves anything new in old `queue:*` to the new Redis, to catch a pusher that was missed.
4. **Live encoders (no live class in progress), only after the channel namespace ships.** Switch futurekul, futurekul-obs, and both powermind processes
   (GPU box + GCP, together). Copy their `rtmp:blocked:/<client>/*` and `privateMode:*` keys if bans must survive.
5. **Watch** `CLIENT LIST` on redis-19504 daily (the 10-29 probe) until only SelectionWay and toppers remain.
6. **Delete** database 13562540 / subscription 2911808 once SelectionWay and toppers have stopped (both leaving). Before deleting,
   take an RDB export to R2 if any old chat history might be wanted.

## Decisions needed
- ~~D1 — toppers.~~ Resolved 2026-10-29: toppers is leaving; its socket (pm2 23 on webserver2-2) is not moved.
- **D2 — `livestream-testing-raghav-clone`.** Whose encoder is it, and should it run at all? (Started 10-29 07:00 IST.)
- **D3 — `b2-video-listener` / `client-561-queue`.** Docs point to 561 = SelectionWay (`hosts.md`: "SelectionWay 561
  encoder"; ops-console: 561 rooms live in `livestream.rooms`, transcoder `clientId` "561"; 695 = toppers). If so, this
  listener retires with SelectionWay instead of moving. Confirm by reading its `.env.b2` queue/bucket before stopping it.
  The ops-console stuck-classes check (written 10-28, not deployed) watches only 561 + 695, so it goes too.
- **D4 — bastion connection.** Identify the EVAL client before cutover; move or drop it.
- ~~D5 — target.~~ Resolved 2026-11-11: share database-quicktricks-gcp with guards (see Target). Earlier 10-29 choice
  (new managed db) and the 11-11 second-database idea were dropped on cost.
- **D6 — Vidyagram on quicktricks' Redis.** The 781 upload lane and the Vidyagram encoder's 1C pusher would write the shared
  transcoder queue on database-quicktricks-gcp. Needs the user's explicit OK under the tenant rule.
