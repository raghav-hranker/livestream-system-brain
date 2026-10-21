# 03 — Create a Platform chat ban and fan it out across active classes

Type: AFK  
Status: `ready-for-agent`  
User stories: 10–11, 27–29, 32, 37, 40

## Parent

[PRD: LMS-Owned Chat Moderation](../../prd-lms-owned-chat-moderation.md)

## What to build

Extend the administrator mutation path to Platform scope. A Platform chat ban has no class selection
and applies to every active viewer socket for the target user within QuickTricks customer 472. The LMS
persists and publishes one customer-scoped authoritative change; livestream fans that state out across
rooms and instances. Removing the restriction reverses the same live state without granting access to
another tenant or disturbing unrelated viewer capabilities.

## Acceptance criteria

- [ ] The admin can select Platform scope without supplying a class, and the LMS rejects a conflicting or malformed class-scoped payload.
- [ ] Create is authenticated, tenant-scoped, audited, idempotent, and returns normalized Platform scope even if storage uses the legacy `application` value.
- [ ] One successful change updates every currently connected socket belonging to the target viewer across multiple classes and both livestream instances.
- [ ] No socket belonging to another viewer or customer changes state.
- [ ] Public and private message sends are rejected in every class while playback, join, roster, history, chat reads, and poll votes remain available.
- [ ] The viewer composer in each active class displays Platform-scope explanatory state without showing a class-access error.
- [ ] A fresh realtime token minted for any class reflects the active Platform restriction.
- [ ] Removing the restriction publishes a newer state and restores active sockets when no Class restriction applies.
- [ ] Replayed delivery remains idempotent across all affected rooms.
- [ ] Multi-room and multi-instance integration tests prove fanout and tenant isolation through real socket handler paths.

## Blocked by

- [02 — Admin Class chat ban with live enforcement](02-admin-class-ban-live-enforcement.md)
