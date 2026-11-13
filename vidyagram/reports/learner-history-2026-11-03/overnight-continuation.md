# VG overnight continuation — 4 November 2026

The user explicitly requested continuing past the pilot while asleep. Existing source pacing remains fixed: 30-second learner pause, 1,000 ms shared admin gap, 1,500 ms per-IP gap and 0–250 ms jitter. No additional VM is added and no further throughput tuning is automatic.

## Scope and cutoff

- Current predecessor: `vg-completion-20261104-fleet2000`, 2,000 learner/OTP reservation ceiling.
- Next: `vg-completion-20261104-overnight6000`, maximum 6,000 additional fresh learners, selected with the same recent paid/unexpired/positive-history eligibility and existing claim/token exclusions. Seeding is atomic and starts this run paused as `queued_overnight`.
- Both runs expire at **09:00 IST on November 4** (`2026-11-04T03:30:00Z`); no new AppX calls can dispatch after expiry. An already-dispatched call may finish within its existing 20-second timeout. The cap is not a promise all 6,000 finish before cutoff.
- These workers capture source flags/mappings only. A separately managed ClassProgress import cron is documented in the shared script index; this change does not alter it. No further cohort extension, traffic increase, OTP resend or safety-stop restart is configured by this continuation.

The predecessor cutoff change is backed up in `apx_vg_completion_tuning_events`, `_id: vg-completion-20261104-fleet2000:overnight-cutoff`.

## VM-local operation

`vidyagram-completion-overnight.cjs` is a standby launcher on all 12 acquisition hosts, the two Azure reader roles and the existing OCI sheet host. Each role polls Mongo every 15 seconds without making AppX calls. It is detached through `nohup` + a dedicated `overnight-<role>.lock`. Cohort preparation itself is detached on migrator under `overnight-seed.lock`. Nothing depends on the local laptop staying connected; no SSH private key was copied to a server.

A handoff is allowed only after the predecessor is finished with a capture-complete status, its token failure count is still three (the preserved pre-overnight baseline), all 1,200 newly released predecessor learners are captured/mapping_exception, and no source 403/429 was recorded during that final stage. Missing/failed authentication, incomplete reads, a safety stop or a new failure prevents handoff. A missing next-run record means preparation is still running, so standby waits until cutoff.

One atomic compare-and-set opens the prepared next run; the others observe it. New workers use the existing per-role lock through blocking `flock`, so they wait for predecessor processes to exit. This also prevents the new sheet from racing the old updater's terminal refreshes. Existing Mongo job claims and reservation transactions prevent duplicate learners/OTP sends.

All continuation requests retain the shared gate, cooldowns, exact identity checks, single post-OTP admin-read retry, original three-failure stop and uncertain-outcome exclusions. A route block or 429 stops the continuation without moving to another cohort or restarting it. A DB failure causes the affected standby/worker to fail closed.

## Verification

37 full isolated migration tests passed after adding the overnight scope and handoff rules. The final four focused handoff tests also passed, covering wait/healthy start, stopped/incomplete/throttled predecessors, cutoff/expiry enforcement and preparation still in progress. Existing source cooldown, ownership, atomic OTP budget, no-OTP-resend and retry regression checks remain covered. Syntax and whitespace checks passed.

Launch logs were read back on every acquisition host and the primary reader/sheet: all showed `overnight-waiting` with the correct parent, next ID and cutoff. Background cohort selection was progressing; it is not another active acquisition fleet yet. The current pilot continues independently. The existing sheet switches to the continuation after the healthy handoff and old sheet lock release.

## Final preparation check at 01:54 IST

The next cohort is atomically seeded: exactly 6,000 learners and 34,808 course pairs. Its state is `queued_overnight`, `stopped:true`, zero OTP reservations, predecessor fleet2000 and fixed pacing/cutoff as above. All 12 acquisition standbys, both reader standbys and the sheet standby were read back as waiting. The cohort selector itself was detached under nohup; no laptop session needs to remain open.

At 01:54:46 IST the current pilot remained running with its historical token-failure count unchanged at three and 1,039 learners fully captured. The recent five-minute rate was 72 learners (864/hour); the ten-minute sample was 133 (798/hour). The prepared cohort has more course pairs per learner, so the current learner rate is not a guaranteed overnight rate. No new OTPs have yet been sent for the continuation.

## Morning result — 09:38 IST

The pilot finished at 03:03:16 IST with 1,995/2,000 learners fully captured, four failed acquisitions and one `read_failed` completion request (HTTP 500). Its final remainder captured 1,199/1,200 at an interval rate of 808/hour. Three post-OTP admin redirects were successfully recovered by the bounded read retry; no 403/429 occurred anywhere in the pilot.

The next 6,000-user run never started: standby logs at 03:03:28 IST show `overnight-not-started`, `health.completed:1199`, `blocks:0`. The strict complete-all handoff prevented continuation because of that single HTTP 500 read failure. All 6,000 remain queued with zero OTPs, and the fleet was idle from then through the 09:00 cutoff. This was a resilience gap in the setup: transient completion GET failures need bounded saved-token read recovery before a handoff is rejected. No retry or expiry extension was performed during this morning read-only status check.

The user subsequently authorised recovery and resumption. The failed read was recovered and the same 6,000-user cohort resumed at 10:04 IST with an 18:04 IST cutoff; see [daytime-resume.md](daytime-resume.md). This supersedes the paused/expired state above without changing the historical overnight result.
