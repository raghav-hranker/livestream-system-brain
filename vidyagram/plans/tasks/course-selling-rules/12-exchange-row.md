# Exchange row

**Type**: AFK
**Blocked by**: 03
**Repo**: Backend + admin

## What to build

The Allow Exchange row lists destination courses and writes `exchangeToPlanIds` on this course's main plans, pointing at each destination's first main plan. The live swap, its rules and its limits don't change. The row can't be turned on for a combo, and says why.

## Acceptance criteria

- [ ] A destination saved here appears in the existing exchange options for an eligible owner.
- [ ] A live swap works unchanged, keeping the end date.
- [ ] A combo's row can't be turned on.
- [ ] A destination with no connected plan can't be picked.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 45, 46, 47
