# Build a course page: the Content step

**Type**: AFK
**Blocked by**: 02
**Repo**: admin

## What to build

The new page with its stepper and the Content step, matching the prototype's Content view
(`prototypes/course-playground/course-builder-playground.html`, behaviour and copy; restyle with the admin's shadcn
components, not the prototype's CSS).

- Route `app/admin/courses/v2/build/page.tsx`; a **Build a course** button on the Courses list toolbar; a sidebar child
  "Build a course" under Learning › Courses (`components/Sidebar.tsx`, inherits the Courses screen permission) and a
  `SidebarSearch` keyword.
- Hooks `hooks/api/use-course-playground.ts` for the task 02 routes; types under `types/`.
- Draft state: one reducer (`lib/course-playground/*.ts`, pure and unit-tested) holding the outline (sections › topics
  › subtopics › items with `kind, id, title, meta, sourceCourseId`, plus each group's `sourceId` and name aliases),
  persisted to `localStorage` under a versioned key (wrapped in try/catch). Actions: add (with "Goes into" target),
  remove item / topic / section, rename (old name kept as alias), reorder within parent, new section, undo (one
  step), reset.
- Left pane: course list (search, category chips from the sources), then the source outline tree with cascading
  tri-state checkboxes, "Added" for items already in the draft (by `kind:id`), search inside the course,
  Expand/Collapse all, Tick whole course; the tray with ticked counts, **Goes into** (same section as in the source /
  a section of the new course / a new section…), the "lands in … joins existing / new" preview and **Add to course**.
- Right pane: the new outline (section cards › topics › subtopic labels › item rows with source chip and remove), the
  source chips with highlight, rename in place, `@dnd-kit` reorder within parent, drag from the tree onto a section or
  the canvas, the empty state with the three steps, **Add a blank section**, Undo toast.
- Stepper in the page header: Content, Price, Details, Review (Price/Details/Review disabled until the outline has
  content; task 06 fills them). Phone width: two tabs.

## Acceptance criteria

- [ ] Unit: reducer — add keeps source names and merges by name and alias; "Goes into" puts topics under the chosen
      section; an item already in the draft is not added twice; rename + later add of the old name lands in the
      renamed section; undo restores the previous outline; reorder stays within the parent.
- [ ] Unit: a draft saved under the key survives a reload; a corrupt or old-version value starts an empty draft.
- [ ] Browser (stubbed routes): open a course, tick a topic, add, see it with its source chip; drag a topic row onto a
      section; rename a section; reload keeps the draft.
- [ ] `NO NEW FAILURES` against the admin baseline.

## User stories covered

- Stories 1 to 13
