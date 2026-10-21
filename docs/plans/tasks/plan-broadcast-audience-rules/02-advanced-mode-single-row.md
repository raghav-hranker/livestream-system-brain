# Advanced mode, single row, end to end

**Type**: AFK
**Blocked by**: #01 — Audience field + Default mode round-trip

## What to build

An admin can switch a Subscription Plan Broadcast to **Advanced**, sees one row pre-filled with the
promoted plan and **Expired + Never bought** ticked, can change the three checkboxes, sees a live exact
count, and sends — and exactly the matching users receive it.

- **Plan state resolver** (PRD module 1), first form: for one plan id (no extension folding yet — task
  04), load successful, non-voided orders and classify each user `active | expired` using the existing
  plan-extension order predicates; absent users are `never`. The per-user classification is a pure
  function over order rows.
- **Audience rule compiler** (PRD module 2) for a single row: S without `never` ⇒ include set of holders
  in S; S with `never` ⇒ exclude holders not in S; all three ⇒ nothing.
- **Validation** accepts `advanced` with exactly one row (multi-row limits come in 03).
- **Audience estimate** returns an **exact** count (`isApproximate: false`) of users with a valid push
  token matching the audience, for both Default and Advanced plan broadcasts.
- **Admin**: Default/Advanced toggle (plan broadcast only), the audience rows editor component (PRD
  module 5) with a single row, and the live count wired to the estimate.

## Acceptance criteria

- [ ] Compiler unit tests cover every row of the PRD's "reading a row" table for a single row.
- [ ] Resolver unit tests: one active order ⇒ active; one expired order ⇒ expired; no orders ⇒ never (fixed `now`, stubbed orders).
- [ ] Estimate for an Advanced single-row audience equals the number of token users the send path targets (verified by a unit test over the shared target-rules output).
- [ ] Admin: switching to Advanced pre-fills the promoted plan with Expired + Never bought; the count updates on checkbox change; component test covers the pre-fill and checkbox state.
- [ ] Sending an Advanced single-row notification delivers only to matching users; excluded users do not see it in-app.

## User stories covered

- Story 2: switch to Advanced.
- Story 3: pre-filled, behaviour-neutral promoted-plan row.
- Story 5: Active / Expired / Never bought checkboxes.
- Story 19: live exact count.
- Story 30: excluded users don't see it in-app either.
