# 01g — Catalogue capture: no lookups for rows their own flags already explain (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-catalog-mirror` (tip 0ee8e0be5 or
later), worktree `~/Projects/worktrees/vg-catalog-mirror`. Read [01e](01e-appx-unavailable-list.md),
[01f](01f-saved-listing-fallback.md) and `src/services/apx/apxCatalogCapture.ts` (hidden-row classification around
the `hiddenRows` / backPath lookups, ~line 214–240, and the completeness counts ~line 660–740) first.

## Why (measured 2026-10-15)

Course 96 ("SCIENCE SPECIAL 2.0 BATCH By Arti Ma'am") has 11,380 pc4 rows, of which **11,265 have `enable = "0"`**
(11,261 are LIVE_STREAM rows created 2026-06 with `stream_status` UPCOMING) and only 167 entries are in the student
tree. The hidden-row classifier calls `get_content_by_id` for the parent of every row not in the tree: 11,268 distinct
parents, at ~6 lookups/min against a slow AppX (6,100 done after a day). Yet completeness already explains a row with
`enable = 0` as `disabled` (and `deleted = 1` as deleted) from the row's own flags, so those lookups change nothing.
The run was stopped on the bastion at 18:00 IST; 6,129 bodies are saved for run `full-2026-10-13`.

## Change

Before scheduling backPath / parent lookups, drop rows already explained by their own flags: `deleted = "1"`,
`enable = "0"`. Only rows that are enabled, not deleted, and still not in the visible tree (or visible-but-not-in-pc4)
need lookups. Keep their `hiddenReason` as today ("item disabled" / "item deleted") without a lookup. Print how many
lookups were skipped this way.

## Tests

A course with many disabled hidden rows completes with zero lookups for them (count fake AppX calls); an enabled hidden
row still gets its lookup; completeness counts unchanged. Existing tests green.

## Run

None (I run it). No AppX calls, no vidyagramdb access.

## Done when

Tests pass, `tsc --noEmit` clean, commit local (not pushed).
