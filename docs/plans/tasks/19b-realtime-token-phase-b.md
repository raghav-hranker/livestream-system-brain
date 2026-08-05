# Task 19b — Realtime token (task 19 phase B): the LMS decides, the edge verifies tickets

**Type**: AFK (three legs, run individually with review between: nodejs-server → livestream → ls)
**Repos**: nodejs-server (B1 mint) · livestream (B2 verify + ledger folds) · ls (B3 connection state machine)
**Status**: registered 2026-08-05, not started
**Governing spec**: the **"Phase B — the Realtime token"** section (B1–B5) and the
**"Acceptance criteria — phase B"** section of
[`19-socket-auth-and-authorization.md`](./19-socket-auth-and-authorization.md) — inlined into every
leg's prompt. That document is authoritative; this file only adds the cross-leg wire pins and scope
fences the spec leaves implicit.

## Cross-leg wire pins (all legs build against exactly these)

The three legs run separately and cannot see each other's code. These shapes are fixed here so they
cannot drift:

- **Mint request:** `GET /api/classes/{classId}/realtime-token` with the caller's existing credential
  in the `Authorization: Bearer <token>` header (Auth access token or Streamer token — exactly how
  `/playback` is called today).
- **Mint success response (200):** `{ "token": "<jwt>", "expiresIn": 600 }` with
  `Cache-Control: no-store`. Nothing else in the body.
- **Mint errors:** standard HTTP — 401 (bad/absent/expired credential, revoked session),
  403 (not entitled / Streamer token for another class), plain `{ "message": string }` bodies per the
  repo's existing error convention. The client treats 401/403 as terminal (no retry loop).
- **Ticket claims:** `userId` (string), `classId` (string), `role` (`'host' | 'viewer'`),
  `name` (string, display name), `jti`, `iss: 'lms'`, `aud: 'livestream-socket'`, `iat`, `exp`
  (10 min). HS256, secret env `REALTIME_TOKEN_SECRET` in both nodejs-server and livestream.
- **Handshake:** ls passes the ticket as socket.io `auth.token`. livestream middleware failures use
  `next(err)` where `err.data = { code }` and `code ∈ { 'AUTH_REQUIRED', 'AUTH_EXPIRED',
  'AUTH_INVALID' }` — surfaced to the client as `connect_error` with `error.data.code`. Join-time
  class mismatch stays a `joinRoom` denial (existing `HOST_CLASS_MISMATCH`), not a handshake code.

## Scope fences

- Phase A + its remediation are ALREADY SHIPPED in these worktrees (livestream `8c215ea`,
  ls `75f261e`). Read them; do not rebuild or redesign them.
- The student-LMS-frontend link change (Auth token on the ls URL) is user-owned and OUT OF SCOPE for
  every leg.
- Secret **values**, deploys, env changes on real boxes: out of scope — code + env *validation* only.
- No secret-rotation machinery (`kid` rings, dual keys): decided against.
- brain docs (GLOSSARY/SYSTEM.md rows) are handled outside these legs.

## Leg order + review gate

Legs run **one at a time** (`npm run task 19b -- --leg=<repo>`), each followed by an independent
review before the next starts. nodejs-server first (defines the real endpoint), livestream second
(dual verification is independently testable), ls last (integrates against both).
