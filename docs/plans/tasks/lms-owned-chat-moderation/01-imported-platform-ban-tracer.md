# 01 — Make one imported Platform chat ban visible and enforceable end to end

Type: AFK  
Status: `ready-for-agent`  
User stories: 13–17, 21, 23, 27–28, 33, 36–37, 43, 51–52, 60, 62

## Parent

[PRD: LMS-Owned Chat Moderation](../../prd-lms-owned-chat-moderation.md)

## What to build

Deliver the thinnest complete path for an existing active APX-imported restriction. The deployed LMS
must interpret the stored `application` value as a Platform chat ban, expose it through an authenticated
administrator list, compute the viewer's effective chat policy during realtime-token minting, and put
that policy plus its version into the viewer ticket. Livestream must initialize socket chat capability
from the verified ticket and reject public and private message sends server-side. The admin must display
the imported restriction, and the viewer must show a disabled composer while retaining room, playback,
roster, poll, and chat-read behavior.

This slice establishes the canonical policy interface and vocabulary. It does not yet create or remove
restrictions or deliver live policy changes to an already-connected socket.

## Acceptance criteria

- [ ] An active customer-472 APX-imported restriction appears in the authenticated admin list with normalized Platform chat-ban language, user snapshot, source, original APX block time, and stable restriction ID.
- [ ] The admin list cannot be read without valid administrator authentication and never returns records from another customer.
- [ ] Effective policy resolves `application` storage values as Platform scope without copying a record into livestream Mongo.
- [ ] An entitled restricted viewer still receives successful playback and realtime-token mints and can join the room.
- [ ] The realtime ticket contains the effective chat-send decision, active reason scope, and monotonic policy version while preserving the existing identity, role, class, issuer, audience, algorithm, and expiry guarantees.
- [ ] Livestream trusts policy only from a verified ticket and never from a payload user ID.
- [ ] The real public-message and private-message handler paths reject sends with a typed chat-moderation error and persist or broadcast nothing.
- [ ] The same viewer can still read chat/history, appear in the roster, vote in polls, and watch video.
- [ ] An unrestricted viewer's behavior remains unchanged.
- [ ] The viewer composer is disabled with Platform-scope explanatory copy, but the room view is not replaced by an access-denied screen.
- [ ] Controller, ticket, socket-handler, admin-rendering, and viewer-state tests exercise the production interfaces rather than private helpers.

## Blocked by

None - can start immediately.
