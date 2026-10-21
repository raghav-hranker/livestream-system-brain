# 07 — Class naming: reconcile what students see vs the unique class title (Vidyagram)

Status: `ready-for-human`, rule chosen 2026-10-19, rename deferred until after task 08 (see Decisions below). Tenant: Vidyagram (customer 781,
DB `vidyagramdb`). Plan: [../../appx-tenant-onboarding.md](../../appx-tenant-onboarding.md).

## Problem (measured 2026-10-19)

- `Class.title` is **unique across the whole tenant** (`src/models/Class.ts:233`, `unique: true`). AppX titles are only
  unique inside their folder: Jai Sir's course 85 has a "CLASS-01" under NOUN, PRONOUN, ARTICLE, ADJECTIVE.
- The class import (branch `feat/vg-class-import`) therefore made titles unique by suffixing: course 85 is stored as
  "CLASS-01", "CLASS-01 (2)", "CLASS-01 (3)", "CLASS-01 (4)"; 4,258 of 10,553 classes carry a " · <topic>" suffix
  (decision 0g in the plan). The user rejects " (2)" across different topics as poor UX.
- No `CourseClass` rows exist yet for Vidyagram (0 courses created), so the course-row names are still free.
- Students inside a course see the placement's name first: `shownName = placement.title ?? placement.apxTitle`,
  else the class title (`src/utils/classNames.ts:15`, "same precedence as the student cards (cardTitleExpr)").
- One class appears at most once per course: unique index `{course, class}` (`src/models/CourseClass.ts:245`).
  `apxDisplayPlacements` is a quicktricks-migration-only escape hatch; do not use it for Vidyagram. Across the plan,
  654 repeats sit in the same topic (AppX double uploads → keep one) and 116 in a different topic (keep first place,
  list the others for the team).

## Proposal to reconcile ("option C", no schema change)

| Field | Value |
|---|---|
| `CourseClass.apxTitle` | AppX's exact title for that course ("CLASS-01"), shown to students inside the course |
| `CourseClass.title` | empty (reserved for the admin's "rename only in this course") |
| `Class.title` (unique) | "<Topic> · <AppX title>" ("Noun · CLASS-01"); if still not unique, add the course short name, then the recording date; never a bare counter |
| `Class.oldTitles` / `searchNames` | the current imported titles, so nothing becomes unfindable (alias feature, PRD class-faculty-duplicate-rename) |

Within one topic, two *different* videos with the same AppX title get a distinguishing suffix from the recording date
("PYQs (12 Sep)"), not "(2)".

## To reconcile / verify in the new chat

1. Confirm the precedence on every student surface that shows a class name: course outline, class tabs, continue
   watching, notifications, student search (`src/services/search/classResult.ts`, `classSearcher.ts`), playback page,
   PDF/notes titles. List which field each uses; flag any that show a bare "CLASS-01" without topic context and propose
   the smallest fix (e.g. topic as a second line).
2. Check every writer of `Class.title` in the Vidyagram flows (class import `feat/vg-class-import`, nightly sync
   `feat/vg-nightly-*`, duplicate/rename features) so the rule is encoded once (one naming function) and the nightly
   sync can't reintroduce counters.
3. Check the course builder (`docs/plans/prd-vidyagram-course-builder.md`) is unaffected.
4. Produce a dry-run rename plan for the 10,553 classes (old → new title, clashes resolved, CSV), read-only.
5. Decide with the user; then encode the rule in code with tests (one shared naming function used by import, course
   creation and nightly sync). No writes to vidyagramdb without the user's explicit go.

## Sources

- Worktrees: `~/Projects/worktrees/vg-class-import` (class import + models), `~/Projects/worktrees/vg-catalog-planner`
  (planner, `src/services/apx/apxCatalogPlanner.ts`), nightly branches `feat/vg-nightly-*`.
- Latest preview: `~/Projects/system-brain/outputs/vidyagram-catalogue-preview-2026-10-16/` (plan-<course>.json).
- Ledger `apxcatalogimports` (vidyagramdb): `placements[]` with `apxCourseId`, `title`, `apxTitle`, `topic`, `priority`.
- Mongo access: see `~/Projects/system-brain/reference/hosts.md`; read-only unless the user says otherwise.

## Findings 2026-10-19 (read-only; offline replay of the 10-16 preview, live DB not yet compared)

Lever: `reference/scripts/vidyagram-class-title-dryrun.cjs` →
`outputs/vidyagram-class-title-dryrun-2026-10-19/` (`class-titles.csv` one row per Class with current / topic-first /
bare-first titles; `batch-labels.csv` suggested short labels). It reproduces 10,553 Classes. Its current-rule replay
predicts 2,018 topic suffixes + 2,520 counters, not the 4,258 measured here: compare against the live DB before the
rename. Code refs are on `feat/vg-class-import` unless a branch is named.

- **Batch copies drive the clashes, not titles.** AppX gives every batch copy of a recording a new video id, so one
  recording became up to 16 Classes ("Circle 03" in CHAMPIONS 6.0 to 18.0: same duration and date in the AppX CMS,
  different asset keys). 4,142 Classes share topic + AppX title with another Class. Merging copies is a separate
  task (task 08, "Later").
- **Per-topic sequences** ("CLASS-01" under NOUN and PRONOUN of one course) are 87 Classes in 12 courses; most AppX
  titles already carry their topic ("Circle 03", "VERB CLASS-01").
- **746 Classes share course + topic + AppX title** (354 groups): mostly re-uploads. A content call for the team.
- **Students' " (2)"** comes from the planner's in-course counter (`applyTitleCounter`, `apxCatalogPlanner.ts:668`)
  into the ledger placement `title`; `apxTitle` keeps AppX's text. Task 08 writes `CourseClass.apxTitle` from it.
- **Three counters write `Class.title`:** `assignImportTitles` (`apxCatalogClassImport.ts:85`, import and nightly),
  the hidden `resolveNewTitle` (`apxPortingService.ts:102-108`, via `apxCatalogClassCommit.ts:194`), and the reconcile
  re-run (`feat/vg-nightly-sync` `apxCatalogReconcile.ts:232`). Nothing finds a Class by title (keys are `classId` and
  `apxAssetKey`).
- **Surfaces with no course context show `Class.title`:** pushes (`cron/classNotificationScheduler.ts:132`,
  `services/classLifecycleNotification.service.ts:51-58`), the global search hit (`services/search/classResult.ts:128`),
  `POST /api/schedules/batch` (`controllers/scheduleController.ts:152`). "NOUN · CLASS-01" reads well there, so no
  change is needed.
- **Course builder unaffected** (step 3): it keys on topic ids and never reads `Class.title`.
- **Unique index kept.** Dropping it was considered and rejected: titles show with no context in pushes, search,
  schedules and admin pickers; six pre-checks and six duplicate-key handlers assume it; the schema is shared with
  quicktricks, and dropping it in one DB only would make autoIndex fail silently on every start (`app.ts:262`).

## Decisions (user, 2026-10-19)

- **Rule:** `Class.title` = "<Topic> · <AppX title>" always (no topic: AppX title as is). Still clashing: add the
  short batch label, then the AppX upload day (from the asset key), then "#<AppX row id>". Never a counter, never
  digits in parentheses (`splitTitleCounter` on `feat/vg-nightly-sync` reads a trailing "(n)" as a counter). In the
  preview: 6,213 unique by topic, 3,533 need the batch label, 362 the day, 445 the row id; 10,474 renames; length
  p50 49, p90 86. The batch labels (88 courses) need a human pass over `batch-labels.csv`.
- **Order:** courses and their rows first (task 08), with the current Class titles. Then merge batch copies, then
  rename, all before launch.
- **The bulk rename must not run `followClassTitle`** (`services/classNames.ts:212-235`): it rewrites every row whose
  `apxTitle` equals the old Class title, so students would see "NOUN · CLASS-01". Set `title`, `oldTitles` and
  `searchNames` without it.
- **One naming function** replaces the three counters above, used by import, nightly and reconcile; `resolveNewTitle`
  fails loudly instead of appending " (n)" on the catalogue path.

