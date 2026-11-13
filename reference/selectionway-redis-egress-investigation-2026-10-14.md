# SelectionWay Redis egress increase — 2026-10-14

## Finding

High-confidence cause of the recent egress step: the October 11 course-class-set cache deployment (`21000c10`, followed by `389093d7`). It moved repeated course structure reads from MongoDB to Redis, but every cache hit transfers the full class ID list and duration map to an API worker. There is no process-local cache or request-level sharing in this path.

This explains the recent network-egress step in the supplied screenshot. The separate operations spike around late September/early October has not been attributed by this investigation.

## Evidence

- Console database `13562540`, subscription `2911808`, endpoint `redis-19504.c45830.ap-south-1-mz.ec2.cloud.rlrcp.com:19504`; the deployed SelectionWay API's configured endpoint matches. Credentials were not printed.
- Weekly chart on October 14: Sunday October 11 08:06 showed 2.45 MB/s egress and 426.05 ops/s; 10:06 showed 5.35 MB/s and 541.04 ops/s. These console times appear to be UTC (the latest chart time matched UTC at observation): approximately 13:36 and 15:36 IST. Egress increased 118%, operations 27% across these points. The points bracket the cache commit timestamps, 14:47–14:51 IST. Commit times alone are not exact rollout times; repository memory separately records deployment that day, and SSH confirms the commits are deployed.
- Ten-second Redis INFO sample: 4,492,287 output bytes/s; 593.2 commands/s; 50.1 MGET/s; 101.1 GET/s; 295.7 HGETALL/s; 0.8 PUBLISH/s; zero evictions.
- A separate simultaneous ~10.2-second Redis INFO + Linux socket-counter sample: Redis output 4,102,207 bytes/s. Eight `selectionway-server` connections received 3,784,366 bytes/s (~92.3%); two `live-chat` connections received 250,501 bytes/s (~6.1%). All other consumers and measurement differences account for the remainder. Redis output and received socket bytes are different measurement surfaces, so shares are approximate.
- Bounded SCAN: 25 iterations, COUNT 2000, MATCH `course-class-set:*`; two returned cache entries were 21,341 bytes / 362 classes and 51,746 bytes / 878 classes. These are samples, not a full key census or an average weighted by request frequency.
- The API source has only one `.mGet(` call, in `src/services/courseClassSetCache.ts:65`, introduced by `21000c10`.
- `src/controllers/courseProgressController.ts:35` concurrently calls `calculateCourseProgress` and `calculateWatchTime`; both independently call `getCourseClassSet`, transferring the same cached course structure twice. For the sampled 878-class course, that is approximately 103 KB per warm progress request before RESP overhead.
- Batch course progress and classes-completed endpoints also fetch full class sets, including duration maps that their completion-count calculations do not need.
- Console shows approximately 2.21 GB used of 5 GB and recent Redis latency near 0.05 ms. These observations do not indicate memory or command-throughput exhaustion as the cause of the bandwidth step.

## Hypotheses assessed

1. Larger responses from the new course cache: supported by deployment timing, source behavior, MGET rate, measured payload sizes, and dominant API network traffic.
2. Increased socket/pubsub fan-out: not the dominant source in the measured interval; SelectionWay live chat accounts for about 6% of total egress. The database is shared with other services, including QuickTricks, so its name does not imply exclusive tenancy.
3. More traffic or a shift toward existing large cached responses: may contribute, but operation growth at onset is much smaller than bandwidth growth; new full-set reads provide a specific mechanism for the additional bytes.

## Limits

No historical per-key byte counters or before/after controlled production experiment were available. Current API attribution is directly measured; attribution of the incremental bytes specifically to course-class-set reads is high-confidence inference from independent evidence, rather than a measured per-key percentage. No MONITOR session, app instrumentation, restarts, writes, or deployments were performed.

Redis Cloud's CLIENT LIST response omitted per-client `tot-net-out` and `tot-cmds`, so it could not provide byte deltas. Linux `ss` counters supplied the application attribution instead. Field semantics are documented in the [Redis CLIENT LIST reference](https://redis.io/docs/latest/commands/client-list/).

## Recommended correction

Keep the Mongo load reduction. First share one class-set fetch between progress and watch-time calculations within a request. Then consider a small, bounded process-local cache for these shared course structures, with explicit freshness and invalidation behavior across the eight workers. Avoid fetching duration maps in count-only paths where possible. A longer Redis TTL alone reduces rebuilds and writes but does not remove bytes transferred on cache hits.

Verify any correction with matched-traffic Redis egress, API socket bytes, MGET rates, and progress-result parity; account for cache invalidation after class assignment or duration changes.

## Follow-up: QuickTricks connection failures

The user identified `quicktricks-socket` as the affected app. Read-only SSH checks confirm:

- App online, current process started 2026-10-14 08:17:53 UTC (13:47:53 IST); PM2 cumulative restart count 315. This count is lifetime metadata, not the number of restarts in today's incident.
- At 13:47:59 IST, several socket `joinRoom` handlers and message-history reads failed with `read ECONNRESET`.
- At 13:48:09 and 13:48:19 IST, both Redis pubClient and subClient PING probes exceeded 5000 ms. At 13:48:29, pubClient reached three failures and the watchdog forced a reconnect; it logged reconnected at 13:48:30.
- The deployed watchdog probes every 10 seconds, reconnects after three failed 5-second probes, and exits the process if probes continue to fail after its allowed heal. PM2 then restarts it. This converts Redis/client stalls into socket-server restarts.
- A fresh diagnostic connection from the same QuickTricks host subsequently returned ten PINGs at 3 ms each. Current INFO showed 49 connections, 2.21 GB memory, zero rejected connections, zero evicted keys, and zero total error replies. Two blocked clients were present; CLIENT LIST also showed XREADGROUP consumers, so this count alone is not evidence of a hung server.
- Newest available slowlog entries did not cover today's disconnect window. They include unrelated previous-day KEYS calls around 0.5 seconds; these do not establish today's cause.

The increased SelectionWay bandwidth is a plausible contributor to contention on the shared Redis deployment. It is not proven to have caused the QuickTricks resets. Current health observations cannot exclude a transient earlier problem. Redis server/proxy logs or simultaneous measurements during the next incident are needed to distinguish network/provider resets, Redis resource pressure, slow subscribers, and application-client stalls.

The deployed watchdog source documents similar hangs on September 23, predating the October 11 cache deployment. Thus the new cache cannot explain the original occurrence of this failure mode, though it may worsen it.

Redis can close a subscriber connection when pending output buffers exceed configured limits ([Redis client handling](https://redis.io/docs/latest/develop/reference/clients/)). Aggregate MB/s alone does not demonstrate such a buffer limit was reached, and the Cloud CLIENT LIST response did not expose the necessary buffer counters.

Recommended next steps: reduce redundant SelectionWay cache transfers; isolate QuickTricks realtime traffic on a Redis deployment shared by all QuickTricks socket/encoder peers; and capture fresh-connection PING plus existing-client progress during a recurrence before treating a watchdog restart as proof of either an app bug or a provider outage. No production configuration or code was changed.
