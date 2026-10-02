# Drag across groups, and drag several classes at once

**Type**: AFK
**Blocked by**: #10 (the move endpoint)

## What to build

PRD Round 2 decisions 20 and 21. Admin, plus tests against task 10's endpoint with `order`.

- **Cross-group drop.** `OutlineSortable.tsx` collision detection matches any class group, not just
  the dragged row's own. `classDropMove` (`lib/course-outline.ts:283-299`) stops returning null for
  another subtopic or topic: it returns the target group, the insertion index and the destination
  topic's full new order.
  - Same group → `topic-order`, as today.
  - Another group → task 10's endpoint with `rows`, `target` and `order`, so the class lands at the
    drop line.
  - A leaf group header (a subtopic, or a topic with no subtopics) accepts a drop at the top of its
    group.
- **Refused drops** show before the drop: the line turns red with the reason over the "No topic"
  section and over any topic the dragged class (or one of the ticked classes) is already in. Letting go
  there does nothing. The server 409 is still handled (toast, refetch) in case the outline was stale.
- **Multi-drag.** Dragging a ticked row drags every ticked row, in outline order, gathered at the drop
  point, from any number of groups. A drop inside one group is still one `topic-order` write if every
  ticked row is in that group; otherwise it is one move call. The `DragOverlay` shows a stacked card:
  "3 classes", the first title, "+2 more". The ticked set clears after a cross-group move.
- After any move: refetch the outline. A topic left empty disappears; no confirm, no Undo.

## Acceptance criteria

- [ ] A row dragged into another subtopic or topic lands exactly at the drop line, and stays there on
      reload.
- [ ] Ticked rows from different groups move together, in outline order.
- [ ] No topic and duplicate-topic drops are refused before the drop, and nothing is sent.
- [ ] Keyboard and touch drag still work (task 09).
- [ ] Tests: pure tests for the new `classDropMove` (cross-group index, multi-row gather, refusals);
      a component test that a cross-group drop calls the move endpoint with `order`.
- [ ] Baselines stay green.

## User stories covered

- 28, 29, 30
