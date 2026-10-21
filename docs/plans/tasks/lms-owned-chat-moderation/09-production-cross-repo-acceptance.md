# 09 — Run the production cross-repo chat-moderation acceptance

Type: HITL  
Status: `ready-for-human`  
User stories: Production acceptance for the full PRD

## Parent

[PRD: LMS-Owned Chat Moderation](../../prd-lms-owned-chat-moderation.md)

## What to build

Coordinate and execute the production acceptance across the deployed QuickTricks LMS/admin forks,
both livestream instances, shared durable moderation delivery, and the `ls` viewer. This is a human-led
deployment and evidence-capture issue, not a place to add unreviewed feature behavior. Exercise an
existing APX-imported Platform restriction, new admin Class and Platform restrictions, host mute/unmute,
overlapping scopes, active sockets, reconnect/failover, dependency outages, and legacy-route removal.
Capture sanitized evidence and rollback points for every stage.

## Acceptance criteria

- [ ] Before deployment, all participating repositories and production commits are recorded, compatible configuration is validated, and rollback versions are identified.
- [ ] The production LMS returns an APX-imported Platform chat ban through the authenticated admin interface with correct customer, identity snapshot, source, and normalized scope.
- [ ] The imported viewer can authenticate, mint playback/realtime credentials, join, watch, read chat, appear in the roster, and vote while public/private sends are denied.
- [ ] An administrator-created Class chat ban affects an already-connected viewer only in the selected class and unban restores sending without refresh.
- [ ] An administrator-created Platform chat ban updates all of the target user's active classes and leaves unrelated viewers unchanged.
- [ ] A verified host can mute/unmute a viewer in the hosted class; a viewer or wrong-class host cannot perform the action.
- [ ] Overlapping Platform and Class restrictions preserve the remaining scope when either specific record is removed.
- [ ] A pre-change ticket cannot bypass a newer ban, and a pre-unban ticket does not prolong a removed restriction.
- [ ] Reconnect to the other livestream instance preserves current policy.
- [ ] A controlled LMS outage during host mutation produces no false success or local-only mute; retry converges to one logical restriction.
- [ ] A controlled moderation-delivery outage during admin mutation retains the outbox event and applies it after recovery.
- [ ] Monitoring shows bounded outbox age/consumer lag and expected apply/denial metrics without secrets or unnecessary PII.
- [ ] Legacy livestream moderation routes expose no list/check/delete capability, and no production client calls them.
- [ ] The admin table, viewer composer, host feedback, and typed denial messages use Class/Platform chat-ban language rather than access-ban language.
- [ ] Sanitized evidence, observed timings, anomalies, rollback decisions, and final production commit set are appended to this issue before it is marked complete.

## Blocked by

- [08 — Legacy ban-authority retirement](08-retire-legacy-ban-authority.md)
