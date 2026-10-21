# Tasks: Plan broadcast audience rules (Default / Advanced mode)

State: 01–06 **done, committed locally, not pushed** (2026-09-30) · 07 `ready-for-human`

Code lives on branch `feat/plan-broadcast-audience` in worktrees `~/Projects/worktrees/qt-plan-audience`
(backend, tip `1976edab0`) and `~/Projects/worktrees/qt-admin-plan-audience` (admin, tip `63a291e`).
New admin endpoint: `GET /api/plans/audience-options?search=&page=&limit=` (base plans incl. off-sale, `status` 0 = off-sale).
Known limits: no admin edit screen for scheduled notifications (API update works); `resolvedAudienceCount`
counts users while `recipientCount` counts deduped devices. No index or data migration needed.

Vertical-slice breakdown of [the PRD](../../prd-plan-broadcast-audience-rules.md). Tasks cite the PRD's
modules (1–6), schema and API contract rather than restating them.

**Working-copy rules.**
- Two **fork** repos, both on the client team's `quicktricks-admin` line: `quicktricks-backend` and
  `quicktricks-admin`. Branch off `origin/quicktricks-admin` into a worktree (suggested branch
  `feat/plan-broadcast-audience`); do not build in the main checkouts (the backend is on
  `agent/course-qa` with unrelated work; the admin's local branch is behind origin). Rebase before
  pushing — the client team pushes often. A push to `quicktricks-admin` ships.
- Commit as the work email, **no co-author trailers** on fork commits.
- Backend deploy = surgical `dist` compile + commit → push → box pull → pm2 restart. Admin deploys via
  Vercel on push. **Backend always ships before the admin** (missing `audience` ⇒ Default).
- `Order.planId` is a String; any `Plans` id query must match both string and ObjectId forms (the
  `Plans.course` id-cast trap).
- Tests: backend `node:test` + `node:assert/strict` (`npm test`, `npm run test:integration` with
  in-memory Mongo); prior art is the plan-broadcast notification unit test. Admin: vitest +
  Testing Library, prior art the course form test.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Audience field + Default mode round-trip](01-audience-field-default-mode.md) | AFK | — |
| 02 | [Advanced mode, single row, end to end](02-advanced-mode-single-row.md) | AFK | 01 |
| 03 | [Multiple rows with AND](03-multiple-rows-and.md) | AFK | 02 |
| 04 | [Plan family + state rules](04-plan-family-state-rules.md) | AFK | 02 |
| 05 | [Guardrails: empty row, all-three hint, zero-count block](05-guardrails.md) | AFK | 02 |
| 06 | [Lifecycle, history + integration test](06-lifecycle-history-integration.md) | AFK | 03, 04 |
| 07 | [Rollout + prod verification](07-rollout-prod-verification.md) | HITL | 01–06 |

03, 04 and 05 can run in parallel once 02 lands.
