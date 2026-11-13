# Vidyagram live bucket + CDN host — 2026-10-21

Status: bucket, custom domain, R2 key and signing secret created and saved. Class playback rules verified.
**The notes rule is not working** on the new host (signed notes URL returns 403). Nothing deployed.

Created by Raghav's agent from the brief in session "Live 1080p rung, per client"; the agent hit its usage
limit before writing this report, so the checks below were re-run independently afterwards. Screenshots:
`vidyagram-live-token-review-2026-10-21.png`, `vidyagram-live-token-created-2026-10-21.png` (same folder).

## Resources (account "Deepaksharma7933@gmail.com's Account", `1ff6f2000c9aa34ca2ec88c066af092a`)

| Resource | State (checked with `wrangler r2 bucket …`, 2026-10-21) | Matches `livev2` (`livestream-hranker-v2`) |
|---|---|---|
| Bucket `livestream-vidyagram` | created 13:01 UTC, APAC, Standard, empty | yes (APAC, Standard) |
| CORS | origin `*`, method GET, no headers, max-age 0 | identical |
| Custom domain `vidyagram-live.hranker.org` | enabled, ownership + SSL active, zone `hranker.org`, min TLS 1.0 | identical shape |
| r2.dev public URL | disabled | identical |
| R2 key `vidyagram-live-ingest` | Object Read & Write on `livestream-vidyagram` only, Forever, no IP filter (agent's confirmation) | — |

Saved in `system-brain/.env.development` (gitignored, 0600), values never printed:
`VIDYAGRAM_LIVE_R2_BUCKET`, `VIDYAGRAM_LIVE_R2_ENDPOINT`, `VIDYAGRAM_LIVE_R2_ACCESS_KEY_ID`,
`VIDYAGRAM_LIVE_R2_SECRET_ACCESS_KEY`, `VIDYAGRAM_LIVE_CDN_BASE=https://vidyagram-live.hranker.org`,
`VIDYAGRAM_LIVE_HMAC_SECRET` (new secret, not livev2's), plus `VIDYAGRAM_LIVE_R2_API_TOKEN`.

## Edge rules, verified by behaviour

Zone rulesets are not readable with wrangler's OAuth, so the copied URL rewrite, WAF and cache rules were
tested end to end. Script: scratch `vg-live-cdn-check.cjs` (repo signer
`livestream/backend/lib/cloudflareFolderSigner.js`, test objects written with the new key, deleted after;
bucket empty afterwards).

| Check | Result |
|---|---|
| Class playlist `781/<24hex>/x.m3u8`, signed | 200 (cf-cache DYNAMIC, as playlists are on livev2) |
| Segment one folder down, signed with the class token | 200 |
| Same segment fetched repeatedly | MISS then HIT ×5 at BOM, `max-age=14400` |
| Wrong secret | 403 |
| Unsigned direct path | 403 |
| Token older than 6 h (TTL 21600) | 403 |
| Another class's token | 403 (class-bound) |
| **Notes `notes/<24hex>/<24hex>/x`, signed (57-char prefix)** | **403 — FAIL, expected 200** |
| Notes, unsigned | 403 |
| Vidyagram token on `livev2.hranker.org` | 403 (secrets are separate) |

## Open

- **Notes rule:** livev2 carries a second WAF rule for `/notes/<24-hex>/<24-hex>/` (57-char prefix, see the signer's
  header comment and ADR 0002), and probably a matching rewrite for `/v/*/notes/*`. On `vidyagram-live` one or both
  is missing or differs. Copy livev2's notes rewrite + notes WAF rule with host `vidyagram-live.hranker.org` and the
  Vidyagram secret, then re-run the notes rows. Notes media (images/audio in class notes) will not load until then.
- Not compared: livev2's exact rule expressions (dashboard only). Class behaviour matches; notes do not.
