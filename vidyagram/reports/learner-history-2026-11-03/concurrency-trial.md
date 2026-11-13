# VG two-slot concurrency qualification — November 4, 2026

## Authorised scope

The user approved separating account deferrals from service failures, recovering the eight saved-token reads, and a bounded cross-IP concurrency qualification. No proxy, additional VM, shorter gap or OTP replay is involved. Test-uday stays excluded.

## Recovery

Eight pending learners were fully read using saved tokens, acquisition disabled. The run reached 461 fully read learners (397 captured + 64 mapping exceptions), nine account deferrals and fourteen other terminal acquisitions. Beforeimages: `apx_vg_completion_recoveries`, ID `vg-completion-20261104-overnight6000:saved-token-recovery-auth-deferral-stop-1`. Recovery finished 13:36:11 IST.

## Policy and scheduler

Account outcomes and service failures now have separate guards. Missing/stale OTPs, unusable contacts and verify HTTP 203 remain terminal `auth_deferred`, with no automatic resend. They do not count toward the three-service-failures/60-second stop. Account failures have their own guard: ten consecutive failures, or at least 30% account failures in the last 50 outcomes (minimum 20). The guard includes the previous restart's 21 resolved acquisition outcomes: 18 successes and 3 deferrals. Invalid outcome history fails closed. Raw failure counts and event history are preserved. Session problems and 403/429 stop immediately.

The organisation-wide HTTP mutex has been replaced by atomic, expiring Mongo slot leases. Default concurrency stays one; only widths one and two are accepted. The shared org document still carries cooldowns. Dispatch checks that cooldown again after acquiring a slot. Per-IP and shared admin leases remain held across each request; their post-response gaps are unchanged. At most two HTTP requests may be in flight across the completion fleet, and same-IP requests remain exclusive. 429 propagates to the shared org cooldown and requests are never replayed by the scheduler.

A concurrent successful request cannot overwrite a stop status set by another worker. This race received a separate regression check.

## Validation

The final full suite passed 60 tests; the separate stop-status regression also passed. Tests demonstrate actual cross-IP overlap capped at two, same-IP and admin spacing, two-slot shared cooldowns, no OTP replay, lease recovery, invalid-width fail-closed behaviour, ownership/run-stop guards, transport redaction, and separate account/service circuits. The first overlap test exposed the old dispatch mutex/polling bottleneck; that version was not activated.

Final pilot SHA-256 deployed identically to all twelve acquisition hosts and the OCI sheet host: `725e81ab3c6747408b16279295d74b930764e170cc6776d31188acd2429347b9`.

## Live trial

Preparer `vidyagram-completion-concurrency-trial.cjs` transactionally backed up run/rate state under recovery ID `vg-completion-20261104-overnight6000:concurrency2-trial50`. Priorities 484–533 are the exact 50 unattempted learners; acquisition ceiling is 534. Slots are two. Final cutoff restored from the saved pre-recovery run: November 4, 23:59:59 IST. Gaps remain learner 30s, per-IP 1.5s, shared admin 1s, jitter 0–250ms.

Trial prepared at 13:40:25 IST, followed by all twelve acquisition workers, two readers, and sheet restart. At 13:41:16 IST, five new learners were fully read, no new deferrals/errors were recorded, and all instrumented source responses were HTTP/API 200 with no transport codes. Early timing is startup evidence, not a sustained speed estimate. The trial pauses at the checkpoint for review before any further expansion.

Follow-up 13:43:24 IST: 35/50 fully read, zero new deferrals or source errors, 12 acquisition/2 reader roles healthy. Mean admin wait 5,184ms versus prior restart 8,425ms; completion wait 1,217ms versus 2,343ms. These cohorts differ, so this indicates reduced waiting rather than a controlled percentage throughput improvement. Source response latency remains well below mean queue wait.

## Successful checkpoint and continuation

All 50 trial learners were fully read: 45 captured and five mapping exceptions. There were no new account deferrals, transport errors or 403/429. The 362 instrumented requests all returned HTTP/API 200. First request: 13:40:49.964 IST; last learner read: 13:44:24.904 IST, approximately 215 seconds. This short trial corresponds to 837 fully read learners/hour, not a sustained-hour measurement and not qualification of 2,000/hour. Timestamp intervals show two overlapping HTTP requests; the distributed slot cap remains two.

Mean queue waits: admin 4,675ms, completion 1,214ms, send 2,235ms, verify 2,941ms. Prior stopped restart admin/completion means were 8,425/2,343ms. Cohorts and durations differ, so no controlled speedup percentage is claimed. Long admin/verify wait tails remain and should guide later tuning.

The checkpoint stopped all 14 worker roles as intended. A guarded review transaction saved run/rate state and assessment under `vg-completion-20261104-overnight6000:concurrency2-qualified-continuation`, then restored the existing acquisition ceiling of 6,000. No new cohort, OTP budget, gap reduction or concurrency increase was introduced. The same fleet and sheet were restarted; expiry remains November 4, 23:59:59 IST. At the checkpoint: 511 fully read, nine deferred, fourteen other terminal acquisitions, and 5,466 queued.

Final request scheduler SHA-256 verified on all thirteen deployment hosts: `c80716aebdd3a94744bd33a737bac487a894863a1c927ac26fffd13ae7a72914`.

Continuation verified at 13:46:31 IST: running, all 12 acquisition and two reader roles fresh, 519 fully read (+8 after trial), nine deferred, 5,453 queued, three saved-token reads pending and two acquisitions in flight. All source responses since trial start remain HTTP/API 200 with no transport codes. Sheet published 13:46:35 IST.

## Monitor stop — 14:35:05 IST

At the 14:37 monitor, the run was stopped with `admin_session_review` following an admin lookup HTTP307 before any OTP attempt for that learner. Two admin307 responses occurred since the prior check, with 234 admin200 responses in the same interval. Later shared session metadata, checked at 14:38:00 IST, reports active/HTTP200 with zero consecutive redirects; session expiry is therefore not proven and the stop may reflect a transient redirect. No source probe, restart, OTP replay or policy change was performed. At stop review: 1,202 fully read, nine deferred, 84 token-ready plus one interrupted read, 18 other terminal acquisitions, one waiting-session job and 4,685 queued. No source403/429 or transport codes. User notified once; manual review is needed before resuming.

## User-requested live session check — 15:43 IST

Three fresh paced read-only admin lookups passed HTTP/API200 with exact source identity checks: the original affected account, a control account, and a repeat of the affected account. The saved session is usable now; no reconnection is currently indicated. This supports a transient-redirect explanation but does not prove the original redirect cause. No OTP was sent, no session record was activated or overwritten, no stop was cleared, and capture remains paused with `admin_session_review`.
