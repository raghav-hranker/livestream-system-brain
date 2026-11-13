# 01f — Catalogue capture: fall back to the saved listing when AppX can't list a huge course (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-catalog-mirror` (tip 7dae77310),
worktree `~/Projects/worktrees/vg-catalog-mirror`. Read [01d](01d-incremental-capture.md),
[01e](01e-appx-unavailable-list.md) and `src/services/apx/apxCatalogCapture.ts` first.

## Why

Course 96 is the last of 146. Its whole-course `get_pc4_contents` (one request, 300 s timeout) answers HTTP 500 most
times; one overnight attempt on 2026-10-14 got it and saved **11,380 rows** for run `full-2026-10-13`, plus 52 tree
pages and 3,047 content bodies. Every later attempt (09:27 IST 2026-10-15 on the bastion) fails at the listing, so the
saved work is never used.

## Change

When the whole-course listing still fails after its retries with a 5xx or timeout, and `apxcatalogrows` already holds
rows for this course stamped with this runId, continue with those saved rows instead of failing the course. Record
`capture.listingReusedFrom = <the newest updatedAt/lastSeenAt of those rows, or the run's previous listing time>` and a
warning `listingReused: true`, and print one line saying so. With no saved rows, fail as today. SessionLost still stops
the run. Apply the same fallback to getFolderPaths if its read fails and saved folderPaths exist for this run.

Keep everything else (tree reuse, content reuse, unavailable list, completeness) unchanged.

## Tests

Listing 500 with saved rows → course continues and completes using them, warning set; listing 500 without saved rows →
course fails; SessionLost on the listing → run stops, no fallback; getFolderPaths fallback likewise. Existing tests green.

## Run

None (I run it). Do not call AppX or write vidyagramdb.

## Done when

Tests pass, `tsc --noEmit` clean, commit local on `feat/vg-catalog-mirror` (not pushed).
