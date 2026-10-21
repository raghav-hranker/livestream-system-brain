# The PDF outline lives in Courses – New only

**Type**: AFK
**Blocked by**: #07–#12, #15 (merged on `feat/course-pdf-outline`)

## Why

Found in the local preview (2026-10-03). The Assigned Classes one-stop shipped to prod as **Courses – New**
(`/admin/courses/v2` → `/admin/courses/v2/assign-classes`) beside the old Courses screens, which were kept
byte-for-byte as legacy copies (`components/admin/assign-classes-legacy/`, `hooks/api/legacy/`) so admins
can fall back. The user wants the PDF outline the same way: **only in Courses – New**. Today the outline
branch rewrote the one shared `/admin/courses/assign-pdfs` screen, which both lists open, and the branch
predates the v2 split, so the preview shows the outline behind the OLD list and Courses – New is missing.

## What to build

1. **Sync with origin.** Merge the current `origin/quicktricks-admin` into the branch in both forks (admin
   is 26 commits behind, backend 67; the one-stop bases 015833e / 83e1dca1b are already on origin). Take new
   baselines after the merge, before any other change.
2. **Old screen stays as it is.** `/admin/courses/assign-pdfs` (opened from the old Courses list and
   `AssignPdfsButton`) renders the pre-outline Assigned/Available PDFs views as **legacy copies**
   (e.g. `components/admin/assign-pdfs-legacy/`, plus `hooks/api/legacy/` for any hook the outline work
   changed or removed), taken from admin commit `69d9cfd` — the task 01 fix (Free per course, the leak
   fix) applied to the old flat table, before the outline rewrite. Same pattern as the classes legacy copy.
3. **New screen.** `/admin/courses/v2/assign-pdfs` renders the outline (Assigned PDFs outline + the
   Available tab as the outline branch has it). The Courses – New list's "PDFs" action
   (`app/admin/courses/v2/page.tsx`, currently pushing `/admin/courses/assign-pdfs`) and any v2-only entry
   point go there; "Back" returns to Courses – New.
4. **The legacy screen keeps working against the new backend.** The outline branch changed backend
   endpoints the old screen calls (e.g. `PUT /api/courses/:courseId/pdfs/reorder` now requires the exact
   active set — task 08 kept the old `pdfOrder` body but hardened it; the section-override endpoint; the
   admin listing fields). Read every request the legacy screen makes and make sure each still behaves as on
   origin (plus task 01). Where task 08 hardened the old `pdfOrder` body, restore origin behaviour for that
   body only (the token bodies stay hardened) — prod will run both screens on one backend.

## Acceptance criteria

- [ ] Old route renders the legacy flat table (component test), with task 01's per-course Free.
- [ ] v2 route renders the outline; the Courses – New "PDFs" action links to it (component/route test).
- [ ] Endpoint tests: the legacy screen's requests (reorder with `pdfOrder`, override section, bulk Free /
      Download, listing) behave as on origin.
- [ ] Suites at the post-merge baseline; classes (v2 + legacy) tests green.
