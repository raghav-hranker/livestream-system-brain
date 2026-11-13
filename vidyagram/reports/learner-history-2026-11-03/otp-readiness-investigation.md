# VG OTP readiness investigation — November 4, 2026

## State at 13:15 IST

Run `vg-completion-20261104-overnight6000` remains stopped after the five-learner canary. Its acquisition ceiling is 460. Of 6,000 learners: 384 captured, 59 mapping exceptions (443 fully read), 17 terminal acquisition failures, and 5,540 queued. No saved-token read backlog remains. Raw acquisition failure counter is 9; terminal failures also include cascading stops.

The canary succeeded for learners 456 and 459. Learners 457 and 458 exposed no OTP through four bounded post-send reads; learner 460 retained the old OTP. Readiness guards prevented verification with missing or stale codes. No automatic resend was performed.

## Read-only follow-up

Five paced account lookups confirmed matching source identity. All five have enabled, nondeleted, paid accounts, ten-digit phone shapes and valid email shapes. Failed accounts do not stand out on these status fields. Follow-up reads still showed missing OTPs for 457/458 and an existing OTP for 460. Source timestamp strings require timezone-aware interpretation; no precise timing conclusion is drawn here.

Historical Quicktricks migration code tries phone then email; VG chooses a single identifier. Email fallback is a candidate explanation, not a proven fix. Quicktricks also has small header differences (`device-type`, `is-safari`, fuller user agent); their significance is unknown. No Quicktricks code or DB was changed.

## Next gate

Keep bulk acquisition stopped. Inspect the actual Vidyagram login request semantics and instrument only allowlisted send-response metadata before a small identifier experiment on unattempted learners. Preserve exact source-user identity verification, one-send protection, current pacing and immediate 403/429 stops. Do not reopen the fleet merely by increasing failure budgets. More VMs cannot resolve the current OTP readiness issue.

## User-authorised deferral resume — 13:28 IST

The user authorised setting individual authentication failures aside and continuing the existing cohort. The policy is opt-in on this run. Missing/stale OTP, unusable contact and verify HTTP 203 are recorded as `auth_deferred` with timestamp/reason and are excluded from automatic claims. Identity rejection on HTTP 200 is not classified as an account deferral. No send or verify retry was added.

Raw failure counts and events are preserved. A three-failure/60-second cluster still stops acquisition; this includes deferred account failures. Admin session errors and 403/429 stop the fleet immediately. The expiry stays November 4, 23:59:59 IST, pacing stays learner 30 seconds / shared admin 1 second / per IP 1.5 seconds with existing jitter, and the cohort stays at 6,000.

A transaction saved run/job beforeimages in `apx_vg_completion_recoveries`, ID `vg-completion-20261104-overnight6000:auth-defer-resume-1`, then reclassified six previously failed accounts. Other terminal or uncertain acquisitions were left excluded. The reviewed acquisition ceiling was reopened from 460 to the existing 6,000 maximum. No learner OTP was replayed.

The full existing test command passed 55 tests. A subsequent real worker-loop regression check passed with the policy enabled: the first account is deferred, the next is claimed, and its simulated 403 immediately stops the run. Both targeted deferral checks passed on the final source. Identical worker SHA-256 `53c16667812f079637ca6623671c0ad6289e1deb47baac4be17f4ff02ace7c50` was verified on all twelve acquisition hosts and the OCI sheet host before resume. Test-uday remains excluded.

At 13:28 IST, all 12 acquisition workers and 2 readers had fresh running heartbeats with the configured pacing. One new learner was fully read (444 total), six accounts deferred, eleven other terminal failures retained, and 5,528 queued. All instrumented source responses since resume were HTTP/API 200; no transport codes. The sheet published at 13:28:07 IST. These are startup checks, not a sustained throughput estimate.

Follow-up 13:28:49 IST: still running, 448 fully read (+5 since resume), eight deferred (+2 missing OTP), eleven other terminal jobs, 5,521 queued. Two isolated failures were successfully deferred while processing continued.

## Planning follow-up — 13:30 IST

The run stopped again at 13:29:23 IST: three new `otp_not_available` deferrals within the 60-second window triggered the cluster stop. Thus individual deferral works, but the cluster policy still allows a small concentration of account issues to stop the whole fleet. This limitation was explained to the user; no stop was cleared during this planning turn.

At 13:30:04 IST: 453 fully read (+10 since resume), nine deferred, eight saved-token reads pending (six ready/two interrupted), fourteen other terminal acquisitions, and 5,516 queued. The restart recorded no 403/429 or transport errors; all dispatched HTTP/API results were 200. Queue/response averages in milliseconds: admin 8425/173, verify 2188/240, send 2464/322, completion 2343/138. This is a short, stopped startup sample, not a sustained throughput benchmark.

Planning priorities: distinguish account-outcome rate from systemic service failure before another resume; recover saved-token reads; qualify bounded cross-IP concurrency while keeping aggregate admin pacing/shared cooldowns; measure sustainable throughput before adding capacity. A 30-second post-attempt pause across twelve single acquisition workers has an ideal upper bound of 1,440/hour. Two normal admin calls per learner with a shared one-second post-response gap impose a ceiling below 1,800/hour. Therefore 2,000 fully read/hour needs both acquisition capacity and a qualified change to admin demand or pacing. These are proposals, not implemented tuning changes.
