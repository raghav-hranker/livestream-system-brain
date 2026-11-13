# Quicktricks API — Client Integration Guide

> **Base URL:** `https://quicktricks.multistreaming.site` · **Test account:** embedded in the collection
> variables (`testEmail` / `testPassword`). It has access to every course. Don't publish the collection
> files anywhere public — that account unlocks all paid content.

## The player trick, simply

There are two different "passes" involved in watching a class:

1. **The login token** — proves who you are to the API. Lasts hours.
2. **The video URL token** — a short-lived stamp glued onto the video URL itself
   (`?token=...&expires=...`). The CDN that serves the actual video files checks this stamp on every
   file it hands out. Lasts minutes.

The problem: the video stamp expires *while the user is still watching*. If you did nothing, the video
would suddenly stop when the CDN starts refusing files.

The player solves it like this:

- **Renew early, not late.** When the player gets a video URL, it looks at the expiry time and sets a
  timer for **80% of the way there**. When the timer fires, it quietly asks the API for a fresh URL —
  so there's always a valid stamp *before* the old one dies.
- **Swap just the stamp, not the video.** The new URL is the same video, only the stamp part changed.
  The player keeps the video engine running exactly as-is and just updates the stamp it attaches to
  future file requests. The user sees nothing — the video already buffered keeps playing, and the next
  chunks are fetched with the new stamp. (hls.js tip: it drops the master URL's query string when
  resolving segment URLs, so re-attach the stamp params in `pLoader`/`xhrSetup` yourself — read them
  from a variable so a fresh stamp takes effect without reloading anything.)
- **Safety net.** If a stale stamp ever does get rejected (a 403 from the CDN), the player treats that
  as "get a fresh URL now" and recovers without showing an error.

That's the whole thing: **renew at 80%, swap only the stamp, recover silently on 403.**

## The complete flow, login → playing a class

**Step 1 — Log in.**
`POST /api/users/login` with email + password → you get back a **login token**. (If the account has a
mobile number, there's an OTP step in between: the response is `data.requiresOtp: true` +
`data.preAuthToken`; finish with `POST /api/users/verify-login-otp` `{ otp, preAuthToken }`.) Keep this
token; send it as `Authorization: Bearer <token>` on everything below.

**Step 2 — Keep the login token alive.**
When it expires, don't log in again — call `POST /api/users/refresh-token` sending the *old expired
token* as the bearer, and you get a fresh one (same session, no separate refresh token). Only if that
fails with 401 (session was logged out) do a full login. Re-logging-in on every expiry will eventually
hit the max-concurrent-sessions cap (429). The Postman collections implement this ladder automatically
— use their scripts as the reference.

**Step 3 — Show the user their classes.**
`GET /api/courses/{courseId}/classes` (grouped by topic), `POST /api/courses/{courseId}/todays-classes`,
`GET /api/courses/{courseId}/pdfs` → titles, schedule, topics, effective `isFree` for lock icons.
Important: **the lists never contain any playable link** — that's deliberate. Lists are for rendering
the screen only.

**Step 4 — User taps a class → ask for the video.**
`GET /api/classes/{classId}/playback` → the API checks *is this user entitled to this class?* (did they
buy a course containing it, or is it free) and if yes, returns the **stamped video URL**. Possible
answers:

- `200` → here's your URL, start playing
- `403` → not entitled (didn't buy it)
- `404` → no recording exists yet
- `425` → recording still processing, show "preparing…" and retry later
- `401` → login token problem → go to Step 2

**Step 5 — Play, and keep it alive.**
Feed the URL to the video player and run the trick from above: renew at 80% of the stamp's lifetime,
swap stamps silently, recover on 403. Never save or reuse a stamped URL — always ask fresh when
playback starts.

**Extras on the same pattern:**

- **Live chat/socket:** `GET /api/classes/{classId}/realtime-token` → a 10-minute ticket, fetched fresh
  before every socket connect (it only gates the handshake — an open socket is never dropped on expiry).
  Full socket contract (handshake, join order, every event + payload, mute handling): `../mobile-socket-guide.md`.
- **PDFs:** `GET /api/classes/{classId}/pdfs` to list, then `GET .../pdfs/{pdfId}/access` per PDF →
  short-lived stamped URL, same "ask at open time" rule.
- **MP4 downloads:** `GET /api/classes/{classId}/downloads`. (The old `/recordings` is retired — `410`.)

One sentence to keep: **lists are for showing, per-class endpoints are for opening, and every "open" is
a freshly stamped short-lived URL — never stored, always re-requested.**

## Token lifetimes

| Credential | Lifetime | Notes |
|---|---|---|
| Login token | **24 h** | can also die early if the session is terminated — handle 401 anytime |
| Playback / download URL | **15 min** | the 80% recipe above |
| PDF access URL | **1 h** | still: mint at open time, never store |
| Realtime (socket) ticket | **10 min** | handshake only; mint fresh per connect |

## Error codes cheat-sheet

| Code | Where | Meaning | Your move |
|---|---|---|---|
| `401` | any API call | login token expired or session terminated | refresh → on refresh-401, login |
| `403` | `/playback`, `/downloads`, `/access` | user not entitled | show purchase/lock UI |
| `403` | **CDN** (video segments) | URL stamp expired | re-mint `/playback`, swap stamp |
| `404` | `/playback` | no recording exists (yet) | show "not available" |
| `425` | `/playback` | recording still processing | show "preparing…", retry later |
| `410` | `/recordings` | endpoint retired | use `/downloads` |
| `429` | login | too many concurrent sessions | log one out, or refresh instead of re-login |

Rule of thumb for the two 403s vs 401: **a CDN 403 means the URL stamp expired → re-mint; an API 401
means the login token/session died → refresh/login.** Different tokens, different fixes.
