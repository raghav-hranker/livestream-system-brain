# 05 — Compose overlapping Class and Platform restrictions correctly

Type: AFK  
Status: `ready-for-agent`  
User stories: 18, 29, 34–35, 52–55

## Parent

[PRD: LMS-Owned Chat Moderation](../../prd-lms-owned-chat-moderation.md)

## What to build

Complete policy composition and version reconciliation for viewers who have both Platform and Class
chat bans or whose immutable ticket predates a live change. The LMS remains the sole calculator of
effective policy and assigns a monotonic per-user moderation version. Tickets describe the effective
reasons at mint time; livestream combines that baseline with newer authoritative events, always choosing
the newest version. Removing one restriction never removes the effect of another active restriction.

## Acceptance criteria

- [ ] The canonical LMS policy module returns allowed, Class-only, Platform-only, and combined reason states correctly for a requested class.
- [ ] Platform scope takes precedence across classes while active, without deleting or rewriting Class restrictions.
- [ ] Removing a Platform restriction leaves a matching active Class restriction effective in that class and restores other classes.
- [ ] Removing a Class restriction leaves an active Platform restriction effective everywhere.
- [ ] Removal always targets one restriction ID and soft-deactivates no sibling record.
- [ ] Every logical mutation increments a monotonic moderation version used by the serializer, ticket, event, and cache.
- [ ] A newer ban event overrides an older unrestricted ticket immediately.
- [ ] A newer unban event overrides an older restricted ticket immediately without waiting for ticket expiry.
- [ ] An older or duplicated event cannot replace newer ticket/cache state or re-disable a newly unmuted viewer.
- [ ] Reconnecting to another livestream instance produces the same effective policy.
- [ ] Table-driven LMS policy tests and cross-socket reconciliation tests cover all scope/removal/version combinations.

## Blocked by

- [03 — Admin Platform chat ban fanout](03-admin-platform-ban-fanout.md)
- [04 — Host Class moderation through LMS](04-host-class-moderation-through-lms.md)
