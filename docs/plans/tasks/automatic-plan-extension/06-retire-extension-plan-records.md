# Retire the older "extension plan" record mechanism

**Type**: HITL
**Blocked by**: 04 — Deploy dark, accept on prod, switch on

## What to build

The older mechanism — separate plan records with `isExtension: true` + `extensionBasePlanId`,
filtered per user in listings and validated at checkout — is superseded by ADR 0023 (glossary:
_Avoid_ "extension plan"). Before deleting it, find out whether it is live: count prod plans with
`isExtension: true`, their status, and any successful orders on them in the last year.
Human in the loop: the count decides the path.

- **None live** ⇒ delete the per-user extension-plan filtering, the checkout validation and the
  `isExtension` listing exclusions; keep the fields in the schema; admin keeps hiding them.
- **Some live** ⇒ stop, record the plans and order counts here, and decide with the user how their
  buyers move onto the automatic rule before anything is removed.

## Acceptance criteria

- [ ] Read-only prod counts recorded here (plans by status, orders by status, date of latest sale).
- [ ] User decision recorded.
- [ ] If deleting: no code path reads `isExtension` / `extensionBasePlanId`; listing and checkout
      integration suites pass; no new failures versus the clean tip.

## User stories covered

- None directly (follow-up; out of scope in the PRD)
