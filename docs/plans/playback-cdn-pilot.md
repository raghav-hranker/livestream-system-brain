# Playback CDN pilot — Bunny over B2 for chosen classes

**Decision 2026-10-07: Cloudflare stays. Pilot not deployed.** Latency is parity once the Bunny zone is tuned and on
the Standard tier; Cloudflare wins on cost (R2 zero egress + flat zone plan vs Bunny per-GB in Asia), on being the
shipped stack since 2026-09-10 with no R2→B2 copy needed, and on keeping one origin + one signer. The branch stays as
the per-class switch a future CDN rescue would need. Bunny zone 5927231 to be switched back to High Volume.

**Reframe 2026-10-07 (team's actual goal):** not performance but **reliability fallback** — some users' DNS/networks
could not reach Cloudflare in the past and the team built proxy servers to cope; they want Bunny (Volume tier, Standard
egress is unaffordable) as the fallback instead of proxies. Facts checked: the API host `backend.quicktricksbysahilsir.com`
resolves straight to the box (148.113.49.18, Apache, no Cloudflare), so an affected user can still mint a playback URL;
only `recordedvideosv2.hranker.org` is Cloudflare-proxied. Consequences:
- The lever is the already-live per-request `?cdn=bunny` override plus client-side fallback (on Cloudflare manifest/segment
  network failure, re-mint with `?cdn=bunny`, remember it per device), NOT a per-class field. This branch stays unmerged.
- Bunny over **B2** only covers pre-2026-09-10 classes. A fallback must cover every class → the **R2 + Bunny** cell
  (Bunny pull zone, Volume tier, S3 origin auth against the private R2 bucket, cache-expiration override, token auth),
  then point `BUNNY_RECORDED_CDN_BASE`/`BUNNY_RECORDED_SECURITY_KEY` at it. One origin, no byte copying, R2 egress to
  Bunny is free, Bunny Volume ≈ per-GB on fallback traffic only. The glossary lists this cell as the mid-class rescue path.

**Status:** backend commits 77601bc66 (feature) + b01da91b3 (integration test) on `feat/playback-cdn-pilot` (quicktricks-backend worktree
`../worktrees/qt-backend-playback-cdn`, based on `origin/quicktricks-admin` 29dc69253). Not pushed, not deployed.
Written 2026-10-06.

## Pilot classes (user, 2026-10-06)
All three are recorded-bucket classes created 2026-07-01 (pre-cutover, so their HLS should be in B2 — not yet verified;
the probe needs a JWT and no CDN key is in the local env):

| classId | title | hlsAsset.key |
|---|---|---|
| 6a455930ebb42f585d9ad162 | Class 20 ‖ Average Part -20 | 472/6a455930ebb42f585d9ad162/hls/master.m3u8 |
| 6a455930ebb42f585d9ad16c | Class 21 ‖ Average Part -21 | 472/6a455930ebb42f585d9ad16c/hls/master.m3u8 |
| 6a455930ebb42f585d9ad179 | Class 01 ‖ Time & Work Part-1 | 472/6a455930ebb42f585d9ad179/hls/master.m3u8 |

```bash
node reference/scripts/playback_cdn_pilot.cjs probe --token <JWT> --runs 3 6a455930ebb42f585d9ad162 6a455930ebb42f585d9ad16c 6a455930ebb42f585d9ad179
```

## Why
Production recorded playback signs Cloudflare over R2 (`RECORDED_CDN_PROVIDER=cloudflare`). The team wants to
compare Bunny's edge against Cloudflare's on real traffic without flipping the whole tenant. Bunny's pull zone has
never served this tenant's video, so every Bunny number starts cold.

## What changes
- `Class.playbackCdn?: 'bunny' | 'cloudflare'`. Optional, stripped from public JSON, not settable through the admin
  API (`updateClassSchema` strips unknown keys). Operator script only.
- `GET /api/classes/:id/playback` picks the signer by precedence **query `?cdn=` > class `playbackCdn` > env default**,
  and a `cloudflare` candidate is honoured only when the Cloudflare signer is configured. Everything else in the
  mint (entitlement, streamer scope, view record) is untouched.
- Clients never parse the URL. Rollback is `unset`.

## The constraint: bytes, not routing
Since the 2026-09-10 cutover the transcoder writes R2 only. Bunny over B2 can serve a class only if its HLS objects
exist in `recordedvideos-hranker-v2` (B2) under the same key. Older classes were produced on the B2 stack and
should be there. The probe below proves it per class before anything is set.

## Runbook
1. **Probe first (no deploy needed).** The `?cdn=bunny` override is already live.
   ```bash
   node reference/scripts/playback_cdn_pilot.cjs probe --token <JWT> --runs 3 <classId> ...
   ```
   Run 1 on Bunny = cold edge. Any non-200 on the Bunny row means the objects are not in B2: copy that
   `472/<classId>/` prefix R2 → B2 (rclone) and re-probe. Do not set the override for a class that fails.
2. **Deploy the backend branch** (box pull + dist, the usual fork deploy). Pause gate: operator approves.
3. **Set the override** from the backend checkout on the box:
   ```bash
   node playback_cdn_pilot.cjs set bunny <classId> ...            # dry-run
   node playback_cdn_pilot.cjs set bunny <classId> ... --commit   # writes a backup JSON first
   ```
   Record the backup file in the prod data-changes ledger.
4. **Measure** over the same window: Bunny pull-zone stats vs Cloudflare analytics for the pilot classes (cache hit
   ratio, TTFB, origin pulls), plus repeated `probe --runs` from a few locations for cold/warm TTFB.
5. **End the pilot** with `unset ... --commit` (or keep Bunny for the winners).

## Probe results 2026-10-06 (from Raghav's machine, 3 runs, raw in `reference/playback-cdn-probe-2026-10-06.json`)
All three classes ARE in B2 and Bunny serves every hop with 200 once the directory token is carried onto child
and segment requests (the apps already do this; the first probe run forgot and saw 403s on the child).

| hop | Bunny (cold, run 1) | Bunny (warm, runs 2–3) | Cloudflare (all runs, HIT) |
|---|---|---|---|
| master.m3u8 | 1.0–1.9 s, MISS/REVALIDATED | **~1.05 s, REVALIDATED every time** | 70–360 ms |
| child .m3u8 | 1.0–1.2 s, MISS | **~1.08 s, REVALIDATED every time** | 60–200 ms |
| first segment | 1.7 s MISS | ~345 ms HIT | 65–150 ms |

Reading: Bunny re-validates both playlists against the B2 origin (us-east) on every request, so a Bunny start costs
~2.1 s before the first segment even when warm, versus ~0.2 s on Cloudflare. Segments do cache but a warm HIT is
~5x slower than Cloudflare's from this vantage (PoP distance or tiering; one location only, not a verdict).
The playlist revalidation is pull-zone configuration, not code: VOD playlists are immutable, so the Bunny zone should
override cache expiration for `*.m3u8` (hours) and probably enable Origin Shield before the pilot measures anything
meaningful. Otherwise the pilot measures a mis-tuned zone, not Bunny.

### Root cause of the playlist revalidation (headers, 2026-10-06 13:31Z)
Bunny pull zone **5927231** respects origin `Cache-Control`. The B2 objects carry `max-age=2` on `*.m3u8` (the live
transcoder's 2-second playlist TTL, frozen into the recording at upload) and `max-age=600` on `*.ts`. So Bunny
expires every playlist 2 s after caching it and revalidates against B2 on each request (~1 s), and even segments
expire after 10 minutes. The edge answering an India request was `BunnyCDN-SG1` (Singapore), which explains the
~340 ms warm segment HIT versus Cloudflare's ~70 ms from an India PoP; `perma-cache: MISS` says Perma-Cache is on
but not populated. Reprobe after the first report (`reference/playback-cdn-probe-2026-10-06-reprobe.json`)
was unchanged because nothing had been changed on the zone yet.

**Zone fix (Bunny dashboard, user):** Pull zone 5927231 → Caching → *Cache Expiration Time*: override to a long
value (this zone is immutable VOD), do NOT respect origin headers; enable *Origin Shield*; check the zone's
network tier / enabled regions so India requests land on an Indian PoP rather than SG1. Then reprobe the same
three classes: runs 2–3 should show HIT on master and child.

### Dashboard correction and approved change (2026-10-07)

The dashboard inspection supersedes the proposed zone fix above: zone 5927231 already displays a locked
1-year cache expiration override, but enabled edge rule #2 explicitly overrides `*.m3u8` to **2 seconds**
at both the edge and browser. Rule #3 already gives `*.ts` a 1-year edge TTL and 600-second browser TTL.
The origin headers alone therefore do not establish the active edge TTL.

After user approval, saved rule #2 with **Override Cache Time = 2592000 seconds (30 days)**; retained
**Override Browser Cache Time = 2 seconds** and the existing `*.m3u8` condition. Verified the saved rules
list shows these values. No purge, tier change, backend deployment, or class override was performed.
Playback latency and cache HIT behaviour have not yet been reprobed after this change.

Perma-Cache is enabled with storage zone `livestream-hranker-v2`; the loaded dashboard shows 26,415 files
and 6 GB. Rule #4 bypasses Perma-Cache for non-TS files. A transient missing-storage warning during page
loading disappeared once loaded. A `Perma-Cache: MISS` response does not prove the storage is empty:
[Bunny documents](https://bunny.net/docs/cdn/perma-cache) that this header can remain cached on edge HITs,
and that Perma-Cache and Origin Shield are mutually exclusive. Perma-Cache was retained.
At the time of the TTL change the zone remained on High Volume Tier; India routing/PoP coverage had not
been changed or established.

### Standard tier comparison (2026-10-07)

At the user's explicit request, switched zone 5927231 from High Volume Tier to **Standard Tier** and
confirmed the selection persists after reloading the pricing page. All displayed pricing regions,
including Asia & Oceania, are enabled. The dashboard lists Asia & Oceania at **$0.03/GB** (other regions
$0.01–$0.06/GB). No cache purge was performed. This is a comparison setting with no automatic rollback;
switch back through General → Pricing & routing → High Volume Tier → Confirm when the comparison ends.
Actual serving PoP, warm latency, and playlist HITs still require a fresh probe.

### After the zone fix (2026-10-07, `reference/playback-cdn-probe-2026-10-07-after-zone-fix.json`)
User set the Cache Expiration override and confirmed Perma-Cache is on; tier left on High Volume (fewer PoPs, India
coverage unverified; switching to Standard changes pricing and needs its own approval). Run 1 refilled the cache
(REVALIDATED, ~1 s per playlist); runs 2–3: every Bunny hop HIT at a flat 345–405 ms, Cloudflare 70–350 ms. The
remaining Bunny gap is one constant ≈350 ms on every hop regardless of size, i.e. round-trip to the Singapore PoP
the High Volume tier routes India to. The zone now measures Bunny-on-Volume-tier honestly, so the pilot can proceed.

### Standard tier (2026-10-07, `reference/playback-cdn-probe-2026-10-07-standard-tier.json`)
User switched zone 5927231 to the Standard tier. Edge for India is now `BunnyCDN-MU1` (Mumbai). Run 1 MISSes were
served in 120–520 ms (Perma-Cache, not B2); runs 2–3 every Bunny hop HIT at 55–105 ms versus Cloudflare 65–140 ms
from the same machine. Bunny is now at parity or slightly ahead on warm hits from one Indian vantage. The zone is
ready; the pilot's remaining variable is real-user traffic across regions and networks.

### Side finding 2026-10-07: the Cloudflare LIVE zone is not caching at all
Analysed the user's own replay URL (class 6ac4ae1a1e45121f102bc4b2, live bucket, `livev2.hranker.org`): every playlist
and segment answers `cf-cache-status: DYNAMIC`, TTFB 185–380 ms, no `age`, across two rounds, although R2 sends
`max-age=31536000, immutable`. No cache rule matches the live host, so every viewer pulls every segment from R2. The
recorded zone HITs at 60–100 ms. Segments are 2.4–4.0 s; the user's DevTools showed one 600 KB segment take 3.0 s
(0.96 s wait + 2.04 s download) — at the stall line. This, not the CDN vendor, is the buffering lead for live replays.
Fix: Cloudflare cache rule for `livev2.hranker.org` (eligible for cache, respect origin TTL so live playlists keep
their 2 s and segments their 1 y). Tracked in memory `livev2-cloudflare-not-caching`.
**Update 2026-10-07 later:** dashboard confirmed no rule existed; user added a `.ts`-only cache rule (playlists bypassed).
Re-check on the same replay URL: segments MISS once then HIT at 60–63 ms; `*-vod.m3u8` playlists still DYNAMIC at
285–520 ms. Open: include `-vod.m3u8` in the cached set (origin already marks them immutable).

## Out of scope
MP4 downloads (`downloadsController` signs Bunny only already), live-zone replays, an admin UI for the field.

### Back on High Volume tier (2026-10-08)
User switched zone 5927231 back to High Volume. Confirmed from an India request: `server: BunnyCDN-SG1-1174`,
`cdn-requestcountrycode: IN` (Singapore edge again). Expect the 2026-10-07 Volume-tier numbers: warm Bunny HIT
≈345–405 ms per hop vs Cloudflare 65–140 ms. That is the fallback's real cost. Branch rebased onto prod tip
26358867e (now 42165c60d + 30420cd97); the 22 pre-existing unit failures and the integration failures are identical to prod tip apart from one
flaky PDF-impression race; not yet deployed.

## Pilot live (2026-10-08)
After review the user chose to run the Bunny-over-B2 pilot. Added a69bf2c3d (override applies to recorded-zone assets only;
tests for live-zone ignore, unknown `?cdn=` fall-through, `?cdn=bunny` over class cloudflare). Deployed 4e854aba1 to the box
(fast-forward from 26358867e; dist backup `~/dist-backup-qt-20261008-162342.tar.gz`; API back in ~2 s). `list` was empty,
then `set bunny` on the three pilot classes (backup `~/playback-cdn-backup-2026-10-08T10-56-13-934Z.json` on the box).
`reference/scripts/playback_host_check.cjs` (admin preview, no view recorded) shows the pilots minting
`recordedvideos-hranker-v2.b-cdn.net` and a control class still on `recordedvideosv2.hranker.org`;
`reference/scripts/playback_walk.cjs` fetched master, child and first segment with 200 for all three. Those timings
(0.9–3 s) were taken from the OVH box, not a student network, and are not a pilot result.
Rollback: `node ~/playback_cdn_pilot.cjs unset <ids> --commit` from the box checkout.
