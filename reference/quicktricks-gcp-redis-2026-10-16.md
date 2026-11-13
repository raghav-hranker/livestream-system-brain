# QuickTricks Redis → Redis Cloud Pro on GCP asia-south1 — 2026-10-16

Why: the OVH Mumbai → AWS ap-south-1 route degrades several times a day for both OVH hosts; the GCP Mumbai Redis
stayed at 5–7 ms from the Hranker box through every episode
([stall analysis](shared-redis-19504-stall-analysis-2026-10-14.md), verdict + 12:55 direct proof).
Procedure: a repeat of the [10-14 cutover](quicktricks-dedicated-redis-2026-10-14.md) with a GCP destination.
Evidence: [quicktricks-redis-gcp-cutover-2026-10-16.json](quicktricks-redis-gcp-cutover-2026-10-16.json).

## 1. Provisioning (purchased 13:54 IST, endpoint live by 14:33 IST)

User signed in to the console in the built-in browser and approved the purchase. The form was compared field by field
with the AWS database 14690512 first: same Pro plan, multi-AZ, 3 GB dataset (6 GB with replica), HA on, 3,000 ops/sec,
AOF every second, Redis 8.6 with auto minor upgrades, RESP3, all capabilities, QPF Standard, Redis hashing policy,
OSS cluster API off, public endpoint allowed, automatic maintenance. After creation: eviction "no eviction",
CIDR allow list off, default user on, remote backup off, alert thresholds identical to the AWS database.

- Subscription `3451665` (console auto-name `PRO-gcp-asia-south1-MVAP4HDV`), Google Cloud asia-south1.
- Database `14696536`, `database-quicktricks-gcp`.
- Price: 3+3 Micro (1 GB) RBUs, $0.340/hr, minimum $248.2/month (AWS: $0.282/hr, $205.86) plus network and tax;
  $200 card hold on the Visa ending 0739, released after 7 days.
- Public endpoint `redis-14293.c72764.asia-south1-mz.gcp.cloud.rlrcp.com:14293`, resolved IP `8.234.93.19` (same from the Mac,
  the socket host and the encoder); private endpoint `redis-14293.internal.c72764…:14293`. Provisioning took under 40 min.

GPU_REDIS_HOST stays on the old shared `redis-19504` (user, 13:50 IST: the GPU job manager is not moving).

## 2. Network preflight

14:33 IST, unauthenticated TCP + PING by IP: encoder `-NOAUTH` in 59 ms; socket host `ECONNREFUSED` in 1 ms
(the outbound filter, same signature as 13.234.240.182:15232 on 10-14 and 34.180.59.168:19593 on 10-15).
Whitelist requested from the server team: outbound TCP 148.113.49.18 → 8.234.93.19:14293. Server team confirmed
14:39 IST; socket host then got `-NOAUTH` in 9 ms on 3/3 attempts (connect + PING).

Readiness (the 10-14 13-check test, new database only, `__qt_readiness:{20261016T0900Z}` keys with 60 s TTL, both
hosts concurrently): **13/13 on both**, test keys removed on both. Password handed over by the user into a 0600 local
file (32 chars, never printed).

| Measurement | Socket server | Encoder | (10-14 AWS: socket / encoder) |
|---|---:|---:|---:|
| Authenticated connection setup | 983.7 ms | 102.92 ms | 251 / 125 |
| Median PING (30) | 4.48 ms | 22.1 ms | 3.80 / 23.77 |
| p95 / max PING | 6.18 / 6.26 ms | 22.36 / 22.44 ms | 5.86 / 8.15, 23.93 / 23.95 |
| 64 KiB SETEX + GET | 25.23 ms | 132.9 ms | 22.08 / 143.77 |

The socket host's one-off connect setup (~1 s, vs 251 ms to AWS) is not yet explained (DNS or first handshake through the new filter rule); steady PINGs match AWS. Recheck at cutover.

## 3. Cutover preparation

Run id `20261016T0900Z`; private run directories `/home/hranker/quicktricks-redis-cutover-20261016T0900Z` (socket host)
and `/home/raghav/quicktricks-redis-cutover-20261016T0900Z` (encoder), 0700, files 0600.

Source census of the AWS database at ~13:45 IST: 133,018 keys, 195 MB.
Pre-inventory (~13:57 IST, 8,316 authoritative class ids from `quicktricksdb.classes`): 123,621 keys selected —
118,050 messages, 193 room histories, 83 room report sets, 5 pinned, 351 private chat indexes, 468 private user indexes,
3,689 `privateMode:current`, 11 polls (+counts, votes), 192 RTMP block markers, 3,259 users' block/report sets,
current stream status for every class, pending-delivery index (0 pending), `chatmod:events:quicktricks`.
Excluded (rebuild on reconnect): 8,615 `user:sessions:*`, 761 `room:*:currentViewers`, 8 `host:sessions:*`,
active `rtmp:session`/`rtmp:grace` (the final copy refuses to run while one exists).
Change from 10-14: `privateMode:current:<class>` is now copied; the 10-14 selection omitted it.

Prepare (15:15 IST, both hosts, no service touched): deployed heads unchanged (`e4e942a` socket, `bfc1512` encoder);
`.env.before`, PM2 target record, log offsets and staged `.env.next` written to the 0700 run directories. Staged envs
differ from the live ones only in REDIS_HOST/REDIS_PORT/REDIS_PASSWORD; STREAM_STATUS_NAMESPACE=quicktricks and
GPU_REDIS_HOST=redis-19504 unchanged. Cross-version DUMP/RESTORE probe (AWS → GCP, 30 s TTL, deleted) read back equal.
Socket PID 532010 / restarts 335 at prepare: the +1 since 13:42 is a watchdog exit at 13:48:54 IST (code 1 via SIGINT,
pubClient reconnected 13:49:32) during the 13:00 class — another AWS-route episode.
Pre-copy deferred until the 15:00 class (live at 15:17) ends, so the bulk DUMP does not load the AWS database under it.
Pre-copy 16:01 IST (RTMP clear): 125,247 keys, 39.0 MB, all verified (3,766 by semantic comparison), 43 s. Inventory runs in 12 s.

## 4. Window and cutover (done 16:04:31–16:05:49 IST)

The user approved switching in the afternoon gap (overriding "nothing within an hour": a teacher was holding a class
for the switch). The 15:00 class's RTMP session had ended at 16:00:27; its status was still `processing` — accepted risk,
see follow-ups. Check 16:04:31 (no RTMP session) → both writers stopped 16:04:33 → final inventory (12 s, guard refuses
any active RTMP session) → final frozen copy **125,257 keys** (119,598 messages, 3,742 private-mode, 11 polls,
196 rooms, 195 RTMP block markers, 39.0 MB), all verified, 49 s, 0 expired → both `.env` files swapped and only the two
named PM2 records saved → both online 16:05:49. **Outage 76 s.** Encoder came up with a PID first time (the 10-14 PATH fix
held).

Health (16:06): socket PID 1231175 / restarts 336, encoder PID 91384; both PINGs, saved PM2 configs, namespace
`quicktricks`; GCP CLIENT LIST shows both host IPs with a 6-channel subscriber each; encoder log: RTMP 8937, pending
recovery in `quicktricks`, both Redis clients, chatmod consumer; no Redis errors. Mesh: a diagnostic event through the GCP
adapter reached temporary sockets on both public hosts.

Live acceptance — user OBS demo class `testing 25` (`6ad1fdefe8c911cfd7a6203d`): preparing 16:07:01, live 16:07:08.
Diagnostic viewers on both hosts got `live` + history; the user's 2 chat messages reached both with the same ids; 90 s,
no disconnects, presence cleaned. User clicked End: OBS stop → reconnecting 16:11:02 → `endStream` reached the encoder via
Redis 16:11:12 → processing → **ended 16:11:59**, 24 VOD playlist uploads, LMS `streamStatus: ended`,
`hlsAsset.key …/playlist-mpl-vod.m3u8`, 0 pending deliveries.

Post-cutover restarts: someone logged in from 148.113.47.103 at 16:11 ran `pm2 restart 27 28 29 30` (16:11:34–48)
then `git pull`, and restarted the socket again at 16:12:55 (code 0 via SIGINT, i.e. manual — not the watchdog).
Config held: socket PID 1264505 / restarts 338, PM2 env + `.env` on GCP, socket HEAD still `e4e942a`; the AWS database
then had **zero clients**.

## 5. Rollback retention

AWS database 14690512 (sub 3448813) is untouched and kept until at least **2026-10-18 16:06 IST**; then it can be
deleted (user decision). Rollback = `control.cjs rollback` per role from the run directories (original env + PM2 record);
writes made on GCP after 16:05:49 must be copied back first. Probe database 14694857 stays (path probes use it).
`/home/*/quicktricks-redis-cutover-20261016T0900Z` still holds `new-redis.json` + `*.env.next` (credential staging) —
remove with `cleanup.cjs` once rollback is no longer wanted.

## Follow-ups (not done here)
- 15:00 class `6ac8ea244783067e4ff4f38d` stuck in `processing`: finalize claimed 16:00:27, no `playlist-vod` uploads
  before the 16:04 stop (the 13:00 class and the demo produced them within ~45 s). Pre-existing. The user reports
  the recording plays (from the live `playlist.m3u8`, segments were uploaded live), but at 16:25 the LMS still holds
  `processing` and the live playlist as hlsAsset, not a `playlist-mpl-vod.m3u8` — status/asset fix still needed.
- TLS + CIDR allow list on the GCP database (needs a static encoder egress IP and a client TLS option).
- Watchdog no-exit / command-timeout hardening card still stands.
- Optional: rename subscription `PRO-gcp-asia-south1-MVAP4HDV` → `database-quicktricks-gcp`.

## Check 2026-10-17 20:30 IST

Scheduled read-only check (ran 21:38 IST, ~29.5 h after the 16:05:49 cutover). Nothing changed on either host.

**Verdict: degraded (mild).** No crash exits, both hosts on GCP, but one watchdog probe failure and two short
Redis socket drops on the socket server.

Socket host (webserver2-2, quicktricks-socket id 28):
- `exited with code [1]`: **0**. Code-[0] SIGINT stops: **10** (10-16 16:11, 16:12, 16:18, 18:11, 20:10;
  10-17 12:11, 13:43, 13:58, 15:07, 20:47), all manual operator restarts.
- `[Redis Watchdog]` lines: **1**, `2026-10-17T05:04:26 pubClient: probe recovered after 1 failure(s)`, no exit.
- Redis error lines (excluding the boot-race "Socket already opened"): **15**, all `SocketClosedUnexpectedlyError`
  in two bursts: 10-17 15:47:35 (1 PubClient + 7 "fetching recent messages") and 15:57:51 (1 + 6). The client
  reconnected on its own, with no watchdog line and no restart.
- pm2: online, pid 829138, restart_time 346 (cumulative), up since 20:47:36 IST. PM2 env and `.env` REDIS_HOST =
  `redis-14293…gcp.cloud.rlrcp.com`.
- Path probe (`qt-path-probe.log`, 18,080 samples since cutover): `gcpr` baseline ~6 ms. **55** samples spiked to
  ~1,000 or ~2,000 ms, which looks like TCP connect retransmits. They were all single samples, mostly on 10-17
  12:00–19:00 IST (15:xx had the most, 14 samples). Two of them coincide with the socket drops (15:47:35, 15:57:47).
  The old OVH→AWS route
  degraded again: **247** samples with `new`/`aws` ≥100 ms (10-16 21:00–22:59 heavy, 10-17 00:xx, and 10-17 21:30–21:31
  up to 1,135 ms). During those episodes `gcpr` stayed ≤7 ms, so the move avoided all of them.

Encoder (livestream-testing-raghav, quicktricks-livestream id 1):
- `.env` and PM2 env REDIS_HOST = GCP host. pm2 online, pid 689, restarts 0, up since 10-17 01:30 UTC (preceded by
  a code-[0] SIGINT stop at 10-16 17:30 UTC).
- Redis errors since 10:35 UTC: **0** real errors. The error log only has the benign boot-race
  `PubClient/SubClient … Socket already opened` from the 10-16 10:35 and 10-17 01:30 starts.
- Classes: 76 "Stream status delivered" lines, including 18 `live`, 15 `ended`, and 12 `reconnecting`, so roughly
  15 classes ran on GCP Redis.

Open question: the `gcpr` connect spikes are new to the GCP path. If the socket drops recur or turn into watchdog
exits, an mtr from webserver2-2 → 8.234.93.19 during a spike would show which hop is losing packets.

## 48 h check 2026-10-18 16:10 IST

Scheduled read-only check (ran 16:10 IST, 48 h after the 16:05:49 cutover). Nothing changed on either host or in
Redis Cloud.

**Verdict: degraded (mild), by the task's rule.** No crash exits, both hosts on GCP, nothing on AWS, but the 48 h
window still holds the one watchdog probe failure from 10-17 05:04. **Nothing new since the 10-17 check:** the last
Redis error on either host is 10-17 15:57:51, so the last ~24 h are clean. AWS stays as rollback until the user decides.

Socket host (webserver2-2, quicktricks-socket id 28):
- `exited with code [1]`: **0**. Code-[0] SIGINT stops: **12** (the 10 listed on 10-17, plus 10-17 22:30:48 and
  10-18 13:46:21), all manual operator restarts. 12 "Stopping app:quicktricks-socket" lines match.
- `[Redis Watchdog]` lines (out log): **1**, `2026-10-17T05:04:26 pubClient: probe recovered after 1 failure(s)`.
  The error log has the matching `probe failed (1/3): pubClient PING timed out after 5000ms` at 05:04:21. No exit.
- Redis error events (excluding the "Socket already opened" boot race and stack frames): the same two
  `SocketClosedUnexpectedlyError` bursts as on 10-17 (15:47:35 and 15:57:51), plus the 05:04 PING timeout. None after 15:57:51.
  The remaining "Pub/SubClient not ready, attempting reconnection" lines all fall in restart minutes (boot race).
- pm2: online, pid 2204291, restart_time 348 (cumulative), unstable 0, up since 10-18 13:46:21 IST. PM2 env and `.env`
  REDIS_HOST = `redis-14293.c72764.asia-south1-mz.gcp.cloud.rlrcp.com`. (pm2 prints "In-memory PM2 is out-of-date";
  not acted on.)
- AWS rollback database (redis-15232, via `socket.env.before`, CLIENT LIST minus own connection): **0 connections**.

Encoder (livestream-testing-raghav, quicktricks-livestream id 1):
- `.env` and PM2 env REDIS_HOST = GCP host. pm2 online, pid 691, restarts 0, up since 10-18 01:30 UTC. Exits since
  10:35 UTC 10-16: two code-[0] SIGINT stops at 17:30 UTC each day (daily stop, start at 01:30 UTC).
- Redis errors since 10:35 UTC: **0** real errors. All 31 "not ready, attempting reconnection" lines and the 28
  "Socket already opened" lines are in the three boot minutes (10-16 10:35, 10-17 01:30, 10-18 01:30).
- 84 "Stream status delivered" lines since cutover.

Decision for the user: the strict "stable" bar (zero watchdog failures in 48 h) is missed only by the 10-17 05:04
probe failure, which recovered after one probe. If that is acceptable, AWS database 14690512 (subscription 3448813) can be
deleted by the user. Afterwards remove the credential staging files with cleanup.cjs and consider deleting the rollback
directories /home/hranker/quicktricks-redis-cutover-20261016T0900Z and
/home/raghav/quicktricks-redis-cutover-20261016T0900Z. Keep probe database 14694857.
