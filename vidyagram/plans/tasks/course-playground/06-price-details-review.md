# Price, Details, Review and Create

**Type**: AFK
**Blocked by**: 03, 04, 05
**Repo**: admin

## What to build

The other three steps and Create, matching the prototype's Price, Details and Review views.

- **Price**: Maximum selling price, Minimum selling price, MRP (optional); the chapters table (one row per topic,
  grouped by section; classes count; weight %; custom ₹; resulting price or "not sold"), the 100% meter, **Split by
  class count** (default seed when no weight is set) and **Split evenly**, both in 0.5% steps summing to exactly 100;
  extras Notes, Tests, Revision each with **Show in the app**, price, "Ticked when a student opens the builder"; the
  side student preview using `lib/course-builder.ts` (task 04).
- **Details**: title (kept in sync with the header name field), short description, main category + category (the
  existing course form's pickers; pre-filled once from the source courses' most common), Live / Recorded (pre-filled),
  faculty from the real faculty list in order (pre-filled from source courses' faculties), validity in the existing
  course form's format, app banner (file kept in memory and IndexedDB-free: re-pick after a reload is acceptable; say
  so under the field), More settings (show in New, close admission, tags, priority) — whichever of these the existing
  Course model has.
- **Review**: the checklist (blocks: no content, no title, no category, no validity, max/min missing, min > max,
  weights ≠ 100%, a class with no topic; warnings: no banner, no faculty, chapters with no weight, a shown extra with
  no price), each with Fix → the step; summaries with Edit links; **Keep it off sale** (default) / **Put it on sale
  now**; **Create course** disabled while anything blocks.
- **Create**: build the task 03 body from the draft (taxonomy `sourceId` only for groups not renamed or moved;
  chapters by position), POST (multipart when a banner is set), show the server's 400 message on the step it names,
  on success clear the draft, toast, and route to the new course's outline (`/admin/courses/v2/assign-classes?…` as
  the Courses list links it).

## Acceptance criteria

- [ ] Unit: split by class count and evenly produce 0.5% steps summing to 100 for 1, 3, 7 and 41 chapters.
- [ ] Unit: the request builder — renamed section sends no `sourceId`; chapter indexes match the outline; status 0
      when off sale.
- [ ] Unit: the checklist blocks and warns on each case above.
- [ ] Browser (stubbed routes): fill price, see the preview change when unticking a chapter and an extra; hide Notes
      and see it leave the preview; Review blocks until weights are 100%; Create posts the expected body and routes on
      success; a 400 shows on the right step.
- [ ] `NO NEW FAILURES` against the admin baseline.

## User stories covered

- Stories 14 to 20
