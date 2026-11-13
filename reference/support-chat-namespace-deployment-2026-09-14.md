# Support chat `/support` namespace deployment — 2026-09-14

User authorized building and deploying the support-chat socket split.
Frontend contract: [support-chat-socket-guide.md](support-chat-socket-guide.md).

## Problem

Support chat, channel messages and the challenge queue all registered on the default Socket.IO
namespace `/` of quicktricks-backend. A failed support auth called `socket.disconnect(true)`, which
dropped the whole connection and cut off channel messages as well.

## Released

- Host `148.113.49.18`, checkout `/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend`,
  pm2 `quicktricks-backend` (port 5916). Old PID `3316871` → new PID `3344263`.
- Production HEAD before: `9efa215f1` (the box diverges from `origin/quicktricks-admin`; the box was
  ahead for support chat, e.g. the Authorization-header token).
- Release: `8da46bf3c` on branch `codex/support-socket-namespace`, fast-forward on the box via git bundle.
  Worktree: scratchpad `support-ns-backend`, off the local `quicktricks-backend` repo.
- Backup branch on box: `deploy-backup/support-namespace-before-20260914T140805Z`.
- The box's pre-existing uncommitted edit to `dist/src/controllers/supportChatController.js.map` was saved
  to `/tmp/support-namespace-prev-controller-map-20260914T140805Z` (+ `.diff`) and superseded by the
  release's regenerated map.
- Not pushed to GitHub (`abhi092515/quicktricks-backend`).

## Behaviour

- `/support`: JWT checked once at the handshake (`auth.token`, `?token=`, or `Authorization: Bearer`);
  failure = `connect_error` `Unauthorized` on that namespace only. Users auto-join `support:user:<id>`,
  admins `support:admins`. Session re-checked before persisting a socket-sent message.
- REST + socket broadcasts go to both `/support` and `/` (`emitToSupportRooms`).
- Legacy `support_*` handlers on `/` kept, but an auth failure only emits `support_error`; no disconnect.

## Verification

- 7 new tests (`src/tests/supportChatNamespace.test.ts`, real server + `socket.io-client` dev dep) fail on
  the old code, pass on the release; existing support token tests pass. The full suite has 27 failures,
  identical on the untouched baseline (listing/PDF/APX/redirection tests).
- Box script: `/support` no token → `44/support,{"message":"Unauthorized"}`; `/` → `40{sid}`;
  `GET /api/support-chat/messages` unauthenticated → 401.
- Public HTTPS with a real client: `/support` no/bad token → `connect_error: Unauthorized`; `/` connects over
  websocket; legacy `support_join` with a bad token → `support_error`, socket still connected.
- Not verified: an authenticated `/support` session against production (no user token used).

## Open

- quicktricks-admin `hooks/api/use-support-chat.ts` still connects to `/` (works via the legacy path);
  move it to `/support`.
- Remove the legacy `/` support handlers + dual emit after the app build ships.
- Rollback: `git reset --hard 9efa215f1` on the box (only if nothing newer landed), restore the saved map,
  `pm2 restart quicktricks-backend`.

Evidence: box log `/tmp/support-namespace-deploy-20260914T140805Z.log`; local test logs
`/tmp/claude-501/support-ns-tests.log`, `/tmp/claude-501/baseline-tests.log`.
