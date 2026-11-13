# Tool to connect old courses, dry run only

**Type**: AFK
**Blocked by**: 03
**Repo**: Backend + `reference/scripts`

## What to build

A script that connects an existing single-course plan to its course without creating plans, so orders stay on the same plan. Dry run by default, with `--commit` to write. It builds `selling` from the plan, reports the 46 courses, lists the 10 price conflicts for approval, and reports the 26 courses it won't touch. It refuses any database but vidyagramdb and is safe to rerun.

## Acceptance criteria

- [ ] A dry run writes nothing and prints each course with its plan, price, length and any conflict.
- [ ] Against a local copy of real shapes, `--commit` links each plan, creates none, and rerunning changes nothing.
- [ ] A price conflict is not written until an approved choice is given.
- [ ] Courses with no single-course plan are reported and left alone.
- [ ] The script is listed in `reference/scripts/README.md`.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 53, 54
