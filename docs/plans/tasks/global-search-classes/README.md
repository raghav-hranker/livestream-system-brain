# Tasks: Global search — classes section

State: `ready-for-agent` (01–03) · `ready-for-human` (04, 05)

Vertical-slice breakdown of [the PRD](../../prd-global-search-classes.md). Tasks cite the PRD's
decisions (D1–D9) and wire contract rather than restating them. Glossary: fork `CONTEXT.md` →
"Global search" (**Class search result**, **Attached course**).

**Working-copy rules.**
- LMS only: the **fork** `quicktricks-backend`. Work in a worktree on a branch off
  `origin/quicktricks-admin`. Rebase before pushing, because the client team pushes often. The
  main checkout sits on `agent/course-qa` with uncommitted work; don't build there. Carry the fork
  `CONTEXT.md` "Global search" section over from that working tree into task 01's branch.
- Deploy = surgical `dist` compile + commit → push → box pull → pm2 restart. No co-author
  trailers; commit as the work email.
- Every ownership decision goes through the Entitlement check's order source. Don't write a second
  "has the user bought X" query (task 02).
- Tests: `node:test` + `node:assert/strict`; `npm test` (unit) and `npm run test:integration`.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Classes section, end to end (guest view)](01-classes-section-guest-view.md) | AFK | — · **done** `5aa5fdf88` (local) |
| 02 | [Purchases on class results, from a verified token only](02-purchases-verified-token-only.md) | AFK | 01 · **done** `774a71b09` (local; AC5 corrected) |
| 03 | [Find a class by its course's title for it](03-placement-title-fallback.md) | AFK | 01 · **done** `a759eb598` (local) + perf `110ad77c9` |
| 04 | [Deploy and accept on prod](04-deploy-accept.md) | HITL | 01, 02, 03 |
| 05 | [App-team guide for the classes section](05-app-team-guide.md) | HITL | 02 |

02 and 03 are independent of each other and can run in parallel after 01.
