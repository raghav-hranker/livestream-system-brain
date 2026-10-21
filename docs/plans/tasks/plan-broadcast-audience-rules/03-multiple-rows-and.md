# Multiple rows with AND

**Type**: AFK
**Blocked by**: #02 — Advanced mode, single row, end to end

## What to build

Advanced mode supports **1–5 rows**, each an independently chosen audience plan, combined with **AND**.
This is what makes "active on 2026 **and** never bought 2027" possible.

- **Compiler**: multiple include constraints intersect; exclude contributions union; an include and an
  exclude row together express the upsell.
- **Resolver** takes a set of plan ids and returns states per plan in one pass per plan.
- **Validation**: 1–5 rows, unique plan ids, each plan exists; rejects otherwise with a field-level 400.
- **Admin**: an audience plan picker per row, independent of the promoted plan; add row (max 5), remove
  any row including the pre-filled one, duplicate plans prevented, and Advanced cannot be saved with
  zero rows.

## Acceptance criteria

- [ ] Compiler unit tests: include ∩ include; include + exclude (the 2026→2027 upsell); exclude ∪ exclude; mixed with an all-three no-op row.
- [ ] Validation unit tests: 0 rows, 6 rows, duplicate plan, unknown plan ⇒ rejected.
- [ ] Admin component test: add up to 5, the add control disables at 5, remove any row, a duplicate plan cannot be selected, the empty-list state blocks save.
- [ ] An Advanced notification whose audience plan differs from the promoted plan opens the promoted plan on tap and reaches the audience plan's selection.

## User stories covered

- Story 4: audience plan independent of the promoted plan.
- Story 6: rows combine with AND.
- Story 7: up to five rows.
- Story 8: any row removable.
- Story 11: no duplicate plans.
- Story 12: Advanced requires at least one row.
- Story 31 (rows part): backend rejects invalid rows.
