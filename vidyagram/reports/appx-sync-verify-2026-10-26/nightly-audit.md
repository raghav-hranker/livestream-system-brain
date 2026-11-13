# Vidyagram nightly audit — 2026-10-26

Read-only inspection of GCP test-uday, isolated `/home/raghav/vidyagram-nightly-20261019`. No sync, deployment, database write, restart or Quicktricks operation was performed. Evidence: `nightly-log-summaries.jsonl` contains selected sanitized lines from every retained run log. The existing preflight was inspected before executing it directly; the runner itself was not executed.

## Current scheduler and version

- `vidyagram-nightly-gcp.timer`: active/waiting. Last trigger October26 02:30 IST; next October27 02:30 IST. OnCalendar is 02:30 Asia/Kolkata, Persistent=true.
- Service: failed/exit-code, ExecMainStatus1. Last run October26 02:30–06:24:07 IST (UTC October25 21:00 to October26 00:54:07).
- REVISION: `f79842940 + serial-api-pacing-250ms-2026-10-19 + placement-7f9cfc649`. This is a revision marker for an overlaid checkout, not proof of a clean Git commit.
- Deployed service uses flock, oneshot, 7h timeout, CPUQuota100%, MemoryMax2G. These match the checked-in service/timer definitions. The script also acquires the shared distributed lock during an actual run; this audit did not acquire it.

## Current bounded upstream probe

Executed the deployed `preflight.cjs` after verifying it only performs reads, disables autoIndex/autoCreate, guards `vidyagramdb`, and its HTTP source only reads session cookies without persisting Set-Cookie.

Result: `{db:vidyagramdb, sessionLive:true, cmsRows:1, studentRows:1, classes:10955, pdfs:8666}`. CMS list page0 size1 and course85 root folder both answered successfully. This establishes current basic reachability, not catalogue-wide correctness or course96 availability. No credentials, session cookies, signed media links, or raw payloads were saved.

A second bounded read fetched the complete CMS course list at 2026-10-26T12:30:16.885Z (18:00:16 IST), page0 length1000. AppX reports total146 and returned146 rows. Course148 and149 are absent. Saved only IDs, titles, enabled flags and counts in live-course-list.json; no raw source payloads. This is direct current evidence, independent of nightly logs. Absence establishes removal from the current list, not whether deletion versus unpublishing caused it; retained mirror entries require an explicit stale-source policy.

`sessionIsLive` checks stored isActive=true and lastHttpStatus200; it does not enforce lastCheckedAt age (deployed vidyagramNightlySync.ts:188–193). The successful live calls provide stronger current evidence than that stored boolean alone.

## Latest stages and persistent failures

Latest capture:145 courses done, course96 failed after retry,21 lookups,2751 reused, no vanished folders. Course96 upstream `get_pc4_contents` returned HTTP502 and its committed source stays `daily-2026-10-22`. It is at least four capture dates stale. The current catalogue list had146 courses; this differs from the147-course October19 catalogue, and should be handled by the main data audit.

Latest classes:1 new Class and1 job queued,147 waitingOnLink,9984 existing,2 failed. Both failures repeat October24–26:

- asset `vid:armaths-data:4656486-1792746126`, AppX class193547;
- asset `vid:armaths-data:4657426-1792753322`, AppX class193550.

Both hit E11000 on vidyagramdb.apxingestjobs index apxCourseId_1_apxClassId_1, course ObjectId6ace395cc9735682f048a449. Proposed investigation: reconcile the old job identity against the changed asset and choose a guarded replacement/reuse policy. Do not drop the index or blindly retry writes.

Latest reconcile: zero changes;5 unknown Class units,2 unknown PDF units,2 Class units and3 PDF units gone from listing. Counts alone do not establish these are errors; main snapshot audit resolves them.

Latest placement:3 rows created,0 courses created,3 courses touched,3 unfiled,0 refused/missing Classes. Recent rows created:377 October23,150 October24,97 October25,3 October26. Placement was explicitly skipped as “courses not created yet” through October22 even though the October19 course import had created courses; deployed placement overlay appears in October23 run revision. The main data audit should verify the backlog was fully repaired.

Latest PDFs:0 new,0 notes,2 attempted,2 failed validity checks, no throttle/session loss. Same two hashed sources fail October22–26: appx-content-v2.classx.co.in#5094a07b5f13 and #da5366b7467b. Proposed investigation: preserve source evidence, inspect expected PDF/encryption response and validity failure, then repair source-specific handling. No invalid bytes should be accepted to make the job green.

Latest run ends done-with-failures, “2 failure(s)” means failed stages/categories, not only two offending content records. There are two class failures and two PDF failures, plus capture96 failure. Every October23–26 run exits1. The last retained exit0 run is October21, but its PDF stage paused with sessionLost=true and capture96 also failed, so it is not a fully complete successful migration. October19 exit0 also paused PDFs after throttling. Exit0 alone is insufficient freshness evidence.

## Failed capture promotion safeguard

Deployed apxCatalogCapture.ts stages attempts separately and only promotes when completeness.ok gives status=done (lines1020–1037). The course capture pointer is written last; failed attempts write captureAttempt and log readers staying on the previous committed run (lines1047–1048). runView includes lastSeenRunId or prevSeenRunId (line529), preserving the prior committed reader view during promotion. Course96 log concretely confirms retention of daily2026-10-22 instead of promoting its failed October26 attempt.

This addresses the October18/19 lesson documented in prod-data-changes memory: a failed capture must not overwrite the committed view. This audit confirms code and log behavior, while the main live database snapshot verifies actual committed pointers and content stamps. Shared correctness principles from the Quicktricks ADRs are reference material only; no Quicktricks database or process was touched.

## Limits

No full fresh AppX crawl was triggered. No upstream detail calls for failing course96 or PDF bytes were made by this audit. Logs are evidence of the deployed job’s work, not a replacement for the main database snapshot. The checkout revision marker was read, but full source-to-Git checksum equivalence was not verified.
