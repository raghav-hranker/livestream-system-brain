# QuickTricks dedicated Redis — 2026-10-14

## Provisioning

User approved the Pro quote of $0.282/hour (approximately $206/month), plus network charges and taxes, and the refundable $200 card authorization held for seven days. Purchase submitted in Redis Cloud; subscription and database creation are visible in the console.

- Subscription: `3448813`, name `database-quicktricks`.
- Database: `14690512`, name `database-quicktricks`.
- Cloud/region: AWS Mumbai, `ap-south-1`.
- Dataset: 3 GB; total memory with replica: 6 GB.
- Initial throughput sizing target: 3,000 ops/sec.
- Multi-zone: enabled; subscription lists `aps1-az1`, `aps1-az2`, `aps1-az3`.
- Replication: enabled; persistence: append-only file every second.
- Eviction: off; Redis version: 8.6.
- Console: https://cloud.redis.io/#/subscriptions/subscription/3448813/bdb-view/14690512/configuration

At the initial post-purchase check, the database was provisioning and Connect was disabled. Do not treat purchase submission as a successful connection test or a completed application cutover.

Provisioning subsequently completed: the configuration page shows a green healthy status, Connect is enabled, and the public endpoint is `redis-15232.c72606.ap-south-1-mz.ec2.cloud.rlrcp.com:15232`. Database creation is complete; the production cutover completed later in the authorized post-stream window (see below).

3,000 ops/sec was selected as an initial capacity target: the existing shared database's observed hour-view peak was about 2,120 ops/sec, and QuickTricks is only one of its consumers. This is not a measurement of instantaneous QuickTricks reconnect-burst demand. The alternative 5,000 ops/sec quote was about $321/month. Redis uses the throughput setting to allocate compute and bandwidth; actual capacity depends on commands and payload sizes. Validate with QuickTricks workload measurements, especially roster responses, before relying on this capacity for peak load. See [Redis sizing guidance](https://redis.io/docs/latest/operate/rc/databases/configuration/sizing/).

## Production peers and cutover status

Both production peers were moved to the new endpoint after the user confirmed streaming had ended. The following endpoint observations describe preflight; completed cutover details are below.

- Hranker client socket: `148.113.49.18`, app `quicktricks-socket`, checkout `/var/www/socket.quicktricksbysahilsir.com/livestream/backend`, documented SSH identity `~/.ssh/hranker-webserver2-2`.
- GCP encoder: `livestream-testing-raghav`, zone `asia-south2-c`, checkout `/home/raghav/quicktricks-livestream/backend`, deployed Git commit `bfc1512`.
- Socket env read confirms old endpoint `redis-19504.c45830.ap-south-1-mz.ec2.cloud.rlrcp.com:19504` and `STREAM_STATUS_NAMESPACE=quicktricks`.
- GCP env read independently confirms the same old endpoint and namespace. Runtime Node v24.15.0 has the PM2 installation; Node v22.22.2 is also present.
- GCP PM2 preflight: `quicktricks-livestream` online, PID 708, cumulative restarts 0 at observation.

Move all QuickTricks socket/encoder peers together. Assess active classes and Redis key ownership before copying state or switching endpoints: the old deployment also holds unrelated tenants' data and has unprefixed legacy keys. Do not clone the entire shared database into the QuickTricks database. Preserve appropriate stream status, pending callbacks, chat/moderation state, and in-flight live-stream ownership; treat stale socket IDs and presence separately from durable state. Retain a rollback configuration and verify delivery across peers after switching.

## Context correction

The subscription listing identifies the existing `2911808` SelectionWay subscription as **Pro**, too. It is shared by applications, rather than known to be an Essentials deployment. Essentials quota documentation consulted during plan selection does not establish that the old subscription was hitting an Essentials bandwidth cap. The new Pro subscription provides separate infrastructure for QuickTricks; it does not by itself prove or resolve the original reset mechanism.

## Verified billing comparison

Subscription Overview pages subsequently verified:

- SelectionWay: 11,500 ops/sec, 5 GB configured dataset, high availability off, one Small (12.5 GB) Redis Billing Unit, $0.320/hour / $233.60/month base subscription price.
- QuickTricks: 3,000 ops/sec, 3 GB dataset plus replica, three Micro (1 GB) units for the primary and three for high availability. Each group costs $0.132/hour. Resource subtotal is $0.264/hour (~$192.72/month); the console applies a minimum subscription price of $0.282/hour / $205.86/month.

Prices are base subscription rates; network usage and taxes are additional. QuickTricks' 3,000 ops/sec subscription is currently cheaper in absolute dollars than SelectionWay. SelectionWay has a cheaper cost per configured operation because billing uses different capacity-unit sizes and it has no replica. The quoted QuickTricks 5,000 ops/sec option (~$321/month) is more expensive than SelectionWay; those configurations also differ in replication and billing units.

Reachability checks after provisioning: the GCP encoder resolves the new endpoint to `13.234.240.182` and receives Redis `NOAUTH Authentication required` (expected for an unauthenticated health probe). The Hranker socket server resolves the same IP but its TCP connection is refused. Repeated direct-IP checks confirm the difference. This does not yet establish which firewall or network component rejects the socket-server connection. Read-only `sudo -n ufw` and iptables inspection could not proceed because sudo requires a password. User believes the server team must add the new Redis destination/port to the firewall; production cutover remains pending that network check and authenticated connectivity tests.

After the user reported that the server team whitelisted the new Redis, another paired check still returned `ECONNREFUSED` from the Hranker socket host while the GCP encoder received `NOAUTH Authentication required` in 41 ms. Both resolved the same destination IP. `ip route get 13.234.240.182` on the socket host confirms outbound source `148.113.49.18` via gateway `100.64.0.1`, interface `enp8s0f0np0`. The rule to verify is outbound TCP from `148.113.49.18` to `13.234.240.182:15232` (hostname `redis-15232.c72606.ap-south-1-mz.ec2.cloud.rlrcp.com`). No production Redis configuration was changed.

After the admin suggested Redis-side allowlisting, fresh console checks confirmed database CIDR allow list **Off**, and subscription Security → Public endpoint access **Allowed**. No configured restriction was found in these settings to explain this source-specific refusal. A fresh paired test from the socket host returned Redis `NOAUTH` from the old IP/port in 6 ms and `ECONNREFUSED` from the new IP/port in 1 ms. An immediate refusal suggests a nearby rejection, but only a packet trace can establish whether the RST originates on the host, its upstream network, or the destination/provider. Do not treat the failure as a confirmed host firewall cause; do not change Redis network settings without identifying a relevant restriction. Evidence screenshot: `/private/tmp/quicktricks-redis-public-access.jpg`. Redis documents database- and VPC-level controls in [Network security](https://redis.io/docs/latest/operate/rc/security/database-security/network-security/).

SelectionWay's isolated cache-fix checkout exists at `/private/tmp/selectionway-cache-bandwidth-20261014`, branch `codex/selectionway-cache-bandwidth-20261014`, based on `389093d7`. No cache source changes have been made; this work is paused at the user's request to prioritize the Redis instance.

## Readiness testing after the network fix

User reported that connectivity succeeded, explicitly prohibited production changes ahead of the 16:00 IST stream, and authorized testing. Isolated low-volume tests subsequently passed from both production hosts against only the **new** Redis database. No live app config, processes, credentials, existing application keys, or production channels were modified.

Both hosts used their installed `redis` package v4.7.1. Socket host runtime was Node v22.22.2; encoder runtime was Node v24.15.0. An initial attempt encountered WRONGPASS because the browser's read-only DOM returned a redacted credential placeholder. The console's normal Copy control supplied the actual credential for the successful run; no password was printed or included in saved results. The temporary local credential file was removed afterward, and the clipboard was cleared/restored.

Each host passed 13 checks: authenticated PING; SETEX/GET/TTL; hash roster operations; set session operations; sorted-set presence operations; list message-history operations; MULTI/EXEC/MGET; NX locks and Lua compare-and-delete; Streams consumer group reads and acknowledgment; a 64 KiB synthetic payload round-trip; pattern Pub/Sub; reconnecting a test subscriber; and receiving a Pub/Sub message from the other host.

| Measurement | Socket server | Encoder |
|---|---:|---:|
| Authenticated connection setup | 251.48 ms | 125.00 ms |
| PING sample count | 30 | 30 |
| Median PING | 3.80 ms | 23.77 ms |
| p95 PING | 5.86 ms | 23.93 ms |
| Maximum PING | 8.15 ms | 23.95 ms |
| 64 KiB SETEX + GET round-trip | 22.08 ms | 143.77 ms |

Synthetic keys and channels used an isolated `__qt_readiness:{<unique run id>}` prefix, with 60-second TTLs for keys. Both hosts reported that all their test keys were deleted. Test clients disconnected afterward. Sanitized machine-readable evidence: [quicktricks-redis-readiness-2026-10-14.json](quicktricks-redis-readiness-2026-10-14.json).

These checks establish client authentication, basic command compatibility, small-sample latency, and Redis delivery across hosts. They do not validate 3,000 ops/sec under reconnect bursts, provider failover, the existing application's full Socket.IO lifecycle, production data migration, or the earlier stall's underlying cause. The user subsequently authorized the post-stream cutover; the completed migration and verification are recorded below.


## Completed production cutover

User confirmed streams had ended and authorized proceeding. The last QuickTricks stream (`6ace420dabbe7476bf6cf298`, client 472) completed VOD upload at 11:24:44 UTC; the LMS received `ended`, and its RTMP session was unregistered before stopping either service. No active QuickTricks RTMP session or reconnect grace state appeared in the scoped final inventory.

Both `.env` files and only the named PM2 saved process records now use `redis-15232.c72606.ap-south-1-mz.ec2.cloud.rlrcp.com:15232`, with `STREAM_STATUS_NAMESPACE=quicktricks`. Deployed source commits were unchanged. Only `quicktricks-socket` and `quicktricks-livestream` were stopped/restarted; other process records were hash-checked to remain unchanged.

Data ownership came from the authoritative `quicktricksdb` class collection: 8,299 class IDs. The copy selected room history, pinned messages, reports, private chat indexes and messages, related polls and user moderation/report state, current stream status, tenant pending-delivery state, and QuickTricks RTMP block markers. It excluded old socket sessions and viewer presence so they rebuild on reconnect. No shared-database flush, old-key deletion, or whole-database clone was performed.

The background copy and the final frozen copy each preserved **98,603 keys**, containing **97,057 indexed messages**, 11 referenced polls, history for 173 rooms, and 32,070,047 bytes of Redis dump payloads. All 98,603 final copied keys verified successfully. 2,831 keys required semantic comparison because source and destination Redis versions serialize equivalent data differently; all matched. No expired keys or changes during background-copy verification were observed. TTLs were retained, and private dump backups were saved before writing destination keys.

Both writers stopped at approximately 11:47:08 UTC. The socket was back around 11:48:56; the encoder returned at 11:50:50. The first encoder restart reported online without a PID because the remote command's PATH lacked Node (`spawn node ENOENT`). A second named-process restart with its Node v24.15.0 directory restored the runtime; that PATH is saved in only its PM2 record. Health checks subsequently require a real PID, not just an online label.

Initial verified process state:

- Socket: PID 2680552, cumulative restarts 316.
- Encoder: PID 101528, cumulative restarts 1.
- Both authenticated PINGs passed against the new endpoint.
- Redis clients from both host IPs appeared on the new database with six subscriptions per application subscriber and moderation Stream readers.
- Encoder startup confirmed both Redis clients connected, pending-status recovery in `quicktricks`, RTMP listening on 8937, HTTP on 8082, and the tenant moderation consumer running.
- Production Socket.IO test connected temporary clients to **both** public hosts and delivered a diagnostic event through the new Redis adapter to only their socket IDs. Both received it; no class-wide diagnostic broadcast was sent.

Private rollback/data backup directories (0700, files 0600):

- Socket: `/home/hranker/quicktricks-redis-cutover-20261014T112301Z`.
- Encoder: `/home/raghav/quicktricks-redis-cutover-20261014T112301Z`.

These retain original environment and named PM2 records; the socket directory also contains the selected-key manifest and pre-copy/final data dumps. The original shared Redis remains intact. A later rollback must account for writes made on the dedicated Redis after cutover; restoring the old endpoint alone would lose visibility of new messages, so freeze writers and sync the tenant's changed durable data back first if necessary.

The cutover isolates QuickTricks from SelectionWay's workload. It does not establish the original connection-reset cause or prove peak-load capacity. A fresh live stream remains the acceptance check for OBS, live status, viewer presence, chat/polls, End, recording finalization, and playback; no live stream was started for this migration. No LMS restart or application-source deployment was included.

Final repeated health checks at approximately 11:52:30 UTC confirmed both PIDs and restart counts remained stable, both saved PM2 Redis environments matched the new endpoint, and the filtered post-cutover logs showed no new Redis errors. Sanitized evidence: [quicktricks-redis-cutover-2026-10-14.json](quicktricks-redis-cutover-2026-10-14.json). Temporary local and remote duplicate credential staging files were removed; private original rollback configurations and data backups remain.


## Additional pre-stream application checks

At the user's request, temporary anonymous diagnostic viewers exercised the actual public application after migration. Both public WebSocket handshakes passed (263 ms socket host, 61 ms encoder from GCP). Both joined the already-ended class, received `streamUpdate: ended` and a boolean private-mode bootstrap, and retrieved 100 public history messages through `messageHistory`. Message contents and user data were not printed or saved.

Five targeted cross-server rounds passed, followed by ten more rounds over 50.268 seconds with zero unexpected disconnects. Fresh reconnects to both hosts continued receiving targeted events. The socket host's polling-only handshake also passed (183 ms). All diagnostic sockets disconnected, and both diagnostic identities were absent from the class viewer hash and session keys after cleanup. No synthetic chat message was sent into a real class. Process PIDs/restart counts remained unchanged and the filtered Redis startup/error checks showed no fresh Redis errors.

Evidence: [quicktricks-redis-prestream-tests-2026-10-14.json](quicktricks-redis-prestream-tests-2026-10-14.json). These are low-volume application smoke checks, not a peak-load test. The user subsequently supplied a running test class and completed the full video/End/VOD test below.


## Live acceptance completed before 18:00 IST

The user supplied `Testing Class 1234`, client 472 / class `6acf6dc3ddd65eabd8badc8c`, already streaming. The supplied teacher credential is not saved in this record.

Both hosts accepted diagnostic viewers, hydrated live status and returned chat history. The user's chat message reached both viewers with the same message ID. They remained connected for 90 seconds with no unexpected disconnects, then cleaned up their presence and session keys. No agent chat messages were posted. Browser live video played at 1280x720, readyState 4, no media error, advancing from 352.255346 to 402.466782 seconds.

The Redis snapshot showed 185 ops/sec, 170,442,320 bytes used memory, zero evictions, zero rejected connections, zero error replies and no pending statuses. This is a small observed workload, not a peak-load guarantee.

The user clicked Stop. At 12:09:41 UTC the encoder explicitly killed FFmpeg (SIGKILL); its command-failure log corresponds to that intended stop. All VOD playlists uploaded and the LMS accepted ended at **12:11:15 UTC / 17:41:15 IST**. Redis then had no active RTMP session or pending deliveries. The authoritative LMS held ended and the VOD master asset.

The page automatically returned to recording playback at 1280x720 without a media error, advancing from 38.345522 to 76.289969 seconds, with an observed duration about 476 seconds. Final checks retained socket PID 2680552/restarts 316 and encoder PID 101528/restarts 1; both PINGs and saved restart configuration checks passed. No service restart or production change was performed during testing.

The next user-advised stream starts at **18:00 IST**. No further production changes or restarts are planned before it. Evidence: [quicktricks-redis-live-tests-2026-10-14.json](quicktricks-redis-live-tests-2026-10-14.json).
