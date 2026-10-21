# 06 — Recover moderation delivery across outages and livestream instances

Type: AFK  
Status: `ready-for-agent`  
User stories: 38–43, 50, 55, 57

## Parent

[PRD: LMS-Owned Chat Moderation](../../prd-lms-owned-chat-moderation.md)

## What to build

Make the moderation event path operationally durable. The LMS outbox must survive process restarts and
publish versioned changes at least once to a durable cross-service stream. Livestream must consume with
recoverable ownership, update shared policy before acknowledging, safely replay pending events, reject
stale versions, and reconcile sockets across both production instances. Add the observability required
to distinguish producer backlog, delivery failure, consumer lag, stale/duplicate drops, and enforcement
denials without logging credentials or unnecessary PII.

## Acceptance criteria

- [ ] A successful moderation mutation always leaves a durable outbox record, including when the publisher is unavailable.
- [ ] Publisher restart retries pending work and marks delivery only after the durable stream accepts the event.
- [ ] Events carry stable event/restriction IDs, tenant, target user, normalized scope, optional class, active state, and monotonic policy version.
- [ ] Livestream acknowledges only after its shared moderation cache has applied the event.
- [ ] Consumer restart reclaims pending work and converges without duplicate user-visible transitions.
- [ ] Duplicate events are idempotent and lower-version events are recorded as stale without changing policy.
- [ ] Both livestream instances observe the same state; a reconnect or socket-box failover cannot bypass or prolong a restriction.
- [ ] Admin-originated changes made while livestream is unavailable update connected/reconnected viewers after recovery without another admin action.
- [ ] Host-originated immediate state remains correct while the eventual durable event repairs the non-originating instance.
- [ ] Metrics expose outbox age/backlog, publish retries, consumer lag/pending work, apply outcomes, stale/duplicate drops, socket updates, and send denials.
- [ ] Logs correlate by event/restriction/version while excluding tokens, service secrets, and full user snapshots.
- [ ] Deterministic failure tests cover LMS publisher outage, livestream consumer outage, process restart, duplicate delivery, out-of-order delivery, and two-instance failover.

## Blocked by

- [05 — Overlapping-scope composition and reconciliation](05-overlapping-scope-reconciliation.md)
