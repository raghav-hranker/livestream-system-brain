# Handoff — course time table audit (2026-09-29)

## The question

The user sees many courses with **no time table** and suspects time tables were lost. The
client also reported (Hinglish, paraphrased): "whenever we edit anything in a course, the
time table goes blank; we have to add it again after every edit." Find out:

1. Which courses **had** a time table and lost it (vs. never had one).
2. **What** deleted each loss, and whether that path is still open.
3. Whether lost rows can be **recovered**.

Vocabulary: "time table" here is the per-course field `Course.timeTable` (`[{topic, time}]`)
plus its on/off switch `Course.isTimeTable`. It is **not** the LMS **timetable** in
`quicktricks-backend/CONTEXT.md` (the cross-course listing at `/api/timetable`).

## Read this first — how the previous session went wrong

The previous session flip-flopped because it reasoned from stale notes and indirect API
signals before checking the database. Do not repeat that:

- **Query the database and the logs first; reason second.** Read-only access works (below).
- The public `GET /api/courses/:id` **cannot** show whether `isTimeTable` is stored — its
  projection falls back to `timeTable.length > 0` when the field is missing.
- `updatedAt` does **not** tell you a course was saved through the form: bulk writes and
  class assignment (`Course.updateMany` + `$addToSet`) bump it too.
- Label every claim **verified** (with the query/command) or **inferred**.

## Verified facts (2026-09-29)

**Database** (read-only query on the prod box):
- 123 courses. **8 have time table rows**, all with `isTimeTable: true` stored:
  RAILWAY EXPRESS SERIES (active, 1), Maths Prime Batch (2026-27) (active, 2), All India Free
  Test Series (inactive, 1), Railway Foundation Batch (TESTING), Course Class - TESTING,
  Testing Course 3/4/5 (inactive test courses).
- **115 have no rows** (39 active, 76 inactive).
- **0 courses lack a stored `isTimeTable`** → the "switch missing" path (below, case 1) is closed.
- Oldest course `createdAt` 2023-10-25 (APX-era courses migrated in; `_id`s `6a45…`).

**The 17 Sep fix is live**: backend `d9e7747f0` (+ `44972c72f` projection) and admin `1c67c3f`
(`lib/course-timetable.ts`: form sends `timeTable: []` only when the switch is off). Confirmed
in the live admin JS bundle and the live API.

**Backend request log** — the best evidence source.
`updateCourse` logs every request body (`=== Course Update Debug Info ===` / `Request body: {…}`,
multi-line JSON). pm2 log `~/.pm2/logs/quicktricks-backend-out.log` on the box: **12 GB, never
rotated, starts 2026-09-06, timestamps in IST**. Extracted 149 bodies (96 full form saves with
`timeTable`, 42 status-only, 11 priority-only) → saved in this repo:
`reference/scripts/course-timetable-audit-2026-09-29/course-update-bodies.json`
(parser: `extract_course_update_bodies.py` in the same folder; run on the box with `python3`).
Caveat: bodies do not include the course id — match by `title` (status/priority-only bodies
have no title).

What the log shows (verify, then extend):
- **Before the fix (up to 09-17 ~14:45 IST) there were real wipes**, e.g.
  Maths Prime Batch 09-17 12:48:12 sent 1 row → 12:48:44 sent 0 rows;
  Course Class - TESTING 09-16 17:54:19 1 row → 09-17 12:48:04 0 rows.
- **After the fix, no logged form save sent 0 rows for a course whose previous logged save had
  rows.** (One edge: Course Class - TESTING 09-17 15:15:11 sent switch-off/0 rows, but its
  previous save was already 0 rows.)
- Most of the 115 empty courses appear in the log only with `isTimeTable:false, rows 0` —
  i.e. **no time table in the logged window**. That window starts 09-06; anything earlier is
  unknown.
- The client team is **actively testing right now** (saves at 09-29 13:35, 13:36, 14:02 IST on
  Testing Course 4, Testing Course 2, Maths Prime Batch).

**Mongo oplog**: `local.oplog.rs` covers only 2026-09-23 04:08 UTC → now. Useful for exact
per-document changes since 09-23 (it has the `_id`), not for older history.

**Known deletion paths**
- *Case 1 (closed)*: an old course without a stored switch; a status/priority save from the
  Courses list let Mongoose write the default `isTimeTable:false`; the next form save sent
  `timeTable: []`. Reproduced against the real model in mongodb-memory-server. Impossible now
  (0 courses lack the flag; new courses always store it).
- *Pre-17-Sep form bug (closed)*: the form hydrated the switch to off and sent `[]` on every save.
- *Case 2 (open, UNTESTED)*: the edit form sends every field, so an edit page opened earlier
  (another person, or a second tab) overwrites a time table added in the meantime. React-query
  `staleTime` is 5 min (`components/providers/query-provider.tsx`).

## What to do next

1. **Scope the "lost" set.** From the log JSON, list every course title that ever had rows > 0
   and compare to current DB rows. Anything that had rows and now has none = a loss; record the
   timestamp of the save that emptied it.
2. **Before 09-06**: find out if courses had time tables at all. Leads: the APX source
   (`ApxCourse` collection / APX API — does APX carry a time table?), the old nodejs-server
   checkout on test-uday (`/home/raghav/quicktricks-backend` — is it the same DB or a copy?),
   any DB backup/dump. If no source has rows, the honest answer is "these courses never had a
   time table on this platform" — not a loss.
3. **Case 2**: reproduce in the admin with two tabs on a TEST course (Testing Course 3/4/5,
   inactive). If it wipes, the fix is send-only-changed-fields or an optimistic-concurrency
   check (`updatedAt`/`__v` in the PUT), not another toggle tweak.
4. **Recovery**: for confirmed losses, the last non-empty rows are in the log JSON. Restoring
   is a prod write → back up, dry-run, and get the user's approval before `--commit`.
5. Ask the user to get the client's exact steps (course, field changed, anyone else/other tab
   open) — still the fastest way to the "every edit" cause.

## Access (read-only is fine; writes need the user's approval)

- `ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18`; checkout
  `/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend`.
- No `mongosh` on the box. Query with the backend's own driver:
  `export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH; DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -e "…mongoose…process.env.MONGO_URI…"`
- The out log contains JWTs elsewhere — never print raw lines; extract only course bodies,
  counts and dates.
- Code: backend fork tip `a8b5414b4` (fetch via `git@raghav-hranker:abhi092515/quicktricks-backend.git`),
  admin `origin/quicktricks-admin`. In zsh always quote `git show "$REF:path"`.
- Key code: backend `src/controllers/courseController.ts` (`updateCourse` ~L687, projection
  ~L305, `updateCourseStatus` ~L1301, `duplicateCourse`), `src/schemas/courseSchemas.ts`
  (`preprocessTimeTable`), `src/models/Course.ts`; admin `components/admin/CourseForm.tsx`,
  `lib/course-timetable.ts`, `hooks/api/use-courses.ts` (`useUpdateCourse`).

## Prompt to start the new chat

> Read `reference/course-timetable-audit-handoff-2026-09-29.md`. Find which courses lost their
> time tables, what deleted them, and whether any deletion path is still open. Query the
> database and logs first; label every claim verified or inferred.
