# VG operational review — November 4, 2026,20:36 IST

Review scope: read-only current run, request limiter, worker coordination, mapping aggregates and source errors. No source HTTP probes, worker restarts, pacing changes, stop clearing or OTP replay were performed.

## Highest-priority finding: actual source429

A completion GET from migrator6 (`40.81.225.65`) started20:32:36.746 IST and returned HTTP429 after1,345ms. This is the first recorded429 in the current run. The client persisted a shared cooldown through20:33:36.872 IST, doubled the affected IP/global/slot penalty to2, and stopped the fleet. Expiration of that stored cooldown does not establish the source's sustainable quota. Do not use more VMs or increased concurrency as the immediate response; leave the stop in place pending a controlled review/requalification. The source's limiting scope and quota remain unknown.

## Stop reason is misleading

The run currently shows `admin_session_review`, stopped20:32:38.788 IST. In the worker catch block (`vidyagram-completion-pilot.cjs` lines381–393), `admin_shared_pause` is classified as a session error and unconditionally writes that status. A worker reacting to the shared429 cooldown can therefore overwrite another worker's `experiment_throttled` stop and misclassify cooldown as an authentication failure. Request metrics and the limiter retain the true429 evidence. Preserve the first/highest-priority stop cause and distinguish shared cooldown from invalid session; add a concurrency regression before deploying a fix. Review only: no fix was applied.

## Throughput/coordination regression

The last full-hour window ending20:36:32 IST captured444 learners, compared with an earlier measured1,068/hour. This window includes the final approximately four paused minutes, but the preceding monitor windows had already fallen to roughly400–600/hour while running. Recent30-minute mean admin request wait is31,452ms versus mean actual response60ms; maximum wait201,664ms. This locates most elapsed request time before dispatch in scheduler/DB coordination, not successful source response time. Code polls shared Mongo gates with up to1-second sleeps, repeatedly reading run/ownership and renewing leases; there is no FIFO fairness. This is a candidate contributor to long waits and DB load, not a proven complete root cause. Review gate fairness, polling/renewal overhead and DB latency before buying more capacity. The new429 additionally requires a conservative source allowance.

## Progress and mapping quality

Current6k cohort:5,292 fully fetched (3,684 captured +1,608 mapping exceptions),647 queued, five interrupted saved-token reads, ten authentication deferrals and46 terminal acquisitions including historical/cascading records. All workers stopped. No uncertain attempts were replayed.

Capture aggregates:30,491 course records,119,989 positive completion flags,88,397 mapped source entries and31,592 unmatched flags (26.3% of positive flags), zero invalid flags. These are capture-layer mappings; existing importer matching may resolve additional rows, so these numbers are not a final ClassProgress import failure rate. Audit importer preview/results before claiming all source flags are usable. Mapping gaps do not establish missing classes on AppX.

## Recommended order

Keep acquisition paused. Correct the misleading stop-cause handling, inspect limiter contention without loosening source limits, and audit the pending flag mappings. Recover the five saved-token reads separately only with authorisation and source health/cooldown checks. A later bounded, conservative qualification should preserve uncertain OTP exclusions, learned backoff and immediate403/429 stops. Do not add servers to this run as the immediate step.
