# Vidyagram notes CDN audit — 2026-11-04

Stopped without Cloudflare changes: the deployed reference rules differ from the supplied brief, which explicitly requires stopping in that case.

Account: Deepaksharma7933@gmail.com's Account (`1ff6f2000c9aa34ca2ec88c066af092a`), zone `hranker.org`.

## Existing rules

| Host | Type | Rule | ID | Observation |
|---|---|---|---|---|
| vidyagram-live.hranker.org | Rewrite | vidyagram live: class token rewrite | `673fd32c52d24694958c39659bc7e679` | Active; `/v/` plus `/781/`; rewrites class path/query using `http.request.uri.path`. |
| vidyagram-live.hranker.org | WAF | vidyagram live: class guard | `5a6a3682530f4d5aa5fc1b44c86f8f44` | Active Block; already excludes `/notes/`. |
| vidyagram-live.hranker.org | WAF | vidyagram live: notes guard | `783ec7680078400c97dbc85ca20ce4cb` | Active Block; notes prefix 57, TTL 21600, traversal checks; equivalent structure to requested notes guard. Secret value not verified against local env. |
| vidyagram-live.hranker.org | Cache | vidyagram live: segments cache | `4bc0e914f18749f9a85feae648e1369d` | Active; matches `.ts` only; eligible for cache, custom cache key, edge TTL. Query-string treatment not inspected. |
| vidyagram-live.hranker.org | Cache | vidyagram live: playlists bypass | `a4f1aa7f9ef34c178546441ab1dde56b` | Active; `.m3u8` bypass. |
| livev2.hranker.org | Rewrite | live-r2-path-token-class | `2bc5a722851f4514aab58ec686e4b419` | Active; `/v/` plus `/472/`; class path/query rewrite. |
| livev2.hranker.org | WAF | live guard class | `3e44b4ec50d143f99ec0ebe7ef86a61e` | Active Block; excludes `/notes/`. |
| livev2.hranker.org | WAF | live guard notes | `45595c529bf94feb860325c792f7be1f` | Active Block; notes prefix 57, TTL 21600, traversal checks. |
| livev2.hranker.org | Cache | live-segments-cache | `e38e9b2ae5bd4d429c1327df9ee8349f` | Active; matches `.ts` only. |
| livev2.hranker.org | Cache | live-playlists-bypass | `ab5a91549dc84684b29bd94d0337c4db` | Active; `.m3u8` bypass. |

The rules overview lists five URL rewrite rules total; neither host has a notes rewrite. This contradicts the brief's working livev2 notes-rewrite reference. The cache predicates also differ from the expected non-`.m3u8` coverage: neither segment cache predicate covers ordinary image/audio note files.

## Class guard before inspection (unchanged; secret redacted)

```text
(http.host eq "vidyagram-live.hranker.org" and http.request.method ne "OPTIONS" and not starts_with(http.request.uri.path, "/notes/") and (not starts_with(http.request.uri.path, "/781/") or http.request.uri.path contains ".." or http.request.uri.path contains "//" or not is_timed_hmac_valid_v0("<REDACTED>", concat(substring(http.request.uri.path, 0, 30), "?verify=", http.request.uri.args["vodauth"][0]), 21600, http.request.timestamp.sec, 8, "s")))
```

## Changes and verification

- Added/edited/deleted/disabled rules: none. No other host, DNS, SSL, or socket configuration changed.
- Upload check and class video check: not run; stopped at the inventory mismatch before changes and production test writes. No successful repair claimed; no check output exists for this audit.
- Required post-fix commands: `reference/scripts/vidyagram-upload-check.sh` and `reference/scripts/vidyagram-live-check.sh` from the Mac.
- Secret hash comparison: not run; the post-change persistent-403 condition was not reached.
- Next decision: authorize proceeding with the supplied host-scoped Vidyagram notes rewrite despite the missing livev2 reference. Existing WAF rules need no structural addition based on this inventory. Cache remains report-only.

## Authorized rewrite attempt

The user subsequently authorized proceeding with the supplied Vidyagram-only rewrite despite the missing livev2 reference. Submitted the new rule form with name `vidyagram live: path token notes`, custom host-scoped filter, dynamic path and dynamic query exactly as supplied. Cloudflare rejected deployment:

```text
Invalid expression
Filter parsing error (1:93): unknown identifier
wildcard_match(http.request.uri.path, "/v/*/notes/*")
Rule validation failed
```

No rule was deployed and no new rule ID was issued. Existing WAF, cache and other host rules remain unchanged. Stopped on this dashboard error as instructed; did not substitute another expression. The form remains open for review. Evidence: `notes-media-rewrite-error-2026-11-04.png` beside this report.

Verification scripts were not run after the rejected deployment, so there is no new upload-check output or class video result. The repair remains incomplete. A next attempt would require authorization to replace the unsupported `wildcard_match(...)` with Cloudflare's supported wildcard match syntax; it has not been attempted.

## Completed repair — 21:12 IST

The user authorized the supported wildcard operator correction. Added **only** `vidyagram live: path token notes`, ID `4cf73c1c0e794eb59425ff4eaed0b5ae`, Active, last URL rewrite rule. No existing rule was edited. The WAF guards already existed; the class guard expression above remains unchanged. No secret was entered for this change.

Match:
```text
http.host eq "vidyagram-live.hranker.org" and starts_with(http.request.uri.path, "/v/") and http.request.uri.path wildcard "/v/*/notes/*"
```
Dynamic path:
```text
wildcard_replace(http.request.uri.path, "/v/*/notes/*", "/notes/${2}")
```
Dynamic query:
```text
wildcard_replace(http.request.uri.path, "/v/*/notes/*", "vodauth=${1}")
```

Waited at least a minute after deployment before the upload verification. Initial sandboxed verification attempts could not access DNS/SSH/gcloud; reran with approved network and existing credential access. Both final scripts exited 0. All note create/fetch/unsigned checks PASS, and no note cleanup failure was reported. The script leaves tiny storage objects by design. Signed class master, five rendition playlists and all sampled first/middle/last segments returned 200. This verifies CDN playback access, not a visual app playback session.

Cache inspected read-only: `vidyagram live: segments cache` ignores query strings, but matches only `.ts`; the expected general non-`.m3u8` cache coverage does not exist. Cache unchanged, report-only as requested. No socket hash comparison needed because signed fetches now pass. Manual app image/audio entry was not performed.

Evidence: [active rule screenshot](notes-media-rewrite-deployed-2026-11-04.png), [full upload output](notes-media-upload-check-2026-11-04.txt), [full video check output](notes-media-live-check-2026-11-04.txt).

### Full final upload-check output

```text
== Backend upload route (Q-Hub, editorial, question media)
  PASS uploads/files image/png upload: HTTP 201, stored as image/png
  PASS uploads/files image/png fetch: 200 image/png 70b
  PASS uploads/files audio/wav upload: HTTP 201, stored as audio/wav
  PASS uploads/files audio/wav fetch: 200 audio/wav 8044b
  PASS uploads/files audio/webm;codecs=opus upload: HTTP 201, stored as audio/mp4
  PASS uploads/files audio/webm;codecs=opus fetch: 200 audio/mp4 7223b
  PASS uploads/files audio/mp4 upload: HTTP 201, stored as audio/mp4
  PASS uploads/files audio/mp4 fetch: 200 audio/mp4 2970b
== Class notes (app and viewer)
  PASS note image/png create: HTTP 201, host vidyagram-live.hranker.org, path /v/<token>/notes/6aeb40abc408c8bdb18f7c25/0000000000000000000a1b2c/1793806952322-probe.png
  PASS note image/png fetch: 200 image/png 70b
  PASS note image/png unsigned: blocked (403)
  PASS note audio/wav create: HTTP 201, host vidyagram-live.hranker.org, path /v/<token>/notes/6aeb40abc408c8bdb18f7c25/0000000000000000000a1b2c/1793806954160-probe.wav
  PASS note audio/wav fetch: 200 audio/wav 8044b
  PASS note audio/wav unsigned: blocked (403)
  PASS note audio/mp4 create: HTTP 201, host vidyagram-live.hranker.org, path /v/<token>/notes/6aeb40abc408c8bdb18f7c25/0000000000000000000a1b2c/1793806955914-probe.m4a
  PASS note audio/mp4 fetch: 200 audio/mp4 2971b
  PASS note audio/mp4 unsigned: blocked (403)

VERDICT: all upload paths work end to end
```

### Full final class video check output

```text
== encoder vidyagram-livestream
 15:42:21 up  1:17,  1 user,  load average: 2.26, 2.13, 2.03
/dev/nvme0n1p1  197G  7.1G  182G   4% /
│ id │ name                    │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
│ 0  │ vidyagram-livestream    │ default     │ 1.0.0   │ fork    │ 598      │ 77m    │ 0    │ online    │ 0%       │ 334.7mb  │ raghav   │ disabled │
ffmpeg processes: 1
connections on 8937: 2

== classes in vidyagramdb
now 2026-11-04 21:12:23
6aeb40abc408c8bdb18f7c25 | test 00 | live | isLive false | start - | updated 2026-11-04 21:09:51 | asset live 781/6aeb40abc408c8bdb18f7c25/playlist.m3u8

== signed walk of 6aeb40abc408c8bdb18f7c25
{"streamStatus":"live","key":"781/6aeb40abc408c8bdb18f7c25/playlist.m3u8","provider":"cloudflare","master":"vidyagram-live.hranker.org/v/<token>/781/6aeb40abc408c8bdb18f7c25/playlist.m3u8"}
{"master":200,"renditions":["0/playlist.m3u8","1/playlist.m3u8","2/playlist.m3u8","3/playlist.m3u8","4/playlist.m3u8"]}
{"rel":"0/playlist.m3u8","status":200,"segments":1088,"seconds":4325,"endlist":false,"probe":[{"seg":"segment_0.ts","status":200,"bytes":193264,"ts":true,"cache":"HIT"},{"seg":"segment_544.ts","status":200,"bytes":546516,"ts":true,"cache":"MISS"},{"seg":"segment_1087.ts","status":200,"bytes":463232,"ts":true,"cache":"MISS"}]}
{"rel":"1/playlist.m3u8","status":200,"segments":1088,"seconds":4325,"endlist":false,"probe":[{"seg":"segment_0.ts","status":200,"bytes":122764,"ts":true,"cache":"HIT"},{"seg":"segment_544.ts","status":200,"bytes":331820,"ts":true,"cache":"MISS"},{"seg":"segment_1087.ts","status":200,"bytes":301740,"ts":true,"cache":"MISS"}]}
{"rel":"2/playlist.m3u8","status":200,"segments":1089,"seconds":4330,"endlist":false,"probe":[{"seg":"segment_0.ts","status":200,"bytes":100016,"ts":true,"cache":"HIT"},{"seg":"segment_544.ts","status":200,"bytes":264516,"ts":true,"cache":"MISS"},{"seg":"segment_1088.ts","status":200,"bytes":377128,"ts":true,"cache":"MISS"}]}
{"rel":"3/playlist.m3u8","status":200,"segments":1089,"seconds":4330,"endlist":false,"probe":[{"seg":"segment_0.ts","status":200,"bytes":76704,"ts":true,"cache":"HIT"},{"seg":"segment_544.ts","status":200,"bytes":181796,"ts":true,"cache":"MISS"},{"seg":"segment_1088.ts","status":200,"bytes":268276,"ts":true,"cache":"MISS"}]}
{"rel":"4/playlist.m3u8","status":200,"segments":1090,"seconds":4333,"endlist":false,"probe":[{"seg":"segment_0.ts","status":200,"bytes":127464,"ts":true,"cache":"HIT"},{"seg":"segment_545.ts","status":200,"bytes":151340,"ts":true,"cache":"MISS"},{"seg":"segment_1089.ts","status":200,"bytes":173712,"ts":true,"cache":"MISS"}]}
```
