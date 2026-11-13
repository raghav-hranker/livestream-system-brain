# Nightly step

**Type**: AFK for the code, HITL for the deploy
**Blocked by**: 02, Write pictures for one course
**Repo**: backend (nightly sync code) + the test-uday nightly checkout

## What to build

The nightly AppX sync keeps folder pictures current until cutover. It runs on GCP test-uday at 02:30 IST from the
isolated checkout named in `reference/hosts.md`.

- **When it runs.** After the nightly placement step, which already files new classes into courses and appends new
  topics to `coursetopics` order. It covers courses whose tree pages changed in this run, plus courses that got new
  placements.
- **What it does.** It runs the task 01 matcher on each of those courses, re-hosts pictures with task 02, and calls
  `setFromAppx`.
  - A new folder or a new outline row gets its picture.
  - A changed AppX URL replaces an `appx` row's picture under a new CDN key.
  - A folder that's gone, or no longer maps cleanly, clears an `appx` row's `image`. The row stays, with a reason in
    the report.
  - `admin` rows are never touched.
- **Off switch.** Env `APX_FOLDER_IMAGES_NIGHTLY`: `off` skips the step and logs that it was skipped. It's on by
  default once deployed.
- **Report.** The night's report gets a folder-images section: set, replaced, cleared, skipped (with reason) and
  re-host failures.
- **Deploy (HITL).** Use the same overlay method as the placement step
  (`reference/scripts/vidyagram-nightly-deploy-placement.sh` pattern). Back up first, refuse while the nightly is
  running, bump REVISION. Wait for the user's OK before deploying.

## Acceptance criteria

- [ ] Integration tests cover:
  - a re-run with no AppX change is a no-op;
  - an `admin` image and an `admin` removal survive the step;
  - a changed AppX URL replaces the `appx` picture;
  - a vanished folder clears it;
  - the off switch skips the step.
- [ ] A course that gains a brand-new topic folder overnight gets its topic row and picture in the same run.
- [ ] The step adds under a minute to a typical night (measure on a dry run against prod data).
- [ ] Deployed to test-uday after the user's OK. The next night's report shows the folder-images section, with no
      failures beyond re-host misses.
- [ ] Backend suite: `NO NEW FAILURES`.

## User stories covered

- Story 7: a folder added in AppX tonight has its picture tomorrow.
- Story 8: a picture changed in AppX changes here after the nightly run.
- Story 17: an admin's choice is never overwritten.
- Story 29: only courses that changed are touched.
- Story 30: an off switch, no deploy needed.
