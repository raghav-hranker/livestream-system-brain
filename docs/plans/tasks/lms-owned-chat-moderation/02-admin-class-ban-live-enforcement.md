# 02 — Create a Class chat ban from admin and update an active viewer

Type: AFK  
Status: `ready-for-agent`  
User stories: 7–9, 12, 15, 18–20, 24–26, 29–30, 44, 48, 56

## Parent

[PRD: LMS-Owned Chat Moderation](../../prd-lms-owned-chat-moderation.md)

## What to build

Add the first complete mutation path. An administrator searches for a user, explicitly selects a class,
and creates or removes a Class chat ban through the LMS. The LMS uses the same canonical moderation
module established by issue 01, persists an audited restriction idempotently, records a versioned
moderation-change delivery, and returns authoritative policy. Livestream consumes the change, updates
the shared policy for the affected user and class, enforces it on an already-connected socket, and emits
a typed update that changes the viewer composer without disconnecting the viewer.

Removal targets the created restriction ID and restores chat immediately when no other applicable
restriction remains. Overlapping Class and Platform precedence is completed in issue 05.

## Acceptance criteria

- [ ] The admin user search and class selector use LMS data, and Class scope cannot be submitted without a valid selected class.
- [ ] Create is authenticated, customer-scoped, audited, and idempotent for the same user, class, and scope.
- [ ] The LMS persists the restriction and a versioned delivery record before returning success.
- [ ] An LMS failure produces an admin error and no viewer mute event or local enforcement change.
- [ ] A successful change reaches livestream and updates a viewer already connected to the selected class without requiring reconnect or refresh.
- [ ] The viewer remains connected and can watch, read chat/history, appear in the roster, and vote while public and private sends are rejected server-side.
- [ ] The same user remains able to send messages in another class.
- [ ] The viewer receives a typed Class-scope moderation update and the composer explains that only the current class is affected.
- [ ] Removing the restriction by ID soft-deactivates that record, records remover/time audit data, publishes a newer policy version, and restores sending for the active socket.
- [ ] Repeating create or delivery is safe and does not duplicate active rows, messages, or UI transitions.
- [ ] Integration tests cover admin authorization, validation, persistence, live application, targeted removal, and preservation of non-chat behavior.

## Blocked by

- [01 — Imported Platform chat ban tracer bullet](01-imported-platform-ban-tracer.md)
