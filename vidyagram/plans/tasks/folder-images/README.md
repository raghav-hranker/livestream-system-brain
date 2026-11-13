# Vidyagram course folder images: tasks (phase 1)

PRD: [`../../prd-vidyagram-folder-images.md`](../../prd-vidyagram-folder-images.md).
Offline cross-check: `reference/scripts/vidyagram-folder-image-map.cjs` (10-19 snapshot in
`outputs/vidyagram-import-verify-2026-10-19/`).

Repo: the Vidyagram backend (fork of quicktricks-backend, branch `vidyagram-admin`; worktree
`~/Projects/worktrees/vg-backend`). Task 04 also touches the nightly sync code that runs on GCP test-uday. No admin
or app work in phase 1. Nothing here touches quicktricks.

Phase 1 brings the AppX folder pictures into `course_outline_images`. Showing them in the app and editing them in the
admin is phase 2 and has no tasks yet.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Dry run for one course, end to end](01-dry-run-one-course.md) | AFK | None |
| 02 | [Write pictures for one course](02-write-one-course.md) | AFK | 01 |
| 03 | [Backfill all courses on prod](03-backfill-prod.md) | HITL | 02 |
| 04 | [Nightly step](04-nightly-step.md) | AFK code, HITL deploy | 02 |

Order: 01, then 02. Then 03 and 04 in parallel.

Working copies: integration worktree `~/Projects/worktrees/vg-folder-images-backend` on `feat/vg-folder-images`, cut
from `origin/vidyagram-admin` c08bd9208, refreshed 2026-11-04 (see below). Per-task worktrees from
`scripts/qt-tasks.sh mkwt vg-folder-images <NN>`, merged back with `scripts/qt-tasks.sh merge vg-folder-images <NN>`.
Baseline: `baseline-backend.txt` (97 failures: tsc 3, unit 21, integration 73).

**Done:**
- **01** (2026-10-27): backend 4249ed572, merged as 75a72ccef. `NO NEW FAILURES`; 15/15 new unit tests re-run by the
  orchestrator. Snapshot dry run (10-19 data): 129 courses, pictures 102 section / 2,431 topic / 58 sub-topic,
  224 distinct AppX images. Course 103: 41/41 class topics; BATCH PLANNER (PDF only) and the Maths section ("Home",
  no image) get none. The gap to the offline script (2,462 topics) is 34 PDF-only topics with no CoursePdf rows yet and
  one class filed in two folders. Open: 3 sections take the course-level "Home" folder's picture (decide keep or skip
  before 02).
- **01 live dry runs** (2026-10-27, read-only, reports in `outputs/vidyagram-folder-images-dryrun-2026-10-27/`):
  course 103 = 41/42 rows, same as the snapshot. All courses (132, ~3 min on a secondary): 103 section, 2,378 topic,
  **1** sub-topic pictures. Cause: the CoursePdf rows placed today (onboarding task 09) are counted under their topic
  only, so a PDF inside a sub-topic's AppX folder makes that folder look shared, and the name-based PDF → chapter join
  sends some PDFs to the wrong topic. The same run with PDFs ignored gives 103 / 2,433 / 92. Proposed fix: match on
  class placements only. Separately, course 103's "Digital Sum" items are in the mirror (capture daily-2026-10-26,
  done) but no "Digital Sum" topic is in the course outline; not a task 01 code issue, look at it with the nightly.

**Decisions for 02 (2026-11-04, defaults chosen when the build started; the user can reverse them):**
- Match on class placements only. PDF-only rows such as BATCH PLANNER get no picture and are reported, so course 103
  writes 41 of 42 topics. PDFs come back when their chapter join is exact.
- A section whose only source is the course-level "Home" folder gets no picture.

**Base refreshed 2026-11-04:** `origin/vidyagram-admin` da8513624 merged into `feat/vg-folder-images` as 778098c9a.
`baseline-backend.txt` re-recorded there: 97 failures (tsc 3, unit 21, integration 73). The 4 new ones came from the
base branch (digialmChallengeSolver, testAnalyticsPdf, VG Books / Ebooks filters and counts).

**02 done (2026-11-04):** backend f629d3a8c, merged locally into `feat/vg-folder-images`; not pushed, not deployed.
Local end to end on course 103 with a fake bucket and fake AppX fetches: first run 41 topic rows and 41 uploads, second
run 0 changes. Snapshot dry run: 99 section / 2,431 topic / 58 sub-topic. Check on the first real run: `HeadObject` on
the real bucket (a 403 for a missing object would fail every re-host), the bucket env on the box, and AppX's real
content types.

**03 code done (2026-11-04):** 4a694112b + 63cce2907, merged locally into `feat/vg-folder-images`. Full `--commit`,
`--resume <runId>`, progress file in `--out`, undo by `createdAt` window. `--commit` refuses at the start when the bucket
can't be read. The prod steps in task 03 are not started. Incident: the 03 agent's scratch run made up to 42 HeadObject
calls to `hranker-server-v2` with empty keys; by its report all failed and nothing was written. `thumbEnv()` has real
defaults, so never run the real CLI locally.

**04 code done (2026-11-04):** 9b2a1bdad on `feat/vg-folder-images-nightly`, worktree
`~/Projects/worktrees/vg-folder-images-nightly`, cut from `feat/vg-nightly-sync` a0aae70c9, because the nightly doesn't
run from `vidyagram-admin`. Baseline there: 87 failures, no new ones. New collection `apxfolderimagetrees` holds tree
fingerprints. Overlay on test-uday: new files, plus `apxClassThumbnail.ts`, `vidyagramNightlySteps.ts` and
`vidyagramNightlySync.ts` as a 3-way merge or hunks, never whole (the branch's copies carry CMS-tree commits the box
lacks).

**Deploy order:** run the backfill before the nightly goes on. With no fingerprints, its first night covers every course
and writes pictures with no dry-run review. The unique index must exist first, or the step fails every night.
