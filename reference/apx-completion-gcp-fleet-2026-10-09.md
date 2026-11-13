# Appx completion fleet: GCP test-uday — 9 October 2026

**October 12 update:** completion imports were moved from the blocked OCI route to GCP. The initial deployment details below are historical; see [the recovery record](apx-completion-fleet-recovery-2026-10-12.md) for current roles and coverage.

`test-uday` was added as a continuous paid-user token worker. It shares the production claim ledger and token cache with the two OCI workers. The existing OCI importer reads the new tokens and imports manual completion flags.

## Deployment

| Item | Value |
|---|---|
| GCP project / zone | `genial-analogy-477417-r7` / `asia-south1-a` |
| VM / egress IP | `test-uday` / `34.47.203.51` |
| Runtime user | `raghav` |
| Migration checkout | `/home/raghav/apx-completion-paid`, existing branch `apx-completion-test-uday` |
| Code | Fast-forwarded from `c1d0661ef` to `0de3389bb`; includes rotating admin-session rereads and Appx failure backoff |
| Existing environment file | `/home/raghav/quicktricks-backend/.env.development`, used in place |
| Node | `/home/raghav/.nvm/versions/node/v24.14.0/bin/node` |
| Service | `apx-completion-prewarm-test-uday.service` |
| Supervisor | `/home/raghav/apx-completion-supervisor.sh` |
| Log | `/home/raghav/apx-completion-prewarm.jsonl` |
| Per-IP cooldown key | `apx-otp-rate-limit-cooldown-completion-test-uday` |

The VM already had the migration checkout and dependencies, but its September 29 worker stopped after five consecutive token failures. Only the isolated migration checkout was updated. Existing backend checkouts and services were left running.

The continuous command is `apxPaidCompletionTokenPrewarm.ts --send-real-otp --all --pause-ms=60000`. It claims each local paid user through the existing unique `(orgId, localUserId)` index before minting. It reuses cached tokens and the rotating admin session. Its independent cooldown key prevents a GCP throttle from pausing the OCI IPs.

The supervisor waits an hour after five consecutive token failures, then makes a bounded one-user recovery probe. Further failed probes back off up to six hours. Transpile-only mode avoids doing TypeScript type checks on every worker restart; the code version is shared with the verified OCI workers. The service ran at approximately 300–360 MB during the first inventory scan, with spare RAM available.

## Verification

- Database preflight matched the main VM exactly: database `quicktricksdb`, the same safe connection fingerprint and reference token ID, 14,805 token-attempt records and 127,783 course-import ledger records at the check. The shared claim index was unique on both hosts. No credentials were copied or printed.
- A read-only completion GET for user `544994`, course `126`, returned HTTP 200 / API 200 from GCP.
- The bounded OTP pilot for paid user `211481` succeeded at **12:50:41 IST**: `sendotp` 200, `otpverify` 200, `minted=1`, `failed=0`, `rateLimited=0`.
- A single-user commit import for user `211481`, course `135`, read the completion response and recorded it in the shared import ledger. Appx returned no completed flags, so it correctly made zero ClassProgress writes.
- At **12:58:24 IST**, the dedicated service was `active/running`, `enabled`, and had zero restarts, with the full `--all` prewarm child running. Its initial inventory scan was still in progress.
- The continuous worker then minted user `551456` at **12:59:38 IST** and user `667496` at **13:00:43 IST**, with `minted=2`, `failed=0`. Together with the bounded pilot, three new tokens were verified during setup. The first two continuous attempts were 65.28 seconds apart, approximately 55 users/hour; this is a brief sample rather than a sustained fleet-rate measurement.
- The final fleet-status check also showed user `529513` minted at **13:02:14 IST**, bringing the continuous run to three successes and zero failures, plus the separate successful pilot (four verified new tokens during setup). The next interval was approximately 90 seconds, so this short sample does not establish a sustained 55/hour rate. All three token-worker hosts were healthy, and GCP remained enabled with zero service restarts.

The temporary PM2 activation was handed over to the dedicated systemd service. The VM has no crontab command and no existing `pm2-raghav` startup service, so systemd provides the scoped reboot startup. The temporary PM2 worker entry was removed; other PM2 applications remained running.

## Fleet roles checked during activation

| Host | Token minting | Completion imports |
|---|---|---|
| OCI `92.4.88.60` | Active; successful recent mints | Existing importer supervisor active; latest completed pass had zero failed courses |
| OCI `92.4.82.27` | Active; successful recent mints | — |
| GCP `test-uday` | Added; pilot succeeded and continuous service enabled | New tokens consumed by the OCI importer |
| Main `148.113.49.18` | No Appx worker running at the check | No Appx worker running at the check; October 8 route probes returned 403 |

The fleet now has three token-worker hosts and one continuous importer host. One-minute pacing sets a ceiling of 60 attempts/hour before queue traversal, lookup, minting time and any backoff. Actual GCP rate needs a longer observation window. New token import can wait for the OCI importer's next pass (20-minute interval).

## Operating commands

All commands use the existing GCP SSH identity:

```bash
gcloud compute ssh test-uday \
  --project genial-analogy-477417-r7 --zone asia-south1-a \
  --command='systemctl status apx-completion-prewarm-test-uday --no-pager; tail -n 10 /home/raghav/apx-completion-prewarm.jsonl'
```

To stop or restart only this worker, use `sudo systemctl stop apx-completion-prewarm-test-uday` or `sudo systemctl restart apx-completion-prewarm-test-uday` through the same SSH command. To remove reboot startup, use `sudo systemctl disable --now apx-completion-prewarm-test-uday`.

The installed unit is `/etc/systemd/system/apx-completion-prewarm-test-uday.service`; its reproducible source is [apx-completion-test-uday.service](scripts/apx-completion-test-uday.service). The existing supervisor source is [apx-completion-supervisor.sh](scripts/apx-completion-supervisor.sh). The fleet helper's `status` command also includes GCP and both OCI hosts.
