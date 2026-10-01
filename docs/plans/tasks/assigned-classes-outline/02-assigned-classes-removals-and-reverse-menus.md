# Assigned Classes removals; Reverse moves into ⋯ menus

**Type**: AFK
**Blocked by**: #01 — Outline read, end to end

## What to build

The row becomes: checkbox, Sequence, title, teacher, ▲▼, Change topic, Start date, Status, Is Free.
The rare, hard-to-undo reverse actions move out of sight into ⋯ menus.

- Remove the placement Priority box, the listing Priority box and the End column from the Assigned
  Classes tab.
- Bulk Edit (`BulkEditSheet`) keeps Status, Start date and Is Free, and drops End date and priority.
  Admin screens stop sending `priority` and `endDate`; the backend keeps accepting both (PRD Backend 5).
- **Reverse priority** moves from the topic header button into the topic ⋯ menu.
  - In the outline model, a topic reverse produces a `topic-order` payload.
  - For a topic with subtopics, it reverses both the subtopic order and the classes inside each, so the
    result mirrors what the admin sees.
- **"Reverse priority in every topic"** goes in a new toolbar ⋯ menu. It reverses each topic through
  `topic-order`; section and topic order are not changed.
- Existing placement end dates stay as they are in the data.

## Acceptance criteria

- [ ] The tab shows no Priority input, no listing Priority input and no End column. Start date, Status
      and Is Free edit as before.
- [ ] Bulk Edit has no End date or priority field, and its request carries neither.
- [ ] Topic ⋯ → Reverse priority on a topic with subtopics reverses the subtopic order and the classes
      inside each. Sequence is renumbered, and no other topic's Priority numbers change.
- [ ] Toolbar ⋯ → "Reverse priority in every topic" reverses every topic and leaves section and topic
      order unchanged.
- [ ] Admin `node --test`: reverse mirrors subtopics and classes. Component test: Priority and End are
      absent, and the ⋯ reverse items send the expected requests.
- [ ] The baselines in the README stay green.

## User stories covered

- 26–28, 32–35, 39
