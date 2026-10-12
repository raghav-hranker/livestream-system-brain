# 09c "Everywhere" also renames place titles that copied the class title

**Type**: AFK
**Blocked by**: 10 (shares `src/services/classNames.ts`)
**Feature**: C

## Why

For classes shown in two places (`apxDisplayPlacements`), many places store a title that is only a copy of
the class title. An "Everywhere" rename leaves those copies on the old title. Students in those courses
keep seeing the old name, even though the dialog says the rename reaches every course.

## What to build

`renameEverywhere` also rewrites, in the same transaction, every place title of the class's placements
whose key (trimmed, case-folded, spaces collapsed) equals the **previous** class title. Place titles
that differ stay as they are, because they are that place's own name. Recompute as usual.

## Acceptance criteria

- [ ] Integration tests on a class shown in two places:
  - One place's title equals the old class title and the other's is "X (Rev)".
  - After an Everywhere rename, the first place shows the new title and the second still shows "X (Rev)",
    in the outline, the course listing and the topic listing.
- [ ] The admin dialog toast for a listing row no longer claims "This place still shows …" when the place
      followed.
- [ ] Suites print NO NEW FAILURES.

## Scope widened (2026-10-12, prod read-only count)

- There are 33,371 placements. 32,337 of them have `apxTitle`, and 30,992 of those are equal by key to
  the class title. Because display reads `title`, then `apxTitle`, then the class title, an "Everywhere"
  rename alone would change almost nothing students see. This is also a pre-existing bug: today a title
  edit in the class form never reaches students in imported courses.
- Place titles: 830 on 415 placements. 791 equal the class title, 39 differ, and none are missing.
- 0 placements store `class` as a string. Only 4 have `CourseClass.title` set. The display change from
  09b affects 0 rows.

So `renameEverywhere` also rewrites every placement `apxTitle` that equals the previous class title by key,
along with the place titles. Differing values stay. It returns counts, and the toast uses them.
