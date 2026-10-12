# 09b Rename a class shown in two places renames only the clicked place

**Type**: AFK
**Blocked by**: 09
**Feature**: C

## Why

Task 09 made a per-course rename write the new name onto every place of a placement that is shown in two
places (`apxDisplayPlacements`). Clearing removed every place's title. Those place titles can differ on
purpose, for example "X (NS)" and "X (Rev)". A rename from one row would overwrite both, and a clear
would delete names students see. Earlier decisions for these classes say each place moves alone and
Remove acts on that place only. Rename should follow the same rule.

## What to build

- **Rename in course with a place.** "Rename in course" takes an optional place (the listing the row
  represents).
  - With a place, it writes only that place's title.
  - With a place and `null`, it removes only that place's title, so the row falls back to the course's
    name, then the imported name, then the class title.
  - Without a place it behaves as today for ordinary rows, writing `CourseClass.title`. For a placement
    with places, a call without a place must not touch the place titles.
- **Admin.** The outline row passes its place id when the row is a listing row. The Rename dialog for a
  listing row says "Only in this place in this course".
- **Recompute.** Recompute keeps counting every place title as a shown name. 09 already does this.

## Acceptance criteria

- [ ] Integration tests:
  - Renaming one place leaves the other place's title untouched in the outline, the course listing and
    the topic listing.
  - Clearing one place removes only that title.
  - An ordinary row's rename is unchanged.
- [ ] Suites print NO NEW FAILURES.
