# Handoff — course multi-faculty bug (2026-09-29)

## The complaint (client, Hinglish, paraphrased)

"Any batch lets us select more than one faculty, but as soon as we select several and
click Update, the others go back and only one stays." ("Batch" = course.)

## Verified root cause (two layers)

1. **Admin form drops the extras.** `quicktricks-admin` `components/admin/CourseForm.tsx`,
   in `handleSubmit`:
   ```ts
   if (Array.isArray(formData.facultyDetails)) {
       formData.facultyDetails = formData.facultyDetails[0] || ""
   }
   ```
   The picker (zod `facultyDetails: z.array(z.string()).min(1)`) is multi-select; the submit
   keeps element 0. Confirmed in the LIVE Vercel bundle of admin.quicktricksbysahilsir.com on
   2026-09-29.
2. **Backend stores one ID.** `quicktricks-backend` `src/models/Course.ts:129`
   `facultyDetails: { type: Schema.Types.ObjectId, ref: 'FacultyDetails' }`; create/update zod
   (`src/schemas/courseSchemas.ts:268`, `:352`) accept one `objectId`. Removing the admin
   truncation alone would make the update 400.

## Wire constraint — do NOT change the shape of `facultyDetails` in responses

Consumers read `facultyDetails` as a **single object**:
- **thedhronas website** (branch `quicktricksbysahilsir-new`): `BatchCourseCardV2.tsx`
  (`facultyDetails.name`, `.avatar`), `utils/utility.ts:1997,2473`, course/batch detail pages.
- **Mobile app**: not inspected; assume the same single-object shape.
- **Backend itself**: `orderController.ts:1929` (`course?.facultyDetails?.name`, after
  `.populate`), `recommendedCourseController.ts:70` (populate), the listing projection
  `getFacultyDetailsProjection` (`courseController.ts:~151`, `$lookup` then `$arrayElemAt 0`),
  the by-id projection at `courseController.ts:~1607`, and the faculty filter at `:2062`
  (`query.facultyDetails = ObjectId(facultyId)`).

Changing stored `facultyDetails` to an array would silently break the populate readers
(`.name` on an array) and the website cards.

## Recommended design (the new session should confirm with the user first)

- Add a new stored field, e.g. `faculties: [ObjectId]` (ref `FacultyDetails`), on `Course`.
- Keep `facultyDetails` = `faculties[0]` (the primary) on every write, so every existing
  reader keeps working unchanged.
- Create/update schemas accept an array (`faculties`, or `facultyDetails` as string|string[]
  normalised server-side — decide which is cleaner; the admin currently sends the key
  `facultyDetails`).
- Responses: keep `facultyDetails` (object) as is; ADD `faculties: [{id, name, ...}]` where the
  admin needs it (at least `GET /api/courses/:id` for the edit form, and the admin list's
  Faculty column, which already renders arrays — `app/admin/courses/page.tsx:157`).
- Faculty filter (`:2062`) should match either field (`$or` or query `faculties`).
- Backfill: `faculties = [facultyDetails]` for existing courses (dry-run first, backup,
  run on the box; user approves the `--commit`).
- Admin: stop truncating; send the full array; hydrate the picker from `faculties`
  (fallback `facultyDetails`). `CourseForm.test.tsx` has `facultyDetails: ['fac-1']`
  fixtures — check whether a test pins the truncated payload.
- Later / optional: website + app show all faculties — separate client-team work.

Alternative if the user wants the smallest change: make the picker single-select so the
UI stops promising what the model cannot store. Ask the user which they want.

## Repo + deploy rules (from memory — verify still true)

- Backend fork `../quicktricks-backend`, branch `quicktricks-admin`. The `origin` remote
  fetch fails; fetch via `git fetch git@raghav-hranker:abhi092515/quicktricks-backend.git quicktricks-admin`.
  Tip on 2026-09-29: `a8b5414b4`. Local checkout sits on a side branch (`agent/course-qa`).
  Work from a clean worktree off the fetched tip.
- Admin fork `../quicktricks-admin`, branch `quicktricks-admin` (local was 38 behind origin,
  with dirty files — use a worktree). Deploys via Vercel on push.
- zsh gotcha: `git show $REF:path` breaks when the path starts with a letter zsh
  treats as a modifier (`:c`, `:s`, …) — always quote: `git show "$REF:path"`.
- No Claude co-author trailers in these client-facing fork repos; commit as
  raghavsharma@hranker.com.
- Backend deploy = dist is tracked; build dist, commit, push, then pull + `pm2 restart` on the
  prod box (see memories quicktricks-prod-box, quicktricks-box-ssh-key,
  quicktricks-backend-dist-deploy). Backend must deploy before the admin change.
- Admin tests: vitest; exclude `.sandcastle/**` if present.

## Not part of this task

The course **time table** complaint from the same message is separate and unresolved:
the 17 Sep fix is live, `isTimeTable` is stored on all 123 prod courses (verified), and the
remaining suspect (stale open edit page overwriting — the form sends every field) is
unproven. Waiting on the client's exact steps.

## Prompt to start the new chat

> Read `reference/course-multi-faculty-handoff-2026-09-29.md` and fix the course
> multi-faculty bug in quicktricks-backend + quicktricks-admin. Confirm the design with me
> before coding.
