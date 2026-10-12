# 10 Admin search finds every name

**Type**: AFK
**Blocked by**: 09
**Feature**: C

## What to build

PRD "Module 4. Search wiring".

- **Search fields.** The shared title search helper searches `searchNames` on the admin class searches:
  the Classes page list (which the PDF class pickers also use) and Add existing classes (class library).
  The cached vocabulary for close spellings includes `searchNames` words.
- **matchedName.** Each result carries `matchedName { name, source: 'oldTitle' | 'course', courseTitle? }`
  when the best match was not the class title.
- **Admin display.** The admin shows the class title first and a "Matched …" tag (board E) on both
  screens. The outline's client-side search matches the class title as well as the shown name.
- **Recompute hooks.** Every title writer listed in the PRD calls recompute:
  - create and bulk create
  - in-place create
  - Copy to another course
  - placement assign and remove
  - duplicate, if feature B has merged to origin by then (otherwise note it for 13)
- **Script.** Add a recompute script for all classes. It is a dry run by default and writes with
  `--commit`. Report counts. It must be idempotent.

## Acceptance criteria

- [ ] Integration tests:
  - Searching a per-course name or an old title on the Classes list returns the class with the right
    `matchedName`.
  - A title match has no `matchedName`.
  - A close spelling of a course name matches.
- [ ] Running the script twice changes nothing the second time (test on the harness).
- [ ] A new duplicate starts with no old titles.
- [ ] Outline search finds a renamed row by its class title.
- [ ] Suites print NO NEW FAILURES.

## User stories covered

42–46, 54, 55, 60
