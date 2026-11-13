# VG completion recovery and daytime resume — 4 November 2026

The user authorised fixing transient completion-read recovery, recovering the pending learner and resuming the queued 6,000-user cohort after the missed overnight handoff.

## Read recovery

`vidyagram-completion-pilot.cjs` now persists `completionReadAttempts.<apxCourseId>` on the learner job before each completion GET. At most three attempts are allowed per learner/course, including across process restarts. HTTP/API 500, 502, 503, 504 and fetch TypeError/TimeoutError can retry after 2 and 4 seconds through the existing shared gate. Other errors, identity/data-shape failures, 403/429, run stops and ownership loss do not retry. Captured course pairs are skipped as before. OTP sending and verification are never invoked by this path.

The failing regression fixtures reproduced the missing HTTP 500/network recovery before the patch. The full 44-test isolated suite passed afterwards, including recovery, persistent failures exhausting the durable budget, no further calls after exhaustion, no OTP calls, immediate 403/429 handling and a stop during backoff. Syntax and whitespace checks passed. The patched worker was copied to all 12 acquisition hosts, both reader locations and the sheet integration.

The final pilot recovery was prepared with a transactionally stored beforeimage (`apx_vg_completion_recoveries`, `_id: vg-completion-20261104-fleet2000:saved-token-recovery-final500`). It admitted only the known failed completion GET using its saved token, with acquisition disabled at claim/reservation boundaries. Its original failed request counts as attempt one. The learner was fully read at 10:02:21 IST, with zero OTP sends, bringing pilot coverage to 1,996/2,000; four historical acquisition failures remain excluded. The predecessor status was restored to capture-complete-with-exceptions, with recovery time retained and beforeimages preserving the original finish time.

## Resumed 6,000-user cohort

After verifying the final 1,200 predecessor learners were all fully read, no source 403/429, all workers stopped, the next cohort unchanged at 6,000 queued/zero reservations, and a successful live admin identity preflight:

- Run `vg-completion-20261104-overnight6000` resumed at **10:04:23 IST** with a new eight-hour expiry: **18:04:23 IST**.
- All 12 acquisition workers and two dedicated readers run at the same tested settings: learner pause 30 seconds, shared admin gap 1 second, per-IP request gap 1.5 seconds.
- The expired VM-local overnight waiters were not restarted. This user-authorised daytime resume launches the existing bounded run directly; no new cohort is seeded and its 6,000-OTP ceiling is unchanged.
- Historical states/cutoff are backed up in `apx_vg_completion_tuning_events`, `_id: vg-completion-20261104-overnight6000:daytime-resume-20261104`. No throttle block or failure count was cleared. The resumed run retains its original zero-failure starting state and three-failure stop.
- Source capture/mapping only; the separately managed progress-import cron remains untouched. Test-uday remains excluded from completion acquisition/read roles.

At **10:06:33 IST**, all 14 roles were verified with the intended settings: 15 learners fully captured, two reading, one saved-token learner waiting, seven acquiring and 5,975 queued. There were 21 successful OTP sends, zero token failures, and no non-200/error metrics in the new run. The sheet updater was verified publishing 6,000 learners and fresh course rows.
