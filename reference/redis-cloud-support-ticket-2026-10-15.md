# Redis Cloud support ticket draft — per-connection stalls, account "hranker"

**Subject:** Individual client connections stop receiving replies for 30–60 s while the database stays healthy (two databases, four incidents, 13–15 Oct 2026)

**Severity:** High (production live-class chat; recurring)

## Account and databases
- Account: hranker (console user Deepak Sharma)
- Subscription 2911808, database 13562540 `database-selectionway`, Pro, AWS ap-south-1, 11,500 ops/sec, endpoint `redis-19504.c45830.ap-south-1-mz.ec2.cloud.rlrcp.com:19504` (13.206.236.148), Redis 7.4.3
- Subscription 3448813, database 14690512 `database-quicktricks`, Pro, AWS ap-south-1, 3,000 ops/sec, replication on, endpoint `redis-15232.c72606.ap-south-1-mz.ec2.cloud.rlrcp.com:15232` (13.234.240.182), Redis 8.6.2, created 14 Oct 09:33 UTC
- Client hosts: 148.113.49.18 and 148.113.35.99 (OVH), node-redis 4.7.1 / @redis/client 1.6.1, no TLS, public endpoint

## What happens
A single busy client connection (our highest-throughput connection, roughly 275 ops/s and 2.4 MB/s of replies, heavily pipelined) stops receiving any reply for 30–60 s. PINGs sent on that connection time out. In the same seconds, other connections from the same host to the same endpoint, including a pub/sub subscriber, keep working, and a pub/sub heartbeat from a second host on the same database arrives every 30 s with latency under 2.5 s. The affected process is alive and logging throughout. On 13 and 14 Oct, API worker connections from 148.113.35.99 were additionally closed by the server side (`Socket closed unexpectedly`) or reset (`read ECONNRESET`) at single points inside the same windows, one connection at a time.

Your console metrics for 13562540 at 1-minute resolution show the database itself was fine: ops never below 335/s, connections flat at 48–49, latency 0.3–1.1 ms, zero evictions, and the SLOWLOG has no entries in any of the windows. What the metrics do show is **egress collapsing while ops stayed normal**, for example 681 ops/s with 0.18 MB/s egress at 13 Oct 10:20 UTC against 4 MB/s normally. Replies were executed but not delivered to the heavy clients.

The problem followed our application onto the new, dedicated database 14690512 one day after we migrated to it, which rules out noisy neighbours on 13562540.

## Exact windows (UTC)
| Date | Window | Database | Client IP | Observed |
|---|---|---|---|---|
| 2026-10-13 | 10:17:53–10:20:30 | 13562540 | 148.113.49.18 | pubClient silent; process exited 10:18:28 and 10:19:39 (our watchdog) |
| 2026-10-13 | 10:20:05 | 13562540 | 148.113.35.99 | one API worker connection: `read ECONNRESET` |
| 2026-10-14 | 07:57:48–08:18:30 | 13562540 | 148.113.49.18 | pubClient silent repeatedly; our process exited 08:00:13, 08:02:49, 08:04:46, 08:05:55, 08:07:41, 08:11:17, 08:17:53; first real `ECONNRESET` on a fresh connection at 08:17:59 |
| 2026-10-14 | 08:05:43 | 13562540 | 148.113.35.99 | one API worker connection: `Socket closed unexpectedly` (server-side FIN) |
| 2026-10-14 | 08:08:29 | 13562540 | 148.113.35.99 | one API worker connection: `read ECONNRESET` |
| 2026-10-14 | 09:24:09–09:24:59 | 13562540 | 148.113.49.18 | pubClient silent 30 s, then reconnect |
| 2026-10-15 | 06:00:12–06:00:57 | **14690512** | 148.113.49.18 | pubClient silent 45 s on the dedicated database; subscriber connection from the same host unaffected |

## Questions
1. Do the proxy (DMC) logs for endpoints 13.206.236.148:19504 and 13.234.240.182:15232 show anything for connections from 148.113.49.18 and 148.113.35.99 in these windows: client-side closures, resets, output-buffer limit hits, backpressure, or connections paused for not reading?
2. Is any per-connection limit applied at the proxy for pipeline depth, outstanding requests, or output buffer size that would stall or close a single heavy connection while others continue?
3. Was there any proxy restart, shard migration, failover, maintenance, or network event on either subscription in these windows? The system log shows none since 11 Aug 2026.
4. Does the proxy apply throughput-plan enforcement per connection rather than per database, and could that produce a 30–60 s stall on the busiest connection at 600–700 ops/s database-wide?

## What we have ruled out on our side
- Shard execution: SLOWLOG empty in all windows; latency metric stayed sub-millisecond.
- Process freeze: the stalled process logged 10–70 lines per second throughout each silence.
- Connection age: dead connections ranged from 18 hours to 3 days.
- Database-wide outage: other connections from the same host and from a second host were fine at the same seconds.

We are capturing kernel TCP socket state (receive/send queues, unacked bytes, retransmits, time since last receive) every 2 s on 148.113.49.18 and will attach the capture of the next stall. Please tell us which additional client-side data would help (for example `CLIENT ID`/`CLIENT INFO` of the stalled connection, which we can log at stall time).

Contact: Raghav Sharma, raghavsharma@hranker.com
