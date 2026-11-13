# Capacity estimate: a 10x-quicktricks project on the quicktricks infrastructure

Date: 2026-10-21 (measured 23:50–00:05 IST, off-peak; peak-hour figures derived from the 27 h request log and the 2026-10-11 incident)
Question: can a new project with ~10x quicktricks' load run on webserver2-2 + the rs0 Mongo cluster, or does it need new infra?

## Verdict

**No for MongoDB, conditional yes for the app box.** rs0 is already cache-miss bound at 1x (the 10-11 incident saturated a secondary at quicktricks + selectionway load), its 500 GB volumes cannot hold a 10x dataset, and the oplog window would shrink from 29 h to ~3 h. The app box has CPU and RAM headroom for 10x only if the backend runs in pm2 cluster mode and pm2 logs get rotated (the disk is at 85% with 103 GB of pm2 logs).

Recommendation: new, dedicated infrastructure for the 10x project, at minimum a dedicated Mongo replica set. Sharing the app box is technically possible but puts five other tenants in the blast radius.

## Quicktricks today (the 1x baseline)

| Metric | Value | Source |
|---|---|---|
| Registered users | 768,617 | users.estimatedDocumentCount |
| Daily active users (sent app events, 24 h) | ~91,000 | appevents distinct userId |
| Users watching classes (24 h) | ~11,400 | classprogresses distinct userId |
| Signups | ~1,000/day, 43,877 last 30 d | users by _id |
| API requests | 6.98 M in 27 h = **71 req/s average** | pm2 out log |
| API peak hour | **136 req/s** (20:00–22:00 IST) | per-hour histogram |
| API peak minute (bursts) | **1,124 req/s** (20:50 IST) | per-minute histogram |
| API latency | mean 30 ms, p50 5 ms, p95 112 ms, p99 405 ms | 349k sampled |
| 5xx rate | 0.02 % | health check |
| Writes to Mongo | appevents 2.42 M/day, notificationdeliverylogs 1.27 M/day, userquestionanswers 1.0 M/day, classprogresses 41 k/day, orders 2.4 k/day | _id-range counts |
| quicktricksdb | 232 collections, 203 M docs, 181 GB uncompressed, **55 GB on disk (21 GB data + 33.5 GB indexes)** | dbStats |
| Live socket connections (off-peak) | 485 on :8082, one process | ss |

## Component by component

### 1. App box webserver2-2 (AMD EPYC 4344P, 8 cores / 16 threads, 62 GB RAM, 878 GB disk; 23 pm2 apps, 6 tenants)

| Metric | Today | At 10x | Headroom |
|---|---|---|---|
| Whole-box CPU busy | 3 % off-peak; load avg 0.7–1.0 all day | ~25–40 % of 16 threads if the new backend is multi-process | OK |
| quicktricks-backend CPU | 8–12 % of one core at 38 req/s → ~0.26 % per req/s → ~36 % at the 136 req/s peak hour | 1,360 req/s needs ~3.5 cores sustained, 8+ in bursts | **One Node process caps at ~380 req/s of this mix. 10x is impossible in fork mode; needs pm2 cluster with 6–8 workers** |
| RAM | 24 GB used, 38 GB available; backend RSS 0.9–2.0 GB | 8 workers × 1–2 GB = 8–16 GB | OK, but the backend has a heap-OOM history |
| Disk | **85 % used, 127 GB free**; pm2 logs 103 GB (quicktricks out log 84 GB, growing ~3 GB/day; no pm2-logrotate) | ~30 GB/day of logs | **Fills in ~4 days at 10x; ~40 days at 1x** |
| Apache (mpm_event) | 611 established, MaxRequestWorkers 20,000, 925 threads | ~6,000 established | OK (30x) |
| Network | 5 Mbit/s in, 4.6 Mbit/s out | ~50 Mbit/s | OK (media is on CDN, not the box) |
| Open files | 1,048,576 per process; 3,106 established box-wide | ~31,000 | OK |

Cluster-mode caveats found in the code: the backend has 23 cron registrations (`DISABLE_CRONS` exists, so crons can be pinned to one worker) and ~188 in-process `Map`/cache sites that become per-worker (stale caches, per-worker rate limits). `ecosystem.config.js` already says `cluster`/`max`, but prod runs fork ×1.

### 2. Socket server (quicktricks-socket, one process, Redis Cloud adapter)

| Metric | Today | At 10x | Headroom |
|---|---|---|---|
| Concurrent connections | 485 off-peak (peak during a live class not measured) | ~5,000 off-peak, 20–50k during live classes | One socket.io process handles ~10k; 10x needs several processes **with sticky sessions** (pm2 cluster alone does not give this behind Apache) |
| Adapter | Redis Cloud GCP Pro, plan size unknown; stalled 8x/day on the AWS plan until 10-16 | 10x pub/sub fan-out | Unknown; must be sized separately |

### 3. MongoDB rs0 (3 × mongodb-cluster2-N: 12 cores, 31 GB RAM, 15 GB WiredTiger cache, 500 GB disk, Mongo 8.0.17)

| Metric | Today | At 10x | Headroom |
|---|---|---|---|
| Cache | **12/15 GB full on all members**; quicktricks indexes alone are 33.5 GB, more than twice the cache | needs ~150 GB+ cache per member | **None. Already miss-bound at 1x** |
| Disk reads into cache (secondaries) | 140–173 MB/s, 1,500–1,900 pages/s **off-peak**; the 10-11 incident hit 850 MB/s, 1,297 active + 335 queued readers | 1.4–1.7 GB/s off-peak | **None** |
| mongod CPU | 0.4 (primary) / 0.8 / 0.65 cores off-peak; ~3× that at peak hour | 15–30 cores per member | **Over the 12 cores per node** |
| Reads | 100–184 ops/s per member, mean 4–5 ms on secondaries (0.3 ms on primary where the cache is warm) | 1,000–1,800/s per member | ~3x at best |
| Writes (primary) | 45/s off-peak, mean 6.8 ms; 4.7 M docs/day | 47 M docs/day; 450/s off-peak, ~1,600/s peak hour, 10k+ bursts | ~2–3x; appevents' 13 GB index is not cache-resident, so write latency climbs fast |
| Oplog window | 29 h | **~3 h** | A secondary down for more than ~3 h needs a full resync (two multi-hour member outages happened on 09-22 and 10-01) |
| Storage | 95 GB total on disk; primary at 60 % of 500 GB (unrotated logs), secondaries 26 % | 10x quicktricks steady state ≈ 550 GB per member; growth ~10–13 GB/day | **Does not fit at all**; primary runs out in ~2 weeks of full 10x growth |
| Connections | 1,684 of 23,916 (quicktricks box 427, selectionway 831, test-uday 207) | +1,000 | OK |
| Tenants sharing it | quicktricksdb, selectionwaydb, vidyagramdb, sandsdb, testrankingDB, adminPanelDB | | Every 10x slow query becomes a six-tenant incident |

## What a 10x deployment needs

1. **Dedicated Mongo replica set** for the new project. Size for the working set, not the ops: at quicktricks' 55 GB on disk per 1x, plan 3 nodes with 16–32 cores, 128–192 GB RAM (cache 64–96 GB), 2 TB NVMe, oplog sized for 48 h+. Add TTLs on event/log collections from day one (appevents and notificationdeliverylogs are 64 % of quicktricks' disk).
2. **App tier in cluster mode from day one** (6–8 workers, crons pinned to one worker, caches moved to Redis), with pm2-logrotate. Whether it sits on webserver2-2 or its own box is a blast-radius decision; a separate box is cleaner given webserver2-2's 220-day uptime, 85 % disk and five other tenants.
3. **Socket tier horizontal** (several processes, sticky sessions, Redis adapter plan sized for the fan-out).
4. Independent of the new project, webserver2-2 needs log rotation now: 127 GB free, 3 GB/day of quicktricks logs, 103 GB already in `~/.pm2/logs`.

## Caveats

- Measured off-peak (23:50 IST, 38 req/s); peak-hour numbers are scaled by the 27 h request histogram (×3.6) and cross-checked against the 10-11 incident. A sample during a 20:00–22:00 IST live class would tighten the socket and Mongo peak figures.
- "10x" was applied to request rate, write volume and data size alike. A project that is 10x in users but lighter on events (app-events are 26 % of quicktricks' backend time and 51 % of its daily inserts) would stress Mongo less, but the cache and disk conclusions hold for anything above ~2–3x.
- Mongo `$top` per-database shares on the secondaries were unusable (known: time deltas there are not physically consistent).
