# VG Azure pacing test — 3 November 2026

User explicitly authorised `ssh -i raghav azureuser@20.193.151.140` for the next bounded acquisition test. Verified login uses `~/.ssh/raghav`; hostname `migrator`, x86-64, about 8 GB RAM and 27 GB free disk at setup.

## Prepared

- Directory: `/home/azureuser/vidyagram-completion-azure-20261103`.
- Isolated Node 24.20.0 downloaded from nodejs.org and verified against its official SHA-256 list. Dependencies pinned to mongodb 6.16.0 and dotenv 16.5.0. No system packages or other app services changed.
- Only the existing VG Mongo URI was transferred over SSH into a mode-600 env file. No personal SSH key or Google service-account key was copied to Azure.
- Tenant-guarded worker and shared request gate deployed. Approved run ID: `vg-completion-20261103-azure50`, maximum 50 new learners, excluding prior claimed learners and existing cached tokens for a genuine acquisition comparison.
- First 10 learners use 60-second post-acquisition spacing. Remaining 40 may use 30 seconds only after all 10 baseline learners have real tokens and complete source reads, with no 429 response in the run. Other run policies remain unchanged.
- Every request continues through shared per-IP/admin/org gates. A 403 or 429 stops this experiment. An uncertain OTP send is not retried. ClassProgress is never written by this capture test.
- Experiment phase and learner interval are retained on each job and request metrics. Sheet code is prepared to show the phase and comparable inter-token rates after five minutes of samples.
- Twenty-one isolated MongoDB tests pass, including explicit rejection of acceleration with an incomplete baseline or any recorded 429.

## Initial network blocker — resolved

Azure could not connect to any rs0 member. Sanitized live diagnostics returned `MongoNetworkTimeoutError` for all three destinations: `148.113.8.241:27017`, `148.113.9.86:27017`, `148.113.17.30:27017`.

The timeout established an unreachable network path, not which firewall was responsible. The user was asked to allowlist the source or provide the verified firewall-management route, then replied “done”.

No learner queue or OTP was created while connectivity was unavailable. The worker failed closed because it could not coordinate claims, limits or token persistence without MongoDB.

At 17:04 IST, the live Azure recheck succeeded: Mongo connectivity plus one admin lookup and two cached-token completion GETs, all HTTP/API 200. No OTP was sent by that preflight. The authorised 50-learner test can now proceed.

## Started

- At 17:05:17 IST, the queue was seeded with 50 new learners and 141 course pairs, excluding all previous claimed learners and cached tokens.
- The Azure `both` worker and existing OCI sheet updater were launched with `VG_COMPLETION_RUN=vg-completion-20261103-azure50`. No acquisition worker on another server was started for this experiment; test-uday remains excluded.
- First token saved at 17:06:29 IST. Both relevant courses were captured by 17:06:33. Admin lookup, OTP send, refreshed lookup, verification and both completion reads returned HTTP/API 200. Request logs retain baseline phase and 60,000 ms learner spacing.
- Baseline-first transition and stop-on-throttle controls remain active. The experiment is bounded to this cohort; it does not automatically extend into the full migration. Captured marks remain staged.
- Initial runtime estimate: approximately 40–50 minutes from the first token (roughly 17:45–17:55 IST), conditional on source/session availability and no throttling. This is an estimate, not a measured completed-run rate.
- Sheet read-back at 17:08:17 IST verified the Azure run, 2/50 tokens, 5/141 course pairs, baseline phase, zero 403/429 and zero token failures. One source completion flag remained unmapped. New acquisition/reader attribution both correctly identify `migrator`.

## Resume after network access

1. Repeat Azure's `request-probe` using the isolated env and `VG_EGRESS_ID=20.193.151.140`. This makes one admin lookup and two cached-token reads without OTPs. It must succeed before seeding.
2. Seed `vg-completion-20261103-azure50` with the explicit run ID: exactly 50 new learners, excluding prior jobs/cached tokens.
3. Start `vidyagram-completion-start.sh both` on Azure with that run ID. The 10/40 phase transition is automatic and guarded.
4. Deploy the matching worker module/request-client/sheet code to the existing OCI sheet host, then start its sheet role with the Azure run ID. Existing pilot data remains in Mongo.
5. Verify the first acquired token and immediate course reads; estimate duration from measured Azure acquisition and read overhead. Do not describe the experiment as running until these steps succeed.
