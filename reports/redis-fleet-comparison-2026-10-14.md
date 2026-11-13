# Shared Redis fleet comparison — 2026-10-14

Read-only checks around 19:42–19:45 IST. Compared original QuickTricks window **13:25–13:50 IST / 07:55–08:20 UTC**, and later recurrence **14:53–14:56 IST / 09:23–09:26 UTC**.

## Connection evidence

Redis CLIENT LIST ages were sampled at 14:13:41 UTC and matched to live host TCP source ports/processes with `ss`. Start times are estimated from current time minus integer-second connection age.

| Machine / app | Old Redis connection example | Connection started (IST) | PM2 evidence |
|---|---|---|---|
| livestream-cpu / SelectionWay | 34.131.142.155:47322, current app PID 1141 | October 14, 07:00:32 | Started 07:00:30; no later restart in current PM2 log |
| livestream-cpu-new / SelectionWay | 34.131.163.111:53470, PID 1163 | October 14, 07:00:32 | Started 07:00:31; no later restart in current PM2 log |
| powermind-livestream / PowerMind | 34.131.108.130:41616, PID 1013 | October 14, 09:00:30 | Started 09:00:29; no later restart in current PM2 log |
| livestream-testing-raghav-clone / Topper | 34.131.70.79:55660, PID 716 | October 14, 07:00:24 | Started 07:00:21; no later restart in current PM2 log |
| webserver2-2 / Topper socket | 148.113.49.18:45514, PID 97484 | September 27, 13:35:31 | Process remains from September 21 |

These named connections survived the original QuickTricks window without reconnecting. This establishes absence of matching connection resets/restarts for those connections; it does **not exclude transient reply stalls that recover on the same TCP connection**, especially on apps without watchdog diagnostics.

## Error-log evidence and limitations

SelectionWay, PowerMind and Topper error logs contain Redis connection timeouts, read timeouts or unexpected closures. Most entries lack timestamps, so they establish that those machines have experienced Redis transport symptoms historically, but cannot be correlated to today's incident. No same-window timestamped Redis event was found in the inspected streaming logs. For error files exceeding 30 MB, the last 30 MB were inspected; this is not a complete lifetime audit. Some historical files are copied/inactive leftovers, which were separated using active PID files and live TCP connections.

The QuickTricks encoder's timestamped log has no Redis transport failure in the original window; its earlier transport failures are from September 24. Today it was later restarted during migration, distinct from the socket server's lunchtime watchdog restart loop.

The separate testing-server-selectionway host contains a backend logging localhost Redis connection refusals in an older error file, and unrelated APX/backend restarts around the later window. No evidence ties those localhost errors or restarts to the old shared Redis endpoint.

## Other consumers visible from Redis

- GPU/transcoder host **178.63.88.34** had many surviving connections created October 13 at approximately 22:55:42 IST, with later queue connections created before today's original window. After an initial approval-review rejection, the user explicitly approved read-only root log access and the follow-up check below was completed.
- Other shared-host address **148.113.35.99** had several connections predating the window, plus connections beginning around **13:52:17 and 13:53:47 IST**, after the original window. These newer connections alone do not prove a failure; they could be ordinary connection creation or process changes. Host identity/access were not independently established, so no host-level logs were read.

## New QuickTricks Redis verification

Both peers now hold live TCP connections to **13.234.240.182:15232**, the new Redis endpoint:

- GCP encoder: PID 101528, three established connections; Redis connected at **17:20:50 IST**.
- Hranker socket server: three established connections to the same endpoint. Migration boot logged Redis connected at **17:18:52 IST**.

No timestamped Redis transport/watchdog failure was found after migration in the inspected QuickTricks socket log. Subsequent process changes must be assessed separately rather than interpreted as Redis reconnects. No diagnostics or fixes were deployed by this investigation.

## What this says about creating another instance

The comparison does **not show a fleet-wide reset/restart at the QuickTricks incident time**. It therefore does not establish a shared-database outage as the cause. Separate-instance migration changes the endpoint/IP and removes shared workload, but it leaves the app's reconnect race and host/client implementation in place. Current health supports that the migration is operational; it is not proof that the original fault cannot recur.

The remaining discriminating evidence is simultaneous app-queue/received-byte/event-loop measurements and independent Redis probes during a failure. The staged [diagnostic recorder](diagnostics/README.md) can collect that, pending an approved rollout gap.

## GPU/transcoder follow-up completed after explicit approval

Read-only host inspection at approximately **20:02 IST** confirmed the host timezone is **UTC+02:00**. The corresponding PM2/log windows were converted to UTC before comparison; raw local clock strings were not compared directly with IST.

- No PM2 restart entry occurred in either QuickTricks failure window.
- `b2-video-listener-error.log`, `b2-secure-job-manager-error.log` and `vid-transcoder-stats-server-error.log` last changed on **October 13 at approximately 17:25 UTC**, before today's incident. Their retained errors include DNS failures (`EAI_AGAIN`), connection refusals and connection timeouts. Those files contain no new error entry during today's windows.
- Multiple GPU livestream apps also have retained Redis DNS failure entries, but these are undated. They cannot establish simultaneous failures today. Relevant error files were read in full up to 50 MB, or as the last 50 MB for larger files; inactive older files were identified by modification date.
- Live TCP sockets from the GPU host matched the old Redis CLIENT LIST source ports previously sampled. Main livestream/worker connections such as ports **56878**, **56872**, **56850** and several subscription ports still date from October 13. Later queue connections also predate the original window. They survived the incident without a TCP reconnect.

This strengthens the conclusion that the observed QuickTricks reset/restart loop was **not a simultaneous reset of all old shared-Redis consumers**. It does not exclude transient same-connection stalls in apps whose logs lack timing or command-path watchdogs. The new database is operational isolation, not a demonstrated fix for the unresolved initiating cause; the confirmed QuickTricks reconnect-ownership defect is unchanged by migration.
