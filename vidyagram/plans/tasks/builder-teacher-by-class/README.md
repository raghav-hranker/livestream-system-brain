# Course builder v2: teacher by class (merged chapters)

Tenant: Vidyagram (781). Course builder v2 = `6aff1280d8f488b0916b2f98` (on sale, hidden from student lists, no orders on 2026-11-20).
Supersedes `../builder-teacher-choice/` (pair model). Session: "vg: Builder teacher access by class (merged topics)".

## Decisions (user, 2026-11-20)

| Question | Decision |
|---|---|
| Who merges | One script merges every pair (the admins' 15 of 11-19 plus 12 more), writes each placement's teacher and the new weights. Dry run, backup, ledger, user's OK. |
| Surviving topic | Abhinay's topic id and name (as the admins did): "Algebra", "Geometry", "Time & Work"… |
| 3-way merges | Aditya's "Profit & Loss" + "Discount (बट्टा)" both merge into "Profit & Loss & Discount."; "RATIO" + "PROPORTION" into "Ratio & Proportion". |
| Result | 39 chapters: 27 with a teacher toggle, 12 Aditya-only. |
| Weights | Average of the old weights (Aditya's two count as one where he has two), rescaled to 100 in 0.5 steps; the 4 largest give 0.5 back so the total is exactly 100. Approved table: `merge-plan-2026-11-20.json` (`new`). |
| No-teacher content in a two-teacher chapter | Open to every buyer (classes without a teacher, course PDFs, course tests). |
| Teacher storage | `CourseClass.teacher` on v2's placements; `Class` untouched. Script now, admin assign screen later. |
| Buyer view | Class lists drop the other teacher's classes of a chapter the student bought with one teacher. |
| Earlier, still holding | Aditya suggested by default; same price either teacher; one teacher per chapter per build; no whole-course purchase; teacher change after purchase admin-only (order view, later); Revision only stays paused; admin UI later. |

## Tasks

1. [`01-teacher-by-class-api.md`](01-teacher-by-class-api.md): backend API (models, scope rule, builder response, checkout, class lists).
2. Data script `reference/scripts/vidyagram-builder-teacher-merge.cjs` (written in-session): merge per the plan, set
   `CourseClass.teacher` on every v2 placement from its source course, set `builder.teachers` (Aditya Sir / Abhinay Sir,
   Aditya suggested) and the approved weights. Read-only dry run first; COMMIT=1 only on the user's OK.
3. Preview the API read-only against live v2, deploy on OK, run the script on OK, verify the live response.
4. App guide in `vidyagram/reference/` on OK.

## Status 2026-11-20

Live: backend c8b739e59 + dist b28b96a42 on `vidyagram-admin` (pm2 92). Merge applied 14:16 IST, chapter-name stamp fix
14:19 IST (`vidyagram-builder-teacher-merge-names.cjs`, 169 placements). Ledger: memory `prod-data-changes`.
App guide: [`../../../reference/vidyagram-builder-teacher-toggle-app-guide.md`](../../../reference/vidyagram-builder-teacher-toggle-app-guide.md).
Next: admin screen (teacher per class, per-chapter suggestion, teacher change on an order).
