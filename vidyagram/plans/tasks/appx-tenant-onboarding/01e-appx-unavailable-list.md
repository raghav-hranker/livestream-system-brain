# 01e — Catalogue capture: finish a course with a "couldn't fetch from AppX" list (Vidyagram)

Status: `ready-for-agent` (after 01d lands). Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-catalog-mirror`,
worktree `~/Projects/worktrees/vg-catalog-mirror`. Read [01c](01c-capture-retry-and-quirks.md),
[01d](01d-incremental-capture.md) and `src/services/apx/apxCatalogCapture.ts` first.

## Decision (user, 2026-10-14)

Items AppX refuses every time are listed, not retried forever. Evidence: across three runs (night, morning, afternoon)
courses 74, 77 and 95 failed on the same `get_content_by_id` ids every time (74: 174813, 174815, 174817, 174818,
189880; 77: 177161 first; 95: 43330 first), with 500s and 60 s timeouts.

## Changes

1. A `get_content_by_id` that still fails after its retries is recorded in `capture.appxUnavailable[]` as
   `{rowId, title (from the visible tree or pc4 row), kind, error, firstFailedAt, lastFailedAt}`, and the item counts as
   **explained** ("couldn't fetch from AppX"). Remove the per-course cap on failed lookups (`maxContentLookupFailures`).
   The course completes `done` when everything else is explained; its `capture.completeness.appxUnavailable` count is
   reported in the table.
2. On a resumed run (01d) these ids are tried once more (one attempt, no backoff ladder); if they answer, they leave the
   list.
3. `SessionLost` still stops the run (never listed as unavailable). A whole-course listing failure still fails the
   course.
4. Print the unavailable items per course at the end (ids and titles only).

## Planner follow-up (separate branch, note only)

The planner (`feat/vg-catalog-planner`) should add a **Couldn't fetch from AppX** sheet from `capture.appxUnavailable`.
Not part of this task.

## Tests

Persistent failure → listed and course `done`; no cap with 25 failing ids; resume retries a listed id once and drops it
when it answers; SessionLost never listed. Existing tests green.

## Run (allowed only when the user has just saved a fresh session and no other capture is running)

`npm run capture:apx-catalog -- --run full-2026-10-13 --courses 74,77,95` (and 96 if not `done`). Report the table and
the unavailable lists. Check apxsessions (isActive/lastHttpStatus/lastCheckedAt only) before and after.

## Done when

Tests pass, `tsc --noEmit` clean, commits local (not pushed); run only if its conditions hold.
