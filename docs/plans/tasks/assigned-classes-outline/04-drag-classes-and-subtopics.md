# Drag classes and subtopics within their group

**Type**: AFK
**Blocked by**: #01 — Outline read, end to end

## What to build

Ordering by dragging, at the two levels the existing `PUT …/topic-order` endpoint already serves (PRD
Backend 3, Admin 6–7). There is no backend change.

- Add `@dnd-kit` to the admin, with one sortable context per container and a handle per level. A row
  handle never drags its subtopic, and a subtopic handle never drags its topic.
- **Class drag.** A class moves within its subtopic, or within its topic when the topic has no
  subtopics. A drop into another subtopic or topic is refused; re-filing stays with Change topic.
- **Subtopic drag.** A subtopic moves within its topic, as one block of its classes.
- Both drags go through outline-model move functions that return a full `topic-order` payload for that
  one topic. ▲▼ call the same functions, so the keyboard path and the drag path cannot diverge.
- Drag handles are disabled while a search is active, with a note saying so.
- A 409 from `topic-order` shows "This course changed since it was loaded. Refresh and try again."
- Classes listed under several topics stay draggable within each topic (per listing).
- Accepted side effect: the 8 interleaved topics become contiguous by subtopic the first time anyone
  reorders them.

## Acceptance criteria

- [ ] Dragging a class within its subtopic saves, and only that topic's Priority numbers change.
      Sequence renumbers across the topic.
- [ ] Dragging a class onto another subtopic or topic does nothing and sends no request.
- [ ] Dragging a subtopic within its topic moves its classes as a block. On the website, the subtopic
      chips follow the new order with no website change.
- [ ] ▲▼ produce the same payloads as the equivalent drag.
- [ ] While searching, the drag handles are disabled and the note is visible.
- [ ] A stale save (409) shows the refresh message and leaves the view unchanged.
- [ ] Admin `node --test` covers each move kind's payload, cross-group refusal and interleaved-topic
      grouping. Component tests cover ▲▼ requests and the handles disabled during search. Gestures are
      not simulated in jsdom.
- [ ] The baselines in the README stay green.

## User stories covered

- 16–20, 23–25, 31, 57 (topic level)
