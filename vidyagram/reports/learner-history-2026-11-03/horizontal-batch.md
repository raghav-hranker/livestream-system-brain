# VG completion worker move — 3 November 2026

User requested phonetics and testing-server-selectionway, with no VG completion work on test-uday. This is a new bounded 50-learner capture batch at the existing 60-second per-worker pacing. It is not an unbounded migration or a shorter-interval experiment.

## Runs and data

- First run: `vg-completion-20261103-pilot50`, complete with exceptions: 47 tokens, 142 course pairs read, 489 positive source flags, 462 mapped class completions, 27 unresolved source flags, 3 learners blocked on rejected source routes. Its records remain intact.
- New run: `vg-completion-20261103-horizontal50`, maximum 50 new learners; candidate selection excludes every learner with a prior job under another run.
- Collections in `vidyagramdb`: `apx_vg_completion_pilots`, `apx_vg_completion_jobs`, `apx_vg_completion_captures`, `apx_vg_completion_workers`; token cache `apxtestusertokens` scoped to org `2177599`.
- Capture only. Source flags and exact-ID mappings are staged. No ClassProgress rows are created or updated. The user clarified that VG is prelaunch, so the earlier native-uncompletion safeguard is not a blocker for subsequent prelaunch import work.

## Intended worker placement

| Host | Role | Directory |
|---|---|---|
| phonetics | Token acquisition and immediate completion reads | `/home/raghav/vidyagram-completion-horizontal-20261103` |
| testing-server-selectionway | Token acquisition | `/home/raghav/vidyagram-completion-horizontal-20261103` |
| 178.63.88.34 | Existing working token-acquisition host | `/root/vidyagram-completion-pilot-20261103` |
| OCI bastion | Existing Google Sheet updater only | `/home/opc/vidyagram/completion-pilot-20261103` |
| test-uday | Disabled for this migration at user request | Old artifacts retained; launcher refuses new starts |

Both new VMs passed tenant DB / live AppX admin identity checks. Existing dependencies are reused; no service repo is changed, package installed, or unrelated service restarted. Phonetics has little disk headroom, so only small scripts and bounded logs are added there.

## Operation

Every launch must specify `VG_COMPLETION_RUN=vg-completion-20261103-horizontal50`. The launcher inherits it into the worker. Do not restart the old run to increase its budget.

- Shared atomic claims prevent duplicate learner acquisition across hosts.
- At most 50 OTP reservations; persist each reservation before sending. An uncertain send is not automatically repeated.
- Save each verified identity-matched token before queueing completion reads. Phonetics reads ready tokens continuously while other hosts acquire the next ones.
- Any source 429 stops this batch globally. An acquisition HTTP 403 stops that host. Other token failures stop the batch after three. A renewed admin session may be required if its keepalive expires.
- Four-hour expiry bounds unattended waiting. Workers stop when the queue finishes. The sheet updater stops after its final terminal-state refreshes.
- To stop the batch, run the pilot script's `stop` command on phonetics with its isolated VG env and the explicit new run ID. This changes the shared control; all batch workers observe it. Do not use a broad process kill.

The current sheet view is [Completion summary](https://docs.google.com/spreadsheets/d/1S8WDIGKnt0gwQB_dVhasseUOgmAtLQbjS3iH5wyglGY/edit#gid=1603878611), with separate learner/course tabs. It shows the selected run, live counts and refresh time; it is not an aggregate across both runs. Switching runs clears only these dedicated tabs, preventing leftover old rows.

Validation: eight isolated MongoDB tests passed after the run-selection and immediate catalogue-ledger mapping changes; JavaScript and shell syntax checks passed. Actual worker-start results and the first checkpoint are recorded below after launch.

## Launch verification

- New cohort seeded at 16:00 IST: 50 new learners, 140 course pairs, excluding the first pilot's claimed learners.
- Phonetics canary succeeded at 16:00:34 IST; token saved, both relevant courses captured by 16:00:36. No ClassProgress writes.
- Three acquisition workers launched with the explicit new run ID. Successful acquisitions were verified in logs on both testing-server-selectionway (16:01:21, 16:02:25) and the GPU host (16:01:31). Phonetics immediately read those tokens' course flags.
- At 16:02:43 IST: 6 tokens saved and all 6 learners read, 12 course pairs captured, 23 positive flags, 16 mapped class completions, 7 unresolved flags, zero token failures. A seventh acquisition was in flight. This is an initial checkpoint, not the final batch result.
- Google Sheets read-back at 16:02:46 verified the new run ID, selected 50 learners, the same counts, and frozen header rows. The updater refreshes every ~15 seconds.
- No VG worker/mapper processes remained on test-uday when checked. Its VG launcher now exits with an explicit disabled-at-user-request message. Quicktricks workers and unrelated services were not stopped.
- Estimate after the three routes succeeded: approximately 20–25 minutes processing for 50 learners, assuming no throttling/session/access interruption. A conservative completion window is around 16:25–16:30 IST. The finite queue and four-hour expiry remain enforced.

The user considered Cloudflare during setup and explicitly declined it; this run remains VM-only.
