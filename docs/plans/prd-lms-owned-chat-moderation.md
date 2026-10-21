# PRD: LMS-Owned Chat Moderation

Status: `ready-for-agent`

## Problem Statement

QuickTricks currently has two disconnected representations of a banned user. The legacy livestream
system stores bans in its own Mongo database and exposes them through unauthenticated moderation
routes. The deployed admin dashboard reads that legacy store, while the production LMS has no deployed
banned-users route. Separately, the APX migration has already mirrored APX blocked users into the
QuickTricks LMS database as active `application` bans in the `bannedusers` collection. Those migrated
records are therefore durable but invisible to the dashboard and unenforced by live chat.

The current language also overstates the policy. Neither scope revokes access to a class or to the
platform. A **Class chat ban** means the user cannot send chat messages in one class. A **Platform chat
ban** means the user cannot send chat messages in any class belonging to the QuickTricks customer.
Both users may still authenticate, purchase content, mint playback and realtime tokens, watch video,
join a room, appear in the roster, read chat history, and receive live chat messages.

The current dashboard mixes incompatible generations of the feature. Its list reads the livestream
store, its create and unblock calls do not match the checked-in livestream routes, class bans omit the
class identifier required by the legacy schema, and the LMS-native hook is unused. A successful-looking
APX migration therefore cannot affect what administrators see or what livestream enforces.

## Solution

Make the LMS the single durable owner of chat-moderation restrictions and treat livestream as the
real-time enforcement plane.

All administrator and host mutations persist through authenticated LMS interfaces. The LMS records
scope, target user, tenant, optional class, provenance, audit data, and active status in one canonical
model. Existing APX-imported `application` bans are interpreted as Platform chat bans without being
copied into the livestream database.

The realtime-token mint continues to authorize room access exactly as it does today, so chat
restrictions never become playback or entitlement failures. A successful viewer ticket additionally
carries the user's current effective chat policy for that class and a policy version. Livestream
verifies the ticket locally and initializes the socket's chat capability from those claims.

When a host changes moderation during a live class, livestream verifies host capability, calls the LMS
through a service-authenticated idempotent mutation, and applies the confirmed result locally. When an
administrator changes moderation in the dashboard, the LMS publishes the same durable moderation
change event. Livestream consumes these events at least once, updates its shared local moderation cache,
updates every affected socket across both livestream instances, and emits a user-facing moderation
event. Every chat-write handler enforces the resulting server-side capability; the UI state is only a
presentation aid.

The admin dashboard returns to the authenticated LMS contract for listing, creating, and removing
restrictions. Class-scoped actions require an explicit class selection. Removal addresses a specific
restriction rather than deleting every restriction for a user. The legacy public livestream listing
and deletion routes, its durable Ban model, and the dashboard's legacy hook are removed after cutover.

## User Stories

1. As a teacher, I want to mute a disruptive viewer in my current class, so that the viewer cannot send further messages in that class.
2. As a teacher, I want a Class chat ban to take effect for the viewer's already-open socket, so that moderation does not depend on a reconnect.
3. As a teacher, I want the ban to be durably persisted before I see success, so that a transient LMS failure cannot produce a UI-only mute.
4. As a teacher, I want repeated ban attempts to be idempotent, so that retries cannot create duplicate active restrictions.
5. As a teacher, I want to remove a Class chat ban, so that the viewer can resume chatting in that class immediately.
6. As a teacher, I want my moderation actions restricted to the class I host, so that a host credential cannot moderate another class.
7. As an administrator, I want to search for a QuickTricks user by name, email, or mobile number, so that I can identify the correct moderation target.
8. As an administrator, I want to select a class before creating a Class chat ban, so that the restriction has an explicit scope.
9. As an administrator, I want the Class chat-ban action disabled until a class is selected, so that the dashboard cannot submit an invalid restriction.
10. As an administrator, I want to create a Platform chat ban, so that a user cannot send chat messages in any QuickTricks class.
11. As an administrator, I want a Platform chat ban to affect all of the user's currently connected class sockets, so that it takes effect immediately everywhere.
12. As an administrator, I want to list all active chat restrictions from the LMS, so that the dashboard reflects the durable source of truth.
13. As an administrator, I want APX-imported restrictions to appear in the same list as administrator-created restrictions, so that there is one management surface.
14. As an administrator, I want to distinguish Class and Platform chat bans in the list, so that I understand the restriction's reach.
15. As an administrator, I want to see the target class for a Class chat ban, so that similarly named restrictions are not ambiguous.
16. As an administrator, I want to see the target user's name and contact snapshot, so that migrated users remain identifiable even if a live user lookup is unavailable.
17. As an administrator, I want to see when and where a restriction originated, so that I can distinguish APX imports, dashboard actions, and in-class host actions.
18. As an administrator, I want to remove one specific restriction without removing the user's other restrictions, so that Class and Platform policy can coexist safely.
19. As an administrator, I want removal to be a soft-delete with an audit trail, so that moderation history is not destroyed.
20. As an administrator, I want list filtering and pagination, so that the feature remains usable as the restriction set grows.
21. As an APX-migrated user with an active APX block, I want that imported state interpreted consistently in QuickTricks, so that migration does not silently discard moderation policy.
22. As an APX-migrated user whose APX block has been removed and synchronized, I want the local restriction deactivated rather than duplicated, so that a later import remains idempotent.
23. As a viewer with no chat restriction, I want to join and chat exactly as before, so that the moderation work does not regress ordinary classes.
24. As a viewer with a Class chat ban, I want to keep watching the affected class, so that moderation is not mistaken for entitlement revocation.
25. As a viewer with a Class chat ban, I want to keep reading public chat and history, so that only my ability to send is restricted.
26. As a viewer with a Class chat ban, I want to remain able to chat in other classes, so that the restriction does not exceed its selected scope.
27. As a viewer with a Platform chat ban, I want to keep watching and joining entitled classes, so that the restriction affects chat only.
28. As a viewer with a Platform chat ban, I want the chat composer to explain that sending is disabled in every class, so that the behavior is understandable.
29. As a viewer whose restriction is removed while connected, I want the chat composer to become available without refreshing, so that the real-time state matches the durable state.
30. As a viewer, I want a rejected message send to produce a typed moderation error, so that the client does not parse fragile message strings.
31. As a viewer, I want private-message sends covered by the same chat restriction, so that I cannot bypass a mute through another message interface.
32. As a viewer, I want poll voting, video playback, roster participation, and chat reading left unchanged, so that unrelated interaction is not accidentally disabled.
33. As a viewer reconnecting after a restriction change, I want the latest LMS policy reflected in my newly minted realtime token, so that missed UI events do not preserve stale permission.
34. As a viewer holding a ticket minted before a new restriction, I want livestream's newer local policy version to override the ticket, so that a pre-ban ticket cannot bypass immediate enforcement.
35. As a viewer holding a ticket minted while restricted and then unmuted, I want a newer unban event to override the ticket, so that I do not remain muted until ticket expiry.
36. As an LMS operator, I want one canonical restriction record per tenant, user, scope, and class, so that two services cannot drift about durable policy.
37. As an LMS operator, I want Platform chat bans scoped to customer 472, so that QuickTricks moderation cannot affect another customer deployment.
38. As an LMS operator, I want moderation changes to produce durable, replayable delivery records, so that a temporary livestream outage does not lose enforcement updates.
39. As a livestream operator, I want moderation events delivered at least once with stable identifiers and versions, so that duplicate delivery is safe.
40. As a livestream operator, I want both livestream instances to share the same current moderation cache, so that a reconnect to a different box cannot bypass a restriction.
41. As a livestream operator, I want a confirmed host mutation applied locally without waiting for event redelivery, so that in-class moderation feels immediate.
42. As a livestream operator, I want the later durable event for that same mutation treated idempotently, so that immediate application and eventual delivery do not double-emit.
43. As a livestream operator, I want cold-start sockets initialized from LMS-minted policy claims, so that an empty local cache does not imply unrestricted chat.
44. As a security engineer, I want only authenticated administrators to list or mutate restrictions through admin interfaces, so that user and moderation data are not public.
45. As a security engineer, I want only an authenticated host for the current class to issue in-class moderation commands, so that viewers cannot mute one another.
46. As a security engineer, I want service-to-LMS writes authenticated with the established per-customer service credential pattern, so that arbitrary callers cannot persist bans.
47. As a security engineer, I want socket identity taken from verified realtime-token claims, so that a user cannot evade a restriction by changing a payload user ID.
48. As a security engineer, I want every chat-write handler to enforce moderation server-side, so that a modified client cannot bypass a hidden or disabled composer.
49. As a security engineer, I want the legacy unauthenticated ban-list and delete routes removed, so that the complete moderation list cannot be downloaded or modified publicly.
50. As a support engineer, I want logs and metrics to identify restriction ID, scope, source, policy version, and delivery result without exposing tokens or unnecessary PII, so that incidents are diagnosable.
51. As a support engineer, I want to distinguish entitlement denial from chat moderation denial, so that users are not incorrectly told they lost class access.
52. As a developer, I want a single chat-policy module to compute effective permission, so that the dashboard, token mint, event producer, and enforcement plane do not encode different precedence rules.
53. As a developer, I want Platform chat bans to take precedence over class-specific state while active, so that a class unban cannot accidentally override a global restriction.
54. As a developer, I want removing a Platform chat ban to leave any active Class chat ban effective, so that restrictions compose correctly.
55. As a developer, I want policy updates to carry monotonic versions, so that out-of-order delivery cannot replace new state with old state.
56. As a developer, I want admin and host mutations to share one LMS implementation behind different authentication adapters, so that validation and audit behavior remain local to one module.
57. As a developer, I want tests to cross the same interfaces used in production, so that they verify behavior rather than private implementation details.
58. As a release operator, I want the LMS route and event producer deployed before the dashboard switches readers, so that the admin table never points at a missing endpoint.
59. As a release operator, I want the livestream event consumer and server-side enforcement deployed before legacy enforcement is removed, so that cutover does not create an unrestricted interval.
60. As a release operator, I want the existing APX-imported rows verified through the production LMS serializer before launch, so that their schema and tenant scope are proven compatible.
61. As a release operator, I want the legacy livestream ban collection confirmed empty or migrated before deletion, so that existing live moderation state is not silently lost.
62. As a future maintainer, I want the terms Class chat ban and Platform chat ban used consistently, so that nobody later treats them as playback or platform-access bans.

## Implementation Decisions

- **Domain meaning is capability-based.** A Chat restriction removes the `chat:send` capability only.
  It does not affect authentication, entitlement, playback minting, realtime-token minting, socket
  admission, roster membership, chat reads, or poll voting. Public and private message sends are both
  chat writes and are covered.
- **Two scopes are canonical.** A Class chat ban applies to one `(customer, user, class)` tuple. A
  Platform chat ban applies to one `(customer, user)` across every class in that customer. The existing
  persisted value `application` is a legacy storage alias for Platform scope; interfaces and UI language
  use `platform` or “Platform chat ban.”
- **The LMS owns durable state.** One canonical LMS moderation module owns validation, persistence,
  effective-policy calculation, audit fields, provenance, soft removal, idempotency, and serialization.
  The existing `BannedUser` data can remain the storage implementation, but callers consume a
  chat-moderation interface rather than inferring access semantics from the model name.
- **Existing APX rows are reused.** Active customer-472 APX-imported `application` rows become Platform
  chat bans in place. Their APX identifier, original block time, source snapshot, matched local user, and
  soft-delete status remain available. The port remains idempotent and may deactivate missing APX rows;
  no second import into livestream Mongo is introduced.
- **Restriction identity is specific.** Create is unique and idempotent by customer, target user, scope,
  and class where applicable. Remove addresses the restriction ID and soft-deactivates only that record;
  it never deletes every restriction for a user.
- **Administrator interfaces are LMS-authenticated.** List/create/remove operations use the deployed
  LMS's administrator authentication and permission system. Listing is paginated, tenant-scoped, and
  searchable. The serializer returns normalized scope, class context, user display snapshot,
  provenance, audit timestamps, and restriction ID without leaking internal delivery state.
- **Host writes use the same LMS implementation.** Livestream exposes no durable ban store. A verified
  host command calls a service-authenticated, class-scoped LMS mutation. The LMS independently validates
  required identifiers and does not trust a client-supplied host identity. The established per-customer
  service credential pattern is reused rather than introducing an admin token on livestream.
- **Persist before success.** A host mutation is acknowledged and broadcast only after the LMS has
  durably committed the restriction and its delivery record. Retriable failures leave the existing chat
  capability unchanged and return a typed failure to the host.
- **Moderation changes are durable domain events.** Every successful activation or removal records a
  versioned ChatModerationChanged event in an LMS-owned outbox. A dispatcher publishes it to a durable
  cross-service stream with at-least-once delivery. Livestream consumes through a consumer group and
  acknowledges only after updating its shared cache. Event identifiers and versions make duplicates
  and out-of-order deliveries safe. Ephemeral Socket.IO pub/sub is not the durable delivery mechanism.
- **Immediate host path and event path converge.** After a successful LMS response, the originating
  livestream instance applies the returned authoritative state immediately and broadcasts it. The
  eventual outbox event passes through the same idempotent apply interface, so it repairs other
  instances without causing duplicate state transitions.
- **Realtime tokens carry chat policy, not an access veto.** Entitled restricted viewers still receive
  ordinary viewer tickets. The ticket adds the effective chat-send decision for that class, the active
  reason scopes, and a monotonic moderation-policy version. Existing identity, role, audience, issuer,
  expiry, and class-scope guarantees remain unchanged.
- **Newer state wins.** Livestream compares the ticket policy version with its shared cached policy.
  The newest authoritative version initializes the socket. Later moderation events update matching
  sockets even when their immutable tickets describe older state. This supports both immediate mute and
  immediate unmute without a forced reconnect.
- **The server enforces every send.** Public-message and private-message handlers check the socket's
  authoritative chat-send capability before accepting or persisting a message. Denial produces a typed
  `CHAT_MUTED`-family response containing normalized scope but no sensitive audit data. Client-side
  disabling is never treated as enforcement.
- **Moderation does not disconnect.** A newly restricted socket stays joined, keeps video and chat-read
  behavior, and receives a moderation-state event. All affected sockets for a Platform chat ban are
  updated; only sockets in the selected class are updated for a Class chat ban.
- **The dashboard becomes an LMS consumer again.** It uses one LMS-backed query/mutation module. User
  search remains LMS-backed. Class scope requires an LMS-backed class selector; no free-form or missing
  class identifier is submitted. The UI presents clear Class/Platform chat-ban language even if the
  legacy route name remains for compatibility.
- **The viewer derives composer state from authoritative moderation state.** Initial state comes from
  the realtime ticket; live changes come from typed socket events. The composer explains whether the
  restriction applies to the current class or all classes. Attempts racing with a new restriction still
  handle the server's typed denial.
- **Host principals are not viewer moderation targets.** Host capability continues to come from a
  class-scoped Streamer token. Viewer chat-restriction records do not downgrade a valid host principal;
  administrator account discipline is handled separately.
- **Legacy ban authority is retired.** The livestream Ban model, public list/check/delete routes, and
  dashboard legacy hook are removed after the cutover gate confirms no unique live records remain. The
  viewer stops making the legacy per-user ban-status request. No dual-write period is retained beyond a
  controlled deployment window.
- **Observability is part of the interface.** Metrics cover create/remove outcomes, effective-policy
  resolution, outbox age, publish retries, consumer lag, duplicate/stale event drops, active socket
  updates, and server-side message denials. Correlation uses restriction/event IDs and policy versions;
  credentials and unnecessary user data are excluded.
- **Deployment follows the production forks.** LMS and admin work lands in the deployed
  `quicktricks-backend` and `quicktricks-admin` lines. The APX migration implementation currently living
  in the separate QuickTricks-oriented node checkout is source material, not a production endpoint.
  Cross-repo delivery includes livestream and `ls` on coordinated compatible versions.

## Testing Decisions

- A good test asserts externally observable behavior through the same interface used by production:
  HTTP status and response shape, minted ticket claims, durable event contents, socket events, accepted
  or rejected messages, and visible UI state. Tests do not assert private helper call order, internal
  collection access, or React implementation details.
- **LMS moderation HTTP seam:** integration tests cover authenticated list/create/remove, missing or
  invalid authentication, tenant isolation, class-required validation, Platform scope without class,
  idempotent duplicates, coexistence of Class and Platform restrictions, restriction-specific removal,
  soft-delete audit data, pagination, search, and APX-imported serialization.
- **Effective-policy module:** table-driven tests cover no restriction, Class-only, Platform-only, both
  scopes, removing either scope, stale versions, unmatched classes, and customer isolation. This module
  is the only tested source of policy precedence.
- **Realtime-token mint seam:** controller tests prove that restricted entitled users still receive 200
  viewer tickets; playback/realtime entitlement results do not change; chat policy, reasons, and version
  are correct; host issuance remains unchanged; and responses remain non-cacheable. Prior art is the
  existing realtime-token controller and ticket-claim suite.
- **Host-to-LMS adapter:** contract tests prove the correct class/user/scope mutation, service
  authentication, idempotency key, typed 4xx handling, retriable failure handling, and authoritative
  policy response. Prior art is the existing livestream class-client contract suite.
- **Outbox and durable-delivery seam:** tests prove one durable event per committed logical change,
  retry after publish failure, at-least-once duplicate tolerance, monotonic versions, out-of-order stale
  rejection, consumer restart recovery, and no acknowledgement before the shared cache update.
- **Livestream socket seam:** handler-path tests use authenticated host and viewer sockets. They prove
  unauthorized moderation commands do nothing; host success persists before broadcast; Class updates
  affect only the selected room; Platform updates affect all of the user's sockets; duplicate events do
  not double-broadcast; and users are never disconnected solely for moderation.
- **Chat-write enforcement seam:** real public and private message handlers accept unrestricted sends
  and reject restricted sends with typed errors while history reads, roster reads, playback, joins, and
  poll votes remain unchanged. Prior art is the existing socket identity/authz handler-path suite.
- **Ticket/cache reconciliation:** tests cover a ticket older than a ban event, a ticket older than an
  unban event, an event older than the ticket, empty-cache cold start, reconnect on another livestream
  instance, and simultaneous Class plus Platform reasons.
- **Admin dashboard seam:** query/mutation tests prove the LMS URL and admin authorization are used.
  UI tests cover user search, required class selection, normalized labels, imported-row rendering,
  targeted removal, loading/error/empty states, pagination, and permission gating.
- **Viewer UI seam:** tests prove initial restricted state from ticket policy, live mute/unmute updates,
  explanatory composer state, typed send-race denial, continued chat rendering, and unchanged video and
  room views. Prior art is the existing connection-state-machine and realtime-token client suite.
- **Cross-repo acceptance:** seed an APX-imported Platform restriction and an administrator-created
  Class restriction. Verify both appear in the dashboard; the restricted viewer can mint playback and
  realtime tokens and watch; Class scope blocks sends only in that class; Platform scope blocks sends
  in multiple classes; host and admin changes update an already-connected viewer; removing one scope
  preserves the other; removing the final scope restores sending without refresh.
- **Failure acceptance:** take livestream delivery temporarily offline during an admin mutation and
  verify the durable event is delivered after recovery. Take the LMS temporarily offline during a host
  mutation and verify no success/broadcast occurs, the host receives a typed failure, and retry produces
  exactly one active restriction.
- **Security regression:** prove the retired public list/delete/check routes are absent, viewer sockets
  cannot issue host moderation commands, payload user IDs cannot bypass claim identity, and logs contain
  no tickets, service secrets, or full moderation-list payloads.
- **Cutover check:** before deletion, compare the legacy livestream collection with LMS active
  restrictions. Production's currently observed empty legacy result is rechecked at deployment time;
  any unique records found then are explicitly ported or dispositioned before retirement.

## Out of Scope

- Revoking login, purchases, enrollment, class entitlement, playback access, realtime-token issuance,
  socket admission, or roster visibility.
- Preventing a restricted viewer from reading live chat or chat history.
- Disabling poll voting, reactions, video controls, downloads, or other non-message interactions.
- Timed mutes, automatic expiry, strike counts, word filters, slow mode, rate limits, or automated
  moderation.
- A general multi-tenant event platform. The durable moderation stream is scoped to the real
  QuickTricks producer and livestream consumer, while preserving tenant identifiers in its interface.
- Reworking the APX blocked-list capture process beyond consuming its already-mirrored records and
  preserving its existing idempotent deactivate behavior.
- Displaying internal moderator identity, reason, or APX provenance to the restricted viewer.
- Building a complete moderation-history/audit-log UI; audit fields and soft-deleted records are kept
  so that UI can be added later.
- Moderating valid host principals through viewer chat-ban records.
- Retaining the legacy livestream Mongo Ban collection as a second source of truth.

## Further Notes

- The governing system rule remains: the LMS owns durable policy and livestream owns real-time socket
  behavior. This feature does not make the LMS a per-message dependency. LMS contact occurs during
  mutations and realtime-token minting; established socket message checks remain local.
- “Platform” means the QuickTricks customer deployment, not every customer served by the broader
  Hranker system.
- The durable event path is required because administrator-originated changes do not begin on a
  livestream socket. A best-effort socket broadcast alone would leave already-connected users with
  stale server-side capability after a process restart or delivery failure.
- The moderation-policy version is an ordering and reconciliation mechanism, not a replacement for
  realtime-token expiry or authentication revocation.
- Rollout order is LMS persistence/interfaces and event producer; livestream consumer/enforcement;
  realtime-ticket claim and viewer handling; admin reader/mutations; acceptance run; then legacy route,
  model, and hook deletion.
- The legacy public moderation routes are already identified as a security exposure in the QuickTricks
  security preflight. Their removal is part of completion, not optional cleanup.
- After this PRD is accepted, issue decomposition should use tracer-bullet vertical slices: first make
  one existing APX Platform restriction visible and enforceable end to end, then add live mutation and
  removal, then retire the legacy store.
