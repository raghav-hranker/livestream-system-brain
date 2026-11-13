# VG expanded fleet resume — November 4, 2026

## Authorisation and change

The user authorised bounded handling of transient admin307 redirects, then resumption with fifteen acquisition workers and four readers at existing pacing. New `preOtpAdminUser` retries only the initial admin GET, at most three attempts with 2/4-second backoff, before any OTP reservation or send. Each attempt re-reads the saved session, respects the existing rate gates, and requires HTTP/API200 with exact source identity. A persistent307 still reaches `admin_session_review`; 403/429 and identity mismatch do not retry. Run stops and lost ownership prevent further dispatch. The existing post-OTP lookup retry and OTP send/verify single-shot policy are unchanged.

All 67 tests passed, covering transient and persistent pre-send redirects, stop during backoff, identity mismatch, 403/429, no OTP replay, existing freshness checks, request semaphore, read retries and policy circuits. A fresh admin preflight passed HTTP/API200 with identity match. Final pilot SHA-256 on all reachable deployment hosts is `98b2c6ed7b1d3303c218429caba8944ed79906f77ae1054d37ee04584aa5f8ed`.

## GPU exception

The GPU host `178.63.88.34` could not be reached over its verified SSH login/key: two direct connection timeouts and one management-hop banner timeout via the existing Azure host. No alternative account/key was attempted, no private key was copied, and no AppX egress route was changed. Its DB worker record confirms a normal stop at 14:35:08 IST, so it was excluded rather than started on old code. This is an SSH management-access limitation, not evidence of an AppX IP block.

The usable fleet is therefore fourteen acquisition workers (all twelve Azure VMs plus the two GCP workers) and four readers on migrator, migrator3, migrator4 and migrator5. The three newly supplied hosts migrator10/11/12 are included. Test-uday remains excluded. The OCI sheet runs separately.

## Guarded resume

A transaction saved the paused run/rate beforeimages under `apx_vg_completion_recoveries`, ID `vg-completion-20261104-overnight6000:redirect-retry-fleet15-resume-1`. It verified completed85-read recovery, no read backlog, no active workers/requests, unchanged OTP counters1,311/1,307, queued4,685 and exactly one waiting-session learner with no prior OTP attempt. New-VM paced admin preflights were checked, and shared concurrency/cooldown state was guarded.

The existing cohort was reopened at 16:06:51 IST (`fleet15ResumedAt`), with planned acquisition workers14/readers4. The end-of-day Nov4 cutoff, 6,000-user ceiling, two in-flight requests, 30-second learner pause, 1-second shared admin gap, 1.5-second per-IP gap and existing jitter remain unchanged. All terminal/uncertain acquisitions and nine account deferrals stay excluded. The original waiting-session learner is eligible because its earlier failure occurred before any OTP attempt; it subsequently reached captured state.

## Startup checks

At 16:08:07 IST, fourteen acquisition/four reader roles had fresh running heartbeats, five new learners were fully read (1,292 total), and no substantive job failure was recorded. One source307 appeared amid HTTP/API200 calls. Follow-up showed a pre-OTP redirect retry recovered successfully; another was awaiting its bounded retry. At 16:09 IST, each of migrator10/11/12 had two successful HTTP/API200 verification calls. The GPU remains stopped. The sheet published at 16:09:03 IST. These are health checks; a 20–30-minute window is needed for expanded-fleet speed comparison.

Follow-up16:10:30 IST: all eighteen worker roles (14 acquisition +4 read) have fresh running heartbeats. Two jobs have `preOtpAdminReadRecoveredAt` after one read-only redirect retry each; one is captured and one token-ready. A temporarily older heartbeat belonged to an admin-gate wait and refreshed normally; no worker was restarted for it. At16:09:51 IST, total fully read was1,310 (+23 since resume), queue4,638, with twenty saved-token reads pending/in progress. No 403/429 or transport errors, and no increase in raw failure/deferral counters.
