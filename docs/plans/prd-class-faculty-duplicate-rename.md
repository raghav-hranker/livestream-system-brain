# PRD: Change faculty, duplicate with courses, rename with aliases (Assign Classes)

State: ready-for-agent
Date: 2026-10-12
Owning repos: `quicktricks-backend` + `quicktricks-admin` (the client forks, line `quicktricks-admin`).
Branch: cut `feat/class-faculty-duplicate-rename` from `origin/quicktricks-admin` in both forks. The forks
never follow the slice branch (see `BRANCHES.md`).
Builds on: [`prd-assigned-classes-one-stop.md`](./prd-assigned-classes-one-stop.md) (the deployed
"Courses – New" Assign Classes outline). It crosses no `SYSTEM.md` contract. It is admin UI plus admin
endpoints, and one student read (live classes by course) switches to the course's name.
Mockups: faculty https://claude.ai/artifact/XBQiVGYJfDWf8LTBgxRrQY (boards A, B); duplicate, rename and
aliases https://claude.ai/artifact/TEEAjaAEeWm8KfgmeBS26i (boards C to F, F1 chosen).
Grilled: 2026-10-12, questions Q1 to Q22 in that session.

## Problem Statement

Admins arrange courses on the Assign Classes screen (`/admin/courses/v2/assign-classes`). Three common
jobs still force them off it or into slow, risky steps.

**Wrong faculty.** A class shows the wrong teacher, often because an import filed it under the default
"Sahil Sir". The screen has no way to change it. The admin opens the Classes page, finds each class and
edits its form one class at a time.

**Next day's class.** A teacher's classes run in series. Maths 1 is assigned to 3 courses, and the next
day the admin needs Maths 2 in the same 3 courses, in the same place. Today they duplicate Maths 1 on the
Classes page, rename it, and then assign it to each course again by hand, re-filing it under the right
topic every time. The copy belongs to no course until they do.

**Names.** A class can show a different title in one course, but nothing in the admin can set that
name. When a course does show its own name, admin search boxes look only at the class title. An admin
who searches the name they saw in a course finds nothing, and the class looks lost. The same thing
happens after a class is renamed, to anyone who still remembers the old title.

## Solution

**Change faculty.** The row ⋯ menu gets "Change faculty…". It opens a dialog with the active faculty
list, the current faculty, and the courses the change reaches. Bulk edit gets a Faculty field in its own
group, "In every course these classes are in", kept apart from the per-course start time and Free
fields. Faculty is a fact about the class, so a change shows in every course it sits in. When a class has
not gone live yet, the dialog warns that Go live will use the new faculty's stream link.

**Duplicate with its courses.** "Duplicate…" opens the class form filled in from the original, plus an
"Also put it in these courses" list. Every course the original sits in is ticked and shows the place
(Section › Topic) with the original's Free and On/Off. The admin can untick courses and add others. The
copy lands right after the original in each ticked course. In the usual case the original is the last
class, so that is the end of the subtopic. The title prefills the next number ("Class-01" becomes
"Class-02"), or "(Copy)" when the title does not end in a number. The same dialog serves the Classes
page and the Assign Classes row ⋯.

**Rename and aliases.** "Rename…" in the row ⋯ offers "Only in this course" (the default) or
"Everywhere". The admin row shows the course's name with "Class title: …" under it whenever the two
differ. Every admin search box finds a class by its title, by any name a course shows, and by its old
titles. A result that matched through another name says which name matched and where it comes from. The
class form lists these names as "Also known as" chips. An old title can be crossed out. A name that some
course still shows cannot be crossed out, so a visible name never becomes unsearchable. Students see
only the course's name, as today.

## User Stories

**Change faculty**

1. As an admin on Assign Classes, I want "Change faculty…" in a class row's ⋯ menu, so that I can fix a
   teacher without leaving the course.
2. As an admin, I want to pick from the active faculty list, so that I cannot misspell a faculty name.
3. As an admin, I want to search the faculty list by name, so that I can find a faculty quickly.
4. As an admin, I want the dialog to show the current faculty, so that I know what I am replacing.
5. As an admin, I want the dialog to list every course the class is in, so that I know a change applies
   to all of them.
6. As an admin, I want a warning when the class has not gone live yet, so that I know Go live will use
   the new faculty's stream link.
7. As an admin, I want the row to show the new faculty right after I save, so that I can see it worked.
8. As an admin, I want a confirmation naming the new faculty and how many courses changed, so that I
   know the reach of what I did.
9. As an admin, I want a Faculty field in Bulk edit for ticked classes, so that I can fix a whole topic in
   one step.
10. As an admin, I want the Faculty field set apart as "In every course these classes are in", so that I
    do not mistake it for a per-course setting like Free.
11. As an admin, I want Bulk edit to tell me how many classes and courses the change reaches, so that I
    can judge its size before I apply it.
12. As an admin, I want classes that already have the chosen faculty skipped, so that nothing changes
    for them.
13. As an admin, I want Bulk edit to warn how many ticked classes have not gone live yet, so that I know
    their stream link changes.
14. As an admin, I want a faculty change made here to show on the Classes page and in the class form, so
    that there is one faculty per class everywhere.
15. As a student, I want to see the correct teacher on class cards in every course, so that I know who
    teaches the class.

**Duplicate with its courses**

16. As an admin, I want "Duplicate…" in a class row's ⋯ menu on Assign Classes, so that I can make the
    next class without leaving the course.
17. As an admin on the Classes page, I want Duplicate to offer the same course list, so that both entry
    points behave the same.
18. As an admin, I want the duplicate form filled in from the original, so that I change only what
    differs.
19. As an admin, I want the title prefilled with the next number, so that "Class-01" becomes "Class-02"
    without typing.
20. As an admin, I want "(Copy)" added when the title has no trailing number, so that the copy is still
    told apart from the original.
21. As an admin, I want every course of the original ticked in the dialog, so that I do not have to
    reassign the copy by hand.
22. As an admin, I want to see where in each course the copy will go, so that I can trust the result
    before creating it.
23. As an admin, I want to untick a course, so that the copy skips courses where it does not belong.
24. As an admin, I want to add other courses in the same dialog, so that one step covers every course.
25. As an admin, I want the copy placed right after the original in each course, so that the series
    stays in order.
26. As an admin, I want later classes in that topic to move down one when I duplicate an older class, so
    that the copy never lands after classes that come later in the series.
27. As an admin, I want the copy to keep the original's Free and On/Off in each course, so that it
    matches its neighbours.
28. As an admin, I want PDFs and tests left off the copy, so that the next class does not carry the
    previous class's material.
29. As an admin, I want the original's course-only name left off the copy, so that the copy shows its own
    title.
30. As an admin, I want a class that appears in two places in one course to get the copy only in its
    main place, so that the copy does not appear twice.
31. As an admin, I want the class and all its course placements created together or not at all, so that
    a failure never leaves a half-placed copy.
32. As an admin, I want the button to say how many courses the copy goes into, so that I know what
    "Create" will do.

**Rename**

33. As an admin, I want "Rename…" in a class row's ⋯ menu, so that I can fix a title from the course.
34. As an admin, I want "Only in this course" as the default choice, so that a rename touches nothing
    outside this course unless I ask.
35. As an admin, I want "Everywhere" to change the class title in all its courses and on the Classes
    page, so that I can fix a title once.
36. As an admin, I want courses that set their own name to keep it after an "Everywhere" rename, so that
    a name someone chose on purpose is not silently overwritten.
37. As an admin, I want the Rename dialog to show both names when this course already has its own name,
    so that I know what each choice changes.
38. As an admin, I want "Use the class title again in this course", so that I can undo a course-only
    name.
39. As an admin, I want an "Everywhere" rename from a course with its own name to also drop that name, so
    that the course follows the new title.
40. As an admin, I want the Assign Classes row to show "Class title: …" under a course-only name, so
    that I can tell the two apart.
41. As an admin, I want editing the title in the class form to count as an "Everywhere" rename, so that
    the alias rules hold however the title changes.

**Aliases and search**

42. As an admin, I want every admin search box to find a class by any name a course shows, so that the
    name I saw finds the class.
43. As an admin, I want an old title to keep finding the class after an "Everywhere" rename, so that a
    colleague who remembers it can still find it.
44. As an admin, I want search results to show the class title first, so that the list reads the same
    everywhere.
45. As an admin, I want a result that matched another name to say which name matched and where it comes
    from, so that I understand why it appeared.
46. As an admin, I want the in-course outline search to match both the course's name and the class
    title, so that I find a class in the course either way.
47. As an admin, I want "Also known as" chips in the class form, so that I can see every name the class
    goes by.
48. As an admin, I want each chip to say whether it is an old title or which course shows it, so that I
    know where it comes from.
49. As an admin, I want to cross out an old title, so that a name no longer wanted stops matching.
50. As an admin, I want names some course still shows to have no ×, so that I cannot make a visible
    name unsearchable.
51. As an admin, I want renaming back to an old title to move the current title into the aliases and drop
    the old one, so that renaming back and forth never piles up chips.
52. As an admin, I want names that differ only in capitals or spaces treated as one, so that chips do
    not repeat.
53. As an admin, I want a course's name to leave the aliases when that course goes back to the class
    title, so that the chips match what courses show.
54. As an admin, I want a new duplicate to start with no aliases, so that it does not inherit the
    original's history.
55. As an admin, I want close spellings of any of these names to match, as titles do today, so that
    typo tolerance does not depend on which name I type.

**Students and safety**

56. As a student, I want class cards to show the course's name for a class, as they do today, so that I
    see one consistent name.
57. As a student on live classes by course, I want the course's name for a live class, so that it
    matches the course's class list.
58. As an operator, I want the per-course name route to require an admin token, so that nobody can
    rename classes anonymously.
59. As an operator, I want every new route admin-only, so that faculty, names and duplicates cannot be
    changed without signing in.
60. As an operator, I want a rerunnable repair that rebuilds every class's search names, so that any
    drift can be fixed in one run.

## Implementation Decisions

**Data shape**

- `Class.teacherName` stays a plain string. Faculty is not linked by id. The change endpoint takes a
  faculty id, checks it is an active Faculty profile, and writes that profile's name.
- New `Class.oldTitles: [String]`. It holds only the old titles an admin has not crossed out.
- New `Class.searchNames: [String]`, a stored union used only by search. It holds the title, the old
  titles, and every name a placement of the class shows. It is rebuilt by the Class names module and is
  never written anywhere else.
- A placement's shown name keeps the existing precedence: course-only name (`CourseClass.title`), then
  the imported name (`apxTitle`), then the class title. Both placement fields count as names a course
  shows.
- No change to `CourseClass` fields. Duplicate reuses placement fields as they are.

**Module 1. Class names (deep module, backend)**

- It is the only writer of class titles, course-only names, `oldTitles` and `searchNames`. Its interface
  has four calls:
  - rename everywhere (class, title)
  - rename in course (course, class, title or none)
  - remove old title (class, name)
  - recompute (class ids)
- Rules, one pure function over (title, old titles, shown names):
  - Names compare after trimming, folding case and collapsing spaces.
  - An "Everywhere" rename adds the previous title to `oldTitles`.
  - `oldTitles` never contains the current title or a name some placement shows.
  - "Remove old title" refuses a name that is the title or that a placement shows.
  - Renaming back to an old title removes it from `oldTitles` and adds the replaced title.
- An "Everywhere" rename leaves course-only names alone. When it is started from a course that has its
  own name, the dialog can also clear that course's name in the same call.
- "Rename in course" with no title clears both `CourseClass.title` and `apxTitle` on that placement, so
  the course really shows the class title. The imported-name field otherwise outranks the class title.
- These writers call recompute for the classes they touch:
  - class form title edits, which go through rename everywhere
  - class create and bulk create
  - in-place create
  - Copy to another course (it copies `title` and `apxTitle`)
  - placement assign and remove
  - the legacy per-course name route
  - duplicate
- A recompute script rebuilds `searchNames` (and prunes `oldTitles` by the rule) for every class. It is
  idempotent, runs as a dry run by default, and runs on deploy day to seed the field.

**Module 2. Duplicate planner (deep module, backend)**

- Pure. Input is the source class's placements (course, main place, priority, Free, On/Off), the
  ticked courses, and each course's ordering inside the source's topic. Output is the list of writes.
- A course the original is in gets the copy right after the original's main place. Placements after it
  in that topic shift down one, and other topics keep their numbers, the same numbering rule as the
  drop-line move. Free and On/Off are copied. Course-only names, imported names and listings are not.
- A class shown in two places in one course gets the copy only in its main place.
- A course the original is not in uses the existing assign rule (where the class is filed, at the end).
- New route: duplicate a class with its courses. It takes the class form fields and the course ids. It
  creates the class through the existing create logic, including the image copy to its own object, then
  applies the plan in one transaction on a primary session. Transactions fail on the prod
  `secondaryPreferred` URI otherwise.
- New read for the dialog: the class's placements with course title, place path, Free, On/Off.
- Title prefill is a pure helper. It increments a trailing number and keeps its zero padding, or
  appends " (Copy)". The in-place create's next-title logic in the admin is the prior art. Reuse it if it
  fits, and move it to one shared helper.
- Pdf and series assignments are not copied. Notifications follow the in-place create's behaviour.

**Module 3. Faculty change (backend)**

- New admin route: set faculty for class ids, taking a faculty id. It applies the same per-class
  ownership check as the class update route. It skips classes that already have the name and returns
  changed count, skipped count, courses touched, and the classes with no recording yet.
- The row dialog and Bulk edit both call it. Bulk edit sends its per-course fields and the faculty
  change as two calls and reports each result.

**Module 4. Search wiring (backend)**

- The shared title search helper gains `searchNames` as a field on the admin class searches: the
  Classes page (which the PDF class pickers also use) and Add existing classes. The cached vocabulary
  that powers close spellings includes words from `searchNames`.
- Each result gets `matchedName` (name, source `oldTitle` or `course`, course title) when the best match
  was not the class title.
- The in-course outline search stays on the client. Outline rows carry the class title next to the
  shown name, and the search matches both.
- Student search surfaces do not change. Global search already matches course-only names.

**Small edits**

- Live classes by course uses the course's shown name. Live schedule, flags and banners keep the class
  title, because each has no single course.
- The legacy per-course name route gets the admin requirement. First check that the legacy Assign
  Classes screen sends its token, and fix that hook if it doesn't.
- The class read for the form returns "other names": each name with its source, its course where it has
  one, and whether it can be removed.

**Admin UI**

- Row ⋯ order: Go live / Upload video, PDFs, Tests / Change faculty…, Rename…, Duplicate….
- Dialogs follow boards A to D. Copy text has no "same length" line and no "PDFs and tests are not
  copied" note. The user removed both.
- The class form gets an "Also known as" chip list. Old-title chips have an ×. Course-name chips do not.
- Search results on the Classes page and Add existing classes show a "Matched …" tag per board E.

## Testing Decisions

- Test what an admin or a caller can observe: names, placements, order, response fields, status codes.
  Do not assert internal calls or query shapes.
- **Class names**, unit tests on the pure rule function:
  - renaming back removes the alias
  - names that differ only in case or spaces collapse to one
  - a name some placement shows cannot be removed
  - an "Everywhere" rename keeps course names
  - clearing a course name drops it from the shown names
- **Duplicate planner**, unit tests:
  - the copy lands right after Class-01, and 03 and 04 shift down one
  - other topics' numbers are untouched
  - Free and On/Off are copied
  - the copy goes only to the main place when the class is shown in two places
  - an unticked course gets nothing
  - an added course goes to the end
- **Title prefill**, unit tests:
  - "Class-01" becomes "Class-02"
  - "Class - 9" becomes "Class - 10"
  - "Day-1 || Prehistoric" becomes "Day-1 || Prehistoric (Copy)"
- **Routes**, integration tests on the existing Mongo harness that runs the Copy and Move tests (it
  connects `secondaryPreferred` like prod):
  - faculty change, single and bulk, including the skip count
  - rename everywhere, rename in course, and remove old title
  - duplicate across three courses in one transaction, and a forced failure leaves no class and no
    placements
  - search returning `matchedName`
  - each new route and the locked legacy route answer 401 without an admin token
- **Recompute script**: running it twice gives the same result.
- **Admin**, component tests:
  - the duplicate dialog's course list is pre-ticked from the placements read
  - the Bulk edit payload carries the faculty change only when its box is ticked
- Baselines: record the backend unit and integration failure counts and the admin vitest and tsc
  counts on the branch base before the first task. Every task ends at that baseline or better.

## Out of Scope

- A per-course faculty, or linking classes to a Faculty profile by id.
- Renaming a Faculty profile cascading to its classes.
- Aliases typed by hand, or a "Use as title" action on a chip.
- Students searching aliases, or students seeing two names (board F2).
- App and website changes. No student-facing field is added.
- Copying PDFs or tests to a duplicate.
- Undo for any of the three actions.
- Course names on live schedule, flags and banners.
- Classes page search while category, Free or live filters are on (it still filters only the loaded
  page, an earlier decision).

## Further Notes

- Changing the faculty of a class that has not streamed changes its RTMP server. The encoder box is
  looked up from the faculty name, and the lookup refuses a name shared by two profiles. The dialogs warn
  about it. The route does not block it.
- Role-scoped teacher admins see classes by matching their name against `teacherName`. A teacher who
  moves a class to another faculty loses sight of it. Role-based filtering is off on prod today.
- Deploy order: backend first (schemas are `.strict()`), then run the recompute script as a dry run,
  then with commit after the user approves, then push the admin. Pushing the backend fork is a deploy,
  so ask before every push.
- Prior decisions this builds on: the never-remove-access rule (duplicate only adds placements), the
  Assign Classes one-stop row ⋯, and teacher prefill from the subtopic's last class for new classes.
