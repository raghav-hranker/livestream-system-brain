# Backfill all courses on prod

**Type**: HITL (prod writes need the user's OK at each step)
**Blocked by**: 02, Write pictures for one course
**Repo**: backend (deploy) + prod data

## What to build

Run the backfill over every Vidyagram course on prod and leave a record of what it did.

- **Resumable full run.** `--commit` without `COURSE` walks every AppX course with a Vidyagram course. It commits
  course by course, so a crash costs at most the course in flight. `--resume` skips courses already done in the
  same run id. It saves the report under `vidyagram/reports/` and the raw JSON under `outputs/`.
- **Deploy.** Merge 01 and 02 into `vidyagram-admin` and deploy the backend dist to the Vidyagram box
  (pm2 92, webserver2-2), the usual surgical way. The commands are offline scripts, so nothing in the API changes.
- **Prod steps.** Do them in this order, and stop for the user's OK before each step that writes.
  1. Run the index script as a dry run, then with `--commit` on `vidyagramdb`.
  2. Run the full dry run and share its report.
  3. Commit `COURSE=103` alone and spot-check it.
  4. Run the full commit.
  5. Record the run in the `prod-data-changes` ledger, with a restore command: delete
     `source: appx` rows by run id or `createdAt` window.

## Acceptance criteria

- [ ] The unique index exists on prod `course_outline_images`.
- [ ] The full dry-run report is shared before any write, and the user approves the commit.
- [ ] After the commit, about 2,600 `source: appx` rows exist; the exact count matches the dry run minus re-host
      failures. Every `image` URL returns 200 from the CDN in a sample of 20.
- [ ] Course 103's 41 class topics each have a row whose CDN image matches the AppX picture by eye (BATCH PLANNER is
      PDF-only and gets none).
- [ ] A second full commit reports 0 changes.
- [ ] `prod-data-changes` ledger and the memory note `vidyagram-folder-banners` updated.

## User stories covered

- Story 23: the dry run is checked before anything is written.
- Story 25: the run resumes safely after a crash.
- Story 26: there's a record of every row and how to undo it.
- Story 32: the client's folder pictures carry over.
