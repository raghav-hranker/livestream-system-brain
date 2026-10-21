# 03b — Planner revisions from the first preview (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-catalog-planner` (tip bed228a4f),
worktree `~/Projects/worktrees/vg-catalog-planner`. Builds on task 03
([03-catalog-planner-preview.md](03-catalog-planner-preview.md)); read it and `src/services/apx/apxCatalogPlanner.ts` first.

## Why

The first read-only preview (65 courses, 34,393 items; `outputs/vidyagram-catalogue-preview-2026-10-13/`) showed that
Vidyagram files content as `Subject › Topic › VIDEO|PDF`, so 33,145 items got a "VIDEO"/"PDF" SubTopic, and three
courses are one folder deep. The user decided the following on 2026-10-13.

## Decisions to encode

1. **Generic media folders are dropped** like the generic "Classes" folder: a path segment equal (case-insensitive,
   after name normalisation) to `video`, `videos`, `pdf`, `pdfs`, `classes` is removed wherever it appears, before
   Section / Topic / SubTopic are derived. Keep the list in one exported constant.
2. **One-level courses: Section = the course's subject, Topic = the folder.** A per-course subject map
   (`--course-sections <json>`, `{ "<apxCourseId>": "<Section name>" }`) supplies the Section for paths that have only
   one meaningful folder. When a course has such paths and no map entry, the planner proposes a subject derived from the
   course title (drop words like BATCH, SPECIAL, COMBO, numbers and version tags; e.g. "COMPUTER SPECIAL BATCH" →
   "Computer") and lists it on a new **Course sections** sheet for confirmation. Items directly under Home (no folder at
   all) stay unfiled.
3. **Course 66 ("testing") is imported off-sale** (status 0) like the disabled courses. Its QUIZ/TEST/IMAGE rows stay
   excluded as unsupported types.
4. **Name merges pick the most-used spelling**: among variants of one node (same parent + normalised key), the display
   spelling is the one carrying the most planned items across the catalogue; ties go to the first seen. The **Name
   merges** sheet shows every variant with its count and the winner.
5. **YouTube `/live/<id>` links** get the `yt:<id>` asset key like other YouTube links. Make the change in
   `src/utils/apxAssetKey.ts` (or wherever `deriveApxAssetKey` lives) with tests; check the fork's existing asset-key
   tests still pass. This is the tenant branch only.
6. **MP4 recordings are usable.** A row whose playable link is a direct `.mp4` URL (e.g. `migrationvideos.kaxa.in`) is
   planned as kind `VIDEO_MP4` with an asset key from its URL, not counted as "no usable link". Do not build the MP4
   ingest path here; just plan and count them.

## Tests

One test per decision that fails without it (VIDEO/PDF dropped at any depth; one-level path with and without a map
entry; course 66 off-sale; most-used spelling incl. tie; `/live/` → `yt:`; mp4 kind). Keep all 22 existing tests green.

## Run (allowed, read-only)

Re-run `src/scripts/apxCatalogPlan.ts` over the courses `done` in run `full-2026-10-13` into
`~/Projects/system-brain/outputs/vidyagram-catalogue-preview-2026-10-13b/`. Report the new summary next to the old one
(sections/topics/subtopics, unfiled, generic placements, no-usable-link, name merges), the proposed course sections,
and the top 10 name merges with winners. Same rules as task 03: find-only DB access with projections, no AppX calls,
no secrets in output.

## Done when

Tests pass, `tsc --noEmit` clean, the new preview exists, commits local on `feat/vg-catalog-planner` (not pushed).
