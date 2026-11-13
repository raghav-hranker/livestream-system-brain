# Handoff: "Add existing classes" sheet — one place dropdown instead of the Where switch

2026-10-03. Admin-only UI change on the Assigned Classes one-stop (PRD `docs/plans/prd-assigned-classes-one-stop.md`,
Round 4 decision 41; task `docs/plans/tasks/assigned-classes-one-stop/20-add-classes-from-the-top.md`).

## The ask (user, verbatim intent)

The top "Add existing classes" sheet (opened from **Add classes ▾ → Add existing classes**, no header place) shows a
two-way switch **"Where each is filed" | "In a place I choose"**. It confuses the user. Replace it with **one dropdown**
for now: a single place picker (Section › Topic › Subtopic) at the top of the sheet.

Open points to settle with the user before building (ask, don't guess):
- With the dropdown left empty, does the sheet still add each class where it is filed (today's default), with no-topic
  classes unpickable? Or is a place required before Add?
- Should the dropdown be one combined "Section › Topic › Subtopic" select, or the existing three cascading selects
  from `PlacePicker` shown as one block?

## Where the code is

Admin integration worktree `~/Projects/worktrees/qt-one-stop-admin`, branch `feat/assign-classes-one-stop`
(head `2123e63` at handoff; others are committing here too — `c537068`, `16d421f`, `2123e63` landed after round 4).
- `components/admin/assign-classes/AddExistingClassesSheet.tsx` — the switch is at ~line 207
  (`[["filed", "Where each is filed"], ["chosen", "In a place I choose"]]`); doc comment ~line 70; chosen-place state
  ~line 96; the "Where each is filed unticks no-topic classes" effect ~line 160; rows pass
  `unpickable={unpickableReason(row, Boolean(place))}` ~line 287.
- `components/admin/assign-classes/PlacePicker.tsx` — shared Section › Topic › Subtopic picker (also used by
  `MoveToDialog.tsx` and the course-level `AddClassInPlaceDialog`). `2123e63` added "create a subtopic" to it via the
  AsyncSelect create option (`16d421f`).
- `lib/class-library.ts:48` `unpickableReason(row, hasPlace)` — text "No topic of its own: choose a place above to add it".
- Tests: `AddExistingClassesSheet.test.tsx` (the Where-switch cases from task 20 will need rewriting).
- Backend is unchanged: `POST /api/admin/courses/:id/placements/assign` already takes an optional target place.

## Data context (why rows say "No topic of its own")

A class has its own filing (`Class.section/topic/subTopic`, the "home" the class library uses) separate from each
course's placement filing (which the outline and students see). The task-19 backfill filled the home for 399 classes
on prod (one agreed place). An `--own-section` pass then filed 104 more (the one place in the class's own section, e.g. the
"TCS Pattern" RRB ALP classes → ALP EXpected Paper › ALP EXpected Paper), so 330 active classes still have no home
topic: 166 in several places with none in their own section and 164 with no course filing. Those need a chosen place to be added.

## Rules (same as the one-stop rounds)

- Admin only. No `npm install` (node_modules is symlinked). Never commit the integration worktree's `config.ts`
  (`localhost:5912` local preview edit). Never touch `qt-grouped-view-*`.
- Commit locally with the work email, no co-author trailers. No push or deploy without the user.
- Baselines: `node --test 'lib/**/*.test.ts'` 301/301; vitest `--exclude '.sandcastle/**'` 14 known failures
  (BannedUsers, LearnLibraryDashboard, LearnLibraryPriorityEditor, PdfForm.section-topic); `npx tsc --noEmit` 105 (+1 stale `.next`).
- Local preview: admin `localhost:3000` (hot reload) → backend `:5912`, which reads the **prod** DB. Start it only with
  `PORT=5912 DISABLE_CRONS=true` (it ran prod crons before); it is currently running in terminal tab c1.
