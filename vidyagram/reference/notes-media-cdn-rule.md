# Class notes image and audio: Cloudflare rule on the Vidyagram live host

**Resolved 2026-11-04, 21:12 IST:** added notes rewrite `4cf73c1c0e794eb59425ff4eaed0b5ae`; both WAF guards already existed. PNG/WAV/M4A note create/fetch/unsigned checks all passed, as did signed class playlists and sampled segments. The supported filter uses `http.request.uri.path wildcard "/v/*/notes/*"`; `wildcard_match(...)` below was rejected by Cloudflare. Cache is `.ts` only with query ignored and was left unchanged. See the [final audit and full check outputs](../reports/notes-media-cdn-audit-2026-11-04.md#completed-repair--2112-ist). The original diagnosis and brief follow for historical context.

Note media is stored at `notes/<classId>/<userId>/<ts>-<file>` in R2 `livestream-vidyagram`. The socket returns it as
`https://vidyagram-live.hranker.org/v/<token>/notes/...`, signed over `/notes/<classId>/<userId>/` (57 characters).
On 2026-10-21 a correctly signed notes URL returned 403 while class playback worked
([report](../reports/vidyagram-live-bucket-2026-10-21.md)). Quicktricks' `livev2.hranker.org` carries a separate notes
rewrite and notes WAF rule for this path. Live-host design: livestream `docs/cloudflare-live-host-dashboard-handoff-2026-09-10.md`.

## 1. Confirm from the Mac

```bash
~/Projects/system-brain/reference/scripts/vidyagram-upload-check.sh
```

What the app itself got back (`[notes]` lines only, so no tokens or request bodies):

```bash
ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 'grep -ahE "\[notes\] upload rejected|Media upload failed|Error creating note" ~/.pm2/logs/vidyagram-socket-*.log | cut -c1-200 | tail -30'
```

| Result | Meaning | Next |
|---|---|---|
| Note `create` 201, `fetch` 403 | CDN rule missing or wrong | Section 2 |
| Log shows `UNSUPPORTED_MEDIA_TYPE` | The app sends a type the server refuses (for example `application/octet-stream`, `audio/3gpp`, `audio/x-wav`) | Code fix in `backend/lib/notesMedia.js`; rule change alone will not help |
| Note `create` 500, or `Media upload failed` | Socket storage settings or R2 key | Check `LIVE_STORAGE_*` and `LIVE_S3_BUCKET_NAME` on `vidyagram-socket` |
| Everything passes, log empty | The request never reaches the server, or the fault is in the app | App team, with a captured request |

## 2. Add the rules

Confirmed 2026-11-04: note `create` returns 201 and the signed `fetch` returns 403.

Cloudflare account "Deepaksharma7933@gmail.com's Account", zone `hranker.org`. Scope every rule to the host; never use
"All incoming requests". Do not change any quicktricks or recorded rule. Easiest route: **duplicate** `livev2`'s two notes
rules and change the host and secret. Its deployed rules win over the text below if they differ, for example
`raw.http.request.uri.path` in the rewrite.

**Look first, because the rules may be partly there.** On 10-21 an unsigned `/notes/...` request also returned 403. So
something already guards that path on this host: either a notes WAF rule with no working rewrite, or a class guard that
does not exclude `/notes/`. Add only what is missing.

**Order matters.** Add or fix the notes WAF rule **before** excluding `/notes/` from the class guard. The other order
leaves note files open without a token until the WAF rule is in.

**Rewrite** (Rules → Transform Rules → Rewrite URL), name `vidyagram live: path token notes`

- Match:
  ```
  http.host eq "vidyagram-live.hranker.org" and starts_with(http.request.uri.path, "/v/") and wildcard_match(http.request.uri.path, "/v/*/notes/*")
  ```
- Path, dynamic: `wildcard_replace(http.request.uri.path, "/v/*/notes/*", "/notes/${2}")`
- Query, dynamic: `wildcard_replace(http.request.uri.path, "/v/*/notes/*", "vodauth=${1}")`

**WAF custom rule** (Security → Security rules → Custom rules), Action Block, name `vidyagram live: guard notes`

```
(http.host eq "vidyagram-live.hranker.org" and http.request.method ne "OPTIONS"
  and starts_with(http.request.uri.path, "/notes/")
  and (
    http.request.uri.path contains ".."
    or http.request.uri.path contains "//"
    or not is_timed_hmac_valid_v0("<VIDYAGRAM_LIVE_HMAC_SECRET>",
         concat(substring(http.request.uri.path, 0, 57), "?verify=", http.request.uri.args["vodauth"][0]),
         21600, http.request.timestamp.sec, 8, "s")
  ))
```

Replace the placeholder with `VIDYAGRAM_LIVE_HMAC_SECRET` from `system-brain/.env.development`. Never use livev2's secret.

**Check the existing class guard on this host.** It must contain `and not starts_with(http.request.uri.path, "/notes/")`.
Without it, the class rule (prefix 30) blocks notes first and the new rule never helps. Add that one clause if it is
missing. A guard that also lets `/notes/` through must stay scoped to `vidyagram-live.hranker.org`.

**Cache:** the live-host segment cache rule (everything not `.m3u8`, query string ignored) already covers notes. Confirm it
exists for this host. Without it notes still work, but each one is fetched from R2.

If the dashboard refuses a new rule because the zone is at its rule limit, stop and change nothing else.

## 3. Verify

Run the check script again. Every note line must pass, including `unsigned`, which proves note files still need a token.
Then add an image and an audio note from the app. Existing notes need no repair, because their URLs are signed on each read.

**If the fetch still returns 403,** the socket may be signing with a different secret or host. Compare the secret on
`vidyagram-socket` (`CF_LIVE_HMAC_SECRET`) with `VIDYAGRAM_LIVE_HMAC_SECRET` without printing either value, for example by
comparing `sha256sum` output.

## Why not a code workaround

Moving notes under `781/<classId>/` would use the class rule and need no Cloudflare change, but the token would then unlock
the whole class folder. The notes POST has no login, so anyone could mint a token for that class's video. Keep the
separate notes rule.
