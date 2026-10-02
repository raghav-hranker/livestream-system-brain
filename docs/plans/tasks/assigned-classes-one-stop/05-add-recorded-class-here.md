# Add recorded class here

**Type**: AFK
**Blocked by**: None — can start immediately

## What to build

PRD decisions 2 and 10. Section, topic and subtopic ⋯ menus get **Add recorded class here**.

- **Backend:** add `POST /api/admin/courses/:courseId/classes/in-place` (PRD decision 2).
  - Creating the Class and its placement happens in one transaction. Go through the model's save and
    hooks so the normal create behaviour is kept, not through a raw insert.
  - `mainCategory`/`category` come from the course. The taxonomy comes from the body and is checked:
    the topic must be under the section, and the subtopic under the topic.
  - The class-create defaults apply, start = now, and the class is **active**.
  - The placement lands last in its group: listing-aware max + 1, then the topic-order append
    (`appendNewPlacementTopicsToCourseTopicOrder` / `courseMaxListingPriority` from outline task 06).
  - Errors: 409 `{ field:'title' }` on a duplicate title; 404 for an unknown course; 400 for a
    taxonomy mismatch.
- **Admin:** `AddClassInPlaceDialog`.
  - It opens from the section ⋯, the topic ⋯ and the subtopic ⋯, and asks only for the part of the
    place the header does not give:
    - subtopic ⋯: nothing to choose;
    - topic ⋯: a **required** Subtopic select with a "No subtopic" option and no default. A topic
      with no subtopics fills in "No subtopic";
    - section ⋯: a required Topic select, then the Subtopic select.
  - Title and teacher fill in once the place is chosen. Create is refused inline ("Choose a
    subtopic." / "Choose a topic.") until it is.
  - A link, "Open the full class form instead", goes to the normal class create.
  - Fields: Title, with the next-number suggestion, and Teacher, with the prefill (PRD decision 10).
    Both are pure functions in `lib/`.
  - A duplicate title shows the error inline.
  - On success, refetch the outline and open `SingleVideoUploadDialog` for the new class.

## Acceptance criteria

- [ ] A new class appears last in the place chosen: the subtopic header's subtopic, or the subtopic
      (or "No subtopic") picked from a topic or section header.
- [ ] From a topic or section header, Create does nothing until the place is chosen, and says so inline.
- [ ] The class has the course's main category and category, active status, and start ≈ now.
- [ ] The title suggestion turns "Simplification Part-6" into "Simplification Part-7" and "Day 06"
      into "Day 07", and leaves a title with no trailing number empty.
- [ ] The teacher prefill takes the last class in the subtopic, then the topic, then the course faculty.
- [ ] A duplicate title gives a 409 shown inline, and nothing is created.
- [ ] Backend integration tests: derivations, landing last (listing-aware), topic-order append
      when the course has a stored order, 409, 400 mismatch, and an atomic rollback when the placement
      fails. Admin: pure tests for the suggestion and prefill, and a component test that the dialog
      sends the derived body and opens the upload dialog.
- [ ] Baselines stay green.

## User stories covered

- 10, 11, 12, 13, 14, 15, 16, 18, 20
