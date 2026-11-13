# VG timeout-cluster recovery and resume — November 4, 2026

The user authorised recovery of five saved-token learners, fresh read-only source checks and resumption only if checks passed. Existing uncertain OTP sends/verifications must never be replayed.

The guarded recovery helper mode `--network-stop --timeout-stop` required the exact 19:00:11.789 IST stop, raw failure count21, 6k ceiling, planned readers8 and shared concurrency2. It selected exactly one token-ready plus four `pilot_stopped` interrupted reads, excluded terminal acquisitions, and backed up beforeimages under `apx_vg_completion_recoveries`, ID `vg-completion-20261104-overnight6000:saved-token-recovery-timeout-stop-1`. Acquisition was disabled at both claim and reservation boundaries.

All five learners recovered: three captured, two mapping exceptions. Total fully read became4,417. OTP reservation/send counters stayed identical to the pre-recovery image;1,539 queued jobs were untouched. Recovery finished19:06:53.512 IST.

The three hosts implicated in the stop (migrator, migrator12 and testing-server-selectionway) each ran six normally paced read-only probes: three admin lookups and three saved-token completion GETs. All18 passed without error or OTP sends. Checks finished19:06:48–19:06:52 IST. This qualifies a fresh short health sample; it does not establish the historical root cause or guarantee the burst cannot recur.

A resume transaction validated completed5-read recovery, unchanged OTP counters, all35 terminal acquisitions preserved, no read backlog or active workers/requests, cleared service-failure time window (without resetting failure history), all18 probe metrics HTTP/API200, and the shared two-slot limiter. It saved a run/rate beforeimage and probe evidence under `vg-completion-20261104-overnight6000:timeout-stop-qualified-resume-1`.

The existing cohort was then reopened at the same14 acquisition/eight reader plan, same gaps (learner30s, admin1s, per-IP1.5s, existing jitter), same6k cap and restored original Nov4 23:59:59 IST expiry. No uncertain authentication attempt was retried, no stop threshold was loosened, and no network setting changed. GPU remains excluded due SSH availability; test-uday remains excluded. The sheet was restarted alongside the workers.

Resume timestamp:19:08:57.099 IST. Verification19:10:16 IST: run active,14 acquisition/eight reader roles fresh,4,426 fully read (+9 after resume),four reads in progress,1,523 queued. All source calls since resume returned HTTP/API200; no new failures. All35 terminal acquisitions and nine account deferrals remain excluded.
