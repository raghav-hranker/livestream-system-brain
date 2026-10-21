# Course class tabs — tasks

PRD: [`../../prd-course-class-tabs.md`](../../prd-course-class-tabs.md). Repo: `quicktricks-backend` (fork).

| # | Task | Type | Blocked by |
|---|---|---|---|
| 01 | [Previous tab, end to end (tracer)](01-previous-tab-tracer.md) | AFK | — |
| 02 | [Upcoming tab](02-upcoming-tab.md) | AFK | 01 |
| 03 | [Today tab](03-today-tab.md) | AFK | 01 |
| 04 | [Watch status and filters](04-watch-status-and-filters.md) | AFK | 01, 03 |
| 05 | [Mark uncomplete clears every session](05-uncomplete-clears-every-session.md) | AFK | — |
| 06 | [Deploy, prod check, app handoff](06-deploy-and-app-handoff.md) | HITL | 02–05 |

Deferred (not the focal point): today's classes ignores placement `status` (cancelled placements
still show there) — fix separately.

Order: 01 ∥ 05 → 02 ∥ 03 → 04 → 06.
