# 01d — Catalogue capture: the last five courses (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-catalog-mirror` (tip 11f79982e),
worktree `~/Projects/worktrees/vg-catalog-mirror`. Builds on 01 and 01c in this folder.

## State (2026-10-13 19:58 IST)

Run `full-2026-10-13`: 141 of 146 courses `done`. Still failing after the 01c retry:

| Course | Error |
|---|---|
| 74, 95 | `timeout of 30000ms exceeded` even with retries |
| 77, 101 | `getFolderPaths … repeated id … at offset=100 (paging incomplete)` |
| 96 | `get_pc4_contents course 96: repeated id 45946 at start=6500` (6,500+ rows) |

## Investigate first (read-only, a few AppX calls)

1. For 74 and 95: which call times out (pc4 page, getFolderPaths, tree crawl, get_content_by_id)? Time one call with a
   60–90 s timeout. Large page? Smaller `length`?
2. For 77 and 101: is getFolderPaths' `page` an offset or a page number? Compare `page=100` vs `page=1`/`page=2` on
   course 77. The repeat exactly at 100 suggests the parameter is misread.
3. For 96: does the DataTables listing accept a stable order (e.g. `order[0][column]` on id asc)? Does a smaller page
   size avoid the shift? Is the course being edited (compare two reads)?

## Fix

Smallest change that makes all five complete honestly: per-call timeout raised for heavy calls (keep retries bounded),
correct getFolderPaths paging, a stable order or a dedupe-and-verify read for big pc4 listings (only if the
completeness check still proves nothing is missing). A test per change that fails without it; keep existing tests green.

Rerun `npm run capture:apx-catalog -- --run full-2026-10-13 --courses 74,77,95,96,101`. Check `apxsessions` (print only
isActive / lastHttpStatus / lastCheckedAt) before and after; stop if inactive. Never print raw rows, cookies or
`pdf_encryption_key`. Never write `apxsessions` or `apxcourses`. No `git stash`.

## Done when

All 146 courses `done` for the run (or each remaining one explained with evidence), tests pass, `tsc --noEmit` clean,
commits local on `feat/vg-catalog-mirror` (not pushed).
