# Copy a topic to another course, end to end

**Type**: AFK
**Blocked by**: #07 — Outline read, end to end

## What to build

PRD D10; module Copy changes; copy endpoint; Copy dialog for PDFs. Topic scope only; other scopes in 12.

- **Copy changes** (pure): source placements (outline order, names, Free) + target placements (active
  and inactive, names, priorities) → add / bring back / skip per PDF; target priorities after the
  target's maximum; per section-and-topic counts and "lands after its N" / "new topic at the end".
- **`POST /api/admin/courses/:courseId/pdfs/copy-to/:targetCourseId`** `{scope, preview}`: preview
  writes nothing; a real copy writes in one transaction; a re-run skips everything. Free (this course)
  copied; skipped placements untouched; the source course never written.
- **Admin**: topic ⋯ → "Copy this topic to another course…": searchable course list, preview table
  (Add, Bring back, Skip, Lands), confirm. Reuse the classes Copy dialog where it fits.

## Acceptance criteria

- [ ] Unit tests: add vs bring back vs skip; landing after the target maximum; new topics at the end;
      source order kept; Free copied.
- [ ] Endpoint tests: preview writes nothing; real copy writes the planned placements; idempotent
      re-run; source unchanged; admin-only.
- [ ] Component test: preview table and confirm request.

## User stories covered

- 51 (topic), 52–60
