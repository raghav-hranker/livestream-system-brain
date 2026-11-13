# VG learner-history inventory — 3 November 2026

Read-only inventory and cached-token source pilot, completed around 10:59 IST.
No OTPs sent, tokens refreshed, learner records changed, indexes built or services restarted.

## Coverage

| Metric | Count |
|---|---:|
| Local users | 2,432,927 |
| Raw AppX user analytics | 2,230,191 |
| Raw user/course-detail documents | 2,230,190 |
| Course-detail items with a usable `merged_courses` array and no error | 1,781,622 |
| Course-detail items failed/malformed | 2 |
| Raw lecture-history entries | 14,375,054 |
| Raw entries with positive cumulative duration | 10,430,121 |
| Raw detail documents stamped `classProgressSyncedAt` | 0 |
| Local ClassProgress rows | 71 |
| Local rows manually completed | 48 |
| Local rows marked `apxMigrated` | 0 |
| VG cached student tokens | 5 |

Scope derived from successful, non-disabled orders and their direct, latest, plan-bundled and build courses. A video course has a CourseClass and an AppX course ID. These are access cohorts, not verified revenue or current course-visibility cohorts. Plans use their present course memberships.

| Cohort | Users | Distinct user/course pairs |
|---|---:|---:|
| All qualifying course access, including free | 703,496 | 1,080,386 |
| Unexpired qualifying access | 703,434 | 1,080,115 |
| Positive-value course orders (`grandTotal > 0` numeric) | 379,781 | 614,804 |
| Unexpired positive-value course orders | 379,772 | 614,788 |

Among the all-access cohort, 901,047 pairs (83.4%) already have saved usable watch detail; 179,339 do not. Missing saved detail does not prove a failed fetch: analytics may omit courses where a user has never watched anything. Three local users lack `usersApxId`. Four eligible users have cached tokens, covering 71 course pairs. These coverage numbers are not separately computed for the positive-value cohort.

## Completion route pilot

Reused the existing Quicktricks GET contract against VG's configured `armathsapi.akamai.net.in/get/getVideoCompletion`, with each cached student's own token and user ID. One locally mapped course per token; no retries or minting.

- Production webserver: three consecutive HTTP 403 responses; stopped there.
- Existing GCP `test-uday` VG nightly checkout: all five tokens returned HTTP 200 / API 200 with a valid completion response.
- GCP request times: 154, 48, 54, 41 and 38 ms, with one-second pauses between calls. This is a latency sample, not a sustainable-throughput measurement.
- All five course responses had zero completion flags. This does not establish population prevalence or verify mapping of a positive flag.
- The production/GCP comparison establishes a working GCP route for these tokens, not the specific cause of the production 403.

Evidence: [production probe](completion-probe.jsonl), [GCP probe](completion-probe-gcp.jsonl).

## Watch-history mapping pilot

First 200 raw detail documents with nonempty lecture history, ascending `_id`: 437 course items, 825 lecture entries. This is a convenience sample, not a population estimate. Course-detail fetch timestamps in this sample are October 15–16; it is historical coverage, not a cutover-fresh snapshot.

- 776 entries uniquely match the existing effective-title rule.
- 26 match multiple distinct Classes in a course; 23 have no match.
- Falling back to `CourseClass.apxTitle` uniquely recovers none of the 23 unmatched sample entries.
- Across current placements, 2,248 course/effective-title keys resolve to multiple distinct Classes. This counts keys, not affected source rows.

The existing importer takes the first placement on title collisions. Do not run that behavior unchanged for VG. Retain source history, import only unambiguous matches, and record ambiguous/unmatched rows separately. Local AppX IDs exist for completion mapping, but the admin watch-history response itself supplies titles rather than video IDs.

## Recommended execution order

1. Build a local preview of unique mappings for the positive-value cohort using the saved raw history. Separate zeros, unmatched titles and collisions. Do not refetch history just to repeat local mapping work.
2. Harden the watch-history importer to reject ambiguity and preserve native sessions and manual flags. Preserve `apxMigrated` semantics: AppX cumulative duration does not set Watch status or playback resume. Run a bounded import canary only under the subsequent import scope.
3. Use GCP for completion reads. Expand the five existing tokens across their relevant courses, persist source responses and a per-user/course ledger in the eventual importer, and validate an actual positive flag before a completion-write canary.
4. Prioritise positive-value learners with evidence of use; retain the remaining cohort as explicit backlog. Define activity from observed source or platform activity, not signup order. Filter eligible users before any OTP work.
5. Token acquisition is the main completion bottleneck: roughly 380k positive-value course users versus five cached tokens. The historical one-minute pacing would be about 264 days for one uninterrupted worker if nearly all require new tokens. This is arithmetic from old pacing, not a newly measured VG limit. Do not increase minting or start workers based on this read-only pilot.
6. Fetch missing watch detail separately from test attempts through a bounded shared admin request budget. Classify no-history courses before treating every absent pair as a fetch job. Perform a fresh delta pass before cutover.

No new OTP work or import was started by this investigation. The next concrete deliverable is the saved-history mapping preview and an importer that refuses ambiguous mappings.

Evidence: [inventory](inventory.jsonl), [mapping and positive-value scope](mapping-probe.jsonl). Reproducible read-only scripts are in `reference/scripts/vidyagram-{learner-history-inventory,completion-cached-probe,history-mapping-probe}.cjs`.
