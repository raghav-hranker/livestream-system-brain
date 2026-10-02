# Guard class test-assignment routes with requireAdmin

**Type**: AFK
**Blocked by**: None — can start immediately
**Branch**: `fix/class-series-require-admin` in both forks, cut from `origin/quicktricks-admin` (not from
the one-stop branch), so it can deploy on its own. It is then merged into `feat/assign-classes-one-stop`
so task 04 builds on it.

## What to build

PRD decision 4. Today anyone can assign, remove and reorder a class's tests: the series mutation
routes in `src/routes/classRoutes.ts` (`POST/DELETE /:classId/series`, `DELETE /:classId/series/:seriesId`,
`PUT …/priority`, `PATCH …/inline-update`) have no auth, while the PDF routes just below them use
`requireAdmin`.

- **Backend:** add `requireAdmin` to the five series mutation routes, the same way the class-PDF
  mutations do. Reads (`GET /:classId/series`, `GET /:classId/available-series`) stay as they are: the
  website and app read a class's tests.
  - Before changing anything, grep both forks and the student site for callers of these mutations.
    Report any non-admin caller instead of breaking it.
- **Admin:** `hooks/api/use-class-series.ts` sends the admin token on every mutation, the same way
  `use-class-pdfs.ts` does. Reads may send it too if that's how the PDF hook does it.

## Acceptance criteria

- [ ] Series mutations without an admin token get 401/403; with one they behave as before.
- [ ] The assign-series page (`/admin/classes/assign-series?classId=`) still assigns, removes and reorders.
- [ ] Backend integration test: unauthenticated mutation refused, admin mutation accepted.
- [ ] Admin test: the hook sends the Authorization header on mutations.
- [ ] Baselines stay green.
