# Connect the other 26 courses

**Type**: HITL
**Blocked by**: 05, 09, 10
**Repo**: Prod, with the user

## What to build

Extend the tool for the 26 courses with no single-course plan: real combos, plans with a stray cheap course, and combos with no course of their own, which get a new course. Bring in AppX's second lengths and review prices where AppX and we differ. The user decides on each group. Default for strays: leave them, shown as attached, because buyers keep them anyway.

## Acceptance criteria

- [ ] The user's decisions per group are recorded here.
- [ ] A dry run lists every course and what would change.
- [ ] No student loses access: a before-and-after check on a sample of buyers passes.
- [ ] Order counts per plan are unchanged, and the change is in `prod-data-changes`.

## User stories covered

- Stories 53, 54, 55
