# VG fleet throughput trial — 4 November 2026

The user asked to maximise the existing 12-host fleet toward 2,000 fully captured learners/hour. That target is unproven. This trial uses a finite 2,000-new-learner cohort, with acquisition initially restricted to priorities 0–199. The run automatically stops at `checkpoint_review` after that slice drains; the other 1,800 cannot start without an explicit checkpoint change and restart.

## Configuration

- Run `vg-completion-20261104-fleet2000`, maximum 2,000 OTP reservations, 12-hour expiry from seed.
- All 12 acquisition hosts use 30-second pauses after each acquisition attempt; per-IP request gap stays 1,500 ms, shared admin gap 2,000 ms, jitter 0–250 ms.
- Request gate acquires narrower IP/admin keys before the organisation key. A worker waiting for its own IP/admin spacing no longer holds the organisation gate. Organisation-wide HTTP serialization remains in place; no concurrency or source-quota claim is implied.
- Two dedicated Azure reader processes drain saved tokens independently of acquisition. Capture remains separate from the separately authorised progress importer.
- Shared cooldowns and per-IP blocks persist; any 403/429 stops this run. Uncertain OTP sends are never automatically replayed. Three substantive token failures still stop acquisition; a job observing `pilot_stopped` no longer inflates that counter.
- First checkpoint checks measured fully-read learners/hour, saved-token backlog, HTTP/API statuses, timeouts and gate/network timings before widening the eligible priority range or changing request spacing.
- Test-uday remains excluded. No unrelated backend/transcoder service was restarted.

## Previous batch reconciliation

A transactionally backed-up read-only recovery reopened the previous stopped fleet500 run for saved-token reads only. Claim and OTP reservation both reject acquisition during this mode. Seven learners were recovered with zero new OTPs: totals became 482 fully read learners and 1,443 course captures, 6,357 flags / 5,386 exact-ID mapped / 967 unresolved. Twelve unattempted learners and six failed acquisitions remain aside, without automatic OTP retries. Recovery beforeimages are in `apx_vg_completion_recoveries`, `_id: vg-completion-20261103-fleet500:saved-token-recovery-1`.

## Validation

28 isolated MongoDB tests passed under the new run ID, including checkpoint claim restriction with reader draining, finite atomic OTP budget, no duplicate claims or OTP reservation, acquisition-disabled recovery, cross-IP shared cooldowns, gate ordering, source ID mapping and capture idempotence. JavaScript/shell syntax and whitespace checks passed. Admin preflight returned HTTP/API 200 with matching identity before launch.

The existing [live sheet](https://docs.google.com/spreadsheets/d/1S8WDIGKnt0gwQB_dVhasseUOgmAtLQbjS3iH5wyglGY/edit#gid=1603878611) will show this run, its checkpoint ceiling, worker pacing, source counts and request metrics. It grows row capacity as needed and clears stale cells in its dedicated Completion tabs.

## Launch and initial verification

Seeded at 00:00:23 IST on November 4: 2,000 fresh learners, 6,080 planned course pairs, 16,761 distinct recent purchasers inspected. Selection is recent successful, non-disabled, positive-value and unexpired orders; active VG accounts with an AppX identity and positive saved source watch time on at least one owned locally mapped video course. All claimed learners and cached tokens are excluded, with AppX-ID deduplication. This is not a random or population-representative cohort. The run expires at 12:00:23 IST; initial acquisition ceiling is 200.

All twelve acquisition roles and two reader roles were verified by Mongo heartbeats at 00:02:38 IST. Azure migrator and migrator4 run the dedicated readers alongside separate acquisition processes. The other seven Azure hosts, phonetics, testing-server-selectionway and GPU run acquisition only. The Google Sheet read-back at 00:02:51 verified the new run, 2,000 selected learners, 6,080 planned pairs, ceiling 200 and all 14 worker rows.

At 00:03:15 IST: 20 learners fully read, two reading, five acquiring, 1,972 queued and one failed acquisition. One `otp_send` network TypeError on migrator4 has unknown delivery outcome; no automatic retry was attempted. No 403/429 was seen in the initial checks. This brief ramp-up sample is insufficient to claim a sustained rate or a speed improvement.

## First checkpoint and second stage

The automatic checkpoint stopped acquisition at 00:19:35 IST. First slice: 199 fully captured learners (169 captured / 30 mapping_exception), one unknown-delivery OTP network failure, no pending reads. From first to last completed learner the observed rate was 651/hour. No 403/429 occurred. Three pre-OTP admin redirects were subsequently recovered; those jobs reached captured/mapping_exception without repeating an OTP reservation.

Admin requests averaged 11,875 ms of gate waiting versus 88 ms of network latency. Completion reads averaged 1,465 ms waiting / 43 ms network. To continue the user's authorised gradual optimisation, stage two admits priorities 200–399 only (ceiling 400 total). Shared admin spacing drops from 2,000 to 1,500 ms; learner pause stays 30,000 ms and per-IP gap 1,500 ms. The change and before-run snapshot are recorded in `apx_vg_completion_tuning_events`, `_id: vg-completion-20261104-fleet2000:stage2`. The existing one-failure count and all cooldown/route-block state were preserved. Advancing required every worker to be stopped and zero recorded 403/429.

At 00:22:56 IST stage two was running. Mongo heartbeats verified all 12 acquisition workers and two readers at the intended settings. Nine additional learners were fully captured, two reading, two token-ready and four acquiring. Acquisition will automatically stop again when this slice drains, before priorities 400 and above become eligible.

## Second stage failure stop

Stage two stopped at about 00:38 IST on the cumulative substantive token-failure threshold, before the normal checkpoint. It had 194/200 learners fully read, three failed acquisitions (two admin redirects after OTP sending and one in-flight stop), two interrupted reads and one saved-token learner awaiting reads. Combined with stage one, 393 learners were fully read at that moment. No 403/429 was recorded.

Stage-two first-to-last capture rate was 716/hour (00:22:05–00:38:15), approximately 10% above stage one's 651/hour; different course mixes and a short run mean this is not a controlled speed guarantee. Admin gate waits averaged 9,582 ms, versus 93 ms on the network; completion reads averaged 1,745 ms gate wait / 44 ms network. More servers are not justified by this evidence.

At 00:40 IST, three paced admin read-only checks (known-token control and both failed identities) all returned matching HTTP/API 200 with no OTPs. These establish currently working authentication, not the cause of earlier redirects. Failed or uncertain OTP attempts were not replayed. The existing backed-up acquisition-disabled recovery was extended narrowly to this stage-two stop and prepared for three saved-token learners; recovery ID `vg-completion-20261104-fleet2000:saved-token-recovery-stage2`. Acquisition remains disabled, the original failure count is preserved and no learner beyond priority 399 is eligible.

Recovery completed at 00:41:18 IST: 396/400 learners fully read (stage two 197/200), four failed acquisitions aside, 1,600 learners still queued beyond the checkpoint. There were 1,241 course captures and 5,545 source flags / 4,628 mapped / 915 unresolved. Run status is `checkpoint_review`, `stopped:true`, `readOnlyRecovery:true`. The 30-minute read-recovery expiry replaced the active trial expiry; any deliberate future acquisition resume must restore the original bounded expiry from the beforeimage and remove read-only mode, rather than just clearing `stopped`. No new OTP was sent during recovery.

## Post-OTP redirect handling and third stage

The user authorised addressing the transient lookup redirects and continuing. A deterministic acquisition fixture reproduced the failure before the patch. The post-OTP admin GET now retries once, after two seconds, only for `admin_session_or_identity_rejected` with HTTP 307. Each retry uses the normal gate, rereads the stored session and verifies exact user identity. It never re-enters acquisition, sends another OTP or replays verification. Wrong identities, persistent redirects, other source errors, stopped runs and lost job ownership still abort. Jobs record retry count and successful read-recovery time without storing contact/OTP/token in telemetry. This handles the observed transient response; its upstream cause remains unproven.

33 isolated tests passed, including recovered/persistent redirects, wrong identity, stop during retry, exactly one OTP send/reservation per learner, source cooldowns and checkpoint boundaries. Syntax and whitespace checks passed. The patched worker was deployed to all 12 hosts.

After a live matching-identity admin preflight, stage three was prepared at about 00:46 IST. The ceiling is 600 (new priorities 400–599 only), learner pause 30 seconds, shared admin and per-IP gaps both 1.5 seconds. No traffic setting was increased in this stage. The four prior failed acquisitions remain excluded. Total token failures stay at three; `tokenFailureBaseline:3` gives this reviewed stage a three-additional-failure stop rather than erasing historical failures. Invalid baselines fail closed. The original 12:00:23 IST expiry was restored from the recovery beforeimage and read-only recovery mode removed transactionally. Before/after record: `apx_vg_completion_tuning_events`, `_id: vg-completion-20261104-fleet2000:stage3`.

## Third checkpoint review at 01:06 IST

Stage three completed all 200/200 at 01:02:32 IST, with a first-to-last rate of 745 learners/hour. All 1,362 instrumented source calls returned HTTP/API 200 (400 admin reads, 200 sends, 200 verifications, 562 completion reads). There were no network errors, redirects, 403/429, or new acquisition failures. The retry was not exercised live in this slice. Totals are 596 fully captured, four prior failed acquisitions aside, 1,400 unstarted learners, and no saved-token read backlog. The fleet is paused at `checkpoint_review`, ceiling 600. Admin waits still average 9,351 ms against 85 ms network latency, supporting a recommendation to retain the current fleet rather than add servers.

## Fourth stage: one-second admin gap

The user explicitly authorised the proposed next-200 test, changing only shared admin spacing from 1,500 to 1,000 ms. After confirming stage three's clean 200/200, zero 403/429, all workers stopped and a live matching-identity admin read, a transaction recorded the beforeimage and advanced the ceiling to 800. Event `_id: vg-completion-20261104-fleet2000:stage4` in `apx_vg_completion_tuning_events`. Stage four began around 01:12 IST.

All twelve acquisition workers and both readers were restarted at learner pause 30,000 ms, per-IP gap 1,500 ms and admin gap 1,000 ms. Source gates, retry limits, original expiry, historical failure totals and three-additional-failure stop remain unchanged. Only priorities 600–799 are newly eligible; the run stops automatically when that slice drains. The sheet updater was restarted with the same settings. The remaining 1,200 learners are not automatically released by this stage.

## Fourth checkpoint and fixed overnight remainder

Stage four completed all 200/200 at 01:27:24 IST, with a first-to-last rate of 796/hour, approximately 7% above stage three. All 1,445 instrumented calls returned HTTP/API 200: 400 admin lookups, 200 sends, 200 verifications and 645 completion reads. No retries, redirects, network errors, 403/429 or new token failures occurred. Admin waits fell to 4,945 ms (96 ms network); read waits were 1,867 ms (46 ms network). At review the pilot had 796 fully read, four prior failed acquisitions and 1,200 unstarted learners.

This satisfied the user's approved conditional plan: after a healthy one-second trial, run the remaining 1,200 at that tested setting without further tuning. After a fresh matching-identity admin preflight and transactional beforeimage, ceiling advanced to 2,000 around 01:34 IST. All 12 acquisition roles and two dedicated readers were launched at exactly the same learner/admin/per-IP settings, with the sheet updater. Event `_id: vg-completion-20261104-fleet2000:stage5-overnight`. The pilot remains capped at 2,000 reservations and expires at 12:00:23 IST; historical failures and the three-additional-failure stop were not reset. Source throttle/route-block stops persist. No automatic cohort extension or progress import was configured.
