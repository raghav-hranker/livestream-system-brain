# VG completion fleet endurance run — 3 November 2026

User authorised proceeding at 30-second learner spacing and adding Azure VMs `20.193.132.31` and `20.193.139.89`, stating they were whitelisted. A bounded 500-new-learner endurance batch was prepared with the original VM at 30 seconds and additions at 60 seconds; shared request limits remain unchanged.

## Run

- ID: `vg-completion-20261103-fleet500`.
- Exactly 500 new learners, excluding earlier claimed learners and cached tokens; 1,486 relevant course pairs.
- Seeded at 18:22:38 IST, expires at 02:22:38 IST on November 4. No automatic cohort extension.
- Shared atomic job claims and OTP reservations cap the whole fleet at 500, not 500 per server. Earlier runs retain their 50-user bounds and all source records.
- Every token is saved before its course flags are read; capture/mapping only, no ClassProgress writes.
- Stop the endurance run globally on HTTP/API 429 or route 403. Uncertain OTP outcomes are not automatically replayed. The request gate retains per-IP, shared-admin and conservative organisation coordination.

## Hosts

| VM | Egress IPv4 | Role | Learner spacing | Verified state |
|---|---|---|---:|---|
| migrator | 20.193.151.140 | acquisition + immediate reads for the fleet | 30 sec | Running |
| migrator3 | 20.193.139.89 | acquisition | 60 sec | Running; first two tokens verified |
| migrator2 | 20.193.132.31 | acquisition | 60 sec | Running; first token verified |
| phonetics | 34.126.210.209 | acquisition | 60 sec | Running; first token verified at 18:39:29 IST |
| testing-server-selectionway | 34.131.242.233 | acquisition | 60 sec | Running; first token verified at 18:39:36 IST |
| GPU server | 178.63.88.34 | acquisition | 60 sec | Running; first token verified at 18:40:01 IST |

All new VMs already had the copied pinned Node runtime and mode-600 VG env. Both were reached using the user-supplied Azure login/key. Launcher host cases were extended to give each VM its own egress-IP limiter key; snapshot log files were not used as evidence of new work.

Original VM and migrator3 each passed one live admin lookup plus two cached-token reads, all HTTP/API 200. Migrator2 timed out against all three members (`148.113.8.241`, `148.113.9.86`, `148.113.17.30`) on TCP 27017. A public egress check returned `20.193.132.31`; local UFW is inactive and OUTPUT policy ACCEPT. The user was asked to recheck source allowlisting; no OTP was sent from that VM.

## Initial checkpoint

At 18:25:32 IST: four learners fully read, one acquisition in flight, zero token failures, 14 course pairs captured. Source marks: 300 positive flags, 155 mapped class completions, 145 unresolved source flags. Early mapping coverage varies by course; these are not import failures. The sheet read-back matched the active fleet and showed zero 403/429.

Twenty-two isolated MongoDB tests passed under the actual fleet500 run setting, including its global OTP boundary and existing duplicate prevention, request pacing, cooldown and mapping checks. JavaScript/shell syntax and whitespace checks passed.

At 18:28:48 IST: 13 tokens saved, zero token failures; 11 learners fully read, one reading and one token ready. There were 34 course pairs captured, 438 source completion flags, 257 mapped class completions and 181 unresolved flags. Shared claims and reader handoff were active on the two verified VMs; migrator2 had not sent any OTP.

The [live sheet](https://docs.google.com/spreadsheets/d/1S8WDIGKnt0gwQB_dVhasseUOgmAtLQbjS3iH5wyglGY/edit#gid=1603878611) shows the shared 500-user budget and worker-specific pacing. Request phase rates combine workers using each pacing profile. Blank cells/removed rows are explicitly overwritten so changing worker counts do not leave stale section labels.

## Adding migrator2 after access opens

1. Run the paced `request-probe` on migrator2 with `VG_COMPLETION_RUN=vg-completion-20261103-fleet500`, egress `.132.31`, its isolated runtime/env.
2. If all three source reads succeed and the fleet is still active, launch its `acquire` role with `VG_LEARNER_GAP_MS=60000` against this same run. Do not seed another cohort or reset the OTP budget.
3. Verify its first token and the original VM's corresponding reads; update this report/host note from actual evidence.

Test-uday remains excluded. Existing GCP/GPU roles were initially inactive; they joined later at the user's request as recorded below.

### Migrator2 joined at 18:36 IST

On the user's requested recheck, `.132.31` connected to MongoDB and passed all three paced AppX probe reads (HTTP/API 200, no OTP). Its `acquire` role then joined this same fleet500 run at 60-second spacing, without reseeding or resetting the shared budget. Its first token was saved at 18:36:28 IST for learner priority 32; all four acquisition requests returned HTTP/API 200. All three Azure VMs are now active.

### GCP/GPU joined at 18:39–18:40 IST

The user requested three more workers and confirmed the third meant the GPU server, alongside phonetics and testing-server-selectionway. The current tested fleet scripts were copied into their existing isolated migration directories; no service repo, application process or transcoder was restarted. All three passed the Mongo-backed paced probe (one admin lookup and two completion reads, all HTTP/API 200) before launch.

All three joined the same fleet500 queue at 60-second acquisition spacing; no cohort was seeded and no OTP budget reset. Their first tokens were saved at the times in the host table, with every acquisition request returning HTTP/API 200. The original Azure worker remains the completion reader. Shared organisation/admin/per-IP gates and stop-on-throttle rules are unchanged; additional workers may wait on those shared gates, so throughput will not necessarily scale linearly.

At 18:40:00 IST the run remained active with zero token failures: 44 learners fully read, four acquiring, 452 queued, and 118 course pairs captured. Source counts were 788 positive flags, 582 mapped and 206 unresolved. These remain staged; ClassProgress writes are still zero.

### Six additional Azure VMs verified at 23:49 IST

The user supplied migrator4–migrator9 IPs: `20.193.253.251`, `4.240.100.64`, `40.81.225.65`, `20.193.138.160`, `20.40.44.181`, `4.240.96.214`. Their existing runtime and prepared launcher configuration were present, and no acquisition worker was running. Each passed the Mongo-backed paced request probe: one admin identity lookup plus two cached-token completion reads, all 18 HTTP/API 200, no OTPs sent. These six are prepared capacity, not active workers in the stopped fleet500 run. The earlier failure does not establish a currently expired global session; the tested identity lookup now succeeds on every new host. Remaining failed learners still need individual reconciliation before any retry.

At the 23:26 check, fleet500 had stopped at about 20:30 IST: 475 learners fully read, 1,420 course captures, 6,321 positive flags, 5,350 mapped flags and 967 unresolved flags. The last active hour captured 178 learners. Three genuine admin identity/session rejections (HTTP 307) triggered the threshold; three additional token failures were in-flight `pilot_stopped` results. No HTTP/API 403 or 429 was recorded. This capture script never writes ClassProgress, but a separately authorised importer has since run; see [progress-import.md](progress-import.md). Statements above about no imports are historical checkpoints.
