# 03c — Planner: skip teacher/batch wrapper folders, join deep levels (Vidyagram)

Status: `ready-for-agent`. Repo: `abhi092515/quicktricks-backend`, branch `feat/vg-catalog-planner` (tip ccf56c201),
worktree `~/Projects/worktrees/vg-catalog-planner`. Builds on [03](03-catalog-planner-preview.md) and
[03b](03b-planner-decisions.md); read both and `src/services/apx/apxCatalogPlanner.ts` first.

## Why

The full preview (142 courses, 41,264 items; `outputs/vidyagram-catalogue-preview-2026-10-14/`) has 792 unfiled items:
699 "too deep", 93 "too shallow". Real too-deep paths:

- `Home > GK/GS > GS By Deepak Sir > History > Modern History` (course 105, 29 items)
- `Home > GK/GS > Geography > Indian Geography > Rivers of India` (course 104)
- `Home > Complete GS By Himanshu Sir > Polity > Handwritten Notes PDF > Hindi Notes` (course 71)
- `Home > 🌍 GS Special 4.0 Batch > Science By Pushpendra Sir > Chemistry > Acid, Base, Salt` (course 151)
- `Home > हिंदी > हिंदी व्याकरण > विराम चिह्न > Vidoes` (course 101; misspelt media folder)

## Decisions (user, 2026-10-14)

1. **Wrapper folders are skipped.** Before deriving Section / Topic / SubTopic, drop:
   - teacher folders: a segment containing `By <Name> Sir|Ma'am|Mam|Madam` (case-insensitive, after name normalisation),
     e.g. "GS By Deepak Sir", "Complete GS By Himanshu Sir", "Science By Pushpendra Sir";
   - batch folders: a segment that equals (normalised, emoji and punctuation stripped) the title of this course or of
     any course in the catalogue, or that ends in "Batch"/"बैच", e.g. "🌍 GS Special 4.0 Batch".
   Record the teacher name taken from a dropped teacher folder on each item as `facultyHint` (the course faculty stays
   "Vidyagram Team"; this is only carried for later use).
   Keep these rules in exported, tested helpers.
2. **Levels beyond three are joined into the SubTopic name.** After generic and wrapper folders are dropped, if more than
   three meaningful levels remain, Section = level 1, Topic = level 2, SubTopic = levels 3..n joined with " – "
   (e.g. "Indian Geography – Rivers of India"). Nothing deep goes to `unfiled` any more.
3. Add `vidoes` to `GENERIC_FOLDER_NAMES`.

"Too shallow" (items directly under Home) stays unfiled.

## Tests

One test per rule that fails without it: teacher folder dropped at any depth with `facultyHint`; batch folder by course
title and by "Batch" suffix; a subject folder that merely contains "by" (e.g. "Divisibility by 3") is NOT dropped;
4- and 5-level joins; `Vidoes` dropped. All existing planner tests stay green.

## Run (allowed, read-only)

Re-plan run `full-2026-10-13` with `--off-sale 66` into `~/Projects/system-brain/outputs/vidyagram-catalogue-preview-2026-10-14b/`.
Report old vs new (sections, topics, subtopics, unfiled by reason), the 10 longest joined SubTopic names, every dropped
wrapper folder name with counts, and any drop that looks wrong. Same rules as before: find-only DB access, no AppX
calls, no secrets in output.

## Done when

Tests pass, `tsc --noEmit` clean, the new preview exists, commits local on `feat/vg-catalog-planner` (not pushed).
