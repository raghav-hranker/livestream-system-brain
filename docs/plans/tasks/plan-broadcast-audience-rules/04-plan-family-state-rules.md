# Plan family + state rules

**Type**: AFK
**Blocked by**: #02 — Advanced mode, single row, end to end

## What to build

The resolver gets the full state semantics from the PRD (module 1) and the picker shows the right plans.

- **Extension family**: a base plan expands to itself plus every plan whose extension base is that
  plan; a user's state is computed across the family.
- **Best state wins** across a user's orders: any active ⇒ active; else any expired ⇒ expired; else never.
- Voided, failed and pending orders count as **never**; free and admin-assigned orders **count**.
- A missing expire date is resolved via days-left (the plan-extension predicate), keeping one definition
  of "active" shared with plan extension and the Default exclusion.
- Plan ids are matched in both string and ObjectId forms.
- **Validation** rejects an extension plan as an audience row; inactive base plans are accepted.
- **Picker**: the audience plan list returns base plans only, **including inactive** ones, flagged so
  the admin shows an "Off-sale" badge. The promoted-plan picker is unchanged.

## Acceptance criteria

- [ ] Resolver unit tests: expired base + active extension ⇒ active on base; expired + active on the same plan ⇒ active; voided / failed / pending only ⇒ never; free / admin-assigned ⇒ counts; no expire date with days-left > 0 ⇒ active, ≤ 0 ⇒ expired; string and ObjectId plan-id forms both match.
- [ ] Validation: extension plan ⇒ rejected; inactive base plan ⇒ accepted.
- [ ] The audience picker lists no extension plans and shows inactive base plans with an "Off-sale" badge (component test).

## User stories covered

- Story 13: off-sale plans selectable, badged.
- Story 14: base plans only.
- Story 15: extension holders count as base holders.
- Story 16: active beats expired.
- Story 17: voided / failed / pending ⇒ never bought.
- Story 18: free and admin-granted count.
