# CDN-side actions for HLS startup and rebuffering (Cloudflare + R2, India)

Researched and probed 2026-10-13. Read-only: nothing was changed. "Unverified" means the docs do not settle the point.

## Probe results (curl 8.7.1 from Mumbai, unsigned root `/`)

| | livev2.hranker.org | recordedvideosv2.hranker.org |
|---|---|---|
| Status | 403 (WAF, as expected) | 403 |
| `server` | cloudflare | cloudflare |
| `cf-ray` PoP | BOM | BOM |
| `alt-svc` | **absent** | **absent** |
| DNS `HTTPS` RR (1.1.1.1) | none | none |
| `/cdn-cgi/trace` | `colo=BOM http=http/2 tls=TLSv1.3 kex=X25519 loc=IN` | same |
| `--http2` vs `--http1.1` | HTTP/2 403 vs HTTP/1.1 403 (both work) | same |
| `content-encoding` with `Accept-Encoding: br, gzip` | `br` on the 403 HTML page | `br` |
| `accept-ranges`, `cf-cache-status` | absent (WAF block, never reached cache) | absent |

This confirms HTTP/3 is off on both hosts. A 403 HTML page says nothing about how .m3u8 or .ts responses are compressed, so I did not probe signed media. The local curl has no HTTP/3 support, so an h3 test needs `curl --http3` built with ngtcp2/quiche, or a browser.

## Ranked checklist

| # | Action | Expected effect | Plan | Cost | Effort | Verify with |
|---|---|---|---|---|---|---|
| 1 | Cache **live** `.m3u8` at the edge with a TTL of 1–2 s (Edge TTL "respect origin", which picks up R2's `max-age=2`), using a separate cache rule from finished `-vod.m3u8` | Large for live and replay. Playlist fetches drop from 285–520 ms DYNAMIC to about 60 ms HIT for most requests. 2,000 viewers become about 1 origin fetch per 2 s per PoP instead of 500 rps to R2 | All (Free 10 / Pro 25 rules) | $0 | 15 min | `cf-cache-status: HIT/EXPIRED/REVALIDATED`, `age: 0–2` |
| 2 | Cache finished **`-vod.m3u8`** for 1 y (override origin) | Large for replay startup. Removes about 300–450 ms from the first request | All | $0 | 5 min (same rule edit) | `cf-cache-status: HIT`, `age` grows |
| 3 | **Status-code TTL** on the live host: 404 for 1 s at most (or no cache); 5xx not cached | Prevents rebuffering when a segment or playlist that is requested slightly early gets a cached 404 for 10 s | All | $0 | 5 min | Request a missing name twice: second response is `MISS`/`EXPIRED`, not a 10 s `HIT` |
| 4 | Turn on **Smart Tiered Cache** (if not already on) | Medium for MISS latency and hit ratio. All Indian PoPs fill from one upper tier next to the bucket, so a DEL miss can hit an upper tier that BOM already warmed | All, free | $0 | 1 click | Logpush `CacheTieredFill`/`UpperTierColoID` (Enterprise only). Otherwise compare MISS rates in the Analytics UI. No response header shows it (unverified) |
| 5 | **HTTP/3** on | Small to medium on lossy mobile links (Jio/Airtel 4G). Cloudflare's own 2020 data shows TTFB 176 vs 201 ms but no gain on a 1 MB transfer | All, free | $0 | 1 click | `alt-svc: h3=":443"` appears. `/cdn-cgi/trace` shows `http=http/3` in Chrome |
| 6 | **0-RTT** on | Small, only on reconnects (about 1 RTT saved on resumed TLS). Applies to GET/HEAD only | All, free | $0 | 1 click | Origin sees `Early-Data: 1` (unverified whether this is visible with R2) |
| 7 | **Compression Rule** for `application/vnd.apple.mpegurl` / `application/x-mpegURL` | Small to medium for large VOD playlists (12.5 s segments mean shorter playlists, but long classes still produce tens of KB). Not in the default compressed list | Compression Rules, plan unverified | $0 | 10 min | `content-encoding: br` on a signed `.m3u8` |
| 8 | Strip **CMCD / query strings** from the cache key (URL rewrite sets query to empty, or Cache Rule "Ignore query string"), or send CMCD in header mode | Prevents the cache fragmenting once CMCD telemetry ships (every request would otherwise be a MISS) | Ignore query string: all plans per the cache-keys table; per-parameter exclusion is Enterprise only | $0 | 10 min | Same URL with a different `?CMCD=` value returns `HIT` |
| 9 | Prewarm with a **Worker cron** that fetches the next day's first N segments + playlists through the zone | Small to medium for first-viewer startup on recorded content. Warms only the PoP the cron runs in, plus the upper tier when tiered cache is on | Workers Paid $5/mo | Negligible at this volume | 0.5–1 day | `cf-cache-status: HIT` on the first student request |
| 10 | Logpush `http_requests` with cache and timing fields | Measurement only, no direct effect | **Enterprise only** | n/a | — | — |
| 11 | Argo Smart Routing | Unverified, probably small. The origin (R2) is already on Cloudflare's network, and Argo only affects origin-bound traffic | Paid add-on (Smart Shield + Argo) | Third-party figures say $5/mo + $0.10/GB (unverified against Cloudflare docs) | 1 click | Logpush `SmartRouteColoID` (Enterprise) |
| 12 | Cache Reserve | **Likely not applicable.** Docs say requests to R2 public buckets linked to the zone's domain do not use Cache Reserve | Paid add-on / Smart Shield Advanced | $0.015/GB-mo, $4.50/M writes, $0.36/M reads | — | `CacheReserveUsed` in logs |
| 13 | Prefetch URLs | **Not applicable.** Enterprise only, and Cloudflare only prefetches file types cached by default; `.ts`/`.m3u8` are not | Enterprise | — | — | — |
| 14 | Replace the WAF rule with a Worker in front of R2 | No startup gain on its own (adds a Worker hop). Only worth it for features the WAF rule can't do | Workers Paid | about $0.30/M requests (see §6) | Days | — |

Recommended order: 1+2+3 in a single cache-rule edit, then 4, 5, 6, then 7 and 8 before CMCD ships, then 9.

## Notes per item

### 1. HTTP/3 + 0-RTT
- Enable at Speed → Settings → Protocol Optimization, or API setting `http3`. Available on all plans at no listed cost. It applies only between the client and Cloudflare; HTTP/3 to the origin is "not yet supported". https://developers.cloudflare.com/speed/optimization/protocol/http3/
- 0-RTT is off by default and available on all plans. GET/HEAD/OPTIONS only (not POST). Adds `Early-Data: 1`. https://developers.cloudflare.com/speed/optimization/protocol/0-rtt-connection-resumption/
- Cloudflare data (2020): TTFB 176 ms (h3) vs 201 ms (h2). A 1 MB page was 2.33 s (h3) vs 2.30 s (h2). Real-site results were 1–4% *slower* on h3 because h2 used BBR and h3 used CUBIC. https://blog.cloudflare.com/http-3-vs-http-2/. The gain is in loss recovery and connection setup, not throughput. Newer Cloudflare benchmarks: unverified.
- Caveats: the docs say nothing specific about range requests or large objects over h3 (unverified). Some Indian carrier or enterprise networks throttle UDP/443, but clients fall back to h2 automatically. AVPlayer/ExoPlayer h3 support depends on the OS and stack (unverified).

### 2. Tiered Cache, Cache Reserve, Argo
- Tiered Cache with Smart topology is free on all plans. Generic Global, Regional and Custom topologies are Enterprise only. https://developers.cloudflare.com/cache/how-to/tiered-cache/
- For an R2 origin, Smart Tiered Cache picks an upper tier near the bucket's region (changelog 2024-11-20). https://developers.cloudflare.com/changelog/post/2024-11-20-smart-tiered-cache-for-r2/ , https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/
- Cache Reserve costs $0.015/GB-month storage, $4.50/M Class A, $0.36/M Class B. It needs a TTL of at least 10 h and a Content-Length. **"Requests to R2 public buckets linked to a zone's domain will not use Cache Reserve."** https://developers.cloudflare.com/cache/advanced-configuration/cache-reserve/. If the media hosts are R2 custom domains, Cache Reserve does nothing here. Even if it did, it is backed by R2, so it would only replace one R2 read with another.
- Argo is now sold as part of Smart Shield ("Smart Shield + Argo" and "Advanced" packages). It routes traffic between a Cloudflare DC and the origin, and cache HITs never reach the origin. https://developers.cloudflare.com/smart-shield/get-started/ , https://developers.cloudflare.com/argo-smart-routing/get-started/. Price and billing basis are not on the docs pages; third parties say $5/mo + $0.10/GB (unverified). Whether Argo speeds up the edge→R2 hop at all: unverified.

### 3. Cache rules for HLS
- Edge TTL modes: `respect_origin`, `override_origin`, `bypass_by_default`. Status Code TTL overrides the origin's headers. "Serve stale while revalidating" is a toggle. https://developers.cloudflare.com/cache/how-to/cache-rules/settings/. Rule counts: Free 10, Pro 25, Business 50, Ent 300. https://developers.cloudflare.com/cache/how-to/cache-rules/
- Neither `.m3u8` nor `.ts` is cached by default, so a rule that marks them eligible is required (the recorded host already has one). Default TTLs: 200/206 120 min, 404 3 min. https://developers.cloudflare.com/cache/concepts/default-cache-behavior/
- How Cloudflare reads `Cache-Control` (OCC is always on for Free/Pro/Business): `s-maxage` is honoured but implies proxy-revalidate, which disables stale serving. **`immutable` has no effect on Cloudflare's cache** and is only passed to browsers. `stale-while-revalidate` is honoured and asynchronous (the first request after expiry gets stale content with status `UPDATING`), but it is ignored when Always Online is on. `stale-if-error` applies to 5xx only. https://developers.cloudflare.com/cache/concepts/cache-control/ , https://developers.cloudflare.com/cache/concepts/revalidation/
- For live playlists: respect origin `max-age=2`. Optionally have R2 metadata add `stale-while-revalidate=2` so a revalidation never blocks a player (at the cost of a playlist up to about 2 s stale). Don't use `s-maxage`, because it kills stale serving. Cloudflare's cache lock and concurrent streaming mean one fetch per PoP serves every waiting viewer (2019 claim, no opt-in needed). https://blog.cloudflare.com/introducing-concurrent-streaming-acceleration/
- For finished `-vod.m3u8`: `immutable` alone is not enough. Use Edge TTL override 1 y, or make sure R2 sends `max-age=31536000`. A match on the `-vod.m3u8` suffix separates them from live playlists.
- Status-code TTL on the live host: the recorded host's 10 s 404 TTL is too long for live. A player that asks for segment N+1 a moment early would see a cached 404 for 10 s.

### 4. R2 as origin and MISS latency
- With Smart Tiered Cache, a MISS goes BOM lower tier → upper tier near the bucket → R2. Without it, each PoP goes to R2 directly. The docs don't break the 190–520 ms down. It is plausibly the BOM→bucket-region RTT plus R2's first-byte time (unverified). The bucket region and any upper tier are not shown in headers.
- R2 has location hints (`apac` etc.), but they are "best effort", set only at bucket creation, and only "honored the first time a bucket with a given name is created". Changing one means a new bucket and a data copy. https://developers.cloudflare.com/r2/reference/data-location/. R2 has no "Smart Placement" (that is a Workers feature). Whether `apac` sits in India or in Singapore/Tokyo is unpublished (unverified). Item 1 removes most MISSes anyway, so moving the bucket is low priority.

### 5. Prefetch and prewarm
- Prefetch URLs is Enterprise only, uses a Link-header manifest, and only prefetches files cached by default, which excludes HLS. https://developers.cloudflare.com/speed/optimization/content/prefetch-urls/
- The Workers Cache API is per data center and `cache.put` "is not compatible with tiered caching". Use `fetch()` through the zone instead. A `put` with a 206 throws. https://developers.cloudflare.com/workers/runtime-apis/cache/
- A cron Worker runs in whichever PoP Cloudflare schedules it, so you can't choose BOM/DEL/MAA. What a prewarm reliably warms is the **upper tier** (with tiered cache on). From India, an external prewarm (one cheap VM or box curl per metro) through each metro's PoP would warm the lower tiers too. Each request must carry a valid `/v/<token>/` or a dedicated prewarm token.

### 6. Worker in front of R2 vs the WAF rule
- Workers Paid: $5/mo including 10 M requests, then $0.30/M. CPU is billed only on cache miss or bypass. https://developers.cloudflare.com/workers/platform/pricing/
- Load model: 2,000 viewers × 1 segment per 4 s = 500 rps for segments, plus about the same again for playlist polls, so about 1,000 rps. That is 3.6 M requests per live hour. At 3 h/day × 30 days ≈ 324 M/mo ≈ **$95/mo**. Running 24×7 at that rate ≈ 2.6 B/mo ≈ $775/mo.
- Pros: token logic in code (expiry, per-user binding), custom headers, R2 binding range reads. Cons: an extra hop on every request, including HITs. The WAF HMAC rule plus URL rewrite is free and runs before cache. Snippets ("no extra cost" on Pro+, GA 2025-04-09, https://blog.cloudflare.com/snippets) are a free middle ground for header logic.

### 7. Range requests and 12.5 s segments
- Cloudflare serves single and multipart ranges from complete or partial cache. **On a cold miss, the first origin request omits `Range`**, which fetches the whole object. With "Origin Range Requests" (a cache-rule setting, plan unverified), fetches align to 1 MiB boundaries, and that feature is incompatible with Cache Reserve. https://developers.cloudflare.com/cache/reference/range-requests/. Ranges therefore share one cache entry for the object and do not split the cache. For segments of about 1 MB, ranges don't matter. hls.js and AVPlayer fetch whole TS segments unless the playlist uses byte-range (`EXT-X-BYTERANGE`).
- Rebuffering risk with 12.5 s segments is a player and encoder issue (larger first fetch, coarser ABR switches), not a CDN one.

### 8. Compression
- The default compressed types are text, JSON, JS and similar. `application/vnd.apple.mpegurl`, `application/x-mpegURL` and `video/mp2t` are **not** in the list. Pro/Business default to Brotli, Free to Zstd. https://developers.cloudflare.com/speed/optimization/content/compression/. Playlists are therefore probably *uncompressed* today (unverified without a signed probe). Add a Compression Rule https://developers.cloudflare.com/rules/compression-rules/ for playlist types only. Segments should stay uncompressed (TS is already compressed, and compression would break byte ranges).

### 9. India PoPs, ISPs, DNS fallback
- Cloudflare status lists 23 Indian PoPs, including BOM, DEL, MAA, HYD, CCU, BLR, AMD, PNQ, NAG, KNU, PAT, IXC, COK, BBI. On 2026-10-13, BLR, CCU and COK showed "degraded_performance". https://www.cloudflarestatus.com/api/v2/components.json. Which PoP a Jio or Airtel user lands on depends on that ISP's peering (unverified per ISP).
- No public 2025–26 Jio/Airtel–Cloudflare peering dispute found. Extreme-IX logged several hours-long Cloudflare peering degradations in BOM/DEL/MAA/BLR in 2025. https://status.extreme-ix.org/incidents/293633. Cloudflare China Network is China-only and irrelevant here. Regional Services only restricts where TLS terminates and does not speed anything up.
- **Correction to the brief:** a non-Cloudflare authoritative DNS *is* possible while keeping the Cloudflare proxy, via a **Partial (CNAME) setup**. The external DNS CNAMEs `livev2` to `livev2.hranker.org.cdn.cloudflare.net`. It requires **Business or Enterprise**. https://developers.cloudflare.com/dns/zone-setups/partial-setup/. On Pro, the proxy needs Cloudflare as authoritative DNS. This doesn't help if an ISP blocks the hostname or Cloudflare's IPs, since the same name and IPs are served.
- Realistic fallbacks if the hostname is blocked: (a) the existing Bunny pull zone on a separate hostname, switched by the LMS playback API. (b) Cloudflare for SaaS custom hostname on a different apex (100 hostnames included, $0.10 each beyond that, all plans): https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/. Same Cloudflare IPs, so it only helps with name-based blocks. (c) A Worker route on a second domain's zone, also on Cloudflare IPs. Only (a) survives an IP-level block of Cloudflare.

### 10. Measurement
- Logpush `http_requests` fields: `CacheCacheStatus`, `CacheTieredFill`, `UpperTierColoID`, `CacheLockWaitedMs`, `CacheReserveUsed`, `EdgeColoCode`, `EdgeTimeToFirstByteMs`, `OriginResponseDurationMs`, `ClientASN`, `ClientTCPRTTMs`, `ClientRequestProtocol`, `SmartRouteColoID`. https://developers.cloudflare.com/logs/logpush/logpush-job/datasets/zone/http_requests/. Zone Logpush is **Enterprise only** (third-party docs plus the Cloudflare availability table; https://developers.cloudflare.com/logs/logpush/). On Pro, use dashboard Analytics (cache status by path and colo is limited) or the GraphQL Analytics API (`httpRequestsAdaptiveGroups` with `cacheStatus`, `coloCode`, `clientAsn` dimensions; unverified per plan). The telemetry endpoint already live can carry `cf-ray` PoP and `cf-cache-status` from the player.
- CMCD: per-parameter query exclusion is Enterprise only. "Ignore query string" or a URL-rewrite rule that empties the query works on any plan, and the rewrite runs before cache lookup (community-reported, unverified in official docs). https://developers.cloudflare.com/cache/how-to/cache-keys/. Simplest: send CMCD as request headers (`CMCD-Request`, etc.), which never touch the cache key.
