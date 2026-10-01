# Copy scopes: whole course, section, selection

**Type**: AFK
**Blocked by**: #07 — Copy a topic to another course, end to end

## What to build

Widen Copy to the PRD's other three scopes, reusing task 07's plan core, endpoint and dialog.

- Endpoint accepts `{ kind: 'course' }`, `{ kind: 'section', sectionId }` and
  `{ kind: 'placements', placementIds }`. Each resolves to source placements in outline order and goes
  through the same plan.
- Entry points:
  - toolbar ⋯ → "Copy to another course…";
  - section ⋯ → "Copy this section to another course…";
  - selection bar → "Copy to another course" for the ticked classes.
- `placementIds` that do not belong to the source course → 400.
- The preview table groups the result per Section › Topic for every scope.

## Acceptance criteria

- [ ] A whole-course copy reproduces the source arrangement in the target. New sections and topics land
      at the end of the target's outline, in source order.
- [ ] A section copy covers exactly that section's topics.
- [ ] A selection copy covers exactly the ticked placements, keeping their outline order.
- [ ] Foreign `placementIds` → 400, and nothing is written.
- [ ] Unit tests cover each scope kind. A component test covers the selection-bar button opening the
      dialog with the ticked count.

## User stories covered

- 40, 41 (section), 42
