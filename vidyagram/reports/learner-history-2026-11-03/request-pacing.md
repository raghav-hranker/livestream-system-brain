# VG migration request pacing — 3 November 2026

User approved request-level pacing, cooldowns, metrics, configurable learner pacing, and distinct acquisition/reader attribution. No new learner cohort was authorised or started by this change. Both existing bounded runs remain preserved.

## Current batch result

`vg-completion-20261103-horizontal50` finished at 16:18:43 IST: 50/50 tokens, 140/140 course pairs read, 448 positive source flags, 414 mapped class completions, 34 unresolved source flags, zero token failures. Marks remain staged; no ClassProgress writes.

## Request policy

All four AppX endpoints used by the migration now pass through `reference/scripts/vidyagram-apx-request-client.cjs`. Endpoint allowlisting prevents arbitrary URLs. The gate fails closed if its database coordination or configured egress identity is unavailable.

| Setting | Default |
|---|---:|
| `VG_LEARNER_GAP_MS` | 60,000 ms |
| `VG_REQUEST_GAP_MS` | 1,500 ms per effective egress IP |
| `VG_ADMIN_GAP_MS` | 2,000 ms shared across the VG admin session/org |
| `VG_REQUEST_JITTER_MS` | up to 250 ms |
| `VG_COOLDOWN_MS` | 60,000 ms when Retry-After is absent/invalid |

These are conservative operating settings, not established AppX quotas. An additional organisation gate serializes in-flight migration HTTP requests while the aggregate source limit remains unknown. This can constrain future fleet throughput and must be considered when tuning capacity.

Mongo-backed permits are keyed independently of run ID so concurrent migration batches cannot evade the shared IP/admin gates. Locks cover request execution; release times enforce gaps without allocating a future backlog of request slots. Expired 45-second request leases recover after a crashed process. Normal HTTP timeouts are 20 seconds.

On HTTP/API 429, the gate persists the later cooldown deadline, honours numeric/date Retry-After, and doubles spacing up to an 8x multiplier for cautious resumption. It also publishes the cooldown into VG's existing `apx-rate-limit-pause` record. Read jobs and acquisition work before OTP reservation may resume later; once an OTP reservation exists, an uncertain or throttled flow is held for review without another automatic OTP send. The HTTP wrapper itself never retries requests.

On HTTP/API 403, the egress route is marked blocked and that worker stops. A restart will not keep probing that blocked IP. Clearing a blocked route is deliberately not automatic.

Jobs retain separate `acquisitionHost`, `acquisitionEgressIp` and `readerHost` fields. The reader can update lease ownership without erasing acquisition provenance. Older records are displayed as unrecorded; their acquisition host is not guessed.

## Scope and limits

This coordinates cooperating VG migration workers, not all outbound traffic on a machine. Unrelated AppX jobs are outside normal request spacing, though existing VG admin callers observe the shared legacy cooldown. Direct GCP VM egress is obtained from metadata; the GPU host uses its documented IPv4. If NAT/proxy routing changes, configure the real shared exit IP instead.

Tokens, OTPs, contacts, cookies, query values and response bodies are excluded from telemetry. `apx_vg_request_metrics` holds timestamp, run, host, configured exit IP, phase, endpoint category, HTTP/API status, response time, queue wait and sanitized error category. A 7-day TTL and run/time index were built only after confirming all rs0 members healthy. `apx_vg_request_limits` preserves cooldown/blocked-route state across process restarts.

## Deployment and verification

Deployed to phonetics, testing-server-selectionway and the GPU host. Test-uday remains disabled. The OCI host runs the existing sheet integration only. No unrelated app service was restarted and no OTPs were sent during verification.

Nineteen isolated MongoDB tests cover rate coordination, cooldown persistence, Retry-After, no automatic OTP/network replay, source-ID mapping, budget concurrency, cancellation and lease safety.

Three concurrent live probes each made one admin lookup and two cached-token completion reads: all 9 calls succeeded with HTTP/API 200, no 403/429. Shared admin requests dispatched at 16:41:58, 16:42:01 and 16:42:05 IST. Per-IP reads were also separated by the configured pacing. These probes establish the gate functions; they do not establish AppX's maximum sustainable rate.

The existing sheet now includes [Completion requests](https://docs.google.com/spreadsheets/d/1S8WDIGKnt0gwQB_dVhasseUOgmAtLQbjS3iH5wyglGY/edit#gid=455021720), plus summary cooldown/settings and separate acquisition/reader columns. Counts explicitly cover instrumented requests only. Older batch requests are not backfilled. The completed batch is not running; its sheet was refreshed once after deployment. Future active runs use the existing ~15-second refresh loop.
