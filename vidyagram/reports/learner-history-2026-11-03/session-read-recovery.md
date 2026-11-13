# Session-stop saved-token recovery — November 4, 2026

The user authorised recovering the pending reads, then separately mentioned three additional VMs are available. SSH/access details for those VMs have been requested; none joined the fleet yet. Token acquisition is not authorised by this recovery and remains disabled.

A guarded `--network-stop --session-stop` recovery helper selected exactly 85 learners (84 token-ready and one interrupted read) with valid saved tokens, excluding all terminal/uncertain acquisitions. Transactional beforeimages live in `apx_vg_completion_recoveries`, ID `vg-completion-20261104-overnight6000:saved-token-recovery-session-stop-1`. The run is `readOnlyRecovery:true`, which blocks both acquisition claims and OTP reservations. Existing per-course read budgets are preserved. Recovery expires after 30 minutes; the prior end-of-day cutoff is saved in its beforeimage.

The 85 learners span 794 course pairs. At 15:47 IST, only completion GET requests were recorded, all HTTP/API200; OTP reservations/sends remained 1,311/1,307, exactly matching the pre-recovery counters. The original readers are migrator/migrator4. Two existing idle hosts, migrator3 and migrator5, were added as temporary read-only workers to shorten this heavy batch. The shared two-request in-flight cap, 1.5-second per-IP spacing and all source failure stops stay unchanged. No additional VMs or acquisition workers were started. The live sheet updater was restarted.

After recovery, verify all 85 finished and no new OTPs, then leave acquisition paused. Restore the saved original cutoff when closing the bounded recovery; do not reopen the queue without the user's instruction.

## Three new VMs prepared

The user supplied `4.240.103.74`, `20.193.154.220`, and `57.159.31.41`. Verified identities are migrator10, migrator11 and migrator12, all using azureuser / the existing raghav SSH key. Each has the isolated Node24.20.0 runtime and mode600 VG env. All passed outbound-IP match, TCP27017 checks on all three Mongo members, a VG Mongo connection and one paced admin identity lookup (HTTP/API200). There are no Vidyagram cron entries. The current tested scripts and explicit hostname-to-egress launcher mappings were installed. No acquisition or OTP was started on the new hosts.

At 15:53:33 IST, 75 of 85 recovery learners had finished, 714 completion GETs and three new-VM admin preflights were all HTTP/API200. Four read-only workers were active, OTP counters were unchanged, and 4,685 queued acquisition jobs were untouched.

## Completed — 15:54:12 IST

All 85 selected learners finished: 43 captured and 42 mapping exceptions. Total fully read is now 1,287 (1,027 captured + 260 mapping exceptions). The recovery made 787 completion GETs; seven course captures were already present, completing all 794 planned course pairs. All 787 responses and the three new-VM admin probes were HTTP/API200 with no transport errors. OTP reservation/send counters stayed exactly 1,311/1,307. All four readers exited normally. The 4,685 queued learners, one waiting-session job, nine account deferrals and eighteen other terminal acquisitions remain untouched.

The guarded close-out preview and commit both passed. It backed up final run state in the recovery record, restored the saved November4 23:59:59 IST expiry, and left `stopped:true`, `readOnlyRecovery:true`, status `reads_recovered_acquisition_paused`. No acquisition role was started. The sheet published the final 4,925 course rows at 15:54:59 IST.

The three new VMs are prepared and preflighted, but have not joined live acquisition. A future acquisition resume requires a new user instruction; its pacing, cohort and OTP limits must remain guarded. No automatic action is armed to clear the pause.
