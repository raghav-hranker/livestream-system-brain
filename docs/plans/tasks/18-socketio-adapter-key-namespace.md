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

- [ ] `socketIoAdapterKey` embeds the deployment namespace: two envs with different `LMS_BASE_URL`s never share a key; `STREAM_STATUS_NAMESPACE` override flows through
- [ ] Stable across restarts: identical env ⇒ identical key in a fresh process (pure function, no per-boot component)
- [ ] Key format verified against the installed `@socket.io/redis-adapter`'s channel construction and documented in execution notes (incl. why it cannot collide with `streamStatus:*` / `rtmp:*` key families)
- [ ] `rtmpserver-2.js` passes the key; diff there is minimal (one call-site change + import)
- [ ] Coordinated-restart constraint documented (code comment at the call site + execution notes)
- [ ] Jest tests (`cd backend && npx jest tests/`, currently 184/184 — must stay green) covering the behaviors above, in the style of `tests/streamStatusNamespace.test.js`
- [ ] No `REDIS_HOST`/env change, no deploy, no prod writes in this task

## User stories covered

- Two clients' livestream boxes share the Redis Cloud cluster; one client's chat, stream-status
  broadcasts, and socket queries never reach the other client's servers — each deployment's
  adapter mesh lives on its own channels.

## Execution notes

_(agent fills in)_
