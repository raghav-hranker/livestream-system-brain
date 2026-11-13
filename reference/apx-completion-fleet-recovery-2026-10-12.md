# Appx completion import recovery — 12 October 2026

The live coverage audit initially found 39,784 paid users with at least one course-import ledger entry, versus 37,274 on October 9. Paid-user cached-token coverage was 43,297. The fleet had stopped making useful progress: OCI completion reads returned HTTP 403, both OCI OTP supervisors were in six-hour recovery backoff, and GCP token minting was waiting for an active Appx admin session.

## Restored completion imports

A read-only completion request from GCP `test-uday` at **13:17:41 IST** returned HTTP 200 / API 200 for the same cached user/course probe previously used to compare routes. The request used the migration checkout's current tenant API constants and cached student token; no OTP was sent.

The blocked OCI import supervisor on `92.4.88.60` was stopped after checking its `FLEET_ROLE=import` environment and isolated process group. Only PID/group `2889735` was stopped. Its prewarm supervisor remained running. A handoff event was appended to `/home/opc/apx-completion-import.jsonl`.

GCP now runs `apx-completion-import-test-uday.service`, installed under `/etc/systemd/system/`, active and enabled for reboot startup. It uses:

- Checkout `/home/raghav/apx-completion-paid`, commit `0de3389bb`.
- Existing environment `/home/raghav/quicktricks-backend/.env.development`.
- Supervisor `/home/raghav/apx-completion-supervisor.sh`, `FLEET_ROLE=import`.
- Log `/home/raghav/apx-completion-import.jsonl`.
- Existing `--all --commit --delay-ms=500 --from-token-id=6abb9a8cc27ac1b3e94a024e` arguments.
- Existing course-import ledger, already-imported skips and idempotent ClassProgress updates.

The importer uses existing student tokens and does not require the admin session. No changes were made to the token-minting workers or their pacing. GCP's source-access failures retain the existing three-user stop and one-hour retry backoff.

## Evidence and coverage checkpoint

GCP committed the same users/courses that had just failed with 403 on OCI. User `612157`, course `119`, had two completed flags, both mapped. User `666686`, course `135`, had five, all mapped. Further successful commits included user `508925`, course `110`, with 152 completed flags and 142 mapped classes; ten unmatched source video IDs remained excluded. These are source completion/mapping counts, not a claim that every matched record was newly inserted.

The refreshed audit after recovery showed:

| Metric | Count |
|---|---:|
| Paid local users | 216,420 |
| Paid users with cached token | 43,297 |
| Paid users covered by at least one course-import entry | **39,832** |
| Increase from October 9's 37,274 | **2,558** |
| Increase during this recovery check | **48** |
| Paid users with known video course | 204,822 |
| Eligible paid course users without any import entry, derived | 164,990 |
| All cached token users in the org | 44,208 |
| All users with any import entry in the org | 40,379 |

Counts are a moving checkpoint. “Covered” means at least one course was processed; empty source completion data still creates a successful import entry. It does not mean every course for that user is complete.

## Current fleet roles

GCP hosts the active completion importer. The two OCI token supervisors remain configured but in recovery backoff. GCP's token worker remains active and checks for the admin session every two minutes. A renewed Appx admin session is still needed to mint more tokens; moving completion reads to GCP does not restore that session.

Use `bash reference/scripts/apx-completion-fleet.sh status` from this repository for both GCP services and both OCI hosts. To inspect the importer directly:

```bash
gcloud compute ssh test-uday \
  --project genial-analogy-477417-r7 --zone asia-south1-a \
  --command='systemctl status apx-completion-import-test-uday --no-pager; tail -n 10 /home/raghav/apx-completion-import.jsonl'
```

To stop just the importer, use `sudo systemctl stop apx-completion-import-test-uday`. To remove reboot startup, use `sudo systemctl disable --now apx-completion-import-test-uday`. Reproducible unit: [apx-completion-import-test-uday.service](scripts/apx-completion-import-test-uday.service).
