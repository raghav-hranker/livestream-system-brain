# Remaining open routes behind the gate, in report mode

**Type**: AFK
**Blocked by**: 02, 10
**Repo**: backend

## What to build

Put every remaining write route that has no login behind the task 02 gate, in `report` mode, so the history and the
report lines show who calls each route before anything is enforced.

- **Make a fresh inventory.** The auth-gate TSV in `vidyagram/plans/` is stale (built at ab7d7b4e0). Walk the routes
  on a fresh `origin/vidyagram-admin`, and list every POST, PUT, PATCH or DELETE with no `requireAdmin` and no
  required student token. Save it as `vidyagram/plans/admin-route-inventory-<date>.tsv`.
- **Groups**, each with its own `ROUTE_GATE_<GROUP>` setting (default `report`):
  - `COURSE_FOLDERS`: the 8 course-folder writes
  - `TAXONOMY`: topic, subtopic and section create, update and CSV import
  - `APX_COURSES`: build-all, process-all, migrate and the other APX course writes
  - `UPLOADS`: `POST /api/pdfs/upload`, `/api/uploads/images`, `/api/uploads/files`
  - any other group the inventory turns up
- `allow` is `admin` for all of these, unless the inventory shows the app or website calls one. Then it's
  `self-or-admin` or left open, and the reason is noted.
- **Don't overlap the student auth gate.** The unpushed `feat/vg-student-auth-gate` covers 137 student routes. A route
  must not be gated by both. Check its route list and say which side owns any overlap.

## Acceptance criteria

- [ ] The fresh inventory TSV is saved.
- [ ] Integration: in `report` a no-login call to one route per group passes and logs a would-refuse line. In
      `enforce` it gets 401 and an admin gets 200.
- [ ] Report lists groups, routes, chosen `allow`, and the overlap check with the student auth gate.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Story 47
