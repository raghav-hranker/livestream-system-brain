# 03e — Preview sheet: "Couldn't fetch from AppX" tab and default faculty (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-catalog-planner` (tip 549fae5a0),
worktree `~/Projects/worktrees/vg-catalog-planner`. Read [03](03-catalog-planner-preview.md), [03d](03d-teacher-folder-subject.md)
and `src/services/apx/apxCatalogPlanner.ts`, `apxCatalogPreviewSheet.ts`, `src/scripts/apxCatalogPlan.ts` first.

## Why

The capture (branch `feat/vg-catalog-mirror`, task [01e](01e-appx-unavailable-list.md)) now finishes a course even when
AppX keeps refusing some `get_content_by_id` lookups, and records them on the course doc as
`capture.appxUnavailable[] = {rowId, title, kind, error, firstFailedAt, lastFailedAt}` (74: 5, 77: 44, 95: 46). The
user needs to see them. Separately, the last preview's Faculty column was empty although the decision is
"Vidyagram Team" for every course.

## Changes

1. Read `capture.appxUnavailable` (projection only) and add a sheet **Couldn't fetch from AppX** with columns
   AppX course, Course title, AppX row, Title, Kind, Error, First failed, Last failed, and whether the row is also in the
   plan's items/excluded/unfiled (and where). Add `appxUnavailable` per course to the Courses sheet and to
   `plan-summary.json`.
2. `--faculty-default <name>` applies to every course without a `--faculty` map entry. Faculty column shows it.
3. Plan only courses whose `capture.status == 'done'` (as today).

## Tests

Sheet present with rows from a fixture; per-course count; default faculty applied and overridden by the map. Existing
tests green.

## Run (allowed, read-only)

`--run full-2026-10-13 --off-sale 66 --faculty-default "Vidyagram Team"` into
`~/Projects/system-brain/outputs/vidyagram-catalogue-preview-2026-10-15/`. Find-only DB access, no AppX calls, no
secrets. Report the summary and the unavailable count per course.

## Done when

Tests pass, `tsc --noEmit` clean, preview written, commit local (not pushed).
