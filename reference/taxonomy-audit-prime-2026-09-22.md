# Class taxonomy audit — Prime Batch line, 2026-09-22

Read-only audit of prod (`courseclasses` × `classes` × `sections` × `topics`, 33,320 effective rows,
108 courses). Dump + analyser: scratchpad `taxonomy_audit.cjs` (run on the prod box, the Mac could not
reach the replica set) and `taxonomy_report.cjs`.

## Effective taxonomy rule (what the student listing shows)
`src/utils/courseClassTaxonomy.ts`: a CourseClass placement (section **and** topic set) owns the path;
otherwise the shared `Class.section/topic/subTopic` is the fallback. `apxDisplayPlacements` expand to
extra rows. Label strings (`sectionName` etc.) override doc names only when a placement exists.
Drift check: 0 rows where the label string disagrees with the doc it points at.

## Canonical section set for the six Prime Batch (2026-27) courses
Introduction · Maths · Reasoning · Science · GK/GS · Current Affairs. Everything the APX catch-up cron
filed through the approved-placement table lands there (Maths > Core Maths, Reasoning > Verbal
Reasoning, GK/GS > Polity/History/Static GK, Science > Physics/Chemistry/Biology).

## Misfiled rows (all five, all hand-set in the admin since 2026-09-19, none from the cron mapping)
| classId | title | shows as | should be | created by |
|---|---|---|---|---|
| 6ab250c34d1e260d40b09124 | Class 123 \|\| Series part -1 | Logical Reasoning > Series | Reasoning > Verbal Reasoning > (Series subtopic — see below) | cron port 09:56Z, then Class edited 14:00Z |
| 6ab2535b0e6394e183ce6c92 | Class 124 \|\| Series part -2 | Logical Reasoning > Series | same | admin 6ab24d69… (role `course_class_management`, account created 09:42Z today) |
| 6ab24f850e6394e183a4d605 | Average Part - 01 | Arithmetic > Misc | Maths > Core Maths > Average (no such subtopic yet; Age + Partnership were added today) | same admin |
| 6aaea3326a2e919c6a61e707 | test 12 (status 0) | (Classes +Pdf) > Algebra | test junk — delete or leave inactive | admin 6a159c18… |
| 6ab0de197cfa951f6da7fc15 | test 14 (status 0) | (Classes +Pdf) > Algebra | same | same |

All have **no CourseClass placement** (`source=class`), so the fix is on `Class.section/topic/subTopic`
(or by giving each CourseClass a placement). Class 123 sits in 3 courses (Maths+Reasoning 6a4558ce…,
Reasoning 6a4558e3…, Railway 6a4558e8…); 124 same three; Average in Maths 6a4558e6…, Railway, Maths+Reasoning.

Wrong section ids: Logical Reasoning `6a885af03aed5ba9f3a20f1b`, Arithmetic `6a885af03aed5ba9f3a20f98`,
(Classes +Pdf) `6a3d2ac13aed5ba9f3fe6c14`. Right ids: Reasoning `6a4558c2ebb42f585d9a8333` > Verbal
Reasoning `6a8d9090b60c546ecb1fe6ce`; Maths `6a3d2ac13aed5ba9f3fe6c0e` > Core Maths `6a8d908fb60c546ecb1fe6b6`.
Verbal Reasoning subtopics that fit "Series": `Alphabetical and Alphanumeric Symbol Series`
(6a8d9090b60c546ecb1fe6da, the approved-rule target) or `15. Number Series` (6a920e944f3abdb661ec4a37).

## Why the wrong sections were pickable
- **Duplicate-named sections**: 2× Maths in use, 2× Reasoning, 2× Logical Reasoning, 5× Arithmetic,
  3× General Awareness, 5× Computer Knowledge … (full list in the audit output). The admin dropdown lists
  them by name only.
- **The 2026-08-21 14:04Z batch** (`6a885af0…`, ~30 sections with APX legacy ids 5, 9, 674, 1531…) is
  the question-bank/test-series taxonomy from `remigrateAffectedSeriesLight.ts::ensureSection`
  (`Logical Reasoning` legacy_id 5 carries ~150 question-style topics like "Series Q"). It shares the
  `sections` collection with the class catalog, so it shows in every class form.

## Catch-up cron holding area
Unknown APX folder ids park under `sectionName:"New Classes (unfiled)"` with no placement, so the row
shows wherever `Class.section` points. Class 123 arrived today via folders **53748 / 53749 / 53750**
(APX courses 139 / 136 / 134) — none in `apxApprovedPlacementPolicy.ts`, so it parked and an operator
re-filed it wrongly. 13 unfiled rows exist in total (6 Railway Prime, 2 Maths+Reasoning, 2 Maths,
1 Reasoning, 1 GK Combo, 1 Free CA); the older ones (Jul–Aug) already have a sensible `Class.section`.

## Fix status
Step 1 DONE 2026-09-22 14:13Z (backup on box `~/taxonomy-refile-backup-2026-09-22T14-13-25-347Z.json`, new subtopic Core Maths > Average `6ab28d0537f2f272dd8f3002`). Steps 2–3 open.

## Recommended fix
1. Data: repoint the 3 real classes (and delete/ignore the 2 tests). Prefer setting a CourseClass
   placement per course over editing the shared Class, matching the cron's convention.
2. Code: add approved rules for folders 53748/53749/53750 → Reasoning > Verbal Reasoning >
   Alphabetical and Alphanumeric Symbol Series so tomorrow's "Series part -3" files itself.
3. Hygiene: deactivate (status 0) or rename the question-bank duplicates so the class form cannot
   offer a second "Reasoning"/"Maths"; the `sections/dropdown` endpoint filters on status.
