# Tasks: Course search — classes, course PDFs and tests inside one course

State: `ready-for-agent` (01–04) · `ready-for-human` (05, 06)

Vertical-slice breakdown of [the PRD](../../prd-course-search.md). Tasks cite the PRD's decisions
(D1–D11) and wire contract rather than restating them. Glossary: fork `CONTEXT.md` → "Course
search" (**Course search**, **Course PDF**, **Class PDF**, **Course test**).

**Working-copy rules.**
- LMS only: the **fork** `quicktricks-backend`. Work in the worktree
  `~/Projects/worktrees/qt-course-search` (branch `feat/course-search`, off
  `origin/quicktricks-admin` `f51c229cf`). It already holds the uncommitted "Course search"
  glossary section: commit it with task 01. Rebase before pushing, because the client team pushes
  often. Don't build in the main checkout (`agent/course-qa`, unrelated uncommitted work).
- Fetch and push over HTTPS via `gh auth git-credential` (the ssh key fails).
- Deploy = surgical `dist` compile + commit → push → box pull → pm2 restart. No co-author
  trailers; commit as the work email. A push ships: the client team deploys by pulling.
- Per-student state comes **only** from the verified token (D10). Never read a body or query
  `userId` in the new code.
- Reuse, don't copy: class-tabs internals (task 01/02), the title search and its vocabulary cache,
  and the extracted item modules (03/04), which the live tabs must also use.
- Tests: `node:test` + `node:assert/strict`; `npm test` (unit) and `npm run test:integration`
  (in-memory Mongo).
- Sandcastle: `node scripts/sandcastle/run-task.mjs course-search:<nn> --base=feat/course-search`
  with `SANDCASTLE_MODEL=claude-opus-5-5`; copy these task files into the fork branch first.

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Classes section, end to end (guest view)](01-classes-section-guest-view.md) | AFK | — |
| 02 | [Per-student class state, from a verified token only](02-per-student-class-state-verified-token.md) | AFK | 01 |
| 03 | [Ebooks section (course PDFs), with the Ebooks tab pinned](03-ebooks-section.md) | AFK | 01 |
| 04 | [Tests section (course tests), with the Tests tab pinned](04-tests-section.md) | AFK | 01 |
| 05 | [Measure, deploy and accept on prod](05-measure-deploy-accept.md) | HITL | 01–04 |
| 06 | [App-team guide + Postman test bed](06-app-team-guide.md) | HITL | 01–04 |

02, 03 and 04 are independent of each other and can run in parallel after 01. 03 and 04 each
golden-pin their live tab **before** extracting its item builder, so the extraction ships with
its own safety net.
