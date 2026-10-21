# 03d — Planner: a teacher folder keeps its subject when it is the subject (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-catalog-planner` (tip 2ca55978e),
worktree `~/Projects/worktrees/vg-catalog-planner`. Builds on [03c](03c-wrapper-and-deep-folders.md); read it and
`stripWrapperFolders` / `proposeCourseSection` in `src/services/apx/apxCatalogPlanner.ts` first.

## Why

03c drops every teacher folder. When the teacher folder is the only subject level, dropping it loses the subject:
"Indian Geo by D.S Sir" (course 42, 68 items) lands under the course section "UP SI LIVE+VOD"; "Maths By Anurag Sir"
(114, 50) under "Upsssc PET"; "Polity (By Deepak Sir)" / "(By Ajeet Sir)" (101, 105; 95 items) lose "Polity";
"Complete Static GK by Shubham Ma'am", "Complete Computer By Shubham Ma'am" (129) lose Static GK / Computer; courses 22
and 151 similar. About 430 items.

## Rule (decided 2026-10-14, refining the user's "skip teacher folders")

A teacher folder is **dropped only when at least two meaningful levels remain below it**. Otherwise it is **kept as its
subject part**: remove the teacher phrase (`By <Name> Sir/Ma'am/…`, with or without brackets), a leading "Complete", and
trailing punctuation; normalise like any name ("Indian Geo. By Shivant Sir" → "Indian Geo.", "Polity (By Ajeet SIr)" →
"Polity", "Complete Static GK by Shubham Ma'am" → "Static GK"). The teacher still goes to `facultyHint`. The user's
examples keep their result: "GK/GS › GS By Deepak Sir › History › Modern History" → GK/GS › History › Modern History.
Batch folders stay as 03c.

Also fix: `proposeCourseSection` must strip emoji variation selectors (U+FE0F) and other invisible characters, so
"⚔️ प्रहार …" proposes "प्रहार", not "️ प्रहार".

## Tests

Kept-as-subject at depth 1 and 2 below; dropped with ≥2 below; bracketed and "Complete" forms; U+FE0F stripped. All
existing planner tests green.

## Run (allowed, read-only)

Re-plan `full-2026-10-13 --off-sale 66` into `~/Projects/system-brain/outputs/vidyagram-catalogue-preview-2026-10-14c/`.
Report old vs new and re-list the rows of 03c's "Drops that look wrong" table with where they land now. Same safety
rules as before.

## Done when

Tests pass, `tsc --noEmit` clean, new preview exists, commit local (not pushed).
