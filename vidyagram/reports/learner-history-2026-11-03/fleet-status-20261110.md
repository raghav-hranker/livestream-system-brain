# Vidyagram completion OTP fleet — status 10 November 2026 (23:50 IST)

Read-only, from `vidyagramdb` (`apx_vg_completion_*`, `apx_vg_request_metrics`, `classprogresses`) via `migrator`,
plus a process check on all 12 Azure migrators. Tenant: Vidyagram (781) only.

## Totals across all 12 runs (11-03 → 11-10)

| Metric | Count |
|---|---:|
| OTPs sent (run counters) | 32,805 (`otp_send` HTTP 200: 32,121) |
| Learners with a saved token | 32,445 |
| Learners whose completions were read | 32,432 (147,835 course reads) |
| Learners with ≥1 completed flag | 13,373 (41%) |
| Completed flags captured | 489,749 (392,722 mapped to a class) |
| ClassProgress markers imported (`apxCompletionImport.batch`) | 417,033 for 12,614 learners |
| Jobs failed / deferred | 284 token_failed, 248 auth_deferred, 28 read_failed, 12 OTP uncertain, 3 route blocked |
| 429s ever | 3 (all `completion_read`, last 11-08) |

About 32k of ~380k paid learners (~8.5%) are done.

## Runs

| Run | OTPs | Captured | Ended (UTC) | Status |
|---|---:|---:|---|---|
| 20261103-pilot50 / horizontal50 / azure50 / nohistory50 | 197 | 181 | 11-03 | complete |
| 20261103-fleet500 | 487 | 415 | 11-03 18:26 | complete |
| 20261104-fleet2000 | 1,999 | 1,654 | 11-04 04:32 | complete |
| 20261104-overnight6000 | 5,975 | 4,145 | 11-05 14:20 | complete |
| 20261105-follow1000 | 961 | 781 | 11-06 10:51 | complete |
| 20261106-next10000 | 9,960 | 7,792 | 11-08 12:22 | complete |
| 20261108-next10000 | 9,947 | 7,933 | 11-09 20:36 | complete |
| **20261109-next10000** | 3,278 | 2,798 | **11-10 11:58** | **`experiment_throttled` safety stop; 6,696 still queued** |

"Captured" excludes `mapping_exception` jobs (6,714 in all): those were read, but some flags did not map.

## State left behind

- No completion worker runs on any of the 12 Azure migrators, phonetics or testing-server-selectionway; every worker's last
  heartbeat is 11-10 ~11:58–12:02 UTC. No request cooldowns are active.
- `migrator` crontab still imports new captures every 30 min (`vidyagram-completion-progress-auto.sh`).
- Stop cause: see the next section. Resuming the 6,696 queued learners needs the user's say-so.

## Why run 20261109-next10000 stopped (checked 11-11 00:00 IST)

- `stopCause` = `{code: admin_shared_pause, workerHost: migrator10, task: acquire}` at 11:58:08 UTC (17:28 IST).
- `admin_shared_pause` comes from `adminUser()` in `vidyagram-completion-pilot.cjs`: the `distributedlocks` key
  `apx-rate-limit-pause` was live. That key is the **shared AppX 429 pause** written by the Vidyagram backend's
  `apxRateLimitGate.ts` (API server, pm2 AppX sync jobs, npm scripts) for 2 minutes whenever any of them gets a 429
  from AppX. It had expired by the time of the check.
- The fleet itself got no 429/403 that day. Its own gate (`org:2177599:all`) last saw a 429 on 11-08. The last
  requests before the stop were all HTTP 200 and acquisitions were succeeding.
- The run has `deferAccountAuth: true` and `throttleIsolation: false`, so the pilot treats a shared pause as a stop.
  The backend's own callers just wait 2 min and retry.
- AppX rate-limits per org across every admin caller, so the fleet's load (~3,700 requests/h) probably helped push a
  backend AppX job into that 429. Which job got it is not confirmed (backend log read was not done).
- The 09:43–11:14 UTC (15:13–16:44 IST) gap was an earlier stop with the same cause (`admin_shared_pause` at
  09:44:09 UTC), resumed at 11:14 UTC by a Codex session with `pause-nov10.cjs`. So the shared pause has stopped this run
  twice in one day.

## Resume, 11-11 00:46 IST (user asked)

Same procedure as the 11-10 16:44 IST resume after the 09:44 UTC stop. That stop had the **same cause**
(`admin_shared_pause`). The 11-09 22:32 UTC stop was `account_auth_failure_spike` / `otp_not_fresh`.

1. Built from the 11-10 kit (Mac `/tmp/vg-nov10-pause-*`): `fleet800-cohort-20261109/pause-nov11.cjs` on migrator
   (scope: stoppedAt 11:58:08.563Z, otpReservations 3286, 6,696 queued, 4 saved-token reads). Fleet launcher = the 11-10
   one with logs `<role>-pause-nov11.log`.
2. `locks`: all 14 hosts free, pilot + request-client fingerprints match. `pause-nov11.cjs preview` passed.
3. No-OTP admin lookup (`~/vidyagram-completion-azure-20261103/pause-admin-nov11.cjs`, needs `VG_COMPLETION_RUN` env): HTTP 200.
4. `pause-nov11.cjs commit && controller-retain-penalty.cjs guard` → `opened`, `guard_ready`, `otp_canary_opened` (12).
   Log `fleet800-cohort-20261109/pause-nov11-controller.log`.
5. Workers launched: 8 hosts acquire + read (migrator–migrator8), 6 acquire only (migrator9–12, phonetics,
   testing-server-selectionway) = 22 processes, 30 s learner gap.

The run still stops on the next shared AppX pause; the guard then restores the gate to 3750 ms and logs `closed`.

## Shared-pause wait (11-11, user asked)

- `reference/scripts/vidyagram-completion-pilot.cjs`: `adminUser()` now calls `waitOutSharedPause()` instead of throwing on a
  live `apx-rate-limit-pause`. It re-checks every 5 s, waits a 0–10 s spread after expiry, re-checks, then goes on (logs
  `shared-pause-wait` / `shared-pause-cleared`). It still throws `admin_shared_pause` (old stop path) if the pause outlasts
  `VG_SHARED_PAUSE_MAX_WAIT_MS` (5 min, inside the 10 min job lease), and `pilot_stopped` if the run stops meanwhile.
  Covers both the pre-OTP and post-OTP admin reads. Tests: 61/61 (4 new, 1 updated).
- Staged on all 14 hosts in `fleet800-cohort-20261109-wait/` (pilot b13320f8…, request client unchanged b354a2ad…). The
  **running workers still use the old code** from `fleet800-cohort-20261109/`.
- Switch over = stop workers, reopen the run with a controller scoped to the actual stop, then
  `python3 reference/scripts/vidyagram-completion-fleet-launch.py launch` (logs `<role>-wait.log`). The no-OTP admin
  check must then require `./fleet800-cohort-20261109-wait/vidyagram-completion-pilot.cjs`.

## Next resume (switches to the shared-pause wait code) — user chose "at the next stop"

The live workers keep the old code until the run stops. When it stops (`experiment_throttled` or `checkpoint_review`;
any other status needs a look first), from the Mac:

```bash
ssh -i ~/.ssh/raghav azureuser@20.193.151.140 'cd ~/vidyagram-completion-azure-20261103 && runtime/node/bin/node fleet800-cohort-20261109/resume-next.cjs preview'
```
Prints `fingerprint` (status|cause|stoppedAt|otpReservations|queued|pendingReads|readRetries). Wait until no worker
heartbeats for 10 min if it says `workers_active` / `job_leases_active`.

```bash
python3 reference/scripts/vidyagram-completion-fleet-launch.py locks
```
All 14 `exit 0` (fingerprints = new pilot b13320f8…, locks free).

```bash
ssh -i ~/.ssh/raghav azureuser@20.193.151.140 'cd ~/vidyagram-completion-azure-20261103 && env VG_APP_ROOT=$PWD/runtime VG_ENV_PATH=$PWD/.env.development VG_COMPLETION_RUN=vg-completion-20261109-next10000 VG_EGRESS_ID=20.193.151.140 VG_LEARNER_GAP_MS=30000 VG_ADMIN_GAP_MS=1000 VG_REQUEST_GAP_MS=1500 VG_REQUEST_JITTER_MS=250 runtime/node/bin/node resume-admin-check.cjs | tail -1'
```
Must print `admin_lookup_passed` (no OTP).

```bash
ssh -i ~/.ssh/raghav azureuser@20.193.151.140 'set -eu; cd ~/vidyagram-completion-azure-20261103; d=fleet800-cohort-20261109; umask 077; nohup flock -n "$d/guard.lock" sh -c "runtime/node/bin/node $d/resume-next.cjs commit '\''<FINGERPRINT>'\'' && exec runtime/node/bin/node $d/controller-retain-penalty.cjs guard" > "$d/resume-next-controller.log" 2>&1 < /dev/null & sleep 5; cat "$d/resume-next-controller.log"'
```
Expect `opened`, `guard_ready`, `otp_canary_opened`. Then:

```bash
python3 reference/scripts/vidyagram-completion-fleet-launch.py launch
```
22 processes; logs `fleet800-cohort-20261109-wait/<role>-wait.log`. Wait for `otp_acquisition_resumed` in
`resume-next-controller.log` (12-learner canary). Workers on the new code log `shared-pause-wait` / `shared-pause-cleared`.

`resume-next.cjs` is `pause-nov11.cjs` with the stop read from the DB instead of hard-coded, penalty 4 or 8 accepted, and
`acquireCeiling` reset to 10,000 on commit. Its happy path has not run yet (the run was live when it was staged).
Copies: `reference/scripts/vidyagram-completion-resume-next.cjs`, `vidyagram-completion-resume-admin-check.cjs`.

## Stop 3 + resume on the wait code (11-11, user asked)

- After the 00:46 IST resume: 566 OTPs in 73 min (~460/h), captured 2,811 → 3,266.
- **Stopped 11-11 01:59 IST (20:29:33 UTC) as `token_failures_stop`**, cause `otp_send_rejected` HTTP 503 on migrator2:
  an AppX blip (one 503 on otp_send, one on completion_read, 11 timeouts within ~30 s) tripped the 3-failures-in-60 s
  rule. Not the shared pause. Idle ~8.7 h.
- `resume-next.cjs` / `resume-admin-check.cjs` now also accept `token_failures_stop` (repo copies updated).
- 16:14 IST: preview fingerprint `token_failures_stop|otp_send_rejected|2026-11-10T20:29:33.461Z|3854|6123|0|0`;
  `locks` 14/14 on the **new pilot b13320f8**; admin lookup HTTP 200, no OTP; commit → `opened`, `guard_ready`,
  `otp_canary_opened` (12); `vidyagram-completion-fleet-launch.py launch` → 22 workers. Logs
  `fleet800-cohort-20261109-wait/<role>-wait.log`, controller `fleet800-cohort-20261109/resume-next-controller.log`.
  First real run of `resume-next.cjs`.
- Canary 12/12 → `otp_acquisition_resumed` at 16:16 IST. First 2.5 min: 15 OTPs, zero non-200, 22 workers live, no
  shared pause yet (new code logs `shared-pause-wait` when one comes).

## Faster gate (11-11, user asked)

Running pace was capped by the shared gate `org:2177599:all`: spacing = 400 ms × max(1, penalty/4) with penalty stuck at 8
since the 11-08 429s → 800 ms, ~1.25 req/s, ~3,500 requests/h ≈ 7 per learner ≈ 500–620 OTP/h regardless of host count.
- 18:25 IST: penalty 8 → 6 (600 ms) with `reference/scripts/vidyagram-completion-gate-penalty.cjs`. Baseline hour: 618 OTP,
  3,488 requests, 0 × 429. Watching an hour; then 6 → 4 (400 ms) if clean. Next ceilings: admin lane 1 s apart (~1,800
  learners/h) and 30 s per-host pacing (~1,680/h).
- `resume-next.cjs` now accepts gate penalty 4, 6 or 8.
- Step 1 hour: **814 OTP/h** (+32%), 4,254 requests/h, 0 × 429, run never stopped.
- 19:26 IST: penalty 6 → 4 (400 ms, the baseline floor). Watching an hour.
- Step 2 (penalty 4, 400 ms): first 10 min ~970 OTP/h and ~5,100 requests/h, then AppX slowed. Average latency per 5 min:
  100 ms (13:15–13:40 UTC), 209 ms (14:00), 402 ms (14:05), 600 ms (14:10), with timeouts on otp_send/otp_verify/completion
  reads and one otp_verify 503. Three service failures in 60 s → **`token_failures_stop` at 14:13:03 UTC (19:43 IST)**, no
  429. ~15 learners got an OTP but no token (6 timeouts, 8 cut off by the stop, 1 × 503). It was also the start of the
  evening student peak, so time of day may have contributed; can't separate the two.
- Penalty set back to **6** (~19:50 IST). Penalty 6 had one brief wobble too (13:45–13:50 UTC, 218 ms, 2 OTP timeouts) but
  recovered. **Keep penalty ≥ 6.** Run stopped; resume with the Next resume runbook (fingerprint from preview).
- Resumed 11-11 ~20:00 IST at penalty 6 (user: "Yes, resume at 6"). Fingerprint
  `token_failures_stop|otp_verify_or_identity_rejected|2026-11-11T14:13:03.442Z|6035|3939|1|0`, 3,939 queued.
  A stray ssh command delayed the worker launch ~4.5 min, so the first canary hit its 5-min deadline
  (`otp_acquisition_review: canary_deadline`) with no OTP failures. Re-armed with `~/vidyagram-completion-azure-20261103/rearm-canary.cjs --commit`
  (only acts on an open run in canary_deadline review): canary 12/12 at 14:33 UTC. First 9 min: ~816 OTP/h, 4,310 requests/h,
  0 × 429, 0 errors. **Lesson: launch workers within a minute of the commit, or the canary times out.**

## Auto-resume (11-11 23:30 IST, user asked "build the auto-resume")

Two parts; the pilot itself is unchanged (b13320f8, 61/61 tests).

**Standby loops on every host.** `fleet800-cohort-20261109-standby/` on all 14 hosts holds the same pilot and request client
plus `standby.cjs` (`reference/scripts/vidyagram-completion-standby.cjs`). Per role the launcher runs
`g=600000; while standby.cjs <role> $g; do pilot worker <role>; g=0; sleep 5; done` queued behind `<dir>/<role>.lock`.
Queued 11-11 17:57–17:59 UTC (22 loops). They do nothing while today's `-wait` workers hold the role locks; at the next stop
those workers exit, the loops take the locks and heartbeat `state: 'standby'` (`apx_vg_completion_workers`
`RUN:standby:<host>:<role>`). A loop releases into the pilot worker only when the run reopens after it began (10 min grace on the
first pass, for a commit-then-launch by hand), so a worker that quits while the run stays open waits for the next reopen
instead of spinning. Logs `<role>-standby.log`. **Kill switch:** pilot `stop` (`operator_stopped`) sends every loop home;
they also leave on run finish or after 36 h without a reopen.

**Watchdog on migrator.** `fleet800-cohort-20261109/autoresume.cjs` (`reference/scripts/vidyagram-completion-autoresume.cjs`),
cron `*/5` under `flock autoresume.lock`, log `fleet800-cohort-20261109/autoresume.log` (only changes of decision),
controller log `autoresume-controller.log`. Crontab before: `crontab-before-autoresume.txt`. A tick resumes only if all hold:
- armed (`apx_vg_completion_autoresume.enabled`; `autoresume.cjs arm|disarm`, armed 17:59 UTC);
- stop is `experiment_throttled`/`admin_shared_pause`, `token_failures_stop` without an AppX 4xx, or `checkpoint_review`;
  everything else (`account_auth_failure_spike`, route blocked, `trial_appx_4xx`, `admin_session_review`, canary review…) waits for a person;
- 20 min since the stop (60 min if it stopped within 30 min of the last auto-resume); at most 4 attempts per 24 h; never the same stop twice;
- gate penalty ≥ 6; ≥ 10 acquire workers on standby; no shared pause.
Then it does the manual runbook: `resume-next.cjs preview` (all its checks, incl. any 4xx since the trial start) → records the
attempt → `resume-admin-check.cjs` (no OTP) → `nohup flock -n guard.lock "resume-next.cjs commit <fp> && exec controller-retain-penalty.cjs guard"`
→ waits up to 60 s for the reopen. The guard's 12-learner canary still gates OTPs; standby loops wake within ~20 s.

Check it: `runtime/node/bin/node fleet800-cohort-20261109/autoresume.cjs status` on migrator (decision, standby counts, last attempts).
Manual resume with standby loops = preview → admin check → commit; **no `launch`** (the loops are the workers).
Not exercised yet on a real stop: the first one will be the first live run of the act path.

## Next batch: vg-completion-20261112-next10000 (11-12 00:45 IST, user: "prepare another batch as well to be auto run")

- Pilot: run id added to `FOLLOW_ON_COHORTS` (pilot a4457ec3…, 61/61 tests). Same selection as the last three cohorts
  (recent positive-value unexpired purchase + positive AppX watch history, excluding every learner already in a job or with a
  saved token). Preview and seed: **10,000 learners**, 14,101 course pairs, 146,437 orders inspected. Seeded 19:14 UTC as
  `queued_prepared` (stopped, ceiling 0, no OTP). Log `fleet800-cohort-20261112/seed.log` on migrator.
- Kit `fleet800-cohort-20261112/` on migrator: `controller.cjs` (`reference/scripts/vidyagram-completion-cohort-controller.cjs`),
  `resume-next.cjs`, `autoresume.cjs` (both now take `VG_COMPLETION_RUN`), pilot + request client + `standby.cjs` on all 14 hosts.
  `resume-admin-check.cjs` takes `VG_PILOT_PATH` (default unchanged). Old copies: `fleet800-cohort-20261109/*.before-20261112.cjs`.
- **Handoff:** `controller.cjs handoff` running under `flock fleet800-cohort-20261112/guard.lock` (log `handoff-controller.log`), armed
  19:16 UTC. When 20261109 is `capture_complete*`, its guard restores the gate; the handoff then needs ≥ 16 standbys (≥ 10 acquire),
  gate penalty 6 or 8, no shared pause or holds, then opens 20261112 and guards it (canary 12).
- **Workers:** 22 loops `fleet800-cohort-20261112/<role>-standby.log`, each queued `flock 20261109-standby/worker-<role>.lock` →
  `flock <dir>/<role>.lock`, so they start only after the 20261109 loop on that host has ended for good (flock waiters are not FIFO;
  this keeps a 20261112 loop from taking a host away from an unfinished 20261109).
- **Auto-resume:** second migrator cron line with `VG_COMPLETION_RUN=vg-completion-20261112-next10000`, armed; log
  `fleet800-cohort-20261112/autoresume.log`; status `VG_COMPLETION_RUN=vg-completion-20261112-next10000 runtime/node/bin/node fleet800-cohort-20261112/autoresume.cjs status`.
- ClassProgress import cron already covers every `vg-completion-<date>-` run.
- At ~816 OTP/h, 10,000 learners ≈ 12–13 h of running.
- **Handoff ran live, unattended (11-12 00:49–00:51 IST).** 20261109 finished 19:19:36 UTC as `capture_complete_with_exceptions`
  (9,974 OTP reservations; jobs: 8,825 captured, 989 mapping_exception, 87 token_failed, 79 auth_deferred, 16 read_failed,
  4 otp_outcome_uncertain). Its guard restored the gate (`closed`), the 20261109 loops exited `run_finished`, the 20261112 loops
  took the role locks, the handoff opened 20261112 (~19:20 UTC) and the canary passed 12/12 at 19:21. At 19:21:41: 22 workers
  running (14 acquire, 8 read), gate penalty 6 / 400 ms, 24 OTPs, 0 non-200.

## 04:00 IST stale-OTP stop and the 4 AM rule (11-12, user: "Resume + 4 AM rule")

- **Stop:** 20261112 stopped 22:32:57 UTC (04:02:57 IST) as `account_auth_failure_spike` / `otp_not_fresh`. From 04:00:47 IST
  every host got stale OTPs within two minutes (15 failures across 9 hosts, no HTTP status, no 4xx). Up to then: 2,389 OTPs
  in 3 h 13 m (~745/h), 2,127 captured, 230 mapping_exception, 28 auth_deferred, 8 token_failed, 7,607 queued; hit rate 38.2 %.
- **Same hour three nights running:** 11-05 04:08, 11-09 04:02, 11-12 04:02 IST. AppX seems to stop issuing fresh OTPs ~04:00 IST.
- **Change (20261112 kit + migrator root; old copies `*.before-4am.cjs` in `fleet800-cohort-20261112/`):**
  - `resume-next.cjs` and `resume-admin-check.cjs` also accept `account_auth_failure_spike` when the cause is
    `otp_not_fresh` / `otp_not_available` with no HTTP status. Every other check (any AppX 4xx since trial start blocks) is unchanged.
  - `autoresume.cjs`: that stop, if it happened 03:45–04:30 IST, resumes no earlier than 05:00 IST (`nightly_otp_window`
    until then), through the usual 12-learner canary. Same spike at any other hour = `needs_review`. Daily limit, cool-off,
    penalty ≥ 6 and standby roster still apply. Tests 10/10.
  - Bug fixed in `autoresume.cjs`: `return outcome(...)` wasn't awaited, so the client closed before the outcome was saved
    (`MongoExpiredSessionError`). The 20261109 kit copy still has it (that run is finished).
- **Resume 11:15 IST:** first tick failed in the admin check (`run_changed`: its status list lacked the spike); that event
  was voided (`voided|<fp>`, still counts toward the daily 4). Second tick: `opened` 05:45:43 UTC, guard ready, canary 12 opened.

## Where the time goes (11-12 ~12:00 IST, user: "try more approaches to speed it up")

- **Downtime is the biggest loss.** 20261109: 48 wall hours, OTPs in only 21 of them (27 hours fully stopped). 20261112 so far:
  12 wall hours, 6 stopped (the 04:00 IST stale-OTP stop). Most of those stops (04:00 spike, admin_shared_pause ×2, 5xx token
  failures) waited 1.5–14 h for a person; the auto-resume watchdog plus the 4 AM rule now reopen them in 20–60 min.
- **Running rate is capped by the shared gate**, not by hosts: fleet-wide dispatch gap p10 628 ms / p50 774 ms against the 600 ms
  floor (penalty 6), workers queue ~2 s per request; ~4,240 requests/h ≈ 5.2 per learner (2 admin_user, 1 otp_send, 1 otp_verify,
  ~1.2–2 completion_read) ≈ 700–830 OTP/h.
- **What AppX tolerates is the real ceiling.** OTP send/verify and completion reads hit the student API (armathsapi.akamai.net.in);
  admin_user hits the CMS. Every timeout/5xx/429 since 11-08 was on the student API (the only 429: completion_read 11-08 19:50 UTC;
  the 11-11 penalty-4 slowdown: otp_send/verify/completion timeouts). Student calls per learner are fixed (send, verify, one read per
  course), so any extra learners/h means proportionally more student-API load: splitting the gate into lanes, dropping the pre-OTP
  admin lookup or removing gate slack all speed up only by raising that load.
- Latency by hour on 20261112 is flat (admin 50–62 ms, send 130–154 ms, verify 152–173 ms, reads 49–64 ms): no strain at penalty 6.

## 429 stop, 11-12 11:49 IST (found while preparing the mini-fleet / stepped-rate test)

- 20261112 stopped 06:19:46 UTC `experiment_throttled` / `source_rate_limited`: one `completion_read` HTTP 429 on migrator5
  (4.240.100.64, read role), at penalty 6. The gate learned penalty 8 and went back to the 3750 ms baseline; ip:4.240.100.64 penalty 2.
  otpSent 2,861 at the stop.
- Not a load spike: migrator5 made 9 requests in the 60 s before (normal), the fleet ~73/min (flat for 20 min), latency flat
  ~90–115 ms, no timeouts/5xx. Same shape as the 11-08 19:50 UTC 429 (migrator3, completion_read, 10 host / 108 fleet requests in
  the prior 60 s). Both 429s since 11-08: single request, single IP, completion read, at ordinary rates.
- Auto-resume holds (`needs_review`, 429). `resume-next.cjs` also refuses: any AppX 4xx since the cohort's trialStartedAt blocks.
- `reference/scripts/vidyagram-completion-rate-trial.cjs` (stepped trial: penalty 4 → gap 300 ms, brake on any 429/5xx/timeout or
  latency rise, restores 400 ms / penalty ≥ 6) is written and deployed as `fleet800-cohort-20261112/rate-trial.cjs`, **not run**.

## Per-server cooldown on 429 (11-12, user: "instead of stopping the whole fleet why not cooldown the server")

New run flag `throttleCooldown: true` (set by `resume-next.cjs commit` and by the cohort controller's `open()`):
- **Request client:** a 429 cools down only `ip:<egress>`: 15 min, doubling for each further 429 on that IP within 6 h (max 2 h,
  or Retry-After if longer); that IP's penalty doubles (max 8). No org cooldown, no org penalty change, no `apx-rate-limit-pause`.
- **Pilot:** the run is not stopped; the job goes back to `read_retry` (read) / `waiting_session` (pre-OTP) for another host; the
  event is kept in `route429Events`. A **second IP rate-limited within 30 min stops the run** (`experiment_throttled` /
  `multiple_routes_rate_limited`, waits for a person). Workers on a cooling IP sit out (state `route_cooldown`) without holding a job.
- **Guard:** ignores 429s on throttleCooldown runs (any other 4xx still stops). **resume-next:** 429s don't block when the run has
  throttleCooldown or the stop being resumed is a single-429 stop (acknowledged by its fingerprint).
- Old `throttleIsolation` (permanent IP hold + 10 min org pause) unchanged and not used.
- Tests: pilot 63/63 (+2), request client 23/23 (+1).
- Deployed: pilot + request client staged on all 14 hosts (hashes match; picked up at the next reopen); `controller.cjs`,
  `resume-next.cjs` in `fleet800-cohort-20261112/` on migrator. Old copies `*.before-cooldown.cjs` there.
- **Not yet done (blocked by the permission check, needs the user's OK):** gate penalty 8 → 6 and the resume. Preview passes:
  `experiment_throttled|source_rate_limited|2026-11-12T06:19:46.729Z|2863|7132|1|1`.
- **Resumed 11-12 12:33 IST (user: "Yes, resume at 6").** Gate penalty 8 → 6 (`vidyagram-completion-gate-penalty.cjs 8 6 --commit`), then
  preview → admin check (200, no OTP) → `resume-next.cjs commit <fp> && controller.cjs guard` under `guard.lock`
  (log `fleet800-cohort-20261112/resume-cooldown-controller.log`). Opened 07:03:19 UTC with `throttleCooldown: true`; canary 12/12
  at ~07:06 UTC. At 07:07 UTC: all 22 workers released (14 acquire, 8 read), gate penalty 6 / 400 ms, 39 OTPs in 3 min (~780/h),
  latency normal (send 147, verify 163, reads 58 ms). 7,083 queued.
- Side note: the two GCP hosts lose nearly every gate race (avg queue wait 13–24 s since the resume, ~3 min overnight; 55 requests
  each in 3 h vs ~1,100 for an Azure host), so they add almost nothing at this gate pace.

## Rate trial (11-12, user: "you can run it")

- 13:36 IST first start refused by its own pre-check (`not_clean_before_start`). At penalty 6 / 600 ms AppX was already wobbling
  07:44–08:05 UTC: 4 OTP timeouts (2 send, 2 verify, 20 s), completion_read 502 + 500, otp_send 500; verify latency 164 → 208 ms.
  The run was not stopped (failures too spread out for the 3-in-60 s rule).
- Retry loop on migrator (`sh` loop, log `fleet800-cohort-20261112/rate-trial.log`): tries every 10 min until 10:00 UTC (15:30 IST),
  stops after the first real start; each start still brakes at the first error or latency rise.
- **Result.** Started 08:57 UTC (14:27 IST) once AppX had 3 clean minutes. Log lines: start → `p4` 08:57 → `gap300` 09:27:13 →
  `restored` 09:27:33 (`error:otp_verify:TypeError`, migrator2, a transport error). Gate back at penalty 6 / 400 ms (600 ms spacing).

  | Window (UTC) | Spacing | Requests/min | OTP sent/h | Errors (429/5xx/timeout/transport) | Median ms send / verify / read |
  |---|---|---|---|---|---|
  | 08:27–08:57, before | 600 ms | 15.6 | 180 | 4 timeouts + 1×500 | 155 / 167 / 60 |
  | 08:57–09:27, `p4` | 400 ms | 87.2 | 994 | **0** | 146 / 167 / 56 |
  | 09:27:13–09:27:33, `gap300` | 300 ms | 85.7 | (20 s) | 1 transport error | 141 / 211 / 59 |

  The "before" row is mostly a stop, not the normal 600 ms pace: three OTP timeouts within 60 s (08:31:25 migrator12 send,
  08:31:56 migrator5 send, 08:32:03 migrator6 verify) stopped the run at 08:32:16 UTC (14:02 IST, `token_failures_stop`); the
  watchdog reopened it at 08:55 UTC (14:25 IST) and the trial started 2 min later. The normal pace (07:06–08:06 UTC) was ~806 OTP/h. So `p4`
  gave ~1.23× (expected 1.5×; the gate is not the only wait), with flat latency and no errors for 30 min. `gap300` braked after
  20 s on a single transport error, which also happens at 600 ms; it does not prove 300 ms is too fast. 307s on admin_user are
  admin-session redirects and are not counted.

## 400 ms until 16:30 IST (11-12, user: "Yes, run 400 ms")

- `rate-trial.cjs` gained `--only <step>` (one step, held until `--until`, latest 16:30 IST; then back to 600 ms).
- 09:41:55 UTC first start braked after 41 s: `latency:completion_read:122>56`. completion_read sat at ~120 ms from 09:42:03
  to 09:43:43 and was back to ~55 ms by 09:44:10, ~90 s after the gate returned to 600 ms. Cause unclear (step or AppX blip);
  the 30 min at 400 ms earlier were flat.
- Loop `fleet800-cohort-20261112/p4-loop.sh` (log `rate-trial-p4.log`): at most 3 starts, 10 min apart after a brake, none after
  10:30 UTC. Second start 09:49:42 UTC; at 09:59 clean, 51 OTPs in 3 min (~1,020/h), medians 141 / 170 / 53 ms.
- 10:09:47 UTC second start braked after 20 clean min (`error:otp_verify:TimeoutError`). Third start 10:19:47 UTC, clean at 10:29.
- The 12:33 IST resume's ssh (holding the first guard) only dropped at ~16:05 IST; that guard had already exited at the 14:02
  stop. The live guard is the watchdog's (pid 299716, started 08:55 UTC).
- Third start held 35 min, braked 10:55:11 UTC (`error:completion_read:TimeoutError`), 5 min before its 16:30 IST end. Gate back at
  penalty 6 / 400 ms (600 ms); the loop makes no new start after 10:30 UTC.
- **Day total at 400 ms:** 30 + 20 + 35 = 85 min across three starts, each ending on a single timeout (or one 100 s latency blip),
  at ~1,000 OTP/h with flat medians. Timeouts also come at 600 ms (3 in 60 s stopped the run at 14:02 IST). Verdict: 400 ms is
  usable; a brake on *one* timeout is too strict to hold it for long. A fairer brake would be 2+ errors in 3 min or a latency rise.

## 400 ms day run armed for 11-13 (user: "sure loosen and run then")

- Brake loosened in `rate-trial.cjs`: any 429 still brakes at once; 5xx / timeouts / transport errors need **2+ in the 3-min
  window**; latency rule unchanged. Tests `vidyagram-completion-rate-trial.test.cjs` 7/7. Old copy `rate-trial.before-2errors.cjs`.
- 16:28 IST was past the trial's window (05:00–16:30 IST), so `fleet800-cohort-20261112/p4-day.sh` (log `rate-trial-p4-1113.log`)
  waits until 05:30 IST 11-13, then starts the 400 ms step; after a brake or run stop it waits 10 min and starts again (at most 8
  starts, none after 16:00 IST). The trial ends at 16:30 IST and puts the gate back to 600 ms. Overnight stays at 600 ms.
- Stop it: `pkill -f p4-day.sh` then `pkill -TERM -f rate-trial.cjs` (restores penalty 6).

## 400 ms from now, not tomorrow (11-12 16:42 IST, user: "why tomorrow and not now" → "Yes, start now")

- The daytime-only window was my own caution, not an AppX limit. Opening the evening exposed a real gap: if the run stops at 400 ms,
  the guard closes the gate (3750 ms, marker removed) but leaves the trial's penalty 4, and the watchdog never resumes below 6.
- `rate-trial.cjs` now: (1) on restore, if the guard already closed the gate and a trial step left penalty < 6, lifts it to 6;
  (2) runs any time except 03:30–05:30 IST (AppX nightly stale-OTP window + 05:00 auto-resume), each start ending by 03:30 IST.
  Tests 9/9 (the penalty lift needs the DB and is not unit-tested). Old copy `rate-trial.before-evenings.cjs`.
- `p4-day.sh` stopped; `p4-run.sh` (log `rate-trial-p4-run.log`) started 11:12 UTC: 400 ms until 03:30 IST, 10 min wait after a
  brake or run stop, then again from 05:30 IST 11-13; last start 11-14 03:00 IST, at most 20 starts.
- Stop: `pkill -f '[p]4-run.sh'` then `pkill -TERM -f '[r]ate-trial.cjs run'` (restores penalty 6). The brackets stop pkill
  matching its own ssh shell (a plain `pkill -f p4-day.sh` killed the deploy ssh).
- 12:12 UTC (17:42 IST): first hour at 400 ms clean, no brake; 981 OTPs sent in the hour. Captured 6,469, queued 2,901
  (~3 h at this pace, done ~20:45 IST if it holds), mapping_exception 542, token_failed 48.

## Guard Mongo blip stop, resume, and 300 ms try (11-12, user: "can we try 300 ms?" → "Yes, resume + 300")

- 12:52:21 UTC (18:22 IST) the run stopped as `trial_controller_recovered`: the guard hit two `MongoServerSelectionError`s and,
  once back, stopped the run because it could not vouch for the gap. No AppX errors in the 5 min before. 400 ms had held 1 h 40 min.
  The trial restored on `run_stopped`; the guard closed the gate to 3750 at penalty 6 (the new penalty lift was not needed:
  the trial restore ran first).
- Neither the watchdog (needs_review) nor resume-next accepted that status. Now all three do (`autoresume.cjs` SAFE,
  `resume-next.cjs`, `resume-admin-check.cjs`; the AppX-4xx check still applies). Tests 19/19. Backups `*.before-ctlrec.cjs`.
- 13:02 UTC: `p4-run.sh` stopped; `p4-300.sh` started (log `rate-trial-300.log`): each start 400 ms for 10 min, then 300 ms
  until 03:30 IST; brake as before; if 300 ms brakes, later starts hold 400 ms only. Resume left to the watchdog's next tick
  (preview fingerprint `trial_controller_recovered|none|2026-11-12T12:52:21.348Z|7653|2332|0|0`).
- Watchdog budget: this is its 4th attempt in 24 h (05:44 voided, 05:45, 08:55, now), so it cannot resume again until 11:14 IST
  11-13 — the 05:00 IST 4 AM resume would be blocked. The cohort (2,332 queued) should finish tonight, well before 04:00.
- Stop: `pkill -f '[p]4-300.sh'` then `pkill -TERM -f '[r]ate-trial.cjs run'`.
- 13:15 UTC (18:45 IST) the watchdog reopened the run (first guard-blip resume); canary 12/12.
- **300 ms:** 400 ms from 13:17:56, 300 ms from 13:27:59 UTC; **37 min at 300 ms with no brake and no AppX error** from our run
  (medians 139 / 165 / 53 ms, ~38 OTPs per 3 min).
- 14:05:17 UTC (19:35 IST) stop `experiment_throttled` / `admin_shared_pause` (migrator12, acquire): the VG backend kept
  `apx-rate-limit-pause` alive past the pilot's 5-min wait. The backend writes that lock after its *own* AppX 429s (its pm2 crons);
  our run logged no 4xx/5xx in the 40 min before. Whether 300 ms pushed the shared AppX admin API into 429ing the backend can't be
  told from our side.
- The watchdog could not resume: 14:30 UTC `daily_limit` (4 attempts in 24 h, the voided 05:44 one included), until 05:44 UTC 11-13.
  Stopped since 19:35 IST; 7,684 captured, 1,559 queued.
- Ready, not deployed: `autoresume.cjs tick --operator` skips only the daily limit (tests 11/11), for a person-approved resume.
- 18:22 UTC (23:52 IST, user: "Yes, resume at 400"): `autoresume.cjs tick --operator` deployed (backup `autoresume.before-operator.cjs`)
  and run under the cron's flock: `opened`; canary 12/12. `p4-300.sh` stopped, `p4-run.sh` restarted; 400 ms live 18:27:15 UTC.

## Next batch: vg-completion-20261113-next10000 (11-13 00:00 IST, user: "prepare the next batch")

- Cohort tables: pilot `FOLLOW_ON_COHORTS`, controller `COHORTS` (previousRun 20261112, marker `fleet800-cohort-20261113`),
  resume-next / autoresume / rate-trial markers, fleet-launch `COHORTS` (stage `fleet800-cohort-20261113`, after
  `fleet800-cohort-20261112`). Tests: pilot 63, request client 23, autoresume 11, rate trial 9.
- Kit on migrator `fleet800-cohort-20261113/`: controller, resume-next, autoresume, rate-trial. Pilot + client + standby staged on
  all 14 hosts (first pass timed out on 9 hosts at the launcher's 30 s ssh limit; second pass all match).
- Preview and seed: **10,000 learners**, 12,518 course pairs, 161,767 orders inspected; seeded 18:30 UTC as `queued_prepared`
  (stopped, ceiling 0, no OTP); 0 overlap with 20261112. Logs `preview.log`, `seed.log`.
- 22 standby loops launched (`<role>-standby.log`), queued behind the 20261112 loops' worker locks.
- Handoff: `controller.cjs handoff` under `flock fleet800-cohort-20261113/guard.lock` (log `handoff-controller.log`,
  `handoff_armed`, expects 22 standbys). Opens 20261113 when 20261112 is `capture_complete*` and the gate is back at penalty 6/8.
- Watchdog: third cron line (`VG_COMPLETION_RUN=vg-completion-20261113-next10000`), armed; old crontab
  `fleet800-cohort-20261113/crontab.before-20261113`. Its daily budget is its own (fresh).
- Pace: 20261113 opens at 600 ms (penalty 6 / 400). `p4-run.sh` is bound to 20261112 and does not carry over.
- Pace update (user: "Yes, 400 ms for it" → "do it at 300 ms ?"): `fleet800-cohort-20261113/p4-300.sh` (log `rate-trial-300.log`)
  idles until 20261113 opens and its canary clears, then each start runs 400 ms for 10 min and 300 ms until 03:30 IST. If a 300 ms
  hold ends any way but `trial_end` (brake or run stop), later starts hold 400 ms only. Last start 11-15 03:00 IST, at most 30.
  Stop: `pkill -f '[f]leet800-cohort-20261113/p4-300.sh'` then `pkill -TERM -f '[r]ate-trial.cjs run'`. 20261112 stays at 400 ms.
- Undo before it opens: kill the handoff (`pkill -f '[c]ontroller.cjs handoff'`), pilot `stop` for 20261113 (operator_stopped →
  standby loops exit), restore the crontab from the backup.

## Stop-time cuts (11-13 00:12 IST, user: "I need to hurry up a bit" → "Yes, both")

- Last 24 h: ~13 h stopped vs ~11 h running. Biggest: 04:02→11:15 (pre-4 AM rule), 19:35→23:52 (watchdog 4/day limit).
- `autoresume.cjs` (both kits; backups `autoresume.before-fast.cjs`): **max 8 attempts / 24 h, voided not counted**;
  **FAST stops wait 5 min (20 after a quick stop)** instead of 20 (60): `token_failures_stop` with TimeoutError/TypeError,
  `experiment_throttled`/`admin_shared_pause`, `trial_controller_recovered`. Any HTTP 4xx keeps the slow path. Tests 12/12.
- Pilot: shared-pause wait 5 → **8 min** (inside the 10-min job lease); staged for 20261113 on all 14 hosts (pilot tests 63/63).
  20261112 keeps the 5-min pilot (it finishes in ~1 h).
- **Separate admin gate: not built.** Premise corrected: every learner needs the same ~3.2 student-API calls, so moving the
  2 admin calls off the shared gate only lets student calls come faster (≈ 400 ms → ~250 ms student spacing; ~190 ms on top
  of 300 ms). Same bet as tighter spacing, not free throughput. Held for a fresh decision.

## Learner-gap trial (11-13)

- **Cap measured (06–07 IST, 400 ms):** 14 acquire workers, one learner each per ~44 s = 30 s learner gap + ~13 s acquisition, most
  of it gate queue wait. About 1,018 learners/h; readers mostly idle.
- **Run was parked 11:01–12:00 IST** in canary review (one phonetics OTP-verify timeout, 11/12 ok, no 4xx). It was stopped at
  12:00 IST to reload the pilot; the user OK'd clearing the review; reopened 12:08 IST, canary 12/12.
- **lg20** (400 ms gate + 20 s learner gap via run doc `learnerGapOverrideMs`, read by workers every loop):
  - Ran 12:22–12:33 IST and lost throughput: 827 OTP/h against 1,013 at p4, with gate queue wait 7.5 s against 3.8 s.
  - Braked on 2 timeouts; the brake removed the override.
- **Why:** the shared gate is a Mongo-polled lock (take() sleeps 100–1000 ms between polls, several round trips per turn). It
  delivers about 5,300 req/h whatever the spacing (300 ms: 5,492; 400 ms: 5,346). More waiting workers mean more contention, so
  less gets through.
- **Next lever:** a slot-reservation gate. One atomic `nextAt` bump hands each request its own slot, then it sleeps to that slot,
  with no polling. Not built.
- **Loop now:** `fleet800-cohort-20261113/p4only.sh` (400 ms, log `rate-trial-p4.log`).

## Reservation gate (11-13, built, not switched on)

**Why.** Production gaps between dispatches with a request waiting (06–07 IST, 400 ms setting): never under 450 ms, median 545,
mean 678; 27% over 700 ms. Mongo round trips from migrator are 6 ms, so the store isn't the cost. The lock gate is: about 11
sequential calls per turn, all-or-nothing retries, and 100–1000 ms poll sleeps.

**What.** `vidyagram-apx-request-client.cjs` has a reservation mode, active only while the gate doc has `dispatchMode:'reserve'`.
- **Book:** one atomic update gives each request its start slot (frontier += current gap, at most 10 s ahead).
- **Claim:** the worker sleeps to the slot and runs its job/stop check. One atomic claim then:
  - takes one of 2 in-flight leases;
  - checks cooldown and block;
  - stamps `lastStartAt`, never sooner than the current gap after the previous start.
- **IP and admin keys:** busy until completion, then their gap, as in the lock gate.
- **429:** a cooldown makes booked slots wait it out and re-book.
- **Version:** workers record `gateClient: reserve-v1`.

**Tests.** 33/33 in the request client. The lock gate fails the new 6 ms-Mongo, 12-worker test (median 340 ms at a 250 ms
setting); reservation passes it repeatedly. Pilot 64, watchdog 12, rate trial 9 and the other suites 19 also pass.

**Simulation** (`vidyagram-completion-gate-sim.cjs`: 14 acquire + 8 read workers, real learner sequence, 400 ms, 6 ms Mongo,
4 min each). The lock gate's baseline row reproduces production: 1,125 learners/h against 1,018 real, median gap 500 against
545.

| gate | learner gap | admin gap | IP gap | learners/h | req/h | median gap |
|---|---|---|---|---|---|---|
| lock | 30 s | 1 s | 1.5 s | 1,125 | 6,270 | 500 |
| reserve | 30 s | 1 s | 1.5 s | 1,245 | 6,960 | 413 |
| reserve | 30 s | 0.5 s | 1.5 s | 1,350 | 7,425 | 403 |
| reserve | 20 s | 1 s | 1.5 s | 1,335 | 7,605 | 404 |
| lock | 20 s | 0.5 s | 0.75 s | 1,215 | 7,080 | 491 |
| reserve | 20 s | 0.5 s | 0.75 s | 1,620 | 8,895 | 401 (p90 406: saturated) |

- **On its own the new gate is worth about 11%.** The 30 s learner gap and the per-IP gap (send and verify each wait about
  1.85 s for the same IP) take most of the cycle.
- **It is what makes the other levers work.** With looser gaps the lock gate stays near 1,200 learners/h, while reservation
  reaches 1,620 and fills the 400 ms gate. Every one of those levers means more AppX traffic: 8,900 req/h is 1.7× today's real
  rate.

**Switch** (between runs or during a stop, never with workers running):
1. Stage the next batch with `vidyagram-completion-fleet-launch.py stage`. It copies the local request client and pilot.
2. Run `verify` on all 14 hosts.
3. On migrator, run `gate-mode.cjs reserve`. It refuses while any worker runs or a request is in flight.
4. Open the batch.
5. `gate-mode.cjs status` must show every running worker on `reserve-v1`.

Rollback: `gate-mode.cjs lock`, safe at any time. The live 20261113 batch keeps the old client; nothing is deployed.
