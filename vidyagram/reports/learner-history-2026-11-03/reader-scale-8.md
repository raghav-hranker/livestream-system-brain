# VG reader expansion — November 4, 2026

The user authorised increasing reader capacity after measured10-minute rates showed132 fully captured versus184 saved tokens, with130 pending/in-progress reads. The live baseline at16:31:15 IST was1,583 fully read and135 saved-token reads pending/in progress.

A guarded transaction stored the run beforeimage and baseline in `apx_vg_completion_tuning_events`, ID `vg-completion-20261104-overnight6000:reader-scale-4-to-8`, then changed only `plannedReaders` from4 to8 with a stage timestamp and baseline counters. No cohort, expiry, OTP, failure-policy or request-pacing changes were made.

Four read roles were started on existing Azure hosts migrator2 (`20.193.132.31`), migrator6 (`40.81.225.65`), migrator7 (`20.193.138.160`) and migrator8 (`20.40.44.181`). Existing readers remain on migrator, migrator3, migrator4 and migrator5. Eight distinct reader egress IPs now share the same two in-flight HTTP slots and1.5-second per-IP gap. Acquisition remains fourteen workers; shared admin gap1s, learner pause30s, jitter0–250ms, original6k cohort and end-of-day cutoff are unchanged. The GPU remains excluded due management SSH timeouts; test-uday remains excluded.

Only existing tested worker roles were launched; no application logic changed. Atomic job claims, cached-token-only reader code, lock-protected launchers and existing source403/429 stops remain in force. The local fleet launcher inventory was updated to retain all eight reader roles on future authorised starts.

## Initial verification —16:32:22 IST

All fourteen acquisition/eight read roles had fresh running heartbeats. Total fully read reached1,615. Since the expansion baseline,32 learners finished reading while20 tokens were saved; the backlog fell from135 to123 in approximately68 seconds. All215 completion GETs and the admin/send/verify calls in this window were HTTP/API200 with no transport codes. Raw failure/deferral counters stayed12/9. This confirms initial backlog drainage, not a sustained-hour throughput estimate.

Monitor16:43:30 IST:1,933 fully read, only5 saved-token reads pending/in progress versus135 at expansion baseline, all22 worker roles fresh. Raw failure/deferral counters unchanged12/9; no403/429 or transport errors. Recent admin307 reads recovered without stopping the run. No tuning action taken by the monitor.

## New transport event —16:46:58 IST

The16:53 monitor found one OTP-send TypeError on migrator10 at16:46:58.002 IST, elapsed253ms, with safe nested codes ETIMEDOUT/ENETUNREACH and no HTTP response. Mongo job metadata shows send attempted, confirmation absent, token absent. The job remains terminal and is not automatically replayed. The code/timing resembles the earlier connection-family hypothesis but does not prove its root cause. At16:53:32 IST, run remains active with2,124 fully read, four saved-token reads pending,14 acquisition/eight read roles fresh, and no403/429. Raw token failure counter increased12->13; account deferrals stay9. Monitor performed only read-only diagnosis and notified the user; no restart, source probe, network setting or pacing change.

##20-second timeout/503 burst —17:50–17:52 IST

Read-only monitor evidence found six completion GET20s deadlines, one OTP-send20s deadline and one OTP-verify20s deadline, plus two completion HTTP503s. Requests started12:20:03.944–12:21:47.531UTC across several existing Azure hosts. The two auth jobs have no saved token: one has unconfirmed send, one confirmed send but unconfirmed verification. Neither was replayed or requeued. Raw acquisition failure counter13->15, account deferrals unchanged9. No403/429. At17:53:31IST the run was active with3,221 fully read and all22 roles fresh; follow-up had zero failed/read_retry jobs and successful completion traffic at17:54:08IST. The monitor notified the user and changed no pacing, budgets, network settings, stop flags or worker processes.

## Service-timeout safety stop —19:00:11 IST

Three genuine authentication deadlines clustered within60s: testing-server-selectionway OTP-send request started18:59:13.515IST, migrator OTP-verify18:59:14.691IST, and migrator12 OTP-send18:59:50.015IST. Each hit the20-second deadline; the third caused `token_failures_stop` at19:00:11.789IST. A completion GET also timed out, but read failures do not drive this acquisition circuit. Eight further acquisition `pilot_stopped` records and four interrupted reads were consequences, not additional source-auth failures. No403/429 or automatic resend.

Current cohort:4,412 fully read (3,044 captured+1,368 mapping exceptions), five saved-token reads pending (one ready+four interrupted),1,539 queued, nine account deferrals and35 terminal acquisitions including historical/cascading records. All workers stopped. User-requested read-only diagnosis reported this; no recovery or restart was performed.
