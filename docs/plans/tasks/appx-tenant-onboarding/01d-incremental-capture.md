# 01d — Catalogue capture: save as it goes, resume without re-asking AppX (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-catalog-mirror` (tip 98503656c),
worktree `~/Projects/worktrees/vg-catalog-mirror`. Read [01](01-catalog-mirror.md), [01c](01c-capture-retry-and-quirks.md)
and `src/services/apx/apxCatalogCapture.ts` first.

## Why

Course 96 (6,500+ rows) has been capturing since 16:12 IST on 2026-10-14. After 3.5 hours it had made 2,000
`get_content_by_id` calls (AppX answering many 500/502/timeouts) while `apxcatalogrows` and `apxcatalogtree` for 96
still held 0 documents for the run: rows and tree pages are written only when the course finishes. The content bodies
are written as they arrive, but a resumed run asks AppX for every one of them again (the "once per id" memo is
in-process only, apxCatalogCapture.ts ~426). The AppX session has died three times mid-run, so a long course never
finishes and each retry starts from zero.

A capture process for 96/74/77/95 is still running from the old code; do not stop it. Editing the source does not
affect it.

## Changes

1. **Write as you go.** Persist the pc4 rows as soon as the listing returns, the course detail and folder paths as soon
   as fetched, and each tree page as soon as fetched, all stamped `lastSeenRunId = runId`. The course stays
   `running` (or `failed`) until the completeness check passes; readers already filter on `capture.status == 'done'`.
2. **Resume from what is saved.** On a run with the same runId, a course that is not `done`:
   - reuses an `apxcatalogcontent` body already stored with `lastSeenRunId == runId` instead of calling
     `get_content_by_id` again;
   - reuses tree pages already stored for this runId instead of re-crawling them;
   - re-fetches the pc4 listing, detail and folder paths (cheap, and they may have changed).
   Failed lookups are not cached; they are retried.
3. **Progress you can see.** Every 100 lookups, update `capture.progress {contentDone, contentReused, contentFailed,
   treePages, updatedAt}` on the course doc and print one line.
4. A new runId still means a full refresh (no reuse across runs).

## Tests

Resume after a crash mid-lookups reuses stored bodies (count AppX calls); stored tree pages are not re-fetched; a body
from an older runId is not reused; failed lookups are retried on resume; rows and tree pages exist in the DB while the
course is still `running`; progress fields advance. Existing tests stay green.

## Run

None. Do not run the capture (one is running). Report how a resume of course 96 would behave given 2,000 stored bodies.

## Done when

Tests pass, `tsc --noEmit` clean, commits local on `feat/vg-catalog-mirror` (not pushed).
