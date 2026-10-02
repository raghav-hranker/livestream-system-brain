# Move to… (one row or a ticked set) and Reset

**Type**: AFK
**Blocked by**: #09 (same view files)

## What to build

PRD Round 2 decisions 13, 19 and the "Rules every move follows". Backend + admin.

**Backend: the move endpoint** (`POST /api/admin/courses/:courseId/placements/move`, admin auth, in
`adminCourseClassGroupsController.ts` / `adminCoursePickerRoutes.ts`).
- Build it complete, including the `order` branch (task 11 is its first caller) and both row kinds
  (an ordinary placement and one place of a class in two places).
- One transaction: validate, rewrite taxonomy, then priorities; nothing is written on any refusal.
- Ordinary row: same writes as the taxonomy PATCH today, except that a target equal to the Class's own
  taxonomy unsets the override (follow the class).
- A place (`listingId`): positional update of that `apxDisplayPlacements` entry, name labels unset,
  ids checked by hand with `taxonomyChainError`.
- Without `order`, rows land last (course max + 1 upward, in the order sent). Use the controller's
  max for the course (`courseListingPriorities` + `courseMaxPriority`): it counts every place and
  every placement not removed (`isActive: true`), switched-off rows included, which is what the
  outline shows. `courseClassPriority.ts:22` also counts removed placements. Say in a comment which
  helper you used.
- 409 `CLASS_ALREADY_IN_TOPIC` when a CourseClass would have two rows in one topic, any subtopic.
- Append destination topics new to the course to the course topic order, computed from the
  destination only (the per-placement helper mishandles sibling places).
- The taxonomy PATCH keeps `{ followClass: true }` for Reset. Its 409 for placements with places
  stays.

**Admin**
- Row ⋯ → **Move to…**, for every class row (a place of a class in two places included). It replaces
  the row "Change topic" link and `PlacementTaxonomyDialog`'s radio choice.
- The dialog: Section / Topic / Subtopic selects, prefilled with the row's current place. Text: "Only
  this course changes. Other courses keep their own place." and "It goes last in ‹path›. Drag to
  reorder afterwards." Amber note for a topic new to the course; green note when an ordinary row lands
  back on its class's topic; the 409 shown inline, Move disabled; "Already here." when nothing would
  change.
- The ticked-rows bar gets **Move to…** (same dialog, "Move 3 classes"), and Bulk edit's line from task
  09 links to it.
- **Reset to the class's topic** in the row ⋯ menu, only for an ordinary row with `taxonomyState`
  `custom`; sub-line "Back to ‹class path›". Calls the PATCH with `followClass`.
- An ordinary row whose placement differs from its class shows a small "Moved here in this course" tag
  (tooltip: where the class itself is filed).

## Acceptance criteria

- [ ] Move to… moves one row or a ticked set to any topic/subtopic of the course, landing last.
- [ ] A place of a class in two places moves alone; its sibling stays.
- [ ] Moving into a topic the class is already in is refused with the title; nothing changes.
- [ ] Landing an ordinary row on its class's own topic leaves it following the class
      (`taxonomyState: class-default`).
- [ ] A topic new to the course appears as a new tab, at the end.
- [ ] Reset shows only on moved ordinary rows and puts them back.
- [ ] Tests: backend integration for both row kinds, follow-class, last-landing order, the 409, the
      400s, new-topic append, the transaction (a refused row leaves every other row untouched). Admin:
      dialog notes and disabled states, the bulk entry point, Reset visibility.
- [ ] Baselines stay green.

## User stories covered

- 27, 31, 32, 37
