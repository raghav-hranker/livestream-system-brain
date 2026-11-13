# Remove the retired Extension card, filter and badge from the admin

**Type**: AFK
**Blocked by**: None. **Precondition:** the Vidyagram admin worktree has an uncommitted change to
`components/admin/PlanForm.tsx` that is not from this work. Ask the user whose it is before cutting the integration
worktree; do not carry it in or discard it without an answer.
**Repo**: admin

## What to build

Clear the dead per-plan Extension code out before the new controls go in. Nothing on the backend reads these fields
(ADR 0023).

- `components/admin/PlanForm.tsx`: remove the hidden Extension card, the `extensionEnabled`, `extensionPrice`,
  `extensionValidity` zod fields and their refinements, the Upgrade/Extension mutual exclusion (the Upgrade checkbox
  is never disabled by Extension again), and the fields from the submit payload and defaults.
- `components/admin/PlansDashboard.tsx`: remove the `extensionEnabled` filter. The Flow column stops reading
  `row.extensionEnabled`; the `isExtension` label stays as it is.
- `hooks/api/use-plans.ts`: drop the retired fields from the `Plan` type if nothing else reads them.

## Acceptance criteria

- [ ] The plan form saves an existing plan without sending `extensionEnabled`, `extensionPrice` or
      `extensionValidity`.
- [ ] The Upgrade checkbox is enabled on a plan whose stored `extensionEnabled` is true.
- [ ] The Plans list has no Extension filter until task 05 adds the new one, and the Flow column shows "Regular" for
      a plan with only `extensionEnabled` set.
- [ ] Existing PlanForm and PlansDashboard tests updated, not deleted, where they asserted the old card.
- [ ] `NO NEW FAILURES` against the admin baseline.

## User stories covered

- Groundwork for stories 15, 16, 20
