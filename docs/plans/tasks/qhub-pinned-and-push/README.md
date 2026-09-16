# Tasks: Q-Hub pinned messages + explicit push

Slices of [the PRD](../../prd-qhub-pinned-and-push.md). Read it first — it holds the decisions
(why the Telegram bar is rejected, why reach counts are not shipped) and the contract table.

**Working-copy rules.**
- Admin: the **fork** `quicktricks-admin`, worktree off `origin/quicktricks-admin` (prod = that branch;
  local `../quicktricks-admin` sits on `agent/course-qa`). Vitest: `npx vitest run --exclude '.sandcastle/**'`.
- LMS/chat API: the **fork** `quicktricks-backend`, worktree off `origin/quicktricks-admin`. Deploy is
  commit → push → pull on the prod box, never patch. No co-author trailers in either fork.
- Feature branch used for this work: `feat/qhub-pinned-push` in both repos.

| # | Task | Type | Repo | Blocked by |
|---|---|---|---|---|
| 01 | [Pinned broadcasts stay in the timeline](01-admin-pinned-inline.md) | AFK | quicktricks-admin | — · **done** `e22ec6c` |
| 02 | [The Pinned tab](02-admin-pinned-tab.md) | AFK | quicktricks-admin | **done** `e22ec6c` |
| 03 | [`silent` flag + persisted delivery facts](03-lms-silent-and-flags.md) | AFK | quicktricks-backend | **done** `96bbd3d9a` |
| 04 | [Explicit notification mode in the composer](04-admin-notification-mode.md) | AFK | quicktricks-admin | **done** `e22ec6c` |
| 05 | [Notify about an existing broadcast (endpoint)](05-lms-notify-existing.md) | AFK | quicktricks-backend | 03 |
| 06 | [Send-push dialog for a published broadcast](06-admin-push-dialog.md) | AFK | quicktricks-admin | 05 |

01–04 are **built and committed** (2026-09-17) on `feat/qhub-pinned-push` in both forks, nothing pushed
or deployed yet; the admin change is verified by `next build`, vitest and the node tests, not yet in a browser. 05–06 are specced and left `ready-for-agent`: they need a cooldown rule and a
delivery record, and the PRD deliberately does not block the pinned fix on them.

Deploy order when 03 and 04 ship together: backend first (the field is additive and ignored by the old
admin), then the admin.
