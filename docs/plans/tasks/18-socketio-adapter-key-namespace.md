# Socket.io Redis adapter key: namespace the broadcast mesh per deployment

**Type**: AFK (code + tests only; the `REDIS_HOST` flip and box deploy are HITL, NOT this task)
**Blocked by**: task 17 (uses its `resolveNamespace` machinery) — landed `b2412ed`
**Repo**: livestream
**Governing docs**: [task 17](./17-shared-redis-ownership-guard.md) §C execution notes (the audit
finding this closes) · `/tmp/handoff-socketio-adapter-mesh-deep-dive.md` (concept walkthrough) ·
[launch runbook](../launch-runbook-quicktricks-v2.md)

> **Branch guard:** verify `git branch --show-current` matches `ACTIVE_BRANCH` in
> `system-brain/repos.manifest` before reading or changing anything. Ignore `.claude/worktrees/*`.

## Background

`backend/rtmpserver-2.js:66` calls `createAdapter(pubClient, subClient)` with no `key` option, so
the socket.io Redis adapter publishes/subscribes on its default `socket.io` channel keyspace. Today
Redis is box-local and the mesh is trivially private. After the planned `REDIS_HOST` flip to the
shared Redis Cloud cluster, **every deployment using the default key merges into one adapter
mesh**: every room broadcast (`streamUpdate`, `privateModeUpdate`, chat, moderation, `pollUpdate`)
is fanned out to every tenant's boxes, adapter request/response ops (`fetchSockets`,
`serverSideEmit`) cross tenants, and mesh members decode each other's packets (version/payload skew
in one tenant can error others). Rooms are named by `classId`, and cloned DBs make identical
`Class._id`s across deployments a real pattern here — so cross-tenant *delivery*, not just
fan-out cost, is on the table.

Task 17 closed the same bug shape (un-namespaced shared state on Redis) for the pending-retry
store and the `rtmp:endStream` subscriber; the adapter is the remaining un-namespaced surface its
audit flagged ("one-line fix, ship WITH the `REDIS_HOST` flip").

## What to build

**A — a `socketIoAdapterKey(env)` helper in `backend/lib/streamStatusNamespace.js`.**
Returns the adapter `key` for this deployment, built on `resolveNamespace(env)` (default
`socket.io:<ns>`, e.g. `socket.io:10.190.0.11-5100` on the box). Pure function of env, same
stability/identity argument as the pending store: every box of one deployment derives the same key
independently; deployments pointing at different LMSes never share one. Before pinning the exact
format, eyeball how `@socket.io/redis-adapter` (in `backend/node_modules/`) composes channel names
from `key` — the chosen string must not collide with or prefix-shadow the task-17 key families
(`streamStatus:*`, `rtmp:*`).

**B — pass it at the call site.** `rtmpserver-2.js:66` becomes
`io.adapter(createAdapter(pubClient, subClient, { key: socketIoAdapterKey() }))`. No other
behavioural change to the file.

**C — document the coordinated-restart constraint** (in code comment + execution notes): servers
with mixed keys cannot see each other's broadcasts — silently, nothing errors. Within a deployment
the key changes on upgrade, so this commit must reach all boxes of a deployment in one restart
window; that is why it deploys WITH the `REDIS_HOST` flip (single box today, so trivially
satisfied — but the constraint must be written down for the split-server future).

Out of scope: the `REDIS_HOST` env flip, any deploy, any prod write; sharded-adapter
(`createShardedAdapter`) evaluation; Redis ACL enforcement (both are deep-dive-handoff threads,
not launch work).

## Acceptance criteria

- [x] `socketIoAdapterKey` embeds the deployment namespace: two envs with different `LMS_BASE_URL`s never share a key; `STREAM_STATUS_NAMESPACE` override flows through
- [x] Stable across restarts: identical env ⇒ identical key in a fresh process (pure function, no per-boot component)
- [x] Key format verified against the installed `@socket.io/redis-adapter`'s channel construction and documented in execution notes (incl. why it cannot collide with `streamStatus:*` / `rtmp:*` key families)
- [x] `rtmpserver-2.js` passes the key; diff there is minimal (one call-site change + import)
- [x] Coordinated-restart constraint documented (code comment at the call site + execution notes)
- [x] Jest tests (`cd backend && npx jest tests/`, currently 184/184 — must stay green) covering the behaviors above, in the style of `tests/streamStatusNamespace.test.js`
- [x] No `REDIS_HOST`/env change, no deploy, no prod writes in this task

## User stories covered

- Two clients' livestream boxes share the Redis Cloud cluster; one client's chat, stream-status
  broadcasts, and socket queries never reach the other client's servers — each deployment's
  adapter mesh lives on its own channels.

## Execution notes

Landed 2026-07-27 on `launch/quicktricks-v2` (livestream) as `a04747e`, on top of task 17 (`b2412ed`).

### Files

| File | Change |
|---|---|
| `backend/lib/streamStatusNamespace.js` | `socketIoAdapterKey(env)` added next to `resolveNamespace` — `socket.io:<ns>`; carries the adapter channel-construction finding as a comment so the format is not "fixed" later without re-reading the adapter |
| `backend/rtmpserver-2.js` | one import + the `createAdapter` third argument; call site carries the coordinated-restart comment. No other behavioural change |
| `backend/tests/socketIoAdapterKey.test.js` | **new** — 7 tests (identity, override, purity/stability, format, mutual invisibility vs the default key, literal-token safety, no collision with the app-plane families) |

Helper placement: it lives in `streamStatusNamespace.js` rather than a new module because the key *is*
`resolveNamespace` plus a prefix — the value of a single namespace source is that one env
(`STREAM_STATUS_NAMESPACE`) renames both key families together, which a second module would drift from.
The file's name is now slightly narrower than its contents; renaming it would churn task 17's diff for no
gain, so it stayed.

### Key format, verified against the installed adapter

`@socket.io/redis-adapter@7.2.0`, `dist/index.js:72-76` — the constructor does exactly:

```js
const prefix = opts.key || "socket.io";
this.channel         = prefix + "#" + nsp.name + "#";      // + "<room>#" when broadcasting to one room
this.requestChannel  = prefix + "-request#"  + nsp.name + "#";
this.responseChannel = prefix + "-response#" + nsp.name + "#";
// subClient.pSubscribe(this.channel + "*")  — broadcasts arrive by PATTERN
// subClient.subscribe([requestChannel, responseChannel, responseChannel + uid + "#"])
```

So `key` is a plain prefix on all four channels, `#` is the adapter's field delimiter, and inbound
broadcasts are matched by the glob pattern `<key>#<nsp>#*` (plus `onmessage`'s own
`channel.startsWith(this.channel)` re-check at `:113`).

**Chosen format: `socket.io:<ns>`** (e.g. `socket.io:10.190.0.11-5100` on the box — confirmed by running
the helper with the box's `LMS_BASE_URL`). Why it is safe:

- **No collision with `streamStatus:*` / `rtmp:*`.** Two independent reasons. (1) Different first segment:
  every adapter channel begins `socket.io:…`, every app-plane name begins `rtmp:` or `streamStatus:`, so
  neither is a prefix of the other in either direction (asserted in the tests). (2) They are not even the
  same Redis namespace — the adapter's four names are **pub/sub channels**, which share no keyspace with
  the `streamStatus:pending:*` / `rtmp:blocked:*` *keys*. The one app-plane pub/sub channel,
  `rtmp:endStream` (`lib/rtmpRedisHelper.js:40`, subscribed by exact name at `rtmpserver-2.js:378`), can
  never be matched by the adapter's `socket.io:<ns>#…*` pattern, and the adapter never subscribes by
  exact name to anything outside its own prefix.
- **No prefix-shadowing of the adapter's own default.** A server left on the default key pattern-subscribes
  to `socket.io#<nsp>#*`; our channels are `socket.io:<ns>#<nsp>#…`, which does not start with `socket.io#`
  (the delimiter is `#`, not `:`). Old-key and new-key servers are mutually invisible — the isolation we
  want *between* deployments, and the restart constraint *within* one.
- **The key is a literal token.** It is spliced into a PSUBSCRIBE pattern, where `*?[]\` are metacharacters,
  and `#` would forge a channel delimiter. `resolveNamespace` already sanitises to `[a-z0-9._-]` (and its
  fallbacks are a sha1 hex slice or `default`), so the key always matches `^socket\.io:[a-z0-9._-]+$` —
  asserted directly, including for a namespace override stuffed with metacharacters.

Identity is inherited wholesale from task 17: `STREAM_STATUS_NAMESPACE` else the `LMS_BASE_URL` host —
mandatory at boot (ADR-0004), constant across restarts, shared by every box of one deployment. No per-boot
component (`INSTANCE_ID` would put every restart in a private mesh of one), and **no new env** for the flip.

### Coordinated-restart constraint

Servers on different keys **silently** cannot see each other: the publisher publishes to its own channel,
the peer's pattern does not match, nothing errors, no client notices until a broadcast (`streamUpdate`,
`privateModeUpdate`, chat, moderation, `pollUpdate`) simply does not arrive on the other box — and
`fetchSockets`/`serverSideEmit` quietly return only local results. Because this commit *changes* the key,
the rule is: **all boxes of a deployment restart into the new key in one window.** Today the deployment is
a single box, so it is trivially satisfied; it is written at the call site for the split
websocket/transcoder future. This is why the task ships with the `REDIS_HOST` flip rather than ahead of it.

### Tests

`cd backend && npx jest tests/` → **22 suites / 191 tests, all passing** (baseline before this task:
21 / 184; +1 suite, +7 tests). The pre-existing "worker process failed to exit gracefully" warning is
unchanged. The 13 streak/notification failures elsewhere in the repo are outside `tests/` and untouched.

TDD honesty note: cycle 1 (different `LMS_BASE_URL`s ⇒ different keys) was a real RED → GREEN
(`socketIoAdapterKey is not a function`). The remaining six were written test-first but passed on first
run — the minimal implementation from cycle 1 already had to pick a string, and after reading the adapter
source that string proved to be the right one. They stand as regression guards on the pinned format.

### Not verified

- No runtime/on-box verification: no deploy, no restart, no `REDIS_HOST` change, no prod Redis reads or
  writes (out of scope per the task). The derived key was confirmed only by running the pure helper locally
  with the box's `LMS_BASE_URL` value.
- **Multi-box behaviour is unit-level only.** "Two deployments' meshes do not intersect" is argued from the
  adapter's channel construction and asserted on strings — no two-server integration test, and no
  observation of an actual shared cluster. The first real test is the `REDIS_HOST` flip.
- Not checked against a live Redis: whether any *default-key* `socket.io#…` channels are currently active on
  the shared cluster from other deployments (would need a prod Redis read). Irrelevant to correctness here —
  we simply stop using that keyspace — but it is what the flip would have merged into.
- `createShardedAdapter` and Redis ACLs remain unevaluated (explicitly out of scope; deep-dive handoff threads).

## Live verification (2026-07-27, box @ a04747e — the REDIS_HOST flip itself)

Executed with the flip as one restart (user green-light): box pulled `a04747e`, app-plane
`REDIS_HOST/PORT/USERNAME/PASSWORD` set to the shared Redis Cloud cluster
(`redis-19504.c45830.ap-south-1-mz.ec2.cloud.rlrcp.com`; values copied server-side from the box's
own `GPU_REDIS_*` — never left the box; backup `.env.bak-redisflip-20260727`), single pm2 restart
12:19:05Z. Boot log: `Redis adapter has been set for Socket.IO`, pending recovery on namespace
`10.190.0.11-5100`, only the known-benign connect-race noise.

- **Adapter isolation proven on the real bus:** `PUBSUB CHANNELS socket.io*` on the shared cluster
  shows our namespaced family (`socket.io:10.190.0.11-5100-request#/#`, `…-response#/#`) coexisting
  with other tenants' default-key family (`socket.io-request#/#`, `socket.io-response#/#…`);
  `PUBSUB NUMPAT` = 2 (the two broadcast patterns). The "not checked against a live Redis" caveat
  above is now closed: default-key deployments ARE active on the cluster — the merge was real and
  we are outside it. PASS
- **Task-17 guard on the real bus:** fabricated foreign `rtmp:endStream` published on the shared
  cluster reached **9 subscribers**; our box logged `Ignoring … no local session and no local
  resources`, zero writes. Probe side-effect: one older unguarded tenant wrote
  `rtmp:blocked:/999/000000000000000000000000` (the fake path) — deleted as self-created residue.
  PASS
- **Foreign-pending audit:** boot logged no ignored-keys line; full 3,140,929-key SCAN of the
  cluster (node script using the backend's redis client; the box redis-cli lacks `--count` and a
  default scan crawls) confirmed `streamStatus:pending*` = **0** — the audit's silence was
  truthful, and the cleanup-ledger's "orphaned shared-cluster pending keys" item is CLOSED.
  Bonus census: `rtmp:blocked` = **3,853 keys** (task 17's unbounded-growth finding, quantified —
  stays on the ledger).

Box lore: non-interactive ssh has no node on PATH — bare `pm2 restart` fails with
`/usr/bin/env: 'node': No such file or directory` and it is easy to mistake stale logs for a boot;
prefix `PATH=/home/raghav/.nvm/versions/node/v24.15.0/bin:$PATH` and verify via `pm2 ls` uptime.
One-off node scripts must sit inside `backend/` for `require()` to resolve.
