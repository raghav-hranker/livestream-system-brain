# 01c — Catalogue capture: retries and three AppX quirks (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-catalog-mirror` (tip 5bdea4285),
worktree `~/Projects/worktrees/vg-catalog-mirror`. Builds on [01-catalog-mirror.md](01-catalog-mirror.md); read it and
`src/services/apx/apxCatalogCapture.ts`, `src/services/apx/apxCatalogHttpSource.ts` first.

## Why

The full run `full-2026-10-13` finished with 137 of 146 courses `done` and 9 failed. Diagnosis (read-only, 2026-10-13):

| Course | Failure | Cause |
|---|---|---|
| 6, 81 | HTTP 500 from `get_pc4_contents` / `get_content_by_id` | transient AppX error; CMS calls are not retried |
| 74, 77, 95 | `timeout of 30000ms exceeded` | transient; not retried |
| 96 | `repeated id 45946 at start=6500` | offset paging shifted on a 6,500+ row course |
| 75 | folder 39877 not in getFolderPaths | the course is empty: its only tree entry is a "Home" folder (parent -1, no children); the Home rule only matches a Home that has children |
| 92 | pc4 row 176892 not visible | a PDF with `parent_id "0"`: it sits at the course root outside Home, which students never see |
| 101 | 4 visible folders not in getFolderPaths (45575, 174064, 174058, 174667, all titled "PDF" with files) | getFolderPaths omits some live folders; the student tree has them |

## Changes

1. **Retry CMS calls**: wrap each CMS request in a bounded retry (3 attempts, backoff ~2 s / 6 s) for HTTP 5xx, timeouts
   and network errors. Never retry `SessionLost` (3xx / login HTML / missing array); re-read the session before each
   attempt as today.
2. **Repeated id while paging pc4**: restart that course's pc4 read from offset 0 once; if it repeats again, fail the
   course as today. Apply the same repeated-id guard to getFolderPaths paging.
3. **Empty Home**: a root entry titled Home (parent -1) with no children counts as `homeFolders`, so an empty course
   completes `ok` with zero items.
4. **Outside Home**: a pc4 row whose `parent_id` is `"0"` (root, outside Home) and that is not in the visible tree is
   explained as `outsideHome` (not visible to students). Add the counter to `explained`.
5. **Folders only in the tree**: a folder present in the student tree but absent from getFolderPaths is recorded under a
   new `warnings.foldersOnlyInTree` list and does **not** fail the course (the tree is the student truth and the mirror
   already holds the folder). Keep failing for the other unexplained kinds.

## Tests

One test per change that fails without it (5xx then success; timeout exhausted → course failed; SessionLost not
retried; repeated id → one restart then ok; empty Home → ok with 0 items; parent "0" row → outsideHome; tree-only
folder → warning, status done). Keep the existing 11 tests green.

## Run (allowed)

After tests pass, re-run the capture for the failed courses only:
`npm run capture:apx-catalog -- --run full-2026-10-13 --courses 6,74,75,77,81,92,95,96,101`.
Check `apxsessions` (print only isActive / lastHttpStatus / lastCheckedAt) before and after; stop if it goes inactive.
Report the per-course table. Never print raw rows, cookies or `pdf_encryption_key`.

## Done when

Tests pass, `tsc --noEmit` clean, the retry run leaves all 146 courses `done` (or each remaining failure explained),
commits local on `feat/vg-catalog-mirror` (not pushed).

## Progress 2026-10-13 22:45 IST (first implementer stopped when its session ended)

Committed on `feat/vg-catalog-mirror`: 11f79982e (retries, re-read once, empty Home, outside Home, tree-only warning),
4b61b8fc4 + 1a663e274 (each course's listings read in ONE request, because AppX reorders rows across page boundaries),
bef8d6881 (listings get a 300 s timeout, other CMS calls 60 s), c32ebdb01 (failed course names the call that gave up).
Uncommitted: test-only edits in `src/tests/integration/apxCatalogCapture.integration.test.ts` expecting a new
`warnings.contentLookupFailed` list (source not written yet).

Run `full-2026-10-13` now: 141 done, 4 failed, 1 stuck `running` (96, its process died with the session).

| Course | Remaining failure |
|---|---|
| 74 | `get_content_by_id 174803` HTTP 500 (after retries) |
| 77 | `get_content_by_id 177149` HTTP 500 (after retries) |
| 95 | `get_content_by_id 43058` timeout 60 s (after retries) |
| 96 | interrupted mid-run (status `running`) |
| 101 | `getFolderPaths` repeated id 175005 at offset=100 |

## Remaining work

6. **Per-row content lookups that keep failing become a warning.** If `get_content_by_id` for one row still fails after
   retries, record `{rowId, error}` in `warnings.contentLookupFailed` and continue; the course is `done` only if that row
   is otherwise explained by the pc4 rows and the visible tree, and fails as unexplained if the lookup was the only
   source for it. Finish the source to match the already-edited tests; review the edits first.
7. **getFolderPaths in one request** like the listings (large `size`, verify `pagination.more` is false), falling back
   to paging with the repeated-id restart.
8. A course left `running` by a dead process is redone on the next run with the same runId.
9. Re-run `--run full-2026-10-13 --courses 74,77,95,96,101` and report the table.

## Result 2026-10-14 00:13 IST

Items 6–9 committed (e39eba78d, 04eac9959, 98503656c; tip 98503656c), 26/26 capture tests pass. Run `full-2026-10-13`:
**142 done, 4 failed** (74, 77, 95, 96). 101 completed. The four failed on AppX itself during 17:20–18:42 UTC: repeated
`get_content_by_id` 500s/60 s timeouts (74: 5 cross-listed ids unprovable; 77, 95: lookup-failure cap of 10 hit) and a
whole-course `get_pc4_contents` 500 for 96. Next: re-run those four off-peak.
