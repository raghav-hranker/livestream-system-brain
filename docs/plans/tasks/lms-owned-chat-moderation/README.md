# LMS-Owned Chat Moderation — Issue Index

Parent: [PRD: LMS-Owned Chat Moderation](../../prd-lms-owned-chat-moderation.md)

| # | Issue | Type | Status | Blocked by |
| --- | --- | --- | --- | --- |
| 01 | [Imported Platform chat ban tracer bullet](01-imported-platform-ban-tracer.md) | AFK | `ready-for-human` (code complete on `sandcastle/chatmod-task-01`, reviewed; merge+deploy user-gated) | None |
| 02 | [Admin Class chat ban with live enforcement](02-admin-class-ban-live-enforcement.md) | AFK | `ready-for-human` (code complete on `sandcastle/chatmod-task-02`, reviewed) | 01 |
| 03 | [Admin Platform chat ban fanout](03-admin-platform-ban-fanout.md) | AFK | `ready-for-human` (code complete on `sandcastle/chatmod-task-03`, reviewed) | 02 |
| 04 | [Host Class mute and unmute through LMS](04-host-class-moderation-through-lms.md) | AFK | `ready-for-human` (code complete on `sandcastle/chatmod-task-04`, reviewed) | 02 |
| 05 | [Overlapping-scope composition and reconciliation](05-overlapping-scope-reconciliation.md) | AFK | `ready-for-human` (code complete on `sandcastle/chatmod-task-05`, reviewed) | 03, 04 |
| 06 | [Durable delivery and multi-instance recovery](06-durable-delivery-recovery.md) | AFK | `ready-for-human` (code complete on `sandcastle/chatmod-task-06`, reviewed) | 05 |
| 07 | [Authenticated admin management surface](07-admin-management-surface.md) | AFK | `ready-for-human` (code complete on `sandcastle/chatmod-task-07`, reviewed) | 03 |
| 08 | [Legacy ban-authority retirement](08-retire-legacy-ban-authority.md) | AFK | `ready-for-human` (code complete on `sandcastle/chatmod-task-08`, reviewed) | 05, 06, 07 |
| 09 | [Production cross-repo acceptance](09-production-cross-repo-acceptance.md) | HITL | `ready-for-human` | 08 |

## Dependency graph

```text
01 → 02 ─┬→ 03 ─┬→ 05 → 06 ─┐
         │      │             ├→ 08 → 09
         └→ 04 ─┘      07 ───┘
                └→ 07
```

Issues are intentionally tracer-bullet slices. Each one proves a user-visible path across the relevant
LMS, admin, livestream, and viewer interfaces instead of assigning one repository per issue.
