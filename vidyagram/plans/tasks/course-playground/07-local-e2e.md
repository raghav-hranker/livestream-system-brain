# Local end to end on a copy of real courses

**Type**: HITL (the user approves the live read and watches the click-through)
**Blocked by**: 01 to 06

## What to do

1. With the user's OK, export 5–6 real Vidyagram courses read-only from `vidyagramdb` (pick with the user: a maths,
   a reasoning, an English and a GA course, one with PDFs and tests, the demo builder course
   `6ad73b8ac90f6da685048d8c`): the courses, their `courseclasses`, `coursetopics`, `coursepdfs`, `coursetests`, the
   referenced classes, pdfs, series, sections, topics, subtopics, categories and faculties. Script in
   `reference/scripts/vidyagram-playground-export.cjs` (read-only, `secondaryPreferred`, prints counts, writes a
   local JSON bundle outside the repo), and `vidyagram-playground-seed.cjs` to load it into a local docker `mongo:7`
   replica set (db name `vidyagramdb`, the branch guard) plus an admin and a student.
2. Run the integration backend (`.env.localpreview`, `DISABLE_CRONS=true`) and a detached preview admin worktree whose
   `config.ts` points at it (never committed). launch.json entries `vg-playground-backend` / `vg-playground-admin`.
3. Click through with the user: build a course from three of them, rename a section, move a topic with Goes into,
   price it with Revision shown and Notes hidden, create it off sale; check the new course's outline and builder strip
   on the Courses screen; check the source courses are unchanged (script diff).
4. API student check (`reference/scripts/vidyagram-playground-e2e-check.mjs`): manual grant of a build without
   Revision ⇒ ordinary classes open, revision classes refused; with Revision ⇒ both open; the student builder data
   shows no Notes.
5. Write the status in the README and the memory note.
