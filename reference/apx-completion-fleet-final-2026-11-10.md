# AppX completion OTP fleet — final result (checked 10 November 2026)

Quicktricks, customer 472, org `8680775`. Read-only counts from prod `quicktricksdb` plus `test-uday` service state.
Earlier checkpoints: [10-09](apx-completion-gcp-fleet-2026-10-09.md), [10-12](apx-completion-fleet-recovery-2026-10-12.md).

## Token ledger (`apx_paid_completion_token_attempts`)

| Status | Rows | Window (UTC) |
|---|---:|---|
| minted | 23,305 | 2026-09-29 11:01 → 2026-10-19 22:31 |
| failed | 192 | last 2026-10-28 11:21 |
| started (stuck claim) | 1 | 2026-09-30 19:20 |

## Import ledger (`apx_manual_completion_imports`)

| Metric | Count |
|---|---:|
| Course reads | 145,850 (144,981 complete, 869 partial) |
| Users with a complete course read | 45,763 |
| Users with ≥1 completed flag | 18,210 |
| Course reads with flags | 24,970 |
| Completed flags read | 742,210 |
| Flags mapped to a class | 738,401 |
| `classprogresses` with `apxManualCompletionImported: true` | 720,748 |
| Fetch window (UTC) | 2026-09-26 22:07 → 2026-10-19 13:12 |

Paid users (token worker scope): 206,642, of which 200,971 have a known video course. Coverage ≈ 45.8k / 206.6k ≈ 22%.
The cached-token batch (09-29) was 24,534 users, so the OTP fleet added roughly 21k users.
Tokens minted between 10-19 13:12 and 22:31 UTC were probably never imported.

## Why it stopped

The AppX admin session expired around 10-19; no OTP can be sent without it. Nothing was minted or imported after 10-19.

## State left behind (10 November)

- `test-uday` `apx-completion-prewarm-test-uday.service`: active + enabled. Every 6 h it logs
  `No active APX admin session; no OTP was sent` (88 times). **If the 472 AppX admin session is renewed, it resumes
  sending real OTPs.**
- `test-uday` `apx-completion-import-test-uday.service`: active + enabled, node child alive since 10-21 11:45 UTC with no
  log output since (last lines: Mongo connect timeouts).
- webserver2-2: a 09-29 heredoc probe (bash + node, counts the ledgers) still running after 42 days.
- OCI clones: stopped.
