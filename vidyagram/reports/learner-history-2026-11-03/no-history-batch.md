# VG no-history census and batch — 3 November 2026

User asked to count paid students with no watch history and try a small batch of them. Capture only: no ClassProgress writes.

## Census

Cohort: successful, non-disabled, positive-value, unexpired orders, the same filter as the completion seed. 435,156 orders, 382,789 users. Read from secondaries, completed at 19:30 IST. Saved history dates from October.

| Bucket | Users | Share |
|---|---:|---:|
| Positive saved seconds on an owned course (seed-eligible) | 280,407 | 73.3% |
| No history | 100,163 | 26.2% |
| No video course | 2,215 | 0.6% |
| Not countable | 4 | 0.0% |

No-history detail:

| Sub-bucket | Users | Share of cohort |
|---|---:|---:|
| Detail doc, no history rows | 57,153 | 14.9% |
| No detail doc | 32,687 | 8.5% |
| Rows, no positive seconds | 9,182 | 2.4% |
| Positive seconds only on a course not owned | 1,141 | 0.3% |

4,565 no-history users have `video_completion` above 0 on an owned course.

`video_completion` inside the eligible group, highest owned course:

| Value | Users | Share |
|---|---:|---:|
| 0 | 12,772 | 4.6% |
| Above 0, under 5 | 101,149 | 36.1% |
| 5 to under 10 | 61,847 | 22.1% |
| 10 or more | 104,639 | 37.3% |

Under 5 in total: 113,921 (40.6%).

## Batch

Run `vg-completion-20261103-nohistory50`: 50 random no-history learners, excluding claimed learners and cached tokens, each rechecked at seed. Worker `both` on migrator2 at a 60-second gap, beside that host's fleet500 `acquire` worker. Ran 19:32–20:43 IST.

- 50 OTPs sent, 50 tokens, 0 token failures. All 265 requests returned HTTP/API 200.
- 13 of 50 learners had flags (26%), against 39% in fleet500 (187 of 477 read).
- 262 flags: 241 mapped, 21 unmatched. Median 10 among learners with flags, maximum 90.
- 65 course pairs read, 17 with flags.

| Sub-bucket | Learners | With flags | Flags |
|---|---:|---:|---:|
| Detail doc, no history rows | 30 | 5 | 19 |
| No detail doc | 17 | 6 | 208 |
| Rows, no positive seconds | 2 | 2 | 35 |
| Positive seconds only on a course not owned | 1 | 0 | 0 |

Fifty learners is a small sample: 26% has a rough range of 16–40%, and the sub-bucket rows are too small to rank. No watch history does not mean no flags, so this group cannot be skipped without losing real progress. If the rate holds, about 26,000 of the 100,163 have flags.

## fleet500 stopped

Read at 23:11 IST: fleet500 is stopped with status `token_failures_stop`, 6 token failures, 487 OTPs sent. Jobs: 408 captured, 67 mapping_exception, 12 queued, 6 token_failed, 5 token_ready, 2 read_failed. Recorded non-200s: 5 `admin_user` 307 responses and 1 `completion_read` with no status. No 429 or 403 recorded. This batch did not change the fleet500 run document or workers; whether the second worker on migrator2 contributed was not investigated.

## Files

- Census: `reference/scripts/vidyagram-completion-history-census.cjs`; outcome: `vidyagram-completion-run-outcome.cjs`.
- Worker change: `vidyagram-completion-pilot.cjs` gains the run, deployed to migrator2 only. 13 tests pass.
- No-history list: `/home/azureuser/vidyagram-completion-azure-20261103/nohistory/no-history.tsv`, mode 600, on migrator and migrator2.
