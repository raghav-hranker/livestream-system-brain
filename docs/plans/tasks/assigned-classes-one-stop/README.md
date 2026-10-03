# Tasks: Assigned Classes one-stop

State: 00–07 and 09–22 **done** (19–22 on 2026-10-03, local) · 19's prod `--commit` **run 2026-10-03** (from the Mac, before deploy: 399/399 modified) · `ready-for-human` (08)

**Merged heads** of `feat/assign-classes-one-stop`: backend `3578ee9f6`, admin `064e8cc` (worktrees
`qt-one-stop-backend` / `qt-one-stop-admin`). Round 3 ended at backend `abdae59b3`, admin `064d358`; round 2 ended at backend `4e9456e64`, admin `c37e774`;
round 1 at backend `146653960`, admin `94cf488`.
Task 00 also sits alone on `fix/class-series-require-admin`
(backend `98a4a874a`, admin `a414e5a`, off origin) and was cherry-picked into the one-stop branch.
Known failures at the merged heads: [`baseline-backend.txt`](baseline-backend.txt) and
[`baseline-admin.txt`](baseline-admin.txt) (taken 2026-10-03 on fresh worktrees with
`scripts/qt-tasks.sh suites`; re-take after each merge round). The integration admin
worktree carries an uncommitted `config.ts` → `localhost:5912` LOCAL PREVIEW edit: never commit it.

**Round 2 commits** (per-task branches `feat/assign-classes-one-stop-NN`, merge order 13, 09, 12, 10, 11):
13 admin `75e93b3` (backend unchanged) · 09 admin `5cb94f3` · 12 backend `4a5998eb8`, admin `afe848c` ·
10 backend `8d184b780` + `a4665385f`, admin `8787060` (task 12 merged into its branch: backend `838988534`, admin `f10652a`) · 11 backend
`38c008a7e` (test only), admin `40d69ed`.
Round 2 notes for the preview (08): nothing was checked in a browser or on a phone; keyboard reorder
stays inside a group (Move to… is the keyboard/phone path across groups); Remove now always confirms;
selection is per row, so ticking one place of a class in two places acts on that place only; a drop into
a topic with no section is refused (the move endpoint needs a section); the class PDFs tab still caps at
25 (pre-existing); student class-tabs ignore a moved place (known PRD gap).
Live in-place classes end at the end of the start's IST day (no live-duration default exists).

**Round 3 commits** (merge order 14, 15, 16, 17, 18; round 3 branched from admin `f0875c5` = `c37e774` +
three small fixes): 14 backend `ffc8b2cd0`, admin `755249c` · 15 admin `0e444df` (backend unchanged) ·
16 backend `e5bd3982b`, admin `1eeda98` · 17 backend `8d939641d`, admin `28fd14c` · 18 admin `40815ee`
(backend unchanged). Two commits outside the series landed on the integration admin during the round
(`e291083` Copy to another course from a row's ⋯, `3271818` add-class dialog files into a new subtopic);
task 15's merge resolved them in `AddClassInPlaceDialog`.
Round 3 notes for the preview (08): nothing was checked in a browser or on a phone, no real upload ran,
and the transcoder flip was tested against the handler only. The recorded mode stays inside
`AddClassInPlaceDialog` (no separate dialog); several videos start at two files, max 30. The flip runs on
the persisted `ended` + `hlsAsset`. `bulk-update-overrides` does not exist in the backend (the per-item
PATCH fallback clears the wait). The class library lists `Class.status: 1` classes, limit 20 (max 50);
restricted roles see only their own classes. From a section header the sheet asks for a topic first.
Cancel remaining asks to confirm. Known nits: the add dialog still says "active straight away" for
recorded classes; with no place, a no-topic row reads "Filed under no topic" plus the amber reason; the
page keeps an always-empty `assignedClasses` local state.

Vertical-slice breakdown of [the PRD](../../prd-assigned-classes-one-stop.md). The tasks cite the PRD's
numbered decisions instead of restating them.

**Working-copy rules**
- **Branch.** Both forks use `feat/assign-classes-one-stop`, cut from `feat/course-class-grouped-view`
  (backend `f86dfb19d`, admin `380a5d5`). Everything stays local: no push, no deploy.
- **Worktrees.** `~/Projects/worktrees/qt-one-stop-{backend,admin}` are the **integration** worktrees:
  only the orchestrator merges into them. Each task runs in its own pair, made and merged with
  system-brain's `scripts/qt-tasks.sh` (`mkwt qt-one-stop NN` → `qt-one-stop-{backend,admin}-NN` on
  `feat/assign-classes-one-stop-NN`; `merge qt-one-stop NN`; `rmwt qt-one-stop NN`).

  **Never edit** `qt-grouped-view-backend` or `qt-grouped-view-admin`: the user's local preview runs
  from them.
- **No npm install in the admin.** It rewrites the lockfile, and `node_modules` is symlinked.
- **Commits.** Use the work email, with no co-author trailers.
- **Tests.** `scripts/qt-tasks.sh suites <worktree> docs/plans/tasks/assigned-classes-one-stop/baseline-<side>.txt`
  must print `NO NEW FAILURES`. How to run, read and write tests:
  [`reference/quicktricks-testing.md`](../../../../reference/quicktricks-testing.md).

| # | Task | Type | Blocked by |
|---|---|---|---|
| 00 | [Guard class test-assignment routes with requireAdmin](00-class-tests-auth.md) | AFK | — |
| 01 | [Row Go live button, status pill and ⋯ menu](01-row-menu-go-live.md) | AFK | — |
| 02 | [Upload video from the row](02-upload-video-from-row.md) | AFK | 01 |
| 03 | [PDFs sheet from the row](03-pdfs-sheet.md) | AFK | 01 |
| 04 | [Tests sheet from the row](04-tests-sheet.md) | AFK | 00, 01 |
| 05 | [Add recorded class here](05-add-recorded-class-here.md) | AFK | — |
| 06 | [Schedule live class here](06-schedule-live-class-here.md) | AFK | 05 |
| 07 | [Row resource counts and the active switch](07-row-resources-and-active-switch.md) | AFK | 01 |
| 09 | [Row and bulk cleanup: Go live into ⋯, arrows out, Bulk edit trimmed](09-row-and-bulk-cleanup.md) | AFK | — |
| 10 | [Move to… (one row or a ticked set) and Reset](10-move-to.md) | AFK | 09 |
| 11 | [Drag across groups, and several classes at once](11-cross-group-multi-drag.md) | AFK | 10 |
| 12 | [Classes that appear in two places](12-classes-in-two-places.md) | AFK | 09 |
| 13 | [Class PDF upload: filed from the class, free in this class only](13-class-pdf-upload.md) | AFK | — |
| 14 | [Hidden until the recording is ready](14-hidden-until-recording-ready.md) | AFK | — |
| 15 | [Background uploads, and a video in the add form](15-upload-queue-and-one-video.md) | AFK | 14 |
| 16 | [Several videos at once, and the old bulk button goes](16-several-videos.md) | AFK | 15 |
| 17 | [Add existing classes here (from a header)](17-add-existing-classes-here.md) | AFK | 15 |
| 18 | ["Add existing classes" at the top, and the Available tab goes](18-remove-available-tab.md) | AFK | 16, 17 |
| 19 | [Backfill the class's own filing from its courses](19-backfill-class-home-filing.md) | AFK (+ HITL prod run) | — |
| 20 | ["Add classes ▾" at the top, and "Where" in the top sheet](20-add-classes-from-the-top.md) | AFK | — |
| 21 | [Copy to several courses at once](21-copy-to-several-courses.md) | AFK | — |
| 22 | [Also add new classes to other courses](22-also-add-to-other-courses.md) | AFK | 20, 21 |
| 08 | [Preview and deploy](08-preview-deploy.md) | HITL | 01–07, 09–22, outline task 11 |

Task 00 is on its own branch off `origin/quicktricks-admin` so it can deploy ahead of the outline; it is merged into the one-stop branch for task 04.

**Round 2** (2026-10-02, after the local preview): tasks 09–13, PRD section "Round 2". Wave 1 = 09 and
13 in parallel; then 10 and 12 (both after 09; they touch the same view, so merge one before starting
the other's merge); then 11. Task 08 runs once round 2 is merged.

**Round 3** (2026-10-02, board I of the preview): tasks 14–16, PRD section "Round 3". Recorded classes
with their videos: one "Add recorded classes here" dialog for no, one or several videos, background
uploads, and new recorded classes hidden until their recording is ready. Run 14 → 15 → 16 in order
(each builds on the last); 17 (add existing classes from a header, board L) can start once 15 is
merged, alongside 16; 18 (top button, Available tab removed) goes last; branch per-task worktrees from the round 2 heads above. Board J (a brand-new
section from the course screen) is parked.

**Round 4** (2026-10-03, after the round 3 preview): tasks 19–22, PRD section "Round 4". Wave 1 = 19,
20 and 21 in parallel (19 is backend only, 20 and 21 are admin only and touch different dialogs; merge
20 before 21 if both edit `AssignedClassesView.tsx`); then 22 (after 20 and 21). Branch per-task
worktrees from the round 3 heads above. Task 19's `--commit` on prod runs only with the user's
go-ahead, after deploy.

**Round 4 commits** (merge order 21, 20, 19, 22; 21 did not touch `AssignedClassesView.tsx`, so it went
first): 19 backend `d821d2ffa` (admin unchanged) · 20 admin `8235b9b` · 21 admin `057dbbc` · 22 backend
`3671c8845`, admin `806e808` (branched from the merged wave: backend `3c96213c0`, admin `0e211fa`).
Round 4 notes for the preview (08): nothing was checked in a browser or on a phone, and no real create,
upload or transcoder flip ran (the cross-course flip was tested against the stream-status handler).
- 19: never run against any real database. Every run writes an EJSON backup (dry run defaults to
  `class-home-filing-backup-<ts>.json` in the cwd) and refuses an existing path. Writes go through the raw
  collections, so `updatedAt` is untouched. A placement with a topic but no section keeps the class's
  own section. Box commands (backend dir, after deploy, with the go-ahead):
  `DOTENV_CONFIG_PATH=.env.development npx ts-node --transpile-only src/scripts/backfillClassHomeFiling.ts --backup <file>`
  (dry run), then the same with `--commit --backup <new file>`; `--restore <file>` undoes it. Copy the
  commit backup to `reference/scripts/`.
  **Run on prod 2026-10-03 ~15:42 IST** by the user from the integration worktree (prod DB, ahead of the
  deploy so the preview could be tested): dry run 833 candidates = 399 one place / 270 several / 164 none;
  `--commit` matched 399, modified 399 (220 of them also changed section, which the topic requires).
  Backup: `reference/scripts/class-home-filing-backup-2026-10-03.json`; undo with `--restore` on that file.
  **Second pass `--own-section`** (backend `5a54f0485`, merged `83e1dca1b`): a several-place class takes the
  one place in its own section (fills the topic, never moves the section). Run on prod 2026-10-03 by the
  user: 104/104 modified; backup `reference/scripts/class-home-filing-own-section-2026-10-03.json`.
  Then restored the same day by the user (104/104), and **re-applied** (104/104 modified) — the second pass
  is live. Backup of the live run: `reference/scripts/class-home-filing-own-section-2026-10-03-b.json`.
  **Third pass `--prefer-course 6a3903d283f65d7af3c02c4c`** (Railway Group D Maths Crash Course 2026, chosen by the
  user; backend `f22309836`, merged `d07574db9`): the 95 AppX Maths classes (own section CGL MATHS) that other
  courses lump under "Maths › Topics" took the Crash course's real topic (section → Maths). Run on prod
  2026-10-03: 95/95; backup `reference/scripts/class-home-filing-groupd-2026-10-03.json`.
  Still without a home topic: 235 = 57 Computer classes (BASICS OF COMPUTER APPLICATION course files them
  Computer › Computer; RRB/SRB batches BASICS OF COMPUTER APPLICATION › same — user to choose), 14 intro /
  announcement leftovers, 164 no course filing (115 in the Science Foundation course, 15 RRB NTPC UG Expected
  Papers, 32 in no course).
  Left without a topic of their own: 166 several places with none in their section + 164 with no course
  filing (132 placements without a topic, 32 no active placement) — added via "In a place I choose".
- 20: the shared picker is `assign-classes/PlacePicker.tsx` (MoveTo, the add dialog and the top sheet).
  With a chosen place the top sheet keeps the All view plus the Filed-under tab; switching back to
  "Where each is filed" unticks no-topic classes.
- 21: a 403 in preview or copy stops everything; a course with nothing to add is left out ("Nothing to
  add"); the dialog can't close mid-run. The entry labels in the view still say "Copy to another
  course…" (title is now "Copy … to other courses").
- 22: `alsoCourseIds` is sent only when a course is picked. Extra placements copy the main one's
  status/waiting/dates and carry no taxonomy pin (they follow the class's own filing). 404 names the
  course by id. `topicOrderAppended` reports the main course only.
