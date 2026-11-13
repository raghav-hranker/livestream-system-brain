# Shared Redis (redis-19504) connection stalls — evidence, 2026-10-13/14

Investigated 2026-10-15 01:40–03:00 IST from logs on three hosts plus read-only INFO/SLOWLOG on the old instance.
All times IST unless marked. Old instance = `redis-19504.c45830.ap-south-1-mz.ec2.cloud.rlrcp.com` (13.206.236.148),
Redis Cloud subscription 2911808, database 13562540, Redis 7.4.3, process uptime 394 days, 4,487,090 keys, 2.14 GB.

## Who uses the old instance (confirmed by live TCP connections + env files)
| Host | Network | Clients |
|---|---|---|
| Hranker box 148.113.49.18 | OVH | quicktricks-socket (until 17:17 cutover; still `GPU_REDIS_HOST`), topperswisdom socket (pm2 23), vibhagexam socket env (no live conn seen) |
| SelectionWay host 148.113.35.99 | OVH | selectionway-server ×8 workers, live-chat (2 conns), speed-maths env |
| GPU box 178.63.88.34 | Hetzner | selectionway-livestream, futurekul, futurekul-obs, powermind-2 encoders (3 conns each), b2-secure-job-manager, stats-server, shorts-callback |
| OCI bastion 92.4.88.60 | OCI | 1 connection, 43 days old, active every ~5 s (apx completion tooling) |
| GCP encoder 34.131.52.223 | GCP | quicktricks-livestream (until cutover); unreachable tonight (ssh + IAP time out) |

## Timeline
- 10-13 15:47:53 quicktricks pubClient PING timeouts → watchdog exits 15:48:28, 15:49:39. SW API **worker 0 only**: `read ECONNRESET` at 15:50:05 (1,032 queued-command errors). Worker 0 hit 1 GB memory cap 16:06.
- 10-14 13:27:48 quicktricks pubClient silent (process alive: 10–50 log lines/s throughout; load normal at ~120 connects/min). Watchdog exits 13:30, 13:32, 13:34, 13:35, 13:37, 13:41, 13:47; each fresh connection stalled again within 1–6 min. 13:47:59 real ECONNRESET. SW API **worker 3**: socket closed 13:35:43; **worker 0**: ECONNRESET 13:38:29. Workers 3 and 0 hit the memory cap 13:52/13:53. 14:54:29 one more quicktricks exit.
- live-chat (same SW host, same instance): 2,880/2,880 heartbeats on 10-14, max 2.3 s, zero reconnects.
- Old instance SLOWLOG (128 entries back to 08-12): nothing in any window. `rejected_connections 0`, `total_error_replies 0`, no evictions.
- GPU box: no restarts in either window (pm2.log, pm2-monitor.log); logs lack timestamps so per-connection errors can't be timed.
- 17:17–17:18 quicktricks cut over to dedicated `redis-15232`; 19:35 ×2 = client team's manual deploy restarts; zero Redis errors since.

## What this rules in / out
- Shard healthy throughout (slowlog, counters, live-chat). Not a Redis command stall, not KEYS blocking.
- Not a quicktricks event-loop freeze (log lines continuous through the 25 s of silence).
- Not a connection-lifetime cutoff (dead connections aged 18 h to 3 d).
- Not an all-clients proxy restart/failover (live-chat and 6 of 8 SW workers untouched).
- Survivor connections on all three hosts show ordinary retransmit rates (0.02–1%).
- Left standing: something between client and shard that silences, closes or resets **individual busy connections** for ~3–20 min windows: the Redis Cloud proxy layer for that endpoint, or the OVH→AWS Mumbai path (both affected hosts are OVH; the Hetzner box can't be timed). Needs the Redis Cloud console (connections/latency/throughput at 1-min resolution, database event log) and the OVH manager (anti-DDoS mitigation on 148.113.49.18 / 148.113.35.99 at 10-13 10:17 UTC and 10-14 07:57–08:20 UTC), or a Redis support ticket for proxy logs.

## Separate hazards found on the old instance
- Wildcard `KEYS` scans over 4.5 M keys: `KEYS *` 2.4 s (10-07), `KEYS *<classId>*` 2.2 s (10-09), `KEYS processing:client:*` / `queue:*` / `*intake-*` / `*hls-*` 0.4–1.7 s — transcoder job-manager/intake and livestream cleanup paths. Each blocks every tenant for that long.
- `PubSubManager.js` in every livestream checkout hardcodes this host as fallback; quicktricks still points `GPU_REDIS_HOST` at it.
- 4,487,090 keys with only 3,264 TTLs; AOF rewrite every ~12 h takes 40 ms.
- The watchdog's exit-on-stall turns each stall into a 1,700–2,700 reconnect herd that re-floods the same path.

## Redis Cloud console, read 2026-10-15 02:20–02:45 IST (metrics API at 1-minute resolution, times UTC)

Database 13562540 is Pro, 11,500 ops/sec plan, 5 GB, noeviction, AOF every second, no CIDR list, no TLS.

**10-14 window (quicktricks silence began 07:57:48Z = 13:27:48 IST)**
| UTC | total ops/s | egress MB/s | ingress KB/s | avg latency ms | conns |
|---|---:|---:|---:|---:|---:|
| 07:40–07:58 baseline | 600–650 | 3.9–4.9 | 300–350 | 0.045–0.06 | 48 |
| 07:46–07:49 | 851–1,232 | 4.6–4.8 | 350 | 0.08 | 48 |
| 07:59 (first stall) | 335 | 1.49 | 100 | 0.057 | 48 |
| 08:00–08:14 (herds) | 455–2,116 | 0.43–8.5 | 93–1,370 | 0.30–0.53 | 47–48 |
| 08:19–08:20 | 1,506–1,778 | 3.0–7.4 | 508–967 | 0.48–0.40 | 48 |
| 08:21 onward | 600–740 | 4–6 | 300–500 | 0.04–0.06 | 48 |

**10-13 window (quicktricks silence began 10:17:53Z = 15:47:53 IST)**
| UTC | total ops/s | egress MB/s | ingress KB/s | avg latency ms | conns |
|---|---:|---:|---:|---:|---:|
| 10:05–10:18 baseline | 550–725 | 3.8–4.8 | 300–415 | 0.05–0.07 | 49 |
| 10:16 | 573 | 3.9 | 416 | 0.50 | 49 |
| 10:19 | 394 | 1.15 | 108 | 0.11 | 49 |
| 10:20 (SW w0 reset 10:20:05) | 681 | **0.18** | 72 | 0.14 | 48 |
| 10:21–10:22 (herd) | 1,456 / 987 | 5.9 / 9.5 | 1,195 / 1,237 | 0.83 / 1.12 | 49 |
| 10:23 onward | 540–650 | 3.7–5.0 | 170–510 | 0.04–0.06 | 49 |

Reading: the shard never stopped (ops never below 335/s, 48–49 connections flat, 0 evictions, memory flat at 2.37 GB).
At each onset **egress collapsed while ops stayed in the hundreds**: replies stopped reaching the busy clients while the
database kept executing commands. Redis-side latency rose only 6–20× to 0.3–1.1 ms during the herds (KEYS scans on 10-09
06:20Z pushed the same metric to 6 ms, so a blocked shard would show far higher). The ~275 ops/s and ~2.4 MB/s that vanished
at 07:59Z is quicktricks' steady share of the old database: about 60% of its egress at that hour.

Six-day 1-minute scan (10-09 00:00Z to 10-14 20:40Z): the egress-collapse signature appears **only** in these two windows.
Other latency bumps (10-09 06:20Z = KEYS scans; 10-12 09:35Z; 10-13 09:45Z, 13:28Z, 17:27Z) had no egress collapse and no
client errors. Connection count moved with GPU-box process restarts (10-13 13:28Z to 59 then 44; 17:31Z to 26).

System log: only account/configuration actions; the last automatic maintenance on subscription 2911808 was 11-Aug-2026 19:11–19:29.
No maintenance, failover or shard event is logged for 10-13 or 10-14.

**Conclusion.** Database-side causes are excluded by the provider's own metrics. What remains is the Redis Cloud proxy
(DMC) layer for this endpoint or the OVH→AWS Mumbai path, acting on individual high-throughput connections. Only Redis
support (proxy logs for 13.206.236.148:19504 at 2026-10-13 10:17–10:22Z and 2026-10-14 07:57–08:21Z) or a packet capture
during a recurrence can split those two. Quicktricks is already off this database; the remaining tenants are still exposed.

## Recurrence on the dedicated instance, 2026-10-15 11:30 IST (06:00 UTC)

quicktricks-socket pubClient to `redis-15232` (dedicated, 18 h after cutover): probe failed 11:30:12, 11:30:22, 11:30:32 → forced
reconnect 11:30:32 (621 queued commands rejected, chatmod/privateMode/streamStatus caches fell back to LMS) → probe failed again
11:30:42, 11:30:52 → **recovered 11:30:57**, no process exit (restarts still 318). Process alive throughout (20–70 log lines/s).
subClient on the same host to the same endpoint: untouched. Load: 190–258 socket connects/min (normal for that hour), no large
message-history reads; a host pinned a message at 11:30:03. SelectionWay API and live-chat on the old database: zero Redis errors
all day. The stall therefore followed quicktricks onto a different database and did not touch the other OVH host.

Narrowed to: (a) the quicktricks pubClient itself (node-redis 4.7.1 / @redis/client 1.6.1, same versions on toppers, vibhag, SW API,
live-chat) stopping reading or writing its one heavily pipelined socket, or (b) the Redis Cloud proxy stalling that one heavy
connection. Both fit every observation so far; only a socket-level view during a stall separates them.

**Sampler running on the Hranker box** (started 12:14 IST 10-15, self-terminates after 48 h): `/home/hranker/qt_redis_sock_sampler.sh`,
pid in `/home/hranker/qt-redis-sock-sampler.pid`, log `/home/hranker/qt-redis-sock-sampler.log`, one `ss -tnoi` line per
connection every 2 s. At the next stall read the pubClient line (the one with large bytes_sent): Recv-Q growing while lastrcv
stays small = the client is not reading (node-redis side); Recv-Q 0 with lastrcv climbing past 5,000 ms and retrans rising =
nothing arriving (proxy or path). Send-Q/notsent growing with unacked = our writes are not being acknowledged (path).

## Caught in the act, 2026-10-15 15:26–15:37 IST: the Hranker box's network path to AWS Mumbai

The `ss` sampler (2-s samples of every quicktricks→Redis TCP socket) captured the fourth episode end to end. Verdict: **path
degradation between 148.113.49.18 and AWS ap-south-1**, not the node-redis client and not Redis.

- Receive queue on the stalled pubClient stayed **0** throughout: the process read every byte that arrived. Client-side stall excluded.
- Smoothed RTT on the long-lived pubClient: 3.0 ms at 15:27:35 → 75 ms at 15:27:37 → 125–170 ms through 15:28; retransmits 65 → 80 in
  40 s; `bytes_received` flat for 9 s (15:27:55–15:28:03) with `lastrcv` reaching 8.9 s; Send-Q 400–1,300 B with 2–7 unacked segments.
- The idle subscriber on the same host/endpoint degraded identically (RTT 54–160 ms, `lastrcv` up to 12.6 s). Fresh connections took
  0.65–3.2 s to complete the handshake (ports 50568/50574/50582/52972).
- Degradation window from the RTT timeline: **15:26:10 → ~15:37**, i.e. it began 100 s before the first watchdog failure. Max RTT per
  30 s: 100–170 ms baseline during the event, 921 ms at 15:28:50, 2.4–3.2 s from 15:29:30 to 15:30:40.
- Four smaller episodes the same day never tripped the watchdog: 12:20–12:22 (68 ms), 13:37–13:40 (114 ms), 14:38–14:41 (116 ms),
  14:53–14:56 (111 ms).
- Not the box: link 25 Gbit at 0.76 % utilisation, CPU 90 % idle, 0 NIC errors/drops (sar 15:20–15:30); mtr at 15:38 showed every OVH
  hop (100.64.0.1 → 10.133.50.x → 10.75.24.x → 10.75.248.x → 103.5.12.x → 10.200.4.5) at 0.2–5 ms; 1.1.1.1 at 2.3 ms.
- Not the other OVH host: 148.113.35.99 → old Redis RTT 2.4–3.4 ms at 15:37, zero Redis errors all day.
- Consequence chain: path RTT ×40 + loss → the busiest pipelined connection misses three 5-s PINGs first → watchdog heal → fresh
  connection inherits the same path → `maxHeals 1` → exit → pm2 restart → reconnect herd. Four exits 15:29–15:35 (restarts 318 → 322).

Signature to look for on the OVH side: a 3 ms → 100–170 ms RTT step for traffic between 148.113.49.18 and AWS Mumbai, lasting 2–11 min,
several times a day, with the same-DC neighbour unaffected. That is what anti-DDoS mitigation (VAC detour) or an edge/peering problem
scoped to this IP looks like. Windows to check (IST): 10-13 15:47–15:50; 10-14 13:27–13:50 and 14:54; 10-15 11:30, 12:20, 13:37, 14:38,
14:53, **15:26–15:37**.

Probes left running on the box (both self-terminate after 48 h from 10-15 ~12:14 / 15:40):
`/home/hranker/qt-redis-sock-sampler.log` (socket state) and `/home/hranker/qt-path-probe.log` (5-s TCP connect time to new Redis,
old Redis, 148.113.35.99:22 and 1.1.1.1:443, plus a 3-cycle TCP mtr appended whenever the new-Redis connect exceeds 50 ms).
At the next event: if `swhost`/`cf` rise with `new`/`old`, the whole box's path is hit (mitigation or uplink); if only the AWS targets
rise, it is the OVH↔AWS leg. The mtr block names the hop.

## Fifth episode, 2026-10-15 16:08–16:16 IST: the leg is OVH edge → AWS, and it is a detour, not congestion

Path probe (5-s TCP connect from the box) during the episode, three ~1-minute bursts (16:08:05–16:09:02, 16:11:09–16:12:03,
16:13:54–16:15:54): `new` (13.234.240.182:15232) and `old` (13.206.236.148:19504) both a **flat 108 ms** with SYN retransmits to
1.1–2.2 s; `swhost` (148.113.35.99:22, same OVH DC) 2–3 ms and `cf` (1.1.1.1:443) 4–8 ms throughout. Only the AWS leg is affected, so
not whole-IP anti-DDoS mitigation and not the box's uplink. Four TCP traceroutes captured inside the bursts: every OVH hop
(100.64.0.1 → 10.133.50.x → 10.75.24.x → 10.75.248.x → 103.5.12.x → 10.200.4.5) at 0.2–5 ms; the destination answered at 105–106 ms
(1,128 ms in one) with 67 % loss. The extra ~102 ms and the loss are added between OVH's edge (10.200.4.5) and AWS. A fixed +100 ms,
identical for two different AWS /14s, is a route detour (Mumbai↔Singapore and back is ~105 ms), not queueing. Both OVH boxes are in the
same announced prefix 148.113.0.0/18 (AS16276; RIPE visibility 327/327), so it is not a BGP announcement problem for this box's
addresses; it is the egress/peering path this box's pod hashes onto toward AS16509 ap-south-1. Watchdog: 3 heals + 1 exit (restarts 322 → 325).
A second probe now runs on 148.113.35.99 (`/home/livestreaming/sw-path-probe.log`, targets new/old/148.113.49.18:22/1.1.1.1) to show
whether the SelectionWay box's AWS leg detours at the same minutes.

## GCP route measurement, created 2026-10-15 23:30 IST
Free Essentials database `probe-gcp-mumbai` (id 14694857, subscription 3450852, Google Cloud asia-south1 Mumbai, Redis 8.6, 30 MB,
$0, no card hold) created only as a probe target. Endpoint `redis-19593.c330.asia-south1-1.gce.cloud.redislabs.com:19593`
(34.180.59.168). Added as `gcpr=` to both path probes (`gcp=` is the encoder VM 34.131.52.223:443 in Delhi). First samples:
SelectionWay host 12 ms; Hranker box timed out, to be checked against the outbound firewall that needed the AWS endpoint whitelisted on 10-14.
Decision rule: through the next episode, if `new`/`aws` rise and `gcpr` stays flat, a GCP Mumbai Pro database would bypass the fault;
if `gcpr` rises too, the exit itself is the problem and the socket server should move hosts instead. An Essentials database cannot be
upgraded to Pro in place; the production move would be a new Pro subscription in asia-south1 plus the 10-14 migration procedure.
Correction 23:40: the 28–126 ms `gcpr` readings were hostname resolution inside the probe; by IP the GCP Mumbai endpoint is 9–11 ms from
148.113.35.99 (AWS 7–11 ms), mtr reaches it in 4 ms via a different transit (hop 10 = 115.113.165.98, Tata) than the AWS path.
From 148.113.49.18 the connect is **refused after exactly ~1,023 ms** (retried SYN answered with RST, no local prohibit route): the
outbound middlebox again; the server team must whitelist 34.180.59.168:19593 for this host, exactly as for 13.234.240.182:15232 on 10-14.
Until then the Hranker `gcpr` column is blind. Both probes now use the IP.

## Verdict, 2026-10-16 12:15 IST: OVH Mumbai → AWS Mumbai route, datacenter-wide; GCP route clean

Overnight 10-15 the probes on **both** OVH hosts caught the same episodes: 19:49 (brief), 20:16–20:37 (bursts), 21:15–21:17 IST.
Per-minute medians during degraded samples, Hranker box: `new`/`old` (AWS Redis) 100–870 ms, `aws` (ec2.ap-south-1, non-Redis) 106–1,005 ms,
`gcp` (encoder VM, Google Delhi) 27–34 ms, `swhost` 2 ms, `cf` 4–5 ms. SelectionWay host, same minutes: `new`/`old` 91–623 ms, `aws` 91–877 ms,
`gcp` 29–37 ms, `hrbox` 5–7 ms, `cf` 7–9 ms. Four more watchdog exits (20:17, 20:18, 20:30, 21:16; restarts 325 → 331 incl. deploys).
50-cycle TCP traceroutes (8 captures): OVH hops 0.2–5 ms; destination 13.234.240.182 at 104–240 ms avg with 54–74 % loss during
episodes, 3.5 ms and 54 % (ICMP-style rate limit at the last hop) at 19:49 baseline. The problem is the OVH→AWS ap-south-1 leg for the
whole OVH Mumbai site, every AWS destination, both of our hosts. Google destinations (Delhi VM, and from 10-16 the GCP Mumbai Redis at
6 ms via Tata 115.113.165.98) are unaffected. Hranker→GCP Redis whitelisted 10-16 morning (6–8 ms).

Implications: (1) a Redis in GCP asia-south1 would bypass the failing leg; (2) OVH ticket should say "OVH Mumbai to AWS ap-south-1,
both 148.113.49.18 and 148.113.35.99, all AWS destinations"; (3) Redis Cloud ticket #173604 can be closed with this; (4) SelectionWay's
own AWS Redis traffic crosses the same leg and will keep taking occasional single-connection resets until it also moves or the leg is fixed.

## Direct confirmation, 2026-10-16 12:55–13:01 IST (gcpr live from the Hranker box)
Episode with watchdog exits at 12:53:00 and 12:56:48 (12:51:51 was a client-team deploy, code 0). Hranker probe, every sample 12:55:49–13:00:49:
`new`/`old` 104–107 ms with SYN retries to 1.1–2.2 s, `aws` (ec2 control) 105–1,164 ms, **`gcpr` (GCP Mumbai Redis 34.180.59.168:19593) 5–7 ms throughout**,
`gcp` (Delhi VM) 23–34 ms, `swhost` 2 ms, `cf` 4–6 ms. The exact endpoint type a migration would use was unaffected during a full episode
from the box that runs the socket server. Decision evidence complete: a Pro Redis Cloud database in GCP asia-south1 bypasses the failing leg.

## Client refresh, 2026-10-29 15:33 IST (read-only CLIENT LIST, 20 s sample, creds = `GPU_REDIS_*` in the socket `.env`)
4,620,705 keys (2,774 with TTL), 2.19 GB. Totals over 20 s: out 111 KB/s, in 73 KB/s, 59 cmds/s (10-14: ~4 MB/s out).
Per-client `tot-net-out` reads 0 through the Redis Cloud proxy, so the per-host split is not measurable this way.

| IP | Box | Conns (subscribed) | Commands seen | Age |
|---|---|---|---|---|
| 178.63.88.34 | GPU / transcoder box | 16 (14) | subscribe, get, del, eval, rpush, publish | 6–16 d |
| 148.113.35.99 | Selectionway app box | 10 (2) | ping, hdel, setex, del, get, exec | 16 h–3 d |
| 148.113.49.18 | Hranker box (webserver2-2) | 2 + this probe | smembers, psubscribe | ≤ 2.7 d |
| 34.131.70.79 | GCP `livestream-testing-raghav-clone` (asia-south2-c) | 3 (6 subs) | publish, subscribe | 8.6 h |
| 34.131.108.130 | GCP `powermind-livestream` (asia-south2-b) | 3 (3 subs) | publish, subscribe, rpush | 1–7 h |
| 92.4.88.60 | OCI bastion | 1 | eval | 58 d |

Changes since 10-15: both GCP encoders above are new to this list; the GCP quicktricks encoder (34.131.52.223) is gone;
`livestream-cpu` / `livestream-cpu-new` (SelectionWay 561) and `vidyagram-livestream` are TERMINATED in GCP.
### Per-process map, 2026-10-29 ~15:50 IST (`ss -tnp dst 13.206.236.148:19504` on each box)
| Box | pm2 (id) | Path | Conns |
|---|---|---|---|
| GPU box | `selectionway-livestream` (3) | `/root/livestream-gpu` | 3 |
| GPU box | `futurekul` (2), `futurekul-obs` (15), `livestream-powermind-2` (16) | `/root/livestream-futurekul*` | 3 each |
| GPU box | `b2-secure-job-manager` (13) | `video-transcoder/gpu-server/job-manager/manager.js` | 1 |
| GPU box | `vid-transcoder-stats-server` (12) | same dir, `stats-server.js` | 1 |
| GPU box | `b2-video-listener` (14) | `/root/video-transcoder/dist` (apx line) | 1 |
| GPU box | `video-listener` (21) | `/root/releases/vg-upload-0165c25` (**Vidyagram 781 upload lane**) | 1 |
| Selectionway app box | 8 × `nodejs-server/dist/app.js` cluster workers (no pm2 name in env) | `/home/livestreaming/nodejs-server` | 1 each |
| Selectionway app box | `live-chat` (53) | `/home/livestreaming/livestream` | 2 |
| webserver2-2 | `socket` (23) = topperswisdom socket | `/var/www/socket.topperswisdom.com` | 2 |
| GCP `powermind-livestream` | `powermind` (1) | `/home/raghav/livestream-futurekul` | 3 |
| GCP `livestream-testing-raghav-clone` | not mapped: ssh and IAP both time out | c4-standard-8, last started 10-29 07:00 IST (= connection age) | 3 |
| OCI bastion | not checked (1 conn, 58 d, EVAL) | | 1 |

No quicktricks process on webserver2-2 held a connection at sample time, although the socket `.env` still sets `GPU_REDIS_*` to this db (on-demand use not ruled out).
