# 08 — Retire the legacy livestream ban authority securely

Type: AFK  
Status: `ready-for-agent`  
User stories: 44–49, 58–61

## Parent

[PRD: LMS-Owned Chat Moderation](../../prd-lms-owned-chat-moderation.md)

## What to build

Cut the system over to the LMS as the only durable chat-moderation owner and remove every legacy
contract half. Before deletion, compare active legacy livestream records with canonical LMS
restrictions and produce an explicit disposition for any unique record. Then remove the public legacy
list/check/delete routes, legacy durable Ban model and writes, the admin legacy hook, and the viewer's
legacy ban-status request. Preserve host socket moderation only through the new LMS-backed flow. Add
security regression coverage proving that old public behavior is gone and no identity payload can
bypass the new enforcement.

## Acceptance criteria

- [ ] A read-only cutover report compares legacy livestream records with active LMS restrictions by user and scope and records the disposition of every mismatch.
- [ ] If production remains empty as previously observed, that fact is revalidated immediately before cutover; if not, unique records are explicitly ported or approved for retirement.
- [ ] The legacy public moderation list, per-user check, and delete routes no longer exist or return moderation data.
- [ ] Livestream no longer registers or writes a durable legacy Ban model.
- [ ] The admin no longer imports or calls the livestream-backed moderation hook or nonexistent REST mutations.
- [ ] The viewer no longer performs the legacy per-user ban-status request or treats a chat restriction as a room-access denial.
- [ ] Host moderation continues to function exclusively through verified sockets and the service-authenticated LMS write.
- [ ] Playback, realtime-token mint, room join, chat reads, roster, and polls remain unchanged after removal.
- [ ] Viewer sockets cannot moderate other users, spoof a target identity, or send chat while restricted through payload manipulation.
- [ ] Administrator routes remain authenticated and permission-gated; no replacement endpoint exposes the full list publicly.
- [ ] Deployment order guarantees the LMS, event consumer, enforcement, ticket, viewer, and admin paths are live before legacy removal.
- [ ] Regression tests assert absence of old routes and calls as well as continued success of both new moderation scopes.

## Blocked by

- [05 — Overlapping-scope composition and reconciliation](05-overlapping-scope-reconciliation.md)
- [06 — Durable delivery and multi-instance recovery](06-durable-delivery-recovery.md)
- [07 — Authenticated admin management surface](07-admin-management-surface.md)
