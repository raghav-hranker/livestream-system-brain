# iOS never gets the offer

**Type**: AFK
**Blocked by**: 01 — Automatic extension offer, end to end, behind the switch

## What to build

Design record D9. An Apple IAP purchase must never be an Extension order: it resolves offers with
platform = iOS, so it grants the plan's normal `duration` and carries no extension marks — fixing
today's bug where an eligible iOS buyer pays the full App Store tier for the extension's shorter
validity. (The Upgrade half is unaffected: it already grants the target's normal duration.)

Also establish whether plan listing requests identify iOS (a header, param or user-agent the
installed app already sends — no app change allowed). If they do, pass the platform into listing
resolution so iOS listings show list values and `is_expire: 0`. If they don't, record that finding
in this file and leave listings unchanged (an iOS user who buys anyway receives the normal duration).

## Acceptance criteria

- [ ] Integration: a lapsed holder completing the Apple IAP path gets an order with the plan's
      normal duration and no `isExtensionOrder` / `extendsOrderId`, with the switch on.
- [ ] Policy unit test: platform iOS ⇒ no offer.
- [ ] Finding recorded here: which request signal (if any) identifies iOS on the plan listings,
      with evidence (code path or captured request).
- [ ] If a signal exists: integration test that an iOS-identified listing shows list values and
      `is_expire: 0` for a lapsed holder, while the same request without it shows the offer.

## User stories covered

- Story 22: Apple purchase always gives the full normal validity
- Story 23: iOS users not shown a price they cannot get (best effort)
