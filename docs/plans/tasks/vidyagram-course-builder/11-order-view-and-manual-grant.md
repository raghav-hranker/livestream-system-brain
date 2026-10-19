# Build on the order page and manual grant

**Type**: AFK
**Blocked by**: #04 — Pricing rule and build checkout

## What to build

Support can see and fix builds. The admin order view shows a build's chapters, Notes / Tests /
Revision only, and the price breakdown from the snapshot. Invoice and My Purchases list the chapters and
options. An admin can grant a build to a user without payment (zero-amount order with the snapshot,
marked as given for free), using the existing admin auth.

## Acceptance criteria

- [ ] Order view renders a build order from its snapshot, not from current settings.
- [ ] Manual grant gives the same access as a paid build; non-admins are rejected.
- [ ] Suites `NO NEW FAILURES`.

## User stories covered

- Story 23, 36, 37
