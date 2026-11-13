# Handoff: per-class playback CDN switch (Bunny pilot code) — 2026-10-08

## What exists
A per-class override of which CDN signs `GET /api/classes/:id/playback`. Built as the test harness for the
Bunny-vs-Cloudflare pilot. Decision on 2026-10-07: Cloudflare stays primary, so this is **not deployed** and
**not merged**. Keep it: it is also the lever a future mid-class CDN rescue needs.

| item | where |
|---|---|
| Branch | `feat/playback-cdn-pilot` in quicktricks-backend, worktree `/Users/raghav/Projects/worktrees/qt-backend-playback-cdn`, rebased 2026-10-08 onto `origin/quicktricks-admin` 26358867e (was 29dc69253) |
| Commits | 42165c60d feature · 30420cd97 integration test · a69bf2c3d recorded-zone gate + 3 tests · 4e854aba1 dist (rebased; were 77601bc66 · b01da91b3) |
| Pushed? | **No.** GitHub was unreachable from the agent sandbox. Push from the laptop: `git push fork feat/playback-cdn-pilot` (remote `fork` = raghav-hranker/quicktricks-backend) |
| dist | not built. Build per the usual surgical tsc + copy at deploy time |
| Operator script | `reference/scripts/playback_cdn_pilot.cjs` (brain repo, uncommitted) |
| Plan + evidence | `docs/plans/playback-cdn-pilot.md`, `reference/playback-cdn-probe-2026-10-0{6,7}*.json` |

## The change (4 files)
- `src/config/videoProtection.ts`: `VIDEO_CDN_PROVIDERS = ['bunny','cloudflare'] as const`; `VideoCdnProvider` derived from it.
- `src/models/Class.ts`: `playbackCdn?: VideoCdnProvider`, enum-validated, optional, no default. Deleted in both
  toJSON and toObject transforms (same as `hlsAsset`), so it never reaches list/detail JSON.
- `src/controllers/playbackController.ts`: `resolveVideoCdn(req, zoneConfig, classOverride)` walks one precedence
  list: `?cdn=` query → `Class.playbackCdn` → env default (`RECORDED_CDN_PROVIDER` / `LIVE_CDN_PROVIDER`). An opt-in
  to `cloudflare` is honoured only when that zone's Cloudflare signer is configured; the env default is returned
  as-is so a misconfigured env flip still 500s loudly (three existing tests pin that). `mongoLoadClass` selects and
  passes `playbackCdn`.
- `src/tests/playbackController.test.ts` + `src/tests/integration/playbackCdnOverride.integration.test.ts`.
  Unit file 50/50; integration test goes through the real Mongo loader (fails if the select drops the field).
  Full `npm test`: 28 pre-existing failures, identical before/after, none in playback.

Not in `updateClassSchema` (Zod strips unknown keys), so the admin API cannot set it. Script-only by design.

## How to run the pilot if it is ever revived
1. Probe first, no deploy needed (the per-request `?cdn=` override is already live in prod):
   `node reference/scripts/playback_cdn_pilot.cjs probe --token <JWT> --runs 3 <classId>...`
   The token's account must be entitled to the classes. Bunny over B2 can only serve classes whose HLS
   objects are in B2 (pre-2026-09-10 recordings); the probe flags the rest.
2. Push, pull on the box, build dist, `pm2 restart quicktricks-backend`.
3. On the box, from the backend checkout: `node playback_cdn_pilot.cjs set bunny <ids> --commit` (writes a
   backup JSON first; `--restore <file>` undoes; `list` shows current overrides). Log the backup in the
   prod-data-changes ledger.
4. Rollback = `unset <ids> --commit`, or restart with the field left in place and the env unchanged (the field
   only matters while the code that reads it is deployed).

## Pilot classes used for the probes
6a455930ebb42f585d9ad162, 6a455930ebb42f585d9ad16c, 6a455930ebb42f585d9ad179 — recorded bucket, created
2026-07-01, keys `472/<id>/hls/master.m3u8`, all present in B2 (verified 2026-10-06).

## Probe results that drove the decision (from Raghav's laptop, Mumbai)
| state | Bunny warm | Cloudflare warm |
|---|---|---|
| zone untuned (origin max-age=2 on .m3u8 respected) | playlists ~1.05 s REVALIDATED each, seg 345 ms | 65–140 ms HIT |
| + cache-expiration override, High Volume tier (SG1) | all hops ~350 ms HIT | same |
| + Standard tier (MU1 Mumbai) | 55–105 ms HIT | same |

Parity on latency once tuned. Cloudflare keeps the job on cost (R2 zero egress vs Bunny per-GB), on being the
shipped stack, and on one origin + one signer.

## Loose ends tied to this branch
- Bunny pull zone 5927231 is on **Standard** tier with a cache-expiration override and Perma-Cache on. Switch
  back to High Volume (no traffic, but Standard pricing should not sit armed).
- The session JWT pasted into the 2026-10-06 chat should be logged out.
- Nothing records which CDN a playback went to (the view record has no CDN field). If the pilot is revived,
  add that or rely on the two CDN dashboards.
