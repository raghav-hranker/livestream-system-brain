# VG network incident and 50k/day capacity assessment — 4 November 2026

The user requested investigation of the resumed batch's clustered request failures and a target of about 50,000 captured learners today. More VMs are available; SSH details remain to be supplied. No additional paid resource was provisioned.

## Incident and recovery

The 6,000-user batch stopped at 10:19:44 IST on three substantive acquisition failures: migrator2 had an admin lookup fetch TypeError; migrator3 and migrator8 had OTP-send TypeErrors. They occurred within four seconds, with 252–260 ms request durations and no HTTP response. Four additional `pilot_stopped` acquisition records were cascading stop results, not new transport faults. No source 403/429 was recorded. OTP-send delivery is uncertain and was not replayed.

All 37 pending saved-token learners were recovered with acquisition disabled and no new OTPs. The cohort now had 202 fully captured learners, seven terminal acquisitions aside, 5,791 queued and no pending reads. Beforeimages: `apx_vg_completion_recoveries`, `_id: vg-completion-20261104-overnight6000:saved-token-recovery-network-stop-1`.

## Diagnosis and practical fix

The original telemetry discarded the nested cause, retaining only TypeError. That prevents proving the original transport root cause retrospectively. Three affected VMs each ran 20 then 200 bounded, normally paced admin/cached-token GETs: **660/660 passed**, with zero OTPs. No failure was reproduced in that live sample.

Ranked hypotheses were connection-family fallback timing, a regional connection reset/interruption, and DNS failure. Each affected Azure VM reports Node v24.20.0 with automatic family selection, 250 ms attempt timeout, and both A/AAAA source addresses. Local IPv6 routing is unavailable on the checked host. The timing resembles the IPv4-timeout/IPv6-fallback pattern in [Node issue 54359](https://github.com/nodejs/node/issues/54359), but this remains an unconfirmed hypothesis. The issue's old public reproduction host no longer resolved, so its two-setting comparison was inconclusive. No IPv4-only, timeout or routing change was applied on that evidence.

Permanent request telemetry now retains only allowlisted nested transport codes such as ETIMEDOUT, ENETUNREACH, ECONNRESET, ENOTFOUND and UND_ERR_CONNECT_TIMEOUT. No raw error message, headers, body, URL, token or contact is logged. A request-boundary regression verifies both useful codes and absence of private strings.

Safe admin GETs now have at most three attempts for TypeError/TimeoutError or transient 500/502/503/504 responses, backing off 2/4 seconds through normal gates. Source 403/429, invalid identity and run/lease stops do not retry. The prior post-OTP redirect retry remains bounded. OTP send/verification endpoints remain single-shot. Regression fixtures reproduced the admin network failure before this patch, and 47 isolated tests passed afterwards, including exactly one OTP send. Existing completion-GET durable three-attempt budgets are unchanged.

## Controlled resumption

After recovery, no pending reads, no source 403/429, a live admin preflight and beforeimage capture, the next 500 unstarted learners were admitted (priorities 209–708, acquisition ceiling 709). The original three failures were preserved with `tokenFailureBaseline:3`; three additional substantive acquisition failures still stop the stage. Shared admin gap remains 1,000 ms, per-IP gap 1,500 ms, learner pause 30,000 ms. No gate was relaxed during this diagnosis.

The user specified today's target, so the run's bounded expiry is now 23:59:59 IST on November 4. The 6,000-user OTP cap remains unchanged. Event: `apx_vg_completion_tuning_events`, `_id: vg-completion-20261104-overnight6000:network-investigation-resume500`.

All 12 acquisition roles and two readers were restarted, with the existing sheet. An app heartbeat `watch-vg-capture-today` checks health every ten minutes until today's end, stays quiet on unchanged/healthy states and alerts only on a new stop/checkpoint/expiry, meaningful transport/authentication finding, 403/429 or completion. It does not clear safety stops or restart acquisition. VM workers remain independent of the local computer; the app heartbeat is an app-side follow-up.

## Capacity needed for 50,000 today

Around noon, roughly 48,000 further captured learners over approximately twelve hours requires roughly 4,000–4,200/hour. This is over five times the demonstrated stable fleet rate. These are required rates, not achieved capacity.

- Twelve single acquisition workers at 30-second post-attempt pauses cannot exceed 1,440 learners/hour even if attempts took no time. Actual capacity is lower.
- Two shared admin calls per learner at the current one-second gap alone impose a ceiling below 1,800 learners/hour before latency/jitter. More servers do not remove that shared constraint.
- The prepared 6,000-user cohort contains 34,808 planned course pairs: about 9.8 normal AppX calls per learner including four acquisition calls. A 4,100/hour goal implies about 40,000 calls/hour, around 11 requests/second overall.
- At the existing 1.5-second per-IP gap, twelve IPs allow at most eight requests/second before network time/jitter. This alone is below that target's request requirement.
- More than 34 acquisition workers are required at 30-second pauses even with zero work time; real worker count depends on measured work, queueing and reader capacity. Worker count and VM count need not be equal, but workers sharing an IP must share its limiter.

The next qualification must introduce bounded cross-IP in-flight concurrency while retaining per-IP/admin pacing and shared cooldowns, measure worker/reader utilisation, then raise aggregate allowance in finite stages only if source responses stay healthy. Additional supplied VMs can be prepared in parallel. The source's sustainable aggregate allowance is unknown; 50,000 today is not a credible promise until the necessary sustained rate is demonstrated. No proxy rotation, route-block clearing or unbounded traffic increase is justified by the target.

## Health-check alert at 12:48 IST

The resumed observation stage stopped at 12:46:29 IST on three new substantive acquisition failures: two OTP verification HTTP/API 203 rejections and one `otp_not_available`. Four additional `pilot_stopped` records were cascading stop results. No new transport-code/network errors or source 403/429 were recorded during this observation. At the check, 404 learners were fully captured in this cohort; 35 token-ready and two interrupted reads remained, with all 14 worker roles stopped. The monitor performed only read-only diagnosis and notified the user; no OTP replay, safety-stop clearing, acquisition restart or pacing change was made. This is a different failure category from the earlier network incident; HTTP 203 alone does not establish its underlying cause.
