# VG429 conservative recovery — November4,2026

## Authorised plan

The user approved fixing rate-limit stop reporting, checking cooldown/backoff, recovering five saved-token reads and testing25 fresh learners only if the read test passed, at lower aggregate throughput. All uncertain authentication attempts must remain excluded.

## Fix and validation

`stopRun` now updates the stop reason atomically using priorities: route403 above throttle429 above session review above service/account failure. Later lower-priority or duplicate stops cannot overwrite the original higher-priority cause/time. Unknown pre-existing stops are preserved. `admin_shared_pause` is treated as shared throttling, not an invalid session or a new token failure; pre-OTP jobs remain waiting and attempted jobs remain uncertain. Rate-limit stops are written before releasing a job to read-retry to reduce reclaim races.

All70 tests passed, including concurrent429/session stops,403 priority, shared-pause classification with zero OTPs and cached-read429 with no source replay. The tested pilot SHA256 `020a641cf3be4b8f5036035e1c2c2b50353201ac147a90ee030e2ad721510bdc` was deployed to all reachable authorised hosts; GPU remains excluded.

## Conservative configuration and recovery gate

The original429 evidence was used to correct the historic `admin_session_review` label to `experiment_throttled` while keeping its original20:32:38.788IST stop timestamp. Run/rate beforeimages are in tuning event `vg-completion-20261104-overnight6000:429-stop-correction-and-conservative-recovery`. The recorded cooldown had elapsed. Shared concurrency was reduced2->1, and no learned penalty/cooldown was reset. Planned source gaps: learner60s, per-IP3s, admin2s, jitter unchanged. The intended25-learner canary would use4 acquisition workers and2 readers, but it was conditional on successful saved-token recovery.

Recovery helper `--network-stop --rate-stop` selected exactly five interrupted saved-token jobs, excluded all46 terminal acquisitions/ten deferrals, backed up beforeimages under `vg-completion-20261104-overnight6000:saved-token-recovery-rate-stop-1`, and disabled acquisition at both claim/reservation boundaries. Two read-only workers started on migrator and migrator6. The previously affected migrator6 IP retained penalty2, giving a6-second base post-response gap with the new3-second base setting.

## Gate failed: second429

Only three source calls occurred:

-20:48:41.954IST,migrator6 completion GET:200.
-20:48:42.770IST,migrator completion GET:200.
-20:48:46.120IST,migrator completion GET:429 (477ms).

The code stopped immediately at20:48:46.666IST with `experiment_throttled` and HTTP429 stop cause, preserved correctly. The second429 was on a different existing IP from the first event; this weakens an IP-only explanation but does not establish the quota scope. Shared penalty increased2->4 automatically and the new cooldown was retained. No further source probe, endpoint retry, alternate-IP retry, OTP send or acquisition was started.

No learner in this five-job recovery completed, though two individual course reads were persisted. All five remain pending; current full-learner total5,292 and queued647 are unchanged. OTP counters remained5,342 reservations/5,332 sends. The25-learner canary was NOT started because its prerequisite failed.

A guarded recovery close-out stored its failed outcome/beforeimage, restored the original November4 23:59:59IST cutoff, and left `stopped:true`, `readOnlyRecovery:true`, status `experiment_throttled`, concurrency1 and all learned backoff intact. The new phase is `held_after_repeat_429`, with zero planned active workers. No automatic retry/restart is armed.

Next safe action is a longer cool-off or clarification of the source's quota/allowance before another bounded test. Do not infer safety merely from expiry of the recorded1-minute cooldown, add servers to bypass it, or reset learned penalties.
