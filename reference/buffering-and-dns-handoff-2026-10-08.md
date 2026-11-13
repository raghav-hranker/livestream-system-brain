# Handoff: buffering, TTFB and DNS reachability — findings and next steps (2026-10-08)

Everything here was measured on 2026-10-06/07 unless marked *inferred*. Raw probe output:
`reference/playback-cdn-probe-2026-10-0{6,7}*.json`. Decision trail: `docs/plans/playback-cdn-pilot.md`.
Memory notes: `livev2-cloudflare-not-caching`, `playback-cdn-pilot`.

## 1. The topology that matters
| host | DNS answered by | address owner | role |
|---|---|---|---|
| `backend.quicktricksbysahilsir.com` | GoDaddy | OVH 148.113.49.18 (Apache, direct) | LMS API, mints playback URLs |
| `livev2.hranker.org`, `recordedvideosv2.hranker.org` | Cloudflare | Cloudflare shared anycast 104.26.0.54 / 104.26.1.54 / 172.67.71.54 (one trio per zone) | video, R2 origin |
| `recordedvideos-hranker-v2.b-cdn.net` | Bunny | Bunny | Bunny pull zone 5927231 over B2 |
| `selectionwaylive-proxy2.hranker.com` | Cloudflare (DNS-only record) | OVH Germany 57.129.57.3 | the old ASN-routed proxy |

## 2. Buffering: what we know
- HLS = playlist + 2.4–4.0 s chunks (~600 KB at 480p). A stall = a chunk's download time exceeded its play time.
- Download time = **TTFB** (distance + cache state; CDN-controlled) + **transfer** (size ÷ student bandwidth; not CDN-controlled).
- TTFB measured from Mumbai: Cloudflare HIT 60–140 ms; Cloudflare DYNAMIC/MISS (fetch from R2) 190–520 ms;
  Bunny HIT 55–105 ms on Standard tier, ~350 ms on High Volume (Singapore PoP).
- **Finding:** `livev2.hranker.org` had **no Cloudflare cache rule**. Every replay segment was fetched from R2 for
  every viewer. A 600 KB segment in Raghav's DevTools took 0.96 s wait + 2.04 s transfer = 3.0 s for ~3.5 s of
  video, i.e. at the stall line. A `.ts`-only cache rule was added 2026-10-07; segments now HIT at 60 ms; 404s
  BYPASS (verified, so a late segment never serves a cached 404).
- The live backend stamps `Cache-Control` per file type (`backend/lib/fileUpload.js cacheControlFor`): `.ts` and
  `*-vod.m3u8` immutable 1 y, live `.m3u8` max-age=2. Reconnects use ffmpeg `append_list` and continue segment
  numbering, so cached segments are never rewritten by a reconnect.

### Open on buffering
1. Add `-vod.m3u8` to the live cache rule (short TTL ≈ 1 h, or purge after a VOD repair). Saves ~0.5 s per replay start.
2. Livestream: a **new stream of an already-streamed class** restarts at `segment_0` and overwrites R2 under a
   1-year edge cache → mixed old/new chunks until purge. Fix = purge-by-URL at new-stream start or a session index
   in the path. Interim rule: one class, one stream.
3. No rebuffer telemetry exists. Apps should report rebuffer events with network type, city, CDN host, rendition.
   Until then, "buffering in tier-2/3 cities" cannot be attributed.
4. Transfer-side levers (not CDN): lower floor rendition / lower 240p bitrate, shorter segments, ABR starting low on mobile.
5. The ls viewer mounts the player twice on class open (two mints, two playlist fetches, segment_1 cancelled). Wasted startup.

## 3. DNS: what the black screen was
- Symptom: app works, player black, no error. Fixed for some students by private DNS to one.one.one.one; fixed
  for ASN-routed students by the OVH proxy.
- The API is on GoDaddy DNS + a plain IP, so minting always worked. Only the Cloudflare-served video names failed.
- One.one.one.one fixing it ⇒ the ISP **resolver** was returning no/bad answers for those names (name-level block,
  the way Indian ISPs enforce court-ordered blocks). The proxy working ⇒ a hostname on Cloudflare DNS (`hranker.com`)
  still resolved, so it was **not** "can't reach Cloudflare nameservers". The proxy also moved to a non-Cloudflare
  address, so an additional IP-level block on the shared trio is *possible, unconfirmed*.
- Subdomains in one zone share the same Cloudflare address trio; another zone gets its own; a DNS-only record
  bypasses Cloudflare addresses entirely (that is what the proxy did).

### Fallback design (agreed in principle, not built)
- Primary: Cloudflare over R2 (cost: R2 zero egress + flat zone; speed: parity; shipped).
- Fallback: **Bunny over R2** (pull zone with R2 as S3-compatible origin, region `auto`, R2 read token; cache
  expiration override; token auth) on a hostname whose resolution chain never touches Cloudflare DNS or Cloudflare
  addresses: `*.b-cdn.net`, or a GoDaddy-served CNAME to it. Never `*.hranker.org` / `*.hranker.com`.
  High Volume tier is acceptable (fallback traffic only). Bunny↔R2 S3 auth is **unverified** (glossary note).
- Client trigger: on manifest/segment failure **with no HTTP status** (DNS fail, connect timeout, TLS fail) or a
  Cloudflare 520–524, re-mint with `?cdn=bunny` (already live in prod) and retry; remember per device/session.
  **Never** on 403 (token problem, re-mint same CDN) or 404 (asset missing).
- Bunny over B2 is not a fallback: it only has pre-2026-09-10 classes.

### Open on DNS
1. Confirm which block it is, next incident, before the student switches DNS: `nslookup` the API host, the
   Cloudflare video host and the Bunny host from the affected network, plus the ISP name. Only-hranker-fails ⇒
   name block; all fail ⇒ broader resolver issue (then the app would be down too).
2. Replace the static ASN routing with the client-side trigger above; block lists change per ISP over time.
3. The app should surface a manifest-load failure instead of a black screen.
4. Build + verify the Bunny-over-R2 zone (runbook + probe run), then point `BUNNY_RECORDED_CDN_BASE` /
   `BUNNY_RECORDED_SECURITY_KEY` (and the live twins) at it.

## 4. Tools
- `reference/scripts/playback_cdn_pilot.cjs probe --token <JWT> --runs N <classId>...` — both CDNs, master→child→segment,
  status/TTFB/cache header. Carries the Bunny query token to child requests like the apps do.
- For a class the token is not entitled to, paste a signed URL from DevTools and run the same walk by hand (see the
  2026-10-07 replay analysis in the plan doc).
