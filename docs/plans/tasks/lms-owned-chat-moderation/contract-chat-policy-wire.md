# Chat-moderation wire contract (pinned for task 01, reused by 02–09)

Status: `in-progress` — pinned 2026-08-21 before the task-01 implementation legs; any later change must
update every consumer in the same slice.

Parent: [PRD: LMS-Owned Chat Moderation](../../prd-lms-owned-chat-moderation.md) ·
[Issue index](./README.md)

## 1. Realtime-ticket `chat` claim (LMS → livestream → ls)

Added to the existing realtime ticket payload (`{ userId, classId, role, name, jti, iss:'lms',
aud:'livestream-socket', iat, exp }` — all unchanged). Optional: tickets minted by an older LMS have no
claim, and every verifier treats *absent or malformed* as **default-allow** (`canSend:true, reasons:[],
v:0`) — the claim is additive capability data, never a credential gate.

```jsonc
"chat": {
  "canSend": false,            // effective chat-send decision for THIS class
  "reasons": ["platform"],     // active scopes, subset of ["platform","class"], platform first
  "v": 1755772800000           // monotonic moderation-policy version (see §3)
}
```

- Hosts always mint `{ canSend: true, reasons: [], v: 0 }` — host principals are not viewer moderation
  targets.
- Storage value `application` (legacy alias in `bannedusers.banType`) is translated to `platform` at
  every interface; the literal `application` never appears in reasons.

## 2. Typed denial: `CHAT_MUTED`

A restricted send is rejected server-side by livestream on the real `userMsg`/`privateMsg` handler
paths. The denial follows the existing `deny()` dual-channel shape (per-event channel + `authzError`):

```jsonc
// emitted on BOTH  'userMsgError' | 'privateMsgError'  AND  'authzError'
{ "code": "CHAT_MUTED", "event": "userMsg", "message": "…", "reasons": ["platform"] }
```

No restriction ids, audit data, or moderator identity in the payload. Nothing is persisted or
broadcast on denial; the socket is never disconnected; joins, reads, roster, and polls are unaffected.

## 3. Policy version

`v` = max `updatedAt` (epoch ms) across **all** of the user's relevant `bannedusers` rows for
`(customer_id, user, scope-matching-class)` — including soft-deleted rows, so an unban bumps the
version; `0` when no rows exist. Mongoose `{timestamps:true}` makes this monotonic per tuple without
new counter infra. Later tasks (events, cache reconciliation) reuse the same derivation:
newest version wins between ticket and cache.

## 4. Effective-policy module (single precedence owner)

`quicktricks-backend src/services/chatModerationPolicy.ts` — the ONLY place precedence lives
(PRD story 52). `computeChatPolicy(docs, classId)` pure + `getEffectiveChatPolicy({userId, classId,
customerId=472})`. Relevance: `banType:'application'` → `platform`; `banType:'class' && doc.classId ===
classId` → `class`. `canSend` = no active (status 1) relevant row. User matching:
`$or: [{userId}, {userObjectId}]` (APX rows carry `userObjectId` when matched, `userId:'apx:NNNN'` when
not).

## 5. Admin list route (LMS → dashboard)

`GET /api/admin/banned-users` behind `requireAdmin` (mounted in `app.ts`; GET only in task 01).
Query: `page` (≥1), `limit` (1–100), `search` (regex over userId/apxUserId/classId/snapshot
name/email), `banType`, `source`. Filter always `{ customer_id: 472, status: 1 }`.

Envelope: `{ state: 200, msg: 'Banned users fetched', data: { bans, totalPages, currentPage,
totalResults } }` — matches the dashboard's pre-existing orphan hook `hooks/api/use-banned-users.ts`.

Ban DTO: `{ id, userId, apxUserId, classId, name, banType, scope, source, email, mobile, reason,
apxBlockedAt, createdBy, createdAt, updatedAt }` — `banType` keeps the storage alias
(`class|application`) for wire compat; `scope` is the normalized vocabulary (`class|platform`); UI
labels come from `scope` ("Class chat ban" / "Platform chat ban").

## 6. Socket-side capability state

`socket.chatPolicy = { canSend, reasons, version }` — a **mutable copy** of the frozen
`principal.chatPolicy`, initialized at the handshake on all three admission branches (ticket, legacy
Streamer, anonymous). Later slices update it live from moderation events and compare versions
(newest wins). Enforcement reads only `socket.chatPolicy`; hosts (`principal.kind === 'host'`) bypass.

> **Flip dependency (review finding, 2026-08-21):** while `REALTIME_AUTH_REQUIRED=false` (the deployed
> state per task 19b B5 — flip step 6 still pending), dual-accept admits token-less sockets as
> anonymous with default-allow policy, so a muted viewer can strip `?token=` and keep chatting.
> CHAT_MUTED has real enforcement value only once the flag is `true`. Livestream meters allowed sends
> from anonymous sockets (`socket_chat_send_unverified`) so the pre-flip hole is visible. The flip must
> land before (or with) task 02's live-mutation legs — factor it into the task-08/09 cutover gates.

## Task-02 additions (pinned 2026-08-21)

**Transport decision:** Redis Streams. Both sides already share Redis infra (livestream: PubSubManager +
`INSTANCE_ID`; LMS fork: ioredis + `src/config/redis.ts`); the PRD's "consumer group" language maps to
XREADGROUP; amqp would add a new dependency to livestream. Deployment constraint: LMS dispatcher and
livestream consumer must point at the SAME Redis instance (env alignment, like `REALTIME_TOKEN_SECRET`).

### ChatModerationChanged event
Stream key `chatmod:events:quicktricks` (tenant key via `customerRegistry`). XADD entry: single field
`event` = JSON:
```jsonc
{ "eventId": "...", "type": "ChatModerationChanged", "customerId": 472,
  "userId": "...", "classId": "..."|null, "scope": "class"|"platform",
  "action": "activated"|"removed", "restrictionId": "...",
  "policyVersion": 1755772800000, "occurredAt": "ISO" }
```
`policyVersion` = the restriction doc's `updatedAt` ms — same derivation as the ticket `v`.

### LMS outbox + dispatcher
`ChatModerationOutbox` model: event fields + `status: 'pending'|'published'`, `attempts`,
`publishedAt`. The mutation writes restriction THEN outbox and returns success only after both
(no multi-doc transaction assumed); idempotent create-hit runs `ensureOutboxForRestriction`
(upsert by restrictionId+policyVersion) so a crash between the two writes is repaired by retry.
Dispatcher: interval loop, oldest-first pending rows → XADD → mark published (at-least-once; consumer
dedupes by version compare).

### LMS admin mutations
- `POST /api/admin/banned-users` (requireAdmin) `{ userId, banType, classId (required for class),
  reason? }` → 201 + ban DTO; idempotent duplicate → **200** with the existing DTO (not 409 — the
  dashboard hook throws on !ok and retries must read as success).
- `DELETE /api/admin/banned-users/:id` (requireAdmin) → soft-deactivate THAT id (+removedBy/At),
  outbox `removed` event, 200 + DTO.

### Livestream consumer + shared cache
Consumer group `livestream` (consumer name = `INSTANCE_ID`), XREADGROUP loop + XAUTOCLAIM recovery on
boot. Per event: (1) update shared cache — Redis hash `chatmod:policy:<userId>`, fields `platform` and
`class:<classId>`, each JSON `{active, version}`, applied only when `event.policyVersion` > stored
version; (2) XACK only after the cache write; (3) publish ephemeral relay `chatmod:apply` on the
existing pub/sub so BOTH instances update their local sockets (scope-set apply: add/remove the scope in
`socket.chatPolicy.reasons`, `canSend = reasons.length===0`, `version = max`), each updated socket gets
`chatModerationUpdate` `{ canSend, reasons, scope, action, version }`.
Join-time reconciliation (PRD 43 / story 34): joinRoom overlays the shared cache over the ticket policy
when the cache version is newer (one HGET pair, fire-and-forget like the privateMode bootstrap).
Send-time stays local to `socket.chatPolicy` — no per-message Redis policy read; restarted instances
drop sockets, and reconnects re-mint fresh tickets.

### ls viewer
New socket event `chatModerationUpdate` handled at connection scope (useSocket): maintains a live
policy `{canSend, reasons, version}` that overrides the ticket policy when newer — supports live
unmute (the CHAT_MUTED latch remains the race fallback and clears when a newer allow update arrives).

## Task-03/04 additions (pinned 2026-08-21)

**Task 03 (platform fanout)** is mostly proven by task-02's scope-generic machinery; the deltas are:
LMS rejects a `classId` supplied with an `application`-scope create (400 — conflicting payload), and
multi-room / multi-instance / tenant-isolation fanout tests through the real socket handler paths.

**Task 04 (host moderation through the LMS):**
- **Host mutation endpoint** (service-authenticated, same credential as the other service→LMS writes):
  `POST /api/classes/:classId/chat-moderation` + `X-Transcoder-Secret`, body
  `{ targetUserId, action: 'mute'|'unmute', requestedBy: { userId, name? } }` →
  `200 { state, msg, data: { restriction: DTO|null, policy: { canSend, reasons, v } } }` where `policy`
  is the target's effective policy for that class AFTER the mutation. `mute` = idempotent class-scope
  create (`source: 'host'`, `createdBy: 'host:<requestedBy.userId>'`); `unmute` = deactivate the active
  class restriction for `(user, class)` by scope (idempotent — none active → 200 with current policy,
  no event). Outbox rules identical to the admin path, repair paths included. Host scope is CLASS ONLY —
  hosts cannot create platform bans (admin dashboard owns those).
- **Livestream socket contract:** `banUser` (host-only, class = verified `principal.classId`, target =
  payload `userId` as the moderation key) now calls the LMS endpoint and waits for durable success —
  the legacy `Ban` collection write is deleted from the handler (model/routes survive until task 08).
  On success: synthesize `{scope:'class', action, version: policy.v}` through the SAME
  `applyScopeToSocketPolicy` interface for the target's local sockets (so the eventual outbox event is
  a version-gated no-op — no double transition), emit `chatModerationUpdate` to the target, keep the
  legacy room `userBanned` emit for compat, ack the host with `banUserSuccess { userId, action }`.
  On failure/timeout: typed `banUserError` (+`authzError` mirror), capability unchanged. New mirror
  event `unbanUser`.
- **ls host UI:** MessageDropdown's class/application ban options become class-scoped
  "Mute in this class" / "Unmute" (`banUser`/`unbanUser` `{ roomId, userId }`); host surfaces the typed
  `banUserError`. Viewer side needs nothing new (chatModerationUpdate already handled).

## Deploy runbook for task 09 (written 2026-08-22, all AFK tasks complete)

Per-repo branch stacks (each `-NN` contains its predecessors; merge the highest you want to ship):
- quicktricks-backend: `sandcastle/chatmod-task-01..08` (08 head = `57fa2f13`)
- livestream (`repos/livestream`): `-01..06, -08` (08 head = `e3c7f87`; no 07 leg)
- ls: `-01, -02, -04, -05, -08` (08 head = `60bee526`; no 03/06/07 legs)
- quicktricks-admin: `-01, -02, -07, -08` (08 head = `2c94738`; no 03–06 legs)

**Order** (PRD rollout + review findings):
1. **LMS first** (merge into `quicktricks-admin` line, deploy test-uday pm2 `quicktricks-backend`).
   Includes the CRITICAL `PUT /api/admins/:id` privilege-escalation fix — deploy urgency independent
   of the feature. Boot runs `syncIndexes` for BannedUser/outbox (handles the changed partial index).
   New env: Redis for the dispatcher (`REDIS_HOST`/`REDIS_URL` — the dedicated client parses URL) —
   must be the SAME Redis livestream uses.
2. **livestream** (merge to `launch/quicktricks-v2`, deploy). Consumer env-gated; kill switch
   `CHATMOD_CONSUMER_ENABLED=false`; optional `CHATMOD_STREAM_KEY` override.
3. **ls** (Vercel) then **quicktricks-admin** (Vercel).
4. **Flip `REALTIME_AUTH_REQUIRED=true`** on livestream (task 19b step 6) — without it, moderation has
   no teeth for token-less sockets (metered via `socket_chat_send_unverified`).
5. Acceptance run (task 09), staged if desired: merge through `-07` (LMS/admin), `-06` (livestream),
   `-05` (ls) first, verify, then merge `-08` everywhere for legacy retirement.
6. Before/with the `-08` deploy: run `backend/scripts/chatModerationCutoverReport.js` (read-only; set
   `DB_URI` explicitly, `CHATMOD_LMS_CUSTOMER_ID=472`; exit 0 = clear, 1 = UNIQUE rows need
   disposition, 2 = script failure; NON-PRINCIPAL junk rows don't gate).
   **Heads-up for the client team:** the LMS route `POST /api/v1/user` (legacy ban-check proxy, added
   by them in May 2026) is deleted in LMS `-08`; any out-of-repo caller (possibly the mobile app) will
   404 by design. **2026-09-05:** the legacy body shape is back as an authenticated LMS read,
   `GET|POST /api/users/me/chat-bans` (token = principal, `bannedusers` rows via the policy module);
   local fork commit 35934a2a; **DEPLOYED 2026-09-05** to test-uday as acf5d918d via `git am` on the box
   (box history = client origin 5945e2f9 + IAP merge + builds; not on any remote), pm2 restarted, prod probe 401-not-404.

## Security findings surfaced by the task-07 review (2026-08-22)

- **CRITICAL, pre-existing, live in production:** `PUT /api/admins/:id` on the deployed LMS accepts a
  bare `authenticateToken` (any logged-in user, students included) and spreads the request body into
  `findByIdAndUpdate` with no field allow-list — one request self-grants `role:'admin'` or any
  permissions blob. Fixed on `sandcastle/chatmod-task-07` (requireAdmin + privileged-field stripping +
  customer scope), but **the hole exists in prod until that branch deploys** — factor into deploy
  urgency. Also fixed there: soft-deleted (status 0) admins retained access until JWT expiry; the
  permission middleware's Admin lookup lacked the tenant filter.
- **Recorded follow-up (not in this slice):** verb-level role capability (only role `admin` may delete,
  reviewer may not add) is still client-only — a `sub_admin` holding the `banned-users` screen can
  DELETE via the API though their UI hides the button. Needs a repo-wide `requireRoleCapability`
  middleware pass.
- Policy-version granularity is milliseconds (`updatedAt`); two mutations in one ms tie, with
  stream/consumer order as the tiebreak — documented in code, acceptable for this feature's rates.

## Branch convention (user decision 2026-08-21)

Work follows the **sandcastle convention**: per-task branches `sandcastle/chatmod-task-NN` in
worktrees under each repo's `.sandcastle/`, merged per task into the repo's landing line (matching the
existing `Merge branch 'sandcastle/<slug>-task-NN'` history). `sandcastle/chatmod-task-01` is pinned in
all four repos at the task-01 review-fix commits (LMS `1e6552c0`, livestream `651324a`, ls `fe09082`,
admin `62c88b9`). The original `feat/chat-mod-01` branches become `sandcastle/chatmod-task-02` and the
worktrees move from `/Users/raghav/Projects/worktrees/chatmod/` into `<repo>/.sandcastle/chatmod` once
the in-flight task-02 review-fix batches land (agents are mid-commit there). An APX-unmatched
restriction removal emits an event whose `userId` is `apx:NNNN` — no edge principal can match it, so
it is a deliberate downstream no-op (LMS task-02 review note).

## Task-01 execution notes

- Work runs on branch `feat/chat-mod-01` in worktrees under `/Users/raghav/Projects/worktrees/chatmod/`
  for: quicktricks-backend (base `quicktricks-admin`), livestream (base `launch/quicktricks-v2`, tip
  e360d66 — NOTE: the checkout with this branch is `system-brain/repos/livestream`; the sibling
  `webcam-livestream` checkout does not have the 19b work), ls (base `launch/quicktricks-v2`),
  quicktricks-admin (base `quicktricks-admin`).
- `BannedUser` model + APX port source material: `nodejs-server-quickstricks` (ADR-0010 there).
  quicktricks-backend had zero banned-user code before this slice; the collection `bannedusers` in
  `quicktricksdb` already holds the APX-imported rows.
- Dashboard legacy create/unblock buttons already 404 in production (they call routes that never
  existed on livestream); task 01 disables them, tasks 02/07 wire LMS mutations.
- Stale-doc flag found during exploration: SYSTEM.md still says livestream's
  `classClient.setPrivateMode` targets the dead `/api/internal/...` URL — the repoint actually landed
  on `launch/quicktricks-v2` and is regression-tested. Fix SYSTEM.md when this slice's brain-doc pass
  happens.
