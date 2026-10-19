# Admin price preview drawer

**Type**: AFK
**Blocked by**: #02 — Builder settings and Builder mode, #04 — Pricing rule and build checkout

## What to build

In Builder mode, a "Preview price" drawer lets the admin tick chapters, switch Notes, Tests and Revision
only, and see the price as the four steps (chapters, cap at max, take off, raise to min), using the
unsaved settings on screen. The price must come from the same rule the checkout uses: either a backend
quote endpoint taking draft settings, or the shared pure function. Pick one and say why.

## Acceptance criteria

- [ ] Drawer numbers equal the backend function's output for the PRD examples.
- [ ] Revision only locks every chapter in the drawer.
- [ ] "At the minimum" message appears when the floor applies.
- [ ] Suites `NO NEW FAILURES`.

## User stories covered

- Story 35
