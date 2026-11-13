# VG rate-limit scope investigation — November 4, 2026

Existing sanitised request metrics show another host returned HTTP200 at 15:02:37.129 UTC, around the first migrator6 HTTP429 at 15:02:36.746 UTC. Other hosts also had successful reads immediately before that event. After the subsequent pause, migrator6 returned200 at 15:18:41.954 UTC, and primary migrator returned200 at 15:18:42.770 then429 at 15:18:46.120 UTC. This is inconsistent with a continuous blanket denial across all hosts, but does not establish an IP-only quota: shared replenishing quotas or learner/endpoint scopes can also mix200/429. Old metrics cannot reliably identify whether both429s involved the same learner. Old response rate-limit headers were not saved.

The fleet remains stopped, with5,292 fully read learners,647 queued, five pending saved-token reads, concurrency1, shared penalty4 and no acquisition/read workers. No source requests were made during this investigation/preparation.

The user authorised a single later diagnostic on the last affected primary route, with no IP/session rotation. Script `reference/scripts/vidyagram-completion-single-rate-check.cjs` is deployed to the isolated Azure primary runtime. Syntax checks passed locally/remotely. An early invocation returned `too_early` before loading credentials, connecting to Mongo or issuing HTTP.

One-off current-chat automation `vg-single-cooldown-check` was created for21:50 IST today (16:20 UTC). The script refuses earlier/later-than-cutoff execution, changed stop/rate history, active workers, unavailable budget or cooldown. It uses the same failed saved-token learner/course, same primary route and existing limiter; reserves one durable diagnostic and one remaining per-course read attempt before any source call. It retains only sanitised status and numeric/date rate headers, makes at most one request with no retry, and never clears the fleet stop. The automation must delete itself after the result or abort; the existing read-only monitor stays unchanged.

This is a cooldown/header diagnostic, not a conclusive quota-scope test. A200 is not permission to resume the fleet; a429 requires continued hold and source quota guidance. No result is available yet.

## Single-check result —21:50:39 IST

The authorised same-route request ran at16:20:39.287 UTC on primary migrator20.193.151.140. Exactly one completion GET returned HTTP200/API200 in210ms (queue81ms), no transport error and no safe rate-limit headers. The response did not satisfy the diagnostic's object-shaped completion-data check (`validShape:false`); this is a successful HTTP/API response, not a verified usable completion capture. No body was printed or retained by this diagnostic and no capture/import was performed. No additional request or retry was made, no OTP was sent, and the fleet remains stopped with all learned penalties intact.

This establishes only that this route accepted that one request after the longer pause. It establishes neither quota scope nor sustainable request rate, and does not qualify a fleet restart. The one-off automation is being removed; the separate read-only monitor remains.

## Validator review and authorised bounded trial

The single diagnostic used a stricter shape predicate than production capture: it rejected null, whereas `normalizeFlags(null)` explicitly accepts an empty completion map. The earlier failed predicate therefore did not establish an invalid source response. The original discarded body cannot be reconstructed. The diagnostic now delegates to the existing parser; local compatibility checks passed for null, empty/populated maps and rejection of undefined/array/string shapes. Its original one-use reservation was not replayed.

The user authorised proceeding with parser review and a small saved-token-only trial. `vidyagram-completion-held-read-trial.cjs` previews and reserves at most three courses on three pending learners, one reader on the same primary route, at least60 seconds after each response. It keeps the run stopped/readOnlyRecovery, preserves maxConcurrent1 and all backoff, consumes existing per-course budgets, performs no retries or OTPs, and halts immediately on any error/403/429. Valid results use the existing flag parser and mapping function and are persisted to completion staging; a learner is marked complete only if every owned course has a completed capture. It does not enable acquisition or change cutoffs. Preview found three eligible courses, remote syntax check passed, and the bounded trial started at16:58UTC.

First result16:58:22.751UTC: HTTP/API200,230ms, data was null, empty map accepted and staged, one learner fully captured. Remaining trial results pending.

Trial finished17:00:23UTC (22:30IST): all three HTTP/API200, latencies230/88/93ms, request starts60.423 and60.267seconds apart. All three returned null completion data, accepted by the existing parser as empty maps and persisted as three valid course captures. Exactly one learner completed all courses; two still have other unread courses. Zero403/429, transport failures, retries or OTPs. Durable diagnostic `vg-completion-20261104-overnight6000:held-read-trial-20261104` is finished and cannot replay. The full fleet remains stopped; three low-rate successes do not establish safe fleet throughput or quota scope.
