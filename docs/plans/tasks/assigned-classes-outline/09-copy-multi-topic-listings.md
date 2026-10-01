# Copy brings multi-topic listings along

**Type**: AFK
**Blocked by**: #07 — Copy a topic to another course, end to end

## What to build

PRD Backend 4: listings, and PRD story 55. 415 placements across 18 courses carry listings, meaning the
same class appears under several topics.

- If any listing of a placement falls in the scope, the whole placement comes across with **all** its
  listings.
- Each copied listing lands after the target's own listings in its topic, with Priority above that
  topic's maximum.
- Topics the listings bring in that are new to the target are appended to its course topic order.
- The plan and preview flag every topic where multi-topic listings come along ("includes N classes also
  listed under other topics").
- A class already active in the target is skipped whole, listings included: the target's arrangement is
  never overwritten.

## Acceptance criteria

- [ ] Copying one topic that holds a multi-listed class copies that class with all its listings, and
      each listed topic shows it in the target.
- [ ] The preview names the extra topics the listings bring and counts them.
- [ ] A multi-listed class already in the target is skipped, and its target listings are unchanged.
- [ ] A unit test pulls multi-listing placements in whole. An integration test copies one on the
      in-memory DB.

## User stories covered

- 55
