# 04 — Persist host Class mute and unmute actions through the LMS

Type: AFK  
Status: `ready-for-agent`  
User stories: 1–6, 41–42, 45–47

## Parent

[PRD: LMS-Owned Chat Moderation](../../prd-lms-owned-chat-moderation.md)

## What to build

Replace the host moderation command's livestream-Mongo write with the canonical LMS mutation. A
verified host may mute or unmute a viewer only in the class named by the host's verified principal.
Livestream calls the service-authenticated LMS interface with an idempotency key, waits for durable
success, applies the returned policy immediately to local sockets, and emits the viewer/host outcomes.
The LMS's eventual durable event repairs every other instance through the same idempotent apply
interface.

## Acceptance criteria

- [ ] Only a verified host principal can issue the host mute/unmute command; anonymous and viewer principals receive typed denial and cause no write or broadcast.
- [ ] The host can act only on the class in the verified host claim; payload room, user, or role fields cannot expand authority.
- [ ] The target identity comes from the authenticated room roster/verified viewer identity rather than an impersonable display payload.
- [ ] Livestream sends an authenticated, class-scoped, idempotent LMS mutation and does not write the legacy Ban collection.
- [ ] Success is emitted only after the LMS confirms durable restriction and delivery-record persistence.
- [ ] A timeout, network failure, or retriable LMS response leaves chat capability unchanged and returns a typed host-facing failure.
- [ ] Successful mute immediately updates the target's active socket and denies public/private sends without disconnecting or affecting video/read behavior.
- [ ] Successful unmute immediately restores sending when no Platform or other applicable restriction remains.
- [ ] The later durable event updates other instances but does not double-emit or regress the originating instance.
- [ ] Repeating a host command or retry after an uncertain response creates one logical restriction and one effective policy transition.
- [ ] Handler-path and service-adapter tests cover authorization, class scope, persistence-before-publish, failure behavior, and eventual repair.

## Blocked by

- [02 — Admin Class chat ban with live enforcement](02-admin-class-ban-live-enforcement.md)
