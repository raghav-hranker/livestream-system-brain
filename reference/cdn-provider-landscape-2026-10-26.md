# CDN provider landscape vs Cloudflare+R2 for HLS to India (2026-10-26)

Desk research from primary sources (provider sweep 2026-10-22, verification and synthesis 2026-10-26) that re-checked the key claims for the main candidates, probed HTTP/3 from one machine in India, re-read only CacheFly's and BlazingCDN's pricing pages among the minor CDNs, checked CDNetworks, Tata Communications and Airtel only for the Excluded table, never verified Azure, KeyCDN or EdgeOne, ran no test from a Jio or Airtel phone, and changed nothing on any account.

Tenant: shared. The findings apply to both tenants. The first-party measurements are from quicktricks. "Six metros" below means Mumbai, Delhi, Chennai, Hyderabad, Bangalore and Kolkata. "V" numbers point to rows in the Verification log.

## Verdict

**Which other CDNs can you use?** Bunny.net and AWS CloudFront are the two usable alternatives on self-serve terms. Fastly, Gcore, Google Cloud CDN, Azure Front Door, KeyCDN, 5centsCDN and EdgeOne can be bought self-serve. Each one misses hard requirements or costs far more. CacheFly has a self-serve entry plan, but traffic at this volume needs a sales-sized commit with no published price (V42). Akamai, CDN77, Alibaba, CDNetworks, Tata Communications, Airtel's Edge CDN and the second-tier CDNs are excluded.

**Which are at par for this workload?** "At par" here means three things. Edge HIT time from the operator's Mumbai vantage falls inside Cloudflare's measured range in the Latency table. Every hard requirement is met natively or with named code. Signup is self-serve at a published price. By that test, none is at par as a full replacement. Bunny on the Standard tier comes closest and fits as a fallback. It matched Cloudflare's cache-HIT latency from Mumbai and uses the same path-prefix HMAC token model. It has no Hyderabad PoP, and its edges served no HTTP/3 in a 2026-10-26 probe (V35). Both are accepted gaps for the fallback role only, for the reasons under Recommended architecture. Private R2 as its origin is untested (V36). As primary it is below Cloudflare: it costs many times more (see Cost), and RIS shows no direct Jio or Airtel adjacency. CloudFront on a flat-rate plan is an unmeasured second-network candidate. Nobody has measured its HIT time from Mumbai or from Jio and Airtel phones, and RIS shows no direct Jio or Airtel adjacency. It also needs custom token code and a secret-header origin, and it still reads from R2.

**Is Cloudflare the best?** Among self-serve offerings with published prices, yes on cost. Nothing self-serve comes close to a flat Pro zone over R2. On India reachability, no CDN in this report is shown to be more reachable. Cloudflare has 22 Indian cities and direct Jio and Airtel adjacency in RIS, which Bunny and Amazon lack in public data. Its weakness is that playback depends on one network, on shared IPs you cannot move. Any CDN on shared IPs carries the same class of risk. The fix is a second hostname on a second network, not a different primary. On support and plan gating, no: Pro has no SLA, and some cache controls need Business or Enterprise. The best self-serve setup is Cloudflare plus R2, with a second hostname on a second network.

Across the whole market, three sales-led offerings address the weak points. Cloudflare Enterprise, listed as the Contract plan at a custom price, adds static IPs or BYOIP, an SLA and per-parameter cache keys [8][23][3]. Akamai Adaptive Media Delivery has the strongest Indian interconnect in public data, with direct Jio and Airtel adjacency [83][151]. Fastly Streaming Delivery has the same direct adjacency, and JioCDN, built on Fastly, serves from inside Jio's own network [74][81][151]. None publishes a price, so each was excluded under the self-serve requirement. Ask for quotes once player telemetry shows Jio or Airtel failures that the fallback does not fix. One example threshold: more than 1% of Jio or Airtel sessions failing on both hostnames over two weeks.

## Scorecard

As of the 2026-10-22 sweep. The Cloudflare, CloudFront, Bunny, Fastly, Gcore and 5centsCDN rows were re-checked on 2026-10-26. The 404, purge and HTTP/3 columns were added on 2026-10-26. Their Cloudflare, CloudFront, Bunny, Fastly, Google, Gcore and CacheFly cells were read or probed that day. The other cells in those columns come from the 2026-10-22 sweep. Bunny's per-PoP rates and BlazingCDN's price tiers were also read on 2026-10-26 (V47, V48).

| Provider | India PoPs | Self-serve | HMAC token fit for HLS | Private R2/B2 origin | HLS cache control | No cached 404s | Purge by URL and prefix | HTTP/3 | Logs on self-serve | Published India price | Rating |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cloudflare Pro + R2 (incumbent) | 22 cities, all six metros [12][13] | Yes | Yes. WAF HMAC rule with path-prefix scope, Pro and up [15] | R2 is first-party, no credentials. B2 not allowed for video on Pro [9] | Rules needed for .ts and .m3u8 [17]. Pro edge-TTL override floor is 1 h, so live TTL comes from R2 headers [16] | Live host 404s were served as BYPASS on 2026-10-24 [2]. Status Code TTL, including no-store, has no stated plan gate [168] (V38). Recorded host caches 404s for 10 s [3] | URL, prefix, tag and all, on all plans [21] | All plans [22]. Off on both media hosts, probed 2026-10-26 (V34) | Logpush on Pro since 2026-09-30, priced by GB, see Cost [19] | No per-GB charge [8] | Baseline |
| AWS CloudFront, flat-rate plans | 7 cities, all six metros plus Pune. Embedded PoPs in 46 cities by sales request [39][40] | Yes | Not native. Needs a CloudFront Function with HMAC. Native signed cookies are RSA and prefix-scoped [43][37] | Not native. OAC signs AWS origins only. R2 needs a secret header plus a WAF rule [44] | Any extension cacheable. Custom TTL policies need Business [45][37] | Error TTL per status code, default 10 s, 0 allowed for custom origins [46]. Same on flat-rate: Unverified (V3) | Exact path or trailing * prefix, all tiers [47][37]. Pay-as-you-go: first 1,000 paths free, then $0.005 each [41]. Flat-rate per-path fee not stated | All tiers [37] | Standard logs on Pro and up. No real-time logs on flat-rate [37] | Flat plan, not region-priced [36] | Unmeasured second-network candidate |
| Bunny.net, Standard tier | 5 cities. No Hyderabad [53] | Yes | Yes. HMAC-SHA256 path token with token_path prefix [54] | SigV4 to an S3 URL with a free-text region, documented for B2 and in use [55][170][5]. No Bunny doc for R2: Unverified (V36) | Cacheable by default. Per-extension edge rules in use on the pilot zone [56][5] | Per-zone switch for caching errors [171]. Off by default in Bunny's Terraform provider [172]. Pilot zone value not read (V37) | Exact URL or * prefix by API, plus tag and full zone [173]. No wildcard purge with Perma-Cache [59] | None on MU1 or SG1 edges, and no HTTP/3 field in the API, 2026-10-26 (V35) | Raw logs free [60] | $0.03/GB at all five Indian PoPs [52][194] | Fallback candidate, pending the R2 origin test. Below as primary: cost, no Hyderabad, no direct Jio or Airtel adjacency in RIS |
| Fastly | 35 named cities: multi-POP sites in five metros and Noida, 29 embedded including Bangalore [71] (V41) | Yes | Custom VCL or JWT with path wildcard [77] | SigV4 recipe for S3-compatible stores. R2 untested [76] | Full VCL [78] | Cached by default. Override in VCL [78] | URL, surrogate key and all. No prefix purge, so keys must be set in VCL [177] | Yes, client side, no plan gate stated [176] | Real-time log streaming included [73] | India region $0.28 then $0.24/GB, nothing published above 20 TB [70] | Below on cost |
| Akamai | Facilities in 7 cities per PeeringDB [83] | No, sales only [82] | Yes. hdnts and hdntl with ACL path scope [84] | R2 and B2 auth undocumented | Live and VOD modes | Cached 10 s by default. Can be turned off [184] | URL, CP code and tag. Prefix only through ECCU, up to 40 min [185] | Yes [186] | Under contract only | Not published | Excluded |
| Google Cloud CDN | 3 cities: Mumbai, Delhi, Chennai [87] | Yes | Query or cookie URLPrefix. Unsigned requests are not blocked [88] | SigV4 private origin auth [89] | Per-route TTL [90] | Not cached by default [90] | Path, trailing * prefix, host and cache tag, about 10 s each [178] | On by default on the load balancer [179] | Cloud Logging, no tier gate | $0.09/GiB first 10 TiB in APAC [86] | Below |
| Azure Front Door (Unverified) | 4 cities. No Bangalore or Kolkata [95] | Yes | No GA HMAC signing [96] | No S3 signing [98] | Rules engine | Undocumented | Path or prefix wildcard, up to 10 min [187] | Not supported per the FAQ [96] | Access logs on Standard | $0.109/GB first 10 TB [94] | Below |
| Gcore | 1 city: Mumbai [101][102] | Signup yes. HLS needs Support approval and a paid plan [104]. Whether PAYG counts is Unverified (V40) | MD5 query token. Directory scope not recursive [103] | SigV4 to any S3 store. R2 untested [105] | By status code [107] | 4xx not cached by default [107] | URL, * pattern and all. One pattern request per minute [180] | API option http3_enabled [181] | Log Viewer. Export enabled by Support | €0.01/GB global [99] | Below |
| KeyCDN (Unverified) | 1, listed as Bangalore [111] | Yes | MD5 over the exact path, no prefix [112] | No SigV4. X-Pull header only | Zone-level only | Not cached [188] | URL or whole zone. No prefix [189] | Not listed [114] | Log forwarding add-on | $0.08/GB Asia, first 10 TB [110] | Below |
| CacheFly (Unverified) | 1: Mumbai [116] | Entry plan by portal signup. Above the included 10 TB, a sales-sized commit [115] (V42) | HMAC per full path, enabled by support [118] | SigV4 S3 origin. R2 and B2 untested | Per-path script enabled by CacheFly | Cannot be turned off, per the sweep | URL on the entry plan. Tag and bulk on the next plan [115] | Listed on the entry plan [115] | Basic logs | No per-TB price above the included 10 TB [115]. AUP clause on concentrated traffic [117] | Below |
| 5centsCDN | 1: Mumbai, on OVH address space [120][121] | Yes | MD5 query token | AWS-format keys only (Unverified) [123] | Segmenter TTL rules | Undocumented. Always Online may serve stale copies on 404 | URL for all. Pattern only on a higher plan [190] | No. The Mumbai edge refused TLS 1.3 in the sweep | Raw logs through support | $15/TB on the Enterprise network [119] | Below |
| CDN77 | 0 [125] | No, sales form | MD5, one directory [126] | AWS S3 keys. R2 untested | TTL floor of 10 min [127] | Floor of 1 s. 0 is not allowed [127] | URL list and directory wildcard [191] | Seen on one edge in the sweep. Default for customers Unverified | Paid add-on | $990 flat up to 250 TB [124] | Excluded |
| Alibaba Cloud CDN | 0 [129] | Yes | MD5 per URI [130] | OSS only [131] | Rules | Cached briefly by default. A TTL of 0 turns it off, per the sweep | URL and directory, with daily quotas [193] | Per-domain toggle, billed per request [192] | SLS logs | $0.108/GB in AP2 [128] | Excluded |
| Tencent EdgeOne (Unverified) | Mumbai and Chennai, vendor claim only. None in PeeringDB [135][136] | Yes | MD5 or SHA-1 per path [134] | SigV4 S3-compatible. R2 untested | Rules | Cached by default, per the sweep | URL and prefix, quotas by plan, per the sweep | Personal plan and up, billed per request [133] | Real-time push free | $0.1229/GB first 2 TB [133] | Below |
| BlazingCDN, Medianova, Leaseweb | Not disclosed, or Mumbai only [140] | Mixed | Undocumented | Undocumented | Partial | BlazingCDN caches errors by default [138]. Others undocumented | BlazingCDN by path and bulk, prefix not stated [138]. Others undocumented | BlazingCDN no [138]. Leaseweb yes [141] | Mixed | BlazingCDN $5/TB for the first 5 TB, falling by tier to $4/TB at 25-100 TB, $25 minimum [139]. Others by quote | Excluded |

## Cost at 20 / 50 / 100 TB per month

Estimated monthly USD. Prices read 2026-10-22. Cloudflare, CloudFront, Gcore and 5centsCDN prices re-checked 2026-10-26. CloudFront plan allowances, S3 prices, CacheFly's pricing page, Bunny's per-PoP rates, BlazingCDN's tiers and Cloudflare's Logpush prices also read 2026-10-26. Assumptions: 1 TB is 1,000 GB. 95% of bytes go to India. The other 5% is priced at each provider's rate for the rest of Asia. 100 M requests per 20 TB. Volumes are combined across both tenants. What reaches the origin follows the next table, which uses the operator's measured miss shares where they exist. Each R2 read costs $0.36 per million after 10 M free (R2 page dated 2026-10-01). Fill bytes add cost only where the CDN bills them: Fastly shield-to-edge fill, Gcore origin pull, Google cache fill, and B2 egress for 5centsCDN. Log export fees are left out of every row. Each provider's dashboard analytics is taken to meet the logs-or-analytics requirement, and Cloudflare Logpush is priced in its own table below. R2 storage and writes are the same in every row and are left out. Taxes are left out. EUR converted at 1.1234 (ECB, 2026-10-21). The arithmetic is in the table after the notes.

| Origin input | Value | As of | Source |
|---|---|---|---|
| livev2 requests answered DYNAMIC or MISS, so read from R2 | 21.4% in the quiet baseline: 69.16k plus 3.85k of 340.38k. 23.6% in the main window: 46.43k plus 11.83k of 246.72k | 2026-10-24 | [2] |
| livev2 requests answered DYNAMIC | 20.3% baseline, 18.8% main. Live playlists were 0% HIT. Class A had 39.01k DYNAMIC playlist requests against 43.57k segment requests in the main window | 2026-10-24 | [2] |
| livev2 requests answered MISS | 1.1% baseline, 4.8% main | 2026-10-24 | [2] |
| Raw size of a live playlist | 74-102 KB, because hls_list_size is 0 and the list grows all class | 2026-10-20 and 2026-10-24 | [7] |
| recordedvideosv2 miss share | Not read from the dashboard. Unverified | n/a | n/a |
| Model: requests and bytes on the live hosts | Half. Unverified: no per-host split was read | Assumption | n/a |
| Model: live-host requests that are playlist polls | 20%, the measured DYNAMIC share. So polls are 10% of all requests | 2026-10-24 | [2] |
| Model: live-host segment misses | 5%, the main-window MISS share rounded up | 2026-10-24 | [2] |
| Model: misses on the other hosts | 10% of requests and bytes. Unverified, kept from the sweep until the recordedvideosv2 share is read | Assumption | n/a |
| Model: live playlist fills where playlists are cached | Fetching locations x 4 rungs x 3,600 / TTL x 300 class-hours, capped at the number of polls. A 1 s TTL gives 4.32 M per location per month. A 2 s TTL halves it. Each fill is about 0.1 MB raw | Assumption | [7] |

| Provider and plan | Origin assumed | Origin egress and fill in the figure | 20 TB | 50 TB | 100 TB | Source |
|---|---|---|---:|---:|---:|---|
| Cloudflare Pro as configured today, monthly billing | R2 custom domain | $0 egress. Live playlists are uncached, so every poll reads R2. R2 reads $2.70 / $12.15 / $27.90 | about $28 | about $37 | about $53 | [8][11][2] |
| Cloudflare Pro after the playlist fix, Smart Tiered Cache on | R2 custom domain | R2 sets max-age=1 on playlist PUTs and a cache rule caches them. One upper tier fills. R2 reads $0.66 / $4.71 / $11.46 | about $26 | about $30 | about $36 | [8][11][18] |
| Cloudflare Business as configured today, monthly billing | R2 custom domain | same as Pro today | about $253 | about $262 | about $278 | [8][11] |
| CloudFront flat-rate, one plan: Business at 20 TB, Premium default at 50 TB, Premium 125 TB level at 100 TB | R2 custom domain behind a secret header. Cloudflare Pro zone kept as the R2 front door | $0 egress. R2 reads, with seven PoP cities filling live playlists. Plus $25 zone | about $228 | about $1,037 | about $2,296 | [37][36][11] |
| CloudFront flat-rate, two plans, only if media is later split by tenant apex | same | same, plus a second Business plan for the smaller tenant | about $428 | about $1,237 | about $2,496 | [37][11] |
| CloudFront flat-rate, one plan, live origin on S3 Mumbai with OAC, VOD still on R2 | S3 ap-south-1 for live, R2 custom domain for VOD | $0 from S3 to CloudFront. S3 PUTs and GETs added. S3 storage sits inside the plan's S3 credit | about $241 | about $1,049 | about $2,308 | [37][50][175] |
| CloudFront pay-as-you-go | R2 custom domain behind a secret header | as above | about $1,967 | about $4,706 | about $9,129 | [41] |
| Bunny Standard, the only tier with Indian PoPs | R2 by S3 auth (Unverified, V36) or B2 | $0 egress from either. R2 reads, with Origin Shield as the one fetching location | about $601 | about $1,505 | about $3,011 | [52][194][11][144] |
| Bunny Volume, no Indian PoP | same | same | about $101 | about $255 | about $511 | [52] |
| Bunny Standard as a fallback carrying 5% of bytes | R2 | same | about $30 | about $75 | about $150 | [52] |
| Bunny Standard absorbing Jio traffic for one week | R2 | Jio carried about 49% of requests on 2026-10-24. One week is 7/30 of a month | about $68 | about $171 | about $342 | [52][2] |
| Fastly, usage-based, with a Mumbai shield | R2 by SigV4 | $0 egress. Shield-to-edge fill billed as India traffic and requests. R2 reads | about $5,819 | not published | not published | [70][75] |
| Gcore PAYG, if PAYG qualifies for HLS (Unverified, V40) | R2 by SigV4 | Origin pull billed as Gcore traffic. R2 reads | about $236 | about $602 | about $1,213 | [99][183] |
| Google Cloud CDN | R2 by SigV4 | Cache fill at $0.04/GiB. R2 reads. Cloud Armor rule to block unsigned requests not included | about $1,660 | about $3,610 | about $6,836 | [86] |
| Azure Front Door Standard (Unverified) | R2 behind a secret header. Cloudflare Pro zone kept as the R2 front door | Edge-to-origin $0.16/GB on origin request bytes. R2 reads. Plus $25 zone | about $2,144 | about $4,910 | about $9,424 | [94] |
| KeyCDN (Unverified) | R2 behind an X-Pull header. Cloudflare Pro zone kept as the R2 front door | $0 egress. R2 reads. Plus $25 zone | about $1,439 | about $3,212 | about $5,269 | [110] |
| CacheFly (Unverified) | B2 | $0. CacheFly is a B2 egress partner | not published | not published | not published | [115][144] |
| 5centsCDN Enterprise network | Public B2. Private R2 not supported (Unverified) | B2 egress on fill bytes beyond the free allowance at $0.01/GB, worst case | about $319 | about $792 | about $1,579 | [119][144] |
| CDN77 Growth (excluded) | R2 | $0 egress. R2 reads | about $992 | about $996 | about $1,003 | [124] |
| Alibaba Cloud CDN (excluded) | R2 behind a secret header. Cloudflare Pro zone kept as the R2 front door | R2 reads. Plus $25 zone | about $2,268 | about $5,637 | about $10,553 | [128] |
| Tencent EdgeOne, one Personal plan (Unverified) | R2 by SigV4 | R2 reads | about $2,418 | about $5,914 | about $11,363 | [133] |
| BlazingCDN (excluded) | R2 | $0 egress. R2 reads | about $95 | about $227 | about $443 | [139] |
| Akamai, Medianova, Google Media CDN | n/a | n/a | not published | not published | not published | [82][140][92] |

Notes on the table:

- The Cloudflare rows hold only with R2 as origin. On Free, Pro and Business, video must be served from a Cloudflare paid service such as R2 or Stream (V23, V31).
- Argo is left out. Cloudflare's own pages give only a "starting at" price, with no per-GB rate (V13).
- Request allowances, not bytes, set the CloudFront tier. From the middle scenario up, the request count forces Premium (V1, V29, V39). Each flat-rate plan covers one distribution and at most one apex domain [37]. Both tenants' media hosts already sit under hranker.org: livev2 and recordedvideosv2 for quicktricks, vidyagram-live and vidyagram-recorded for Vidyagram [2][200][201]. Only the API and admin hosts use different apexes. So one plan covers both tenants when their CloudFront hostnames sit under one apex, as in the fallback design. The one distribution then needs a path prefix per bucket, or edge code to pick the bucket by hostname (Unverified). The two-plan row applies only if media is later split by tenant apex. The same reasoning puts EdgeOne on one plan.
- No content-type, video or streaming limit was found in the flat-rate plan page or the CloudFront Service Terms on 2026-10-26 (V44). The only limit on carrying 20-100 TB of HLS is the soft usage allowance.
- A second Cloudflare zone for another apex adds one more plan fee.
- Every design that uses the R2 custom domain as its origin carries the $25 Pro zone: CloudFront, Azure, KeyCDN and Alibaba. A Free zone could host the custom domain and the secret-header WAF rule for $0 (Unverified for this setup).
- The playlist fix cuts R2 reads only with Smart Tiered Cache on. With it off, about 10 colos each fill playlists, and R2 reads stay near today's level at these volumes. Its state on hranker.org is unknown (see Keep).
- R2 reads rise a little when two CDNs pull the same bucket, because each keeps its own cache. The change is small next to the CDN fee.
- The CacheFly row no longer uses the old Business tiers. The pricing page dated 2026-09-15 includes 10 TB on each plan and sizes larger volumes through a rep (V42).
- The Gcore row is a floor. HLS needs a paid CDN plan, and the fee of a plan that qualifies is not published (V40).

| Row | Arithmetic |
|---|---|
| Origin reads, every row | Live playlist polls are 10% of requests: 10 M, 25 M and 50 M. Segment and other misses are 7.5% of requests: 7.5 M, 18.75 M and 37.5 M. Where playlists are cached, playlist fills are 4.32 M per fetching location, capped at the polls. R2 reads are the playlist fills plus the other misses, at $0.36 per million after 10 M free |
| R2 reads by fetching locations | Every poll reaches R2: 17.5 M, 43.75 M and 87.5 M = $2.70, $12.15 and $27.90. One location: 11.8 M, 23.1 M and 41.8 M = $0.66, $4.71 and $11.46. Two: $2.21, $6.26 and $13.01. Three: $2.70, $7.82 and $14.57. Four: $2.70, $9.37 and $16.12. Seven: $2.70, $12.15 and $20.79. Ten: $2.70, $12.15 and $25.45 |
| Fetching locations per row | Every poll: Cloudflare today, plus Alibaba and BlazingCDN, whose Indian PoPs are unknown. One: Cloudflare after the fix with Smart Tiered Cache on, which picks a single upper tier per origin [18], Bunny and Fastly with a shield, Gcore, KeyCDN and 5centsCDN. Two: CDN77 and EdgeOne. Three: Google. Four: Azure. Seven: CloudFront, since playlists with a TTL under 3,600 s skip regional caches [42]. About ten: Cloudflare with Smart Tiered Cache off, the 9 colos that each served over 2.5% of livev2 on 2026-10-24 plus others [2], and Fastly edges below the shield |
| Fill bytes, where billed | Playlist fills at about 0.1 MB raw each, plus 7.5% of edge bytes for segment and other misses. One location: 1,932, 4,182 and 7,932 GB |
| CloudFront flat-rate allowances | Business is $200 for 50 TB and 125 M requests, so 20 TB and 100 M fit. Premium default is $1,000 for 50 TB and 500 M, so 50 TB and 250 M fit, at the full byte allowance. The Premium 125 TB level is $2,250 for 125 TB and 1.25 B, so 100 TB and 500 M fit. The 75 TB level, $1,450 for 750 M, is too small at 100 TB. Read from [37] on 2026-10-26 |
| CloudFront two plans | Only if media is later split by tenant apex. Assumes the second tenant carries at most 20% of bytes and requests. It then fits Business at every volume, and the larger tenant needs the one-plan tier or a lower one. One-plan figure plus $200 |
| CloudFront live on S3 | Assumes 300 live class-hours a month. A class writes about 2 objects a second across 4 rungs and the playlists, so 2.16 M PUTs at $0.005 per 1,000 = $10.80. Live bytes at about 1.44 GB per class-hour, with rungs assumed at 0.45, 0.65, 0.9 and 1.2 Mbps, come to about 432 GB. That is $10.80 at $0.025/GB, inside the 1 TB Business or 5 TB Premium S3 credit [37]. S3 GETs are live playlist fills from seven PoP cities plus live segment misses: 12.5 M, 31.25 M and 42.74 M at $0.0004 per 1,000 = $5.00, $12.50 and $17.10. R2 reads then cover only the other hosts: 5 M, 12.5 M and 25 M = $0, $0.90 and $5.40. S3 prices from the price list published 2026-10-15 [175] |
| Bunny Standard | India 19,000 GB at $0.03, the rate Bunny's region list gives all five Indian PoPs [194]. The other 5%, 1,000 GB, at the Asia & Oceania $0.03. Total $600. The same split gives $1,500 and $3,000. If the other 5% were served in Europe or North America at $0.01, the totals would fall by $20, $50 and $100. Plus R2 reads at one location |
| Fastly, 20 TB | India traffic is 19,000 GB at the edge plus 2,500 GB of shield fill = 21,500 GB. The fill is 10 M playlist fills from about ten edges at 0.1 MB, 1,000 GB, plus 1,500 GB of segment and other misses. 100 GB free, 9,900 x $0.28 = $2,772, 10,000 x $0.24 = $2,400, and 1,500 GB above 20 TB at the last published $0.24 = $360, which is not a published price. Asia is 900 billable GB x $0.19 = $171. Requests are 117.5 M including shield transfers, about $115. R2 reads at one location $0.66. Total about $5,819. Without a shield no fill is billed. R2 reads then come from about ten edges, $2.70, and the total is about $5,204 |
| Gcore | Edge bytes plus origin pull, minus 1 TB free, at €0.01/GB. Origin pull is one location's playlist fills plus 7.5% of bytes: 1,932, 4,182 and 7,932 GB. Billable 20,932, 53,182 and 106,932 GB = €209, €532 and €1,069 = $235, $597 and $1,201. Plus R2 reads at one location. Requests stay under the 1 B free allowance |
| Google Cloud CDN, 20 TB | APAC egress $1,368.91, the other 5% $83.82, lookups $75, fill of 2,500 GB at $0.04/GiB $93.13, load balancer processing $18.63, forwarding rule $18.25, R2 reads at three locations $2.70 = $1,660. The fill is 10 M playlist fills at 0.1 MB plus 7.5% of bytes. The same method gives $3,610 and $6,836, with fill of 5,046 and 8,796 GB |
| Azure | The sweep's per-GB, request and base figures, plus about 1 KB per origin read sent to origin at $0.16/GB: $2.80, $5.76 and $8.76. Plus R2 reads at four locations and the $25 zone |
| 5centsCDN | $15/TB edge, and B2 egress on one location's fill of 1,932, 4,182 and 7,932 GB at $0.01/GB worst case: $19.32, $41.82 and $79.32. The raw-log fee is left out, as in every row |
| EdgeOne | The sweep's two-plan figure minus one $4.20 plan fee and its 18 GB of India quota, about $2. Plus R2 reads at two locations |
| BlazingCDN | The $25 minimum covers the first 5 TB. Then $4.50/TB to 25 TB and $4.00/TB to 100 TB: $92.50, $215 and $415, the page's own totals [139] (V48). Plus R2 reads with every poll counted |

Cloudflare Logpush on Pro, if per-request logs are wanted. Prices read 2026-10-26 from [19]. Allowances are per account, so both tenants share them (V12, V49). Assumes 0.5 to 1 KB per log line, which is Unverified. The changelog does not say whether volume is counted before or after compression. R2 storage for the logs is left out.

| Log lines per month | Volume | Pushed to R2: 25 GB free, then $0.03/GB | Pushed elsewhere: 25 GB free, then $0.10/GB |
|---|---|---:|---:|
| 100 M | 50-100 GB | $0.75-2.25 | $2.50-7.50 |
| 250 M | 125-250 GB | $3.00-6.75 | $10.00-22.50 |
| 500 M | 250-500 GB | $6.75-14.25 | $22.50-47.50 |

## India reachability

### What the operator saw

In the black-screen cases the app and API worked, and only the Cloudflare-served video names failed [4]. Private DNS to one.one.one.one fixed it for some students. A proxy on a non-Cloudflare address fixed it for others [4]. A resolver fix points to a DNS-layer failure for those names. An extra IP-level block on Cloudflare's shared addresses was possible but not confirmed [4].

### What Indian ISPs do

Measured by the Poisoned Wells study, published March 2026 [145] (V21).

| ISP | Block signature at measurement time | Injects DNS answers | Does a resolver change get around it? | Measured |
|---|---|---|---|---|
| Jio | A record 49.44.79.236 | No | DNS layer yes. Jio also uses SNI blocking, which a resolver change does not avoid [147] | 2025-03-09 to 2025-03-29 |
| Airtel | CNAME to dotblocking.dummy, which points to 13.127.247.216 | No | DNS layer yes. SNI blocking recorded on Airtel in 2020 [147] | 2025-03-11 to 2025-04-10 |
| ACT | 49.205.171.201 from its resolver, 49.207.46.62 when injected | Yes, port 53 only | Only DoH or a non-standard port | 2025-03-09 to 2025-04-01 |

The study tested apex domains only. It cannot show blocks on subdomains, which is where playback hostnames sit (V21). The compiled blocklist had no shared CDN apex such as b-cdn.net, cloudfront.net or r2.dev, and none of the operator's apex names [146]. Whole-platform collateral blocks still happen: Supabase domains were unreachable on Jio, Airtel and ACT for days in early 2026 [148].

### Cloudflare-specific exposure

A Pro zone sits on anycast IPs shared by every proxied hostname. Cloudflare says it cannot guarantee those IPs are unblocked, and it cannot clear an ISP block [23][24]. Static IPs and BYOIP are Enterprise-only. Business can reduce IP sharing with a custom certificate, per the docs [23]. Its effect on Indian blocks is Unverified.

| Date, UTC | Cloudflare status incident | What it says | Source |
|---|---|---|---|
| 2025-07-30 05:01 to 23:58 | Network Routing in India | Working "with external parties". No ISP or cause named | [28] |
| 2025-07-31 04:58 to 2025-08-05 11:29 | Network Routing in India | Same wording. Together with the first record, about 6 days | [29] |
| 2026-03-16 21:56 to 22:48 | Elevated R2 Error Rate in India | R2 accessed from India saw high error rates | [31] |
| 2026-10-21 from 16:42 | Increased Latency in India | BOM, BLR and CCU degraded on 2026-10-22. BLR and CCU still degraded on 2026-10-26 | [32][13] |
| 2025-07-30 to 2026-10-22 | Incidents titled with India or an Indian city | 27 incidents. Sweep count, not re-verified | [30] |

On the first day of the 2025 incident, one user on X blamed a Jio IP-level block [149]. Cloudflare never confirmed a cause. The timeline is confirmed. The IP-block reading is not (V22).

### Where the operator's Indian traffic is served

| Cloudflare colo | Requests, 18:12-18:25 IST | Share of requests |
|---|---:|---:|
| BOM Mumbai | 61.41k | 24.9% |
| DEL Delhi | 50.59k | 20.5% |
| SIN Singapore | 38.67k | 15.7% |
| FRA Frankfurt | 24.70k | 10.0% |
| MAA Chennai | 24.12k | 9.8% |
| HYD Hyderabad | 16.04k | 6.5% |
| JRG Jharsuguda | 10.60k | 4.3% |
| PAT Patna | 6.56k | 2.7% |
| IAD Ashburn | 6.44k | 2.6% |

Host livev2.hranker.org on 2026-10-24, from 50% sampled dashboard analytics [2]. India was the client country for 240.28k of 246.72k requests. In the quiet baseline window, 17:45-18:05 IST, SIN served 17.6% and FRA 12.1%.

About a quarter of requests from an almost entirely Indian audience were served from Singapore and Frankfurt. That matches the direction of one developer's report that Free and Pro zones get served from Singapore (V26) [154]. That report rests on one Jio fiber line. It does not show which ISPs land outside India, and neither does the operator's data. Cloudflare publishes no plan-based routing rule [25]. Its Traffic Manager post says that under capacity pressure Free traffic moves out first, then Pro, then Business [26].

### Peering per PeeringDB and RIPE RIS

| Network | Indian facilities | Indian IX presence | Direct adjacency with Jio AS55836 | Direct adjacency with Airtel AS9498 |
|---|---|---|---|---|
| Cloudflare AS13335 | 8, in 7 cities | 14 IXPs | Seen | Seen |
| Akamai AS20940 | 15 | NIXI in 5 cities, Extreme IX in 6, DE-CIX in 4 | Seen | Seen |
| Fastly AS54113 | 5 | NIXI, DE-CIX and Extreme IX in 5 cities each | Seen | Seen |
| Amazon AS16509 | 12 | Extreme IX in 7 cities, DE-CIX in 4 | Not seen | Not seen |
| Google AS15169 | 8, in 3 metros | Delhi, Mumbai and Chennai only | Not checked | Not checked |
| Bunny AS200325 | 0 listed | 0 listed | Not seen | Not seen |
| Gcore AS199524 | 1, Navi Mumbai | DE-CIX and Extreme IX Mumbai | Uncertain | Uncertain |
| CDN77 AS60068 | 0 | 0 | Not checked | Not checked |
| Jio AS55836 | n/a | No public IX ports in India | n/a | n/a |
| Airtel AS9498 | n/a | No IX ports in India. Ports abroad, including Equinix Singapore | n/a | n/a |

PeeringDB read 2026-10-22 and 2026-10-26 [14][83][72][49][69][102][150]. RIS neighbours queried 2026-10-21 [151][152]. RIS misses private peering and embedded caches, so "not seen" does not prove "not connected". Bunny reaches Indian carriers through upstreams such as DataCamp, Vultr and Zenlayer in RIS data.

Jio and Airtel have no public IX ports in India. So a CDN's presence at NIXI or Extreme IX matters for Vi, BSNL and smaller ISPs, not for the two big carriers. For Jio and Airtel, private interconnects and embedded caches decide the path. Cloudflare, Akamai and Fastly show direct adjacency to both. Bunny and Amazon do not in public data.

### Answer: would leaving Cloudflare fix the black screens?

Only for one failure mode. Leaving Cloudflare fixes a block aimed at Cloudflare's IP addresses. It does not fix a DNS-layer failure on the names themselves, which is what the resolver fix points to. Any CDN on shared IPs carries the same class of collateral risk. Bunny's shared b-cdn.net domain was blocked by name in Turkey in 2018 [67].

So the operator needs a second hostname on a second network regardless of which CDN is primary. Put it on a different apex domain, with DNS outside Cloudflare, on non-Cloudflare IP space, and let the player switch on network failure. The API host already sits on a plain OVH address that these students reach [4]. An in-app DoH resolver is a cheap extra for DNS-layer blocks, but it does not help against SNI or IP blocks [145][147].

## Origin fill and live delivery

Two different failures hit live viewers in the same week. They sit on different paths, and a CDN swap touches only one of them.

| Date | Path | What was measured | Values | Source |
|---|---|---|---|---|
| 2026-10-20 | Encoder to R2, write | PUT duration during bursts | 11-126 s. 261 of 3,480 uploads over 2 s in 25 min | [7] |
| 2026-10-20 | Playlist publish | Playlist published after a 2 s cap | Listed segments not yet in R2, so edge 404s | [7] |
| 2026-10-24 | Cloudflare edge to R2, read | Origin p99 per minute, quiet baseline | 578-1,914 ms | [1] |
| 2026-10-24 | Cloudflare edge to R2, read | Origin p99 per minute, spike minutes | 7,278-14,460 ms | [1] |
| 2026-10-24 | Cache HITs slower than 2 s | Share of HITs | 0.012% baseline. 1.78-4.82% in spike minutes | [1] |
| 2026-10-24 | Spread of slow HITs | Colos and ASNs | 7 colos including SIN and FRA. Jio, Airtel, Vi and others | [1] |
| 2026-10-24, 19:44-19:52 IST | Quiet-time probe | Fill time | 0.5-1.1 s | [7] |

**Write path, 2026-10-20.** Encoder PUTs to R2 stalled in bursts. The encoder then published the live playlist anyway, so playlists listed segments that were not in R2 yet. Viewers got 404s and stalled [7]. No CDN sits on this path. Any CDN in front of R2 would see the same missing segments. The fix is in the encoder: gate the playlist on uploaded segments and retry hung PUTs. It was not deployed as of 2026-10-24 [7].

**Read path, 2026-10-24.** Per-minute analytics showed short latency spikes on segments in both classes at once [1]. In some spike minutes, Cloudflare's own fetch from R2 had a multi-second p99. Slow cache HITs appeared across colos and ISPs in the same minutes. The operator's working explanation is one slow fill of a brand-new segment, with every viewer waiting on it [7]. The table below shows that it fits some minutes, not all. The report itself says it did not establish which subsystem caused the spikes [1].

| Minute, IST | Class | Origin p99, ms | Edge p99, ms | Fits a slow fill from R2? |
|---|---|---:|---:|---|
| 18:14 | A | 1,022 | 3,830 | No |
| 18:14 | B | 10,472 | 5,796 | Yes |
| 18:19 | A | 14,460 | 10,851 | Yes |
| 18:20 | B | 7,617 | 6,276 | Yes |
| 18:29 | A | 868 | 9,345 | No |

Source [1], 2026-10-24, 50% sampled dashboard data.

**Is R2 the shared factor?** Any CDN that reads this bucket goes through Cloudflare's R2 front end. That is either the S3 endpoint or a custom domain on the Cloudflare zone [11][2]. If the delay sits inside R2, every CDN in front of it inherits the delay. If it sits in Cloudflare's tiered-cache or cache-lock path, a CDN that reads the S3 endpoint directly may avoid part of it. No public data splits the two. The R2 metrics page has no latency panel, and object access logs were off [2]. R2 location hints are best effort, and where an APAC bucket sits is unpublished [35][3]. A CDN that uses the R2 custom domain as its origin, as in the CloudFront and KeyCDN designs, adds a hop through the same Cloudflare edge.

**Request collapsing cuts both ways.** Collapsing lets one fill serve thousands of viewers. It also means one slow fill freezes all of them together. Every serious CDN collapses requests, so a switch does not remove this shape of failure. That slow HITs are viewers queued behind a fill is an inference, not a measurement.

| Provider | Mid-tier or shield on self-serve | Request collapsing | Note | Source |
|---|---|---|---|---|
| Cloudflare Pro | Smart Tiered Cache, free on all plans. Regional tiers are Enterprise | Cache lock, per a 2019 blog | Whether Tiered Cache is on for hranker.org is still unknown on 2026-10-26. No public probe shows it | [18][27][7] |
| CloudFront | Regional edge caches on all plans. Origin Shield is Premium-only on flat-rate | Yes, at the PoP | GETs with TTL under 3,600 s count as dynamic and skip regional caches, so live playlists likely go straight to origin (Unverified for this setup) | [42][37] |
| Bunny | Origin Shield free. Perma-Cache cannot be combined with it | Request Coalescing per zone or rule | Shield location is chosen by region | [57][58][59] |
| Fastly | Shield POPs including Mumbai. Shield traffic is billed | On by default | Shield-to-edge fill costs bandwidth and requests | [75] |
| Gcore | Origin Shielding through Support, price not published | Not documented | n/a | [106] |
| Google Cloud CDN | None | Yes | Every metro fills from origin | [91] |
| Azure Front Door (Unverified) | None configurable | Not documented | n/a | [97] |
| KeyCDN (Unverified) | Shields only in the US and Amsterdam | Collapsed forwarding | An Indian miss travels abroad | [113] |
| 5centsCDN | Shields only in San Jose and London | Not documented | An Indian miss travels abroad | [122] |

**What avoids the fill problem regardless of CDN.** These changes sit on the operator's side and cost less than a switch:

- Gate the live playlist on segments that are already in R2, and time out and retry hung PUTs [7].
- Warm each new segment through the CDN before the playlist lists it. If Smart Tiered Cache is on, one warm request fills the upper tier that every colo reads from [18][3]. If it is off, a warm request fills only the colo it lands in. Its state on hranker.org is unknown, so read it first (see Keep).
- Deepen the player's live buffer, so one slow fill does not drain it [7].
- Before deciding anything, test a non-R2 live origin on one class. S3 in Mumbai has no transfer charge to CloudFront [50]. Its cost is in the CloudFront live-on-S3 row of the Cost table.

**Answer.** A different CDN in front of R2 inherits the R2 part of the problem and the shape of the failure. It can only avoid the part that may sit in Cloudflare's edge-to-R2 path. Nobody knows today how the delay splits between those two.

## Where Cloudflare is not the best

- **Reachability resilience on Pro.** A Pro zone uses shared anycast IPs. Cloudflare cannot clear an ISP block and offers no self-serve way to move off a blocked address [23][24]. The 2025 India routing incident lasted days [28][29].
- **Where Indian viewers are served.** A large share of the operator's Indian requests was served from Singapore and Frankfurt [2]. Fastly and CloudFront list many more in-ISP or embedded sites in India [71][39]. CloudFront's embedded PoPs are available only by sales request [39]. Whether Fastly's embedded POPs serve a self-serve account is Unverified (V41). Neither is shown to be more reachable than Cloudflare from Jio or Airtel. Akamai and Google have more port capacity than Cloudflare at Extreme IX Mumbai and Delhi [155]. That matters for Vi, BSNL and smaller ISPs, since Jio and Airtel do not use Indian IXes.
- **SLA and support.** Pro has no uptime SLA and ticket-only support [8]. CloudFront Business and Premium carry a published SLA [48][37]. Bunny publishes a credit table and offers 24x7 chat to every account [61][62]. Gcore's PAYG terms include an SLA [108].
- **Plan gating.** Per-parameter cache keys are Enterprise-only [3]. Partial CNAME setup needs Business [20]. Pro cannot override edge TTL below an hour [16]. Instant Logs need Business [8]. Bunny and Fastly expose the equivalent controls without an enterprise tier [56][73]. Gcore has its own gates: HLS needs Support approval and a paid plan, path tokens sit on Video Streaming only, subnet binding is Enterprise-only, and log export is enabled by Support (V17, V40) [104].
- **HLS defaults.** Cloudflare does not cache .ts or .m3u8 without a rule [17]. The live host ran uncached until a rule was added on 2026-10-07 [5]. CloudFront, Bunny and Gcore cache them by default [45][56][107].
- **Origin choice.** On Pro, video must be hosted on R2 or Stream [9][10]. No other CDN here ties the origin to its own storage. That locks the live path to R2, even if R2 turns out to be the slow part.
- **R2 reliability.** R2 had an India-specific error incident and a long regional 500 incident in 2026 [31][33].

## Where Cloudflare is the best for this operator

- **Cost.** A flat plan with no per-GB charge, over an origin with no egress fee [8][11]. The cheapest self-serve alternative with Indian PoPs costs many times more (see Cost).
- **One first-party origin.** The edge reads R2 with no credentials, no SigV4 and no secret headers [3]. One signer and one origin serve live and VOD.
- **Token fit.** The WAF HMAC rule checks the path-prefix token before cache, with no code [15]. Child playlists and segments inherit it.
- **Footprint.** All six metros plus many tier-2 cities (V14) [12]. Direct adjacency with Jio and Airtel in RIS data [151][152].
- **Self-serve features.** Prefix purge and HTTP/3 on all plans [21][22]. HTTP/3 was still off on both media hosts on 2026-10-26 and is a toggle (V34). Logpush on Pro since 2026-09-30 (V12) [19]. Smart Tiered Cache is free [18], but whether it is on for hranker.org is unknown. These are strengths on paper until the settings in Keep are switched on.
- **Latency.** Edge HIT latency is at parity with Bunny from Mumbai. Origin-fill latency is a separate question, covered above.

| Path, Mumbai vantage | TTFB | Measured | Source |
|---|---|---|---|
| Cloudflare cache HIT | 60-140 ms | 2026-10-06 and 2026-10-07 | [4][5] |
| Bunny Standard tier cache HIT, edge MU1 | 55-105 ms | 2026-10-07 | [5] |
| Bunny High Volume tier cache HIT, edge SG1 | 345-405 ms | 2026-10-07 and 2026-10-08 | [5] |
| Cloudflare MISS or DYNAMIC, fetched from R2 | 190-520 ms | 2026-10-06 and 2026-10-07 | [4] |
| Bunny Standard MISS, served from Perma-Cache | 120-520 ms | 2026-10-07 | [5] |

| CDNPerf India RUM, 2026-09-21 to 2026-10-21 | Median query time | Last-day RUM uptime |
|---|---:|---:|
| Cloudflare | 31.84 ms | 99.72% |
| bunny.net | 32.03 ms | 99.67% |
| Gcore | 44.87 ms | 4.74% |
| CDN77 | 113.90 ms | 93.68% |

Re-queried 2026-10-26 (V25) [153]. It times a tiny object in the browser. It says nothing about HLS throughput or per-ISP behaviour. The uptime column is the last day only, and CDNPerf warns it contains false positives.

## Per-provider notes

**Cloudflare Pro + R2 (incumbent, baseline)**
- Can meet every hard requirement on Pro with R2 as origin. HLS needs cache rules, and live playlist TTLs must come from R2 headers on Pro [16][3]. As configured on 2026-10-26, it does not meet two of them on every host: HTTP/3 is off on both media hosts (V34), and the recorded host caches 404s for 10 s [3].
- No cached 404s: a missing R2 object returns no Cache-Control, and the default 404 TTL is 3 min [17]. Cache Rules can set a Status Code TTL, including no-store, with no plan gate stated on the settings page dated 2026-10-15 [168]. That page does not say whether Pro's 1 h edge-TTL floor [16] applies to a positive status-code TTL, so use no-store, not 1 s (V38). The live host already served its 404s as BYPASS on 2026-10-24 [2].
- Dealbreakers: none. Risks: shared IPs, no SLA, and terms that bind HLS to R2 or Stream [23][8][9].
- Pro and Business prices: verified (V13). Argo per-GB price: Unverified on official pages (V13).
- Indian city count: corrected to 22 (V14). Logpush on Pro: verified (V12). Video terms: verified (V23, V31). R2 egress: verified (V24).
- Pro-plan routing to Singapore: corrected to one user's Jio fiber data (V26). The operator's own analytics show part of the Indian traffic served from SIN and FRA [2].
- A private B2 bucket behind Cloudflare would need a signing Worker, and the video terms still bar it [34][9].

**AWS CloudFront (flat-rate plans)**
- Strengths: all six metros plus Pune, embedded PoPs on request, HTTP/3, prefix purge, HLS cached without an allowlist, and a configurable error-cache TTL [39][47][46]. Whether the error-cache setting works on flat-rate plans is Unverified (V3).
- Gaps: no native HMAC path token, so the current token needs a CloudFront Function [43]. No native signing for R2 or B2. The R2 custom domain must be gated by a secret header and a Cloudflare WAF rule [44].
- Flat-rate limits: soft allowances, with possible throttling or a forced plan change (V30, V32). One plan per apex. A WAF web ACL is mandatory. No real-time logs. Origin Shield only on Premium (V29).
- Fill: it inherits the R2 read path, plus a hop through the Cloudflare edge when the custom domain is the origin. Short-TTL live playlists likely skip regional caches; Unverified for this setup [42].
- Reachability: a separate network, but RIS shows no direct adjacency with Jio or Airtel [151][152]. Untested from Indian phones.
- Rating: the sweep rated it "above". Revised to "unmeasured second-network candidate". No HIT time was measured from the Mumbai vantage used for Cloudflare and Bunny, and nothing was tested from Jio or Airtel. It costs more, needs custom work for tokens and origin auth, and does not escape R2. To move it to "at par", put a test distribution in front of the R2 custom domain and run the pilot's probe from the same Mumbai vantage [5]. Its HIT time must fall inside Cloudflare's range in the Latency table.
- Flat-rate allowances, S3 credits and HTTP/3 on every tier: verified 2026-10-26 (V39).
- Flat-rate terms: no content-type, video or streaming limit in the plan page or the CloudFront Service Terms, checked 2026-10-26 (V44). The usage allowance is the only limit found.
- Verification: V1 verified. V2 verified. V3 partly corrected. V29 verified. V30 corrected. V32 corrected. V33 corrected to city counts. V39 verified. V44 verified.

**Bunny.net**
- Strengths: the same token model as today [54]. Private B2 origin already in production use [55][5]. Free origin shield and request coalescing [57][58]. Free raw logs [60]. 24x7 chat [62]. Purge by exact URL or prefix [173].
- Gaps: no Hyderabad. The Volume tier has no Indian PoP [53]. No HTTP/3: a 2026-10-26 probe of Standard edge MU1 and Volume edge SG1 got no alt-svc header, DNS records that offer only h2 and http/1.1, and no QUIC answer. The pull-zone API has no HTTP/3 field (V35) [171]. No written answer from Bunny was sought.
- R2 as origin: Bunny signs origin requests with SigV4 to the origin URL you enter, and the region field is free text [170][171]. Its only S3-compatible example with auth is B2, a non-AWS endpoint [55]. No Bunny page names R2 or region "auto". R2 uses region "auto" and treats "us-east-1" as the same [169]. So a private R2 origin is likely but Unverified (V36). The fallback recommendation depends on the step-2 signed-GET test.
- Cached 404s: the pull zone has a switch for caching error responses [171]. Bunny's own Terraform provider defaults it to off [172]. The dashboard default is not documented, and the pilot zone's value was not read (V37). Check it is off on the fallback zone.
- Measured: cache-HIT parity on the Standard tier from Mumbai [5]. The pilot zone went back to High Volume on 2026-10-08 [5], and the sweep saw it answer from SG1 on 2026-10-22. The parity figure does not describe today's zone.
- Reachability: its own network and IPs. No Indian PoPs in PeeringDB and no direct Jio or Airtel adjacency in RIS [69][151][152]. Use a custom hostname, not b-cdn.net [67].
- Incidents: a Singapore outage on 2026-01-15, which matters for Volume-tier India traffic [65]. A registrar suspension of bunny.net on 2026-05-21 took Bunny DNS down [66]. Keep primary DNS elsewhere.
- Verification: V7 verified. V8 verified. V9 partly corrected: no plan gate is documented, but none is ruled out either. V28 verified. V35 verified by probe. V36 Unverified. V37 partly verified. V47 verified: India is billed at the Asia rate.

**Fastly**
- Strengths: 35 named Indian cities, direct adjacency with Jio and Airtel, a Mumbai shield, real-time logs without Enterprise, and HTTP/3 [71][151][73][75][176].
- Footprint, like for like: Fastly lists multi-POP sites in six places and embedded POPs in 29 cities (V41). CloudFront lists PoPs in 7 cities and embedded PoPs in 46 cities by sales request [39]. Whether Fastly's embedded POPs serve a self-serve account is Unverified.
- Dealbreakers: India is billed as its own, most expensive region. Nothing is published above the second tier. Month-to-month accounts have no SLA [70][79].
- Tokens and prefix purge must be written in VCL [77]. 404s are cacheable by default [78].
- India incidents in 2026 include a long latency event on embedded POPs [80].
- Verification: V10 verified. V11 verified. V18 corrected: India is billed as its own region, not as Asia. V41 recounted the cities.

**Akamai (excluded)**
- Strongest Indian interconnect in public data, with direct Jio and Airtel adjacency [83][151].
- Fails self-serve and published pricing [82]. R2 or B2 origin auth is undocumented. Prefix purge is slow without cache tags. India-routed edge incidents in mid-2026 [85].
- Verification: not run. The sweep excluded it.

**Google Cloud CDN**
- Only Mumbai, Delhi and Chennai in India (V5).
- Signed URLs do not block unsigned requests. With SigV4 origin auth, unsigned misses would be fetched from private R2 (V6). Tokens are query or cookie only.
- Cost is far above Cloudflare and Cloud CDN charges its own cache fill (V4).
- A Delhi PoP fire in June 2026 degraded India traffic for weeks [93].
- Media CDN fixes tokens and shielding but is sales-only [92].
- Verification: V4, V5 and V6 verified.

**Azure Front Door (never verified)**
- Sweep findings, all Unverified: no GA HMAC signing, no S3 signing for R2 or B2, no HTTP/3, four Indian metros and Zone 5 per-GB pricing [96][98][95][94].
- Not a candidate on the sweep's own evidence.

**Gcore**
- Mumbai is the only Indian PoP (V16).
- The token is MD5 in the query string, and a directory token does not cover subfolders (V17). Per-rung folders would need one token per folder, or a flat layout.
- HLS delivery needs a paid plan and Support approval (V17) [104]. Expired tokens return 410.
- Which plan counts as paid is Unverified (V40). The pricing page lists only PAYG and Enterprise [99]. The trial page also names Free, Start and Pro plans [182], and the billing page describes fixed monthly fees with traffic limits [183]. No Start or Pro fee is published. So the PAYG cost row is a floor.
- Private S3-compatible origin through SigV4 [105]. R2 untested.
- A global outage on 2026-05-13 came from one customer's bad config [109]. The CDNPerf India uptime collapse from 2026-10-19 looks like a test-endpoint artifact; Unverified (V25).
- Pricing is one global rate with graduated volume tiers and no India line (V15) [100]. Origin pulls count as billable traffic.
- Verification: V15 verified. V16 verified. V17 verified, with the Support gate added. V40 Unverified.

**KeyCDN (never verified)**
- Sweep findings, all Unverified: one Indian PoP, an MD5 exact-path token with no prefix scope, no SigV4 origin auth, no prefix purge and no HTTP/3 [111][112][114].
- Fails several hard requirements even if every finding holds.

**CacheFly (pricing re-read, the rest never verified)**
- Pricing page dated 2026-09-15, re-read 2026-10-26 (V42). The entry plan has portal signup and includes 10 TB. Volume above that is a commit sized by a rep, with no published per-TB price. The top plan is sales-only [115]. So CacheFly is not self-serve at this workload's volume.
- Sweep findings, all Unverified. Mumbai is the only Indian PoP [116]. Token auth must be enabled per account and has no HMAC prefix form [118].
- Negative caching cannot be turned off; the floor is one second, per the sweep.
- The AUP lets CacheFly rebalance geographically concentrated traffic [117]. That describes an India-only audience.

**5centsCDN**
- India needs the Enterprise network (V19). The calculator has no real top-up cap (V19).
- Mumbai is the only live Indian PoP. Delhi and Chennai sit hidden as "coming soon" (V20). The Mumbai edge runs on OVH address space [121].
- Origin auth takes AWS-format keys only per the API schema; Unverified, because the verification run failed [123].
- MD5 tokens, no HTTP/3, prefix purge only on a higher plan, and business-hours free support.
- Verification: V19 corrected. V20 verified. Origin claim not verified.

**CDN77 (excluded)**
- No Indian PoP. In a sweep probe, India was served from Singapore and Hong Kong [125]. Onboarding is through a sales form [124].

**Alibaba Cloud (excluded)**
- No Indian PoP, though India is billed in AP2 [129][128]. The Mumbai cloud region closed in 2024 [132]. MD5 per-URI tokens and an OSS-only private origin [130][131].

**Tencent EdgeOne (never verified)**
- Sweep findings, all Unverified. Mumbai and Chennai are claimed only in a vendor blog, with no Indian PeeringDB presence [135][136].
- Tokens are per-path MD5 or SHA-1, and HTTP/3 is billed extra [134][133].
- India blocked Tencent apps under Section 69A in 2020 [137]. That is a policy-driven blocking risk of its own.

**BlazingCDN, Medianova, Leaseweb (excluded)**
- See Excluded providers. None meets HTTP/3, Indian PoP disclosure and self-serve pricing together [138][140][141].

## Managed video platforms instead of a CDN

Estimates from the provider sweep, whose pages were read on 2026-10-22. Cloudflare Stream and Mux were re-read on 2026-10-26 (V45, V46). The other platform prices were never re-checked and are Unverified. The 50 TB month is converted at a blended 800 kbps, about 8.33 M viewer-minutes. At 1.2 Mbps it is about 5.56 M minutes, and at 450 kbps about 14.8 M.

| Platform | 50 TB month, USD | Price read | Live | Signed playback | DRM | Off Cloudflare's network? | Source |
|---|---|---|---|---|---|---|---|
| Cloudflare Pro + R2 as configured today, for scale | about $37 | 2026-10-26, see Cost | Yes, own encoder | Path HMAC | None | No | [8][11] |
| Bunny Stream | about $1,450-1,575 plus storage. Unverified | 2026-10-22 | Not on its pricing pages (Unverified) | Bunny token | MediaCage add-on | Yes | [68] |
| Gumlet | about $2,919 plus DRM. Unverified | 2026-10-22 | Live minutes capped on Business, more needs Enterprise | Tokenized | Add-on | Vendor says Fastly and CloudFront | [162] |
| VdoCipher | about $3,625-5,000 for VOD. Live about $1,500-2,500. Unverified | 2026-10-22 | Yes, without DRM | Yes | Included on VOD | Vendor says AWS plus CDN | [163][164] |
| Mux | about $5,520 plus storage and live input | 2026-10-26 (V46) | Yes | Signed JWT | Add-on | CDN list unpublished | [161] |
| AWS IVS, live only | about $5,600-11,200 plus input. Unverified | 2026-10-22 | Yes | Not verified here | Not verified here | Yes | [51] |
| Cloudflare Stream | about $8,333 plus storage | 2026-10-26 (V45) | Yes | Signed JWT per video | Not in docs | No, same network | [159][160] |
| api.video | at least $14,200. Unverified | 2026-10-22 | Yes | Not verified here | Not on pricing page | Unverified | [165] |
| Vimeo OTT | Per subscriber, not per GB | 2026-10-22 | Yes | Storefront | n/a | n/a | [166] |
| Wowza | Not published at scale | 2026-10-22 | Yes | n/a | n/a | n/a | [167] |

No managed platform is cheaper than what the operator runs. Each one also takes away controls the operator relies on: the GPU bitrate ladder, short live segments, per-extension cache rules and the path-prefix token. Cloudflare Stream stays on the same network, so it does not help with the black screens. VdoCipher and Gumlet make sense only if Widevine and FairPlay DRM or watermarking become a requirement. Neither is a reliability or cost fix.

## Recommended architecture

**Keep.** Cloudflare Pro over private R2 stays the primary for live, VOD, PDFs and images. Finish the open items from the 2026-10-13 checklist first [3]. Their known state is below. No zone API token was available here, so states marked unknown need a read of the zone settings by the account holder: `tiered_cache_smart_topology_enable`, `http3` and the cache rules list.

| Setting on hranker.org | State | As of | Evidence |
|---|---|---|---|
| HTTP/3 on livev2 and recordedvideosv2 | Off. HTTP/3-only requests failed to connect. DNS records offer h2 only | 2026-10-26 | V34 [174] |
| Smart Tiered Cache | Unknown. No public probe shows it | 2026-10-26 | [3] |
| Live .m3u8 on livev2 | Not cached. Served as DYNAMIC | 2026-10-24 | [2] |
| -vod.m3u8 on livev2 | Not cached when last checked. Served as DYNAMIC | 2026-10-07, not re-checked | [5] |
| 404s on livev2 | Not cached. 697 BYPASS against 699 404s in the upload-stall window | 2026-10-24 | [2] |
| 404s on recordedvideosv2 | Cached for 10 s | 2026-10-13 | [3] |

**Add a second-network fallback.**
- A hostname under an apex that is not hranker.org or hranker.com, with DNS outside Cloudflare [4].
- A Bunny Standard-tier pull zone over the same private R2 bucket, with S3 auth and region "auto". This rests on an untested step: Bunny documents SigV4 origin signing for B2 but not for R2 (V36). Run the signed-GET test in step 2 before relying on it. If it fails, the fallback can serve only content that also sits on B2. Bunny over B2 covers only pre-cutover classes today [5]. Keep India off the Volume tier, which serves India from Singapore [53]. Keep error caching off on the zone (V37). Keep Perma-Cache off, so wildcard purge by prefix works [59]. The pilot zone has Perma-Cache on [5].
- Accepted gaps for the fallback role. Bunny Standard misses two hard requirements: HTTP/3 (V35) and a Hyderabad PoP [53][194]. Both are accepted here, and only here. HTTP/3 is also off on the Cloudflare media hosts today (V34), so the fallback is no worse than the primary on that point. Hyderabad viewers would be served from a nearby PoP such as Chennai, Bangalore or Mumbai. That routing is not measured. The other providers were judged as replacements, where the full requirement set applies. Asking Bunny support for a written HTTP/3 answer is optional.
- Client failover in both players. The LMS already honours ?cdn=bunny [5]. Stock Media3 switches location only on some HTTP status codes. DNS, connect and timeout failures need a custom LoadErrorHandlingPolicy (V27) [156]. hls.js documents redundant URLs and content steering [157]. Never fail over on 403 or 404 [4].
- Optional coarse steering. Bunny Scriptable DNS can send Jio and Airtel resolvers to the fallback at no query cost (V28) [64][63]. It sees the resolver, not the phone, so player failover stays the real fix.
- If Bunny over R2 fails the tests, CloudFront Business on a flat-rate plan is the next candidate. Size it for failover spikes. AWS tolerates one spike over the allowance, and sustained excess can be throttled [37][38].

The big Indian streamers already run two CDNs, with one hostname per CDN [158][81].

**Residual risk: the fallback shares R2.** A Bunny or CloudFront fallback over R2 reads the same bucket through Cloudflare's R2 front end [11]. It covers DNS failures and blocks on Cloudflare's edge. It does not cover an R2 outage, such as the 2026 India error incident or the regional 500s [31][33]. Nor does it cover the 2026-10-24 fill stalls, if those sit in R2 [1]. Two ways to close that gap for live:

| Option | What it adds | Monthly cost | As of | Source |
|---|---|---|---|---|
| Dual-write live segments and playlists to B2. Bunny pulls from B2 | B2 storage for a 30-day live window, about 432 GB | about $3 at $6.95/TB | 2026-10-26 | [144] |
| same | B2 uploads, about 2.16 M a month | $0. B2 uploads are free | 2026-10-26 | [144] |
| same | B2 egress to Bunny | $0. Bunny is a B2 free-egress partner | 2026-10-26 | [144] |
| same | A second upload stream from the encoder, about 432 GB | The encoder host's internet egress rate. Not priced here | n/a | n/a |
| Live origin on S3 Mumbai behind CloudFront | See the live-on-S3 row in the Cost table | about $12-13 over the one-plan row | 2026-10-26 | [175][37] |

Volumes use the Cost table's live assumptions: 300 class-hours a month and about 1.44 GB per class-hour. The B2 option is cheap in fees. Its real cost is encoder work: a second upload path with its own timeouts, so a B2 stall does not block R2. If neither is built, state the risk as accepted: the fallback covers Cloudflare edge reachability only, and an R2 incident takes down both paths.

**What would justify switching the primary.**

| Trigger | Next step |
|---|---|
| Cloudflare warns or limits the zone under the video terms | Move video delivery to CloudFront or Bunny. R2 can stay as origin |
| Player data shows Jio or Airtel sessions served from SIN or FRA with worse segment times than the fallback | Treat Business as a test, not a fix. Cloudflare says the ISP picks the data center and selection cannot be configured per zone or account [25]. Its Traffic Manager post covers only capacity shedding [26]. Buy one monthly-billed Business month. Compare the colo share by ASN for Jio and Airtel before and during it, with the dashboard colo and ASN breakdown used in [2]. Keep Business only if the share outside India drops. Otherwise move those users to the fallback (V43) |
| A test shows the live fill stalls come from Cloudflare's edge path, not R2 | Move live delivery to whichever path avoided them in the test |
| India incidents push a large traffic share to the fallback for long periods | Re-decide the primary on measured cost and quality |
| A need for an uptime SLA or real support | Cloudflare Business, before any switch |

**First three concrete steps.**
1. Measure before buying. At the next black-screen report, resolve the playback hostnames through the student's ISP resolver and through 1.1.1.1, and look for the Jio and Airtel block signatures [145]. Get the apps sending player telemetry with ASN, cf-ray colo, segment time and stalls. The endpoint exists, but no app sends to it yet [6]. During one live class, time fresh-segment GETs from R2's S3 endpoint and through livev2 side by side, to split R2 delay from edge delay.
2. Build and test the fallback zone. Create the Bunny Standard-tier pull zone over private R2 on the new hostname. First run a signed GET through it for one R2 object, with region "auto", then "us-east-1" if that fails (V36). Then check token inheritance, that error caching and Perma-Cache are off, that a missing segment is not cached, that a prefix purge clears a folder, and HIT latency from Jio and Airtel phones in tier-2 cities. Confirm HTTP/3 is still absent (V35), to record the accepted gap, not to re-test it.
3. Ship client failover, together with the live fixes that do not depend on any CDN: the playlist gate, PUT timeout and retry, segment warming and a deeper live buffer [7].

## Excluded providers and why

| Provider | Why excluded | Source |
|---|---|---|
| Akamai Ion and Adaptive Media Delivery | Sales-only, no published price | [82] |
| Google Media CDN | Sales-only, no public rate card | [92] |
| Fastly Streaming Delivery and JioCDN | Sales-only pricing. JioCDN runs on Fastly and carries JioHotstar. Worth a sales call only if Jio reachability comes to dominate | [74][81] |
| Airtel Edge CDN | Published INR rates: ₹6.00/GB for the first 10 TB, ₹5.00 to 50 TB, ₹4.00 to 150 TB and ₹3.00 to 500 TB. GST not stated. No self-serve signup: an enquiry form and "talk to an expert". Claims over 100 Indian edge locations and lists no cities. Read 2026-10-26. As a carrier CDN it is the Airtel-side counterpart of JioCDN for a sales call | [199] |
| Tata Communications CDN | No published price. The CDN pages offer a sales conversation, not a CDN signup. Claims 28 "super nodes" and names no Indian cities. Read 2026-10-26 | [197][198] |
| CDNetworks (Wangsu), CDN Pro | Search results for its own pages show self-signup, a $50 monthly commitment and per-GB prices by server group from $0.04/GB. The pages refused direct reads on 2026-10-26, so India's server group and its Indian PoPs are Unverified (V50). Even the lowest group costs more per GB than Bunny Standard | [195][196] |
| Vi (Vodafone Idea) | No CDN product for businesses found in a search on 2026-10-26. Unverified | n/a |
| CDN77 | No Indian PoP. Onboarding through a sales form | [125][124] |
| Alibaba Cloud CDN and ESA | No Indian PoP. Mumbai region closed in 2024 | [129][132] |
| BlazingCDN | No HTTP/3 by its own statement. Indian PoPs not disclosed | [138] |
| Medianova | Quote-only. Mumbai only | [140] |
| Leaseweb Multi-CDN | Annual contract. Underlying CDNs and Indian PoPs not disclosed | [141] |
| StackPath, Highwinds, MaxCDN | CDN operations ceased in 2023 | [142] |
| Edgio, Limelight, Azure CDN from Edgio | Platform shut down on 2025-01-15 | [143] |
| Cloudflare Stream as the main path | Same network, so no reachability gain. Per-minute pricing | [159][160] |

## Verification log

First run on 2026-10-22, second run on 2026-10-26. "Confirmed" means the claim held. "Partially correct" means the corrected claim replaces it.

| ID | Run | Owner | Claim | Verdict | Corrected claim | Evidence URL |
|---|---|---|---|---|---|---|
| V1 | 2026-10-22 | cloudfront | Flat-rate Business is $200 for 50 TB and 125 M requests with no overage. Premium is $1,000, $1,450 or $2,250. Not priced by region | Confirmed | No change. Allowances are soft, and the Business allowance cannot be raised | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html |
| V2 | 2026-10-22 | cloudfront | PoPs in 7 Indian cities, embedded PoPs in 46 by sales, Mumbai regional cache and Origin Shield | Confirmed | No change | https://aws.amazon.com/cloudfront/features/ |
| V3 | 2026-10-22 | cloudfront | Flat-rate: no real-time logs, standard logs Pro and up, custom cache policies Business and up, Origin Shield Premium only, signed URLs and Functions on every tier | Partially correct | Signed cookies are not named on the plan pages. KeyValueStore is Pro and up. Negative caching on flat-rate not documented | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html |
| V4 | 2026-10-22 | gcp | Cloud CDN APAC egress $0.09 then $0.06/GiB, lookups $0.0075 per 10k, fill $0.02 or $0.04/GiB | Confirmed | No change. Higher tiers also exist | https://cloud.google.com/cdn/pricing |
| V5 | 2026-10-22 | gcp | Cloud CDN and Media CDN list only Mumbai, Delhi and Chennai in India | Confirmed | No change. Hyderabad and Kolkata appear only as network edge sites | https://docs.cloud.google.com/cdn/docs/locations |
| V6 | 2026-10-22 | gcp | Signed URLs do not block unsigned requests. With SigV4 origin auth, unsigned misses reach private R2. Media CDN is sales-only | Confirmed | Exposure is wider: unsigned cache hits are served too | https://docs.cloud.google.com/cdn/docs/using-signed-urls |
| V7 | 2026-10-22 | bunny | Indian PoPs only on Standard: Mumbai, New Delhi, Chennai, Bangalore, Kolkata. No Hyderabad. No Volume PoP in India | Confirmed | No change | https://bunny.net/network/ |
| V8 | 2026-10-22 | bunny | Standard $0.03/GB Asia & Oceania. Volume $0.005/GB. No request fees. $1 minimum | Confirmed | No change. India's billing region is inferred from the network page | https://bunny.net/pricing/cdn/ |
| V9 | 2026-10-22 | bunny | Advanced token is HMAC-SHA256 with a path form and token_path prefix, required for HLS, on all accounts | Partially correct | Technical part holds. "All accounts" is not documented for this feature | https://bunny.net/docs/cdn/security/token-authentication/advanced |
| V10 | 2026-10-22 | fastly | India $0.28 then $0.24/GB, contact sales beyond. Packages exclude streaming and cap India traffic | Confirmed | The 10% cap covers Africa, India and South Korea combined | https://www.fastly.com/pricing |
| V11 | 2026-10-22 | fastly | Real-time log streaming included without Enterprise, capped at two statements per request | Confirmed | No change | https://docs.fastly.com/products/fastlys-full-site-delivery |
| V12 | 2026-10-22 | cloudflare | Logpush self-serve on Free, Pro and Business since 2026-09-30, usage-priced | Confirmed | Allowances are per account, not per zone. Field availability still depends on products | https://developers.cloudflare.com/changelog/post/2026-09-30-logpush-usage-based-pricing/ |
| V13 | 2026-10-26 | cloudflare | Pro $25 monthly or $20 annual, Business $250 or $200, no per-GB charge. Argo from $5 plus $0.10/GB | Partially correct | Plan prices confirmed. The $0.10/GB Argo rate is only on third-party sites. Video on Pro must come from R2 or Stream | https://www.cloudflare.com/plans/network-cdn/ |
| V14 | 2026-10-26 | cloudflare | Network page lists 23 Indian cities. Status page has 22. PeeringDB lists 8 Indian facilities | Partially correct | Network page lists 22 cities. Status page 22. PeeringDB 8 facilities in 7 cities | https://www.cloudflare.com/network/ |
| V15 | 2026-10-26 | gcore | PAYG €0.01/GB global after 1 TB free, graduated volume tiers, requests over 1 B at €0.75 per M | Confirmed | No change | https://gcore.com/pricing/edge-network |
| V16 | 2026-10-26 | gcore | Mumbai is the only Indian PoP, also per PeeringDB | Confirmed | No change | https://gcore.com/network |
| V17 | 2026-10-26 | gcore | MD5 query token, path tokens only on Video Streaming, directory token not recursive, Query String Forwarding, subnet binding Enterprise-only | Confirmed | Adds: HLS needs a paid plan and Support approval. Expired tokens return 410 | https://docs.gcore.com/cdn/cdn-resource-options/security/use-a-secure-token/configure-and-use-secure-token |
| V18 | 2026-10-26 | fastly | Multiple POPs in six metros, Bangalore plus about 28 others embedded, new Indian sites billed as Asia | Partially correct | Map data marks five metros as multi-POP and 28 cities as embedded, Bangalore included. India is its own billing region, priced above Asia | https://www.fastly.com/pricing |
| V19 | 2026-10-26 | 5centscdn | India needs the Enterprise network at $15/TB. Plan includes 1 TB. Calculator caps top-up at 50 TB | Partially correct | No effective 50 TB cap. A second option, Enterprise+, covers India at $35/TB | https://www.5centscdn.net/cdn-pricing/ |
| V20 | 2026-10-26 | 5centscdn | Mumbai only on Enterprise. Delhi and Chennai coming soon. No Hyderabad, Bangalore or Kolkata | Confirmed | The coming-soon flag is in page data, not shown to visitors | https://www.5centscdn.net/network/ |
| V21 | 2026-10-26 | india-reachability | Jio and Airtel poison DNS with fixed signatures. ACT injects. A public resolver bypasses Jio and Airtel blocks, which explains the black screens | Partially correct | Only ACT injects. Jio and Airtel also use SNI blocking. Study covers apex domains only. The black-screen link is untested | https://dnsblocks.in/assets/report.pdf |
| V22 | 2026-10-26 | india-reachability | Cloudflare's India routing incident ran 2025-07-30 to 2025-08-05 alongside reports of Jio IP-blocking | Partially correct | Timeline confirmed, with a gap between two records. No ISP or IP-block cause confirmed by Cloudflare | https://www.cloudflarestatus.com/incidents/ty5lgvkd41lm |
| V23 | 2026-10-26 | egress-economics | Free, Pro and Business terms require video to be hosted on a Cloudflare paid service, so B2-origin HLS on Pro is restricted | Confirmed | Enforcement is at Cloudflare's discretion, with notice | https://www.cloudflare.com/service-specific-terms-application-services/ |
| V24 | 2026-10-26 | egress-economics | R2 egress is $0 to any destination. Only Class B reads are billed on misses | Confirmed | First 10 M Class B free each month. Revalidations also count | https://developers.cloudflare.com/r2/pricing/ |
| V25 | 2026-10-26 | benchmarks | CDNPerf India: Cloudflare 31.81 ms, Bunny 32.00 ms, uptime 99.73% vs 99.65%. CDN77 113.87 ms. Gcore uptime 4.54% | Partially correct | Re-queried values differ slightly. The uptime figure is the last day only. Gcore's drop starts 2026-10-19 | https://www.cdnperf.com/#!rum,India |
| V26 | 2026-10-26 | benchmarks | Free and Pro zones served to Jio and Airtel from Singapore, Business and Enterprise from Mumbai | Partially correct | Latency data is from one Jio fiber line. Mobile only shows the colo. From OVH Mumbai, Free and Pro zones were served from BOM | https://punits.dev/blog/cloudflare-latency-india/ |
| V27 | 2026-10-26 | multi-cdn | Media3 1.10 adds HLS location fallback, 1.11 adds Content Steering, so apps can fail over between CDNs | Partially correct | Versions confirmed. Default policy switches only on HTTP 403, 404, 410, 416, 500 and 503, not on DNS, connect or timeout failures | https://raw.githubusercontent.com/androidx/media/release/RELEASENOTES.md |
| V28 | 2026-10-26 | multi-cdn | Bunny DNS queries, including scripted ones, are free. Scripts can route by ASN | Confirmed | Up to 500 zones free. CDN bytes after steering are still billed | https://bunny.net/pricing/dns/ |
| V29 | 2026-10-26 | cloudfront | Business flat-rate allows a non-AWS origin, a viewer-request Function for HMAC and per-path cache policies, with no overage | Confirmed | WAF ACL mandatory. Function not shareable. No Origin Shield on Business | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html |
| V30 | 2026-10-26 | cloudfront | Allowances are soft. Sustained excess can mean distant edges or throttling, per the Service Terms. Per distribution | Partially correct | The edge and timing wording is in the Developer Guide. Service Terms say throttling or a forced pricing change | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html#usage-allowance |
| V31 | 2026-10-26 | cloudflare | R2, Stream or Images hosted video is allowed on self-serve. HLS from B2 through Pro is not | Confirmed | Enforcement is discretionary. A grey-clouded subdomain is the allowed workaround | https://www.cloudflare.com/service-specific-terms-application-services/ |
| V32 | 2026-10-26 | video-platforms | Flat-rate has no overage, Premium scales to 125 TB, sustained excess may only mean distant edges | Partially correct | "May only" is wrong. AWS may throttle or require a pricing change | https://aws.amazon.com/service-terms/ |
| V33 | 2026-10-26 | video-platforms | CloudFront has 7 Indian PoPs plus 46 embedded. Bunny has 5 and none on Volume | Partially correct | These are city counts, not PoP counts. AWS publishes no Indian PoP count | https://aws.amazon.com/cloudfront/features/ |
| V34 | 2026-10-26 | cloudflare | HTTP/3 is off on both media hosts, as seen on 2026-10-13 | Confirmed | Still off at 14:47 UTC. HTTP/3-only requests to livev2 and recordedvideosv2 failed to connect, and their DNS HTTPS records offer h2 only. The same client reached www.cloudflare.com over HTTP/3 from BOM | Probe [174] |
| V35 | 2026-10-26 | bunny | Bunny does not offer HTTP/3 | Confirmed by probe | Standard edge MU1 and Volume edge SG1 sent no alt-svc header, their DNS HTTPS records offer h2 and http/1.1, and HTTP/3-only requests timed out. The pull-zone API has no HTTP/3 field. Not confirmed in writing by Bunny | Probe [174], https://core-api-public-docs.b-cdn.net/docs/v3/public.json |
| V36 | 2026-10-26 | bunny | Bunny S3 authentication works with a private R2 bucket and region auto | Unverified | Bunny signs origin requests with SigV4 and takes a free-text region. Its only documented non-AWS case is B2. No Bunny page names R2. R2 accepts auto and aliases us-east-1 to it | https://bunny.net/docs/cdn/request-headers-to-origin |
| V37 | 2026-10-26 | bunny | Bunny can keep 404s out of cache | Partially correct | A per-zone switch exists. Bunny's Terraform provider defaults it to off. The dashboard default is undocumented | https://github.com/BunnyWay/terraform-provider-bunnynet/blob/main/internal/provider/resource_pullzone.go |
| V38 | 2026-10-26 | cloudflare | A 1 s status-code TTL works on all plans, per [3] | Partially correct | The settings page lists no plan gate and offers no-store and no-cache values. It does not say whether Pro's 1 h floor applies to a positive TTL. The live host's 404s were BYPASS on 2026-10-24 | https://developers.cloudflare.com/cache/how-to/cache-rules/settings/ |
| V39 | 2026-10-26 | cloudfront | Premium at $1,000 covers 250 M requests and the $2,250 level covers 500 M | Confirmed | Premium default is 50 TB and 500 M. The $1,450 level is 75 TB and 750 M. The $2,250 level is 125 TB and 1.25 B. S3 credit is 1 TB on Business and 5 TB on Premium. HTTP/3 on every tier | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html |
| V40 | 2026-10-26 | gcore | PAYG is enough for HLS delivery | Unverified | HLS needs Support approval and a paid CDN plan. The pricing page lists PAYG and Enterprise only. The trial page names Start and Pro plans whose fees are not published | https://docs.gcore.com/cdn/getting-started/create-a-cdn-resource/create-a-cdn-resource-for-video-streaming |
| V41 | 2026-10-26 | fastly | 35 Indian cities, or five multi-POP metros plus 28 embedded per V18 | Partially correct | The list names 35 cities. Mumbai, New Delhi and Noida are marked multi-POP in the list, and Chennai, Hyderabad and Kolkata in the map data. 29 are embedded, Bangalore and Bhopal included. Bhopal has a swapped latitude in the map data, which hid it from V18's count. Map dated 2026-06-30 | https://www.fastly.com/network-map |
| V42 | 2026-10-26 | cachefly | CacheFly Business is bought through a form, with published global tiers | Partially correct | The page dated 2026-09-15 has new plans. The entry plan has portal signup with 10 TB included. Larger volume is a rep-sized commit with no published per-TB price. The top plan is sales-only | https://www.cachefly.com/pricing/ |
| V43 | 2026-10-26 | cloudflare | Business reduces how much Indian traffic is served from SIN or FRA | Unverified | No Cloudflare page ties plan level to colo selection. The routing page says the ISP chooses, and selection cannot be configured per zone, per account or by support request | https://developers.cloudflare.com/support/troubleshooting/general-troubleshooting/geographic-traffic-routing/ |
| V44 | 2026-10-26 | cloudfront | Flat-rate plans may restrict a video- or HLS-dominant workload | No restriction found | The plan page names no content-type, video, streaming or large-file limit. The CloudFront section of the Service Terms, last updated 2026-10-22, covers only domains, certificates and the usage allowance: excess can mean throttling or a forced pricing change. The pricing page points large, predictable traffic spikes to pay-as-you-go. AWS's general Acceptable Use Policy was not read | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html, https://aws.amazon.com/service-terms/ |
| V45 | 2026-10-26 | video-platforms | Cloudflare Stream is $1 per 1,000 minutes delivered plus storage | Confirmed | Storage is $5 a month per 1,000 minutes. Ingress and encoding are free. No free delivery allowance. Volume pricing through sales. Page updated 2026-10-15 | https://developers.cloudflare.com/stream/pricing/ |
| V46 | 2026-10-26 | video-platforms | Mux delivery for about 8.33 M minutes at up to 720p is about $5,520 | Confirmed | First 100,000 minutes free. Basic and Plus tiers fall from $0.0008 to $0.00061 per minute at this volume. Live encoding on Plus is $0.025 per minute up to 720p. No date on the page | https://www.mux.com/docs/pricing/video |
| V47 | 2026-10-26 | bunny | India is billed at the Asia & Oceania rate of $0.03/GB | Confirmed | Bunny's region list gives Mumbai, New Delhi, Chennai, Bangalore and Kolkata $0.03/GB each, under continent ASIA. It has no Hyderabad entry | https://api.bunny.net/region |
| V48 | 2026-10-26 | second-tier | BlazingCDN costs $5/TB | Partially correct | $5/TB covers only the first 5 TB, inside a $25 minimum. Marginal tiers follow: $4.50 to 25 TB, $4.00 to 100 TB, $3.50 to 500 TB. The page's own totals are $92.50, $215 and $415 at 20, 50 and 100 TB, "as of October 2026" | https://blazingcdn.com/pricing/ |
| V49 | 2026-10-26 | cloudflare | Logpush on Pro is usage-priced, with no price stated here | Confirmed | Priced by GB, not by line. Pushes to R2 or Pipelines: 25 GB a month free, then $0.03/GB. Other destinations: 25 GB free, then $0.10/GB. Transformations: 1 GB free, then $0.04/GB. Per account | https://developers.cloudflare.com/changelog/post/2026-09-30-logpush-usage-based-pricing/ |
| V50 | 2026-10-26 | india-cdns | CDNetworks CDN Pro is self-serve with published prices and Indian PoPs | Unverified | Search results for its pricing and signup pages show self-signup, a $50 monthly commitment and per-GB server-group prices. The pages refused direct reads. No Indian server group or PoP list was found | https://www.cdnetworks.com/products/cdnpro-pricing/ |

Claims that were never verified. Verification attempts failed in the 2026-10-22 run and were not re-run. Treat each as Unverified.

| Owner | Claim | Status | Source in the sweep |
|---|---|---|---|
| azure | Zone 5 India pricing and request rates | Unverified | https://azure.microsoft.com/en-us/pricing/details/frontdoor/ |
| azure | Four Indian metros, no Bangalore, Kolkata or Pune | Unverified | https://learn.microsoft.com/en-us/azure/frontdoor/edge-locations-by-region |
| azure | No GA HMAC signed-request feature | Unverified | https://learn.microsoft.com/en-us/azure/frontdoor/front-door-faq |
| keycdn | Asia per-GB tiers and no request fees | Unverified | https://www.keycdn.com/pricing |
| keycdn | Bangalore is the only Indian PoP | Unverified | https://www.keycdn.com/network |
| keycdn | MD5 exact-path token with no prefix scope | Unverified | https://www.keycdn.com/support/secure-token |
| cachefly | Global Business tiers and the AUP clause on concentrated traffic | Tiers superseded by V42. AUP clause Unverified | https://www.cachefly.com/acceptable-use-policy/ |
| cachefly | Mumbai is the only Indian PoP | Unverified | https://www.cachefly.com/network-map/ |
| cachefly | Token auth needs enabling and has no HMAC prefix form | Unverified | https://portal.cachefly.com/api/2.5/docs/signedurls |
| edgeone | India billed in Asia-Pacific Zone 3 with quota weighting | Unverified | https://edgeone.ai/document/55643 |
| edgeone | Mumbai and Chennai claimed only in a vendor blog | Unverified | https://edgeone.ai/blog/details/best-cdn-india |
| edgeone | No prefix-scoped HMAC token | Unverified | https://edgeone.ai/document/62479 |
| 5centscdn | Origin auth accepts AWS-format keys only, so private R2 and B2 fail | Unverified | https://developer.5centscdn.net/api-reference/post-zones-http-pull |

## Sources

Operator evidence (repo paths unless noted)
- [1] reference/quicktricks-cloudflare-minute-delivery-2026-10-24.md
- [2] reference/quicktricks-cloudflare-buffering-2026-10-24.md
- [3] reference/cdn-actions-cloudflare-2026-10-13.md
- [4] reference/buffering-and-dns-handoff-2026-10-08.md
- [5] docs/plans/playback-cdn-pilot.md
- [6] reference/client-playback-telemetry-guide.md
- [7] Operator memory note live-r2-upload-stalls-404 (2026-10-20 PUT stalls and the 2026-10-24 follow-up; kept outside the repo)
- [200] TENANTS.md (recorded media hosts per tenant)
- [201] Operator memory note vidyagram-live-encoder (vidyagram-live.hranker.org, set up 2026-10-21; kept outside the repo)
- [174] HTTP/3 probe run for this report on 2026-10-26, 14:47-14:49 UTC, with curl 8.22.0 built with HTTP/3, from the operator's machine in India. Hosts: livev2.hranker.org, recordedvideosv2.hranker.org, www.cloudflare.com, test.b-cdn.net, bunny.net, recordedvideos-hranker-v2.b-cdn.net. Checks: response headers, `--http3-only` requests and DNS HTTPS records from 1.1.1.1

Cloudflare
- [8] https://www.cloudflare.com/plans/network-cdn/ (Contract plan "Custom", re-read 2026-10-26)
- [9] https://www.cloudflare.com/service-specific-terms-application-services/
- [10] https://blog.cloudflare.com/updated-tos/
- [11] https://developers.cloudflare.com/r2/pricing/
- [12] https://www.cloudflare.com/network/
- [13] https://www.cloudflarestatus.com/api/v2/components.json
- [14] https://www.peeringdb.com/api/net?asn=13335
- [15] https://developers.cloudflare.com/ruleset-engine/rules-language/functions/#hmac-validation
- [16] https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/
- [17] https://developers.cloudflare.com/cache/concepts/default-cache-behavior/
- [18] https://developers.cloudflare.com/cache/how-to/tiered-cache/ (updated 2026-09-29)
- [19] https://developers.cloudflare.com/changelog/post/2026-09-30-logpush-usage-based-pricing/ (prices read 2026-10-26)
- [20] https://developers.cloudflare.com/dns/zone-setups/partial-setup/
- [21] https://developers.cloudflare.com/cache/how-to/purge-cache/
- [22] https://developers.cloudflare.com/speed/optimization/protocol/http3/
- [23] https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/
- [24] https://developers.cloudflare.com/support/troubleshooting/general-troubleshooting/potential-isp-blocking/
- [25] https://developers.cloudflare.com/support/troubleshooting/general-troubleshooting/geographic-traffic-routing/
- [26] https://blog.cloudflare.com/meet-traffic-manager/
- [27] https://blog.cloudflare.com/introducing-concurrent-streaming-acceleration/
- [28] https://www.cloudflarestatus.com/incidents/dmz0f4sm2tmg
- [29] https://www.cloudflarestatus.com/incidents/ty5lgvkd41lm
- [30] https://www.cloudflarestatus.com/history?type=incident
- [31] https://www.cloudflarestatus.com/incidents/zzm20jnkvy44
- [32] https://www.cloudflarestatus.com/incidents/t77gwnpr6oe5
- [33] https://www.cloudflarestatus.com/incidents/fpj51jcbb89l
- [34] https://developers.cloudflare.com/rules/cloud-connector/
- [35] https://developers.cloudflare.com/r2/reference/data-location/
- [168] https://developers.cloudflare.com/cache/how-to/cache-rules/settings/ (updated 2026-10-15)
- [169] https://developers.cloudflare.com/r2/api/s3/api/ (updated 2026-10-14)

AWS
- [36] https://aws.amazon.com/cloudfront/pricing/
- [37] https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html (re-read 2026-10-26)
- [38] https://aws.amazon.com/service-terms/ (last updated 2026-10-22, read 2026-10-26)
- [39] https://aws.amazon.com/cloudfront/features/
- [40] https://aws.amazon.com/cloudfront/faqs/
- [41] https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/
- [42] https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html
- [43] https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-javascript-runtime-20.html
- [44] https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-origin.html
- [45] https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html
- [46] https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/HTTPStatusCodes.html
- [47] https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/invalidation-specifying-objects.html
- [48] https://aws.amazon.com/cloudfront/sla/
- [49] https://www.peeringdb.com/api/net?asn=16509&depth=2
- [50] https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSDataTransfer/20260916132208/ap-south-1/index.json
- [51] https://aws.amazon.com/ivs/pricing/
- [175] https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/ap-south-1/index.json (published 2026-10-15)

Bunny.net
- [52] https://bunny.net/pricing/cdn/
- [53] https://bunny.net/network/
- [54] https://bunny.net/docs/cdn/security/token-authentication/advanced
- [55] https://bunny.net/docs/cdn/integrations/storage/backblaze
- [56] https://bunny.net/docs/cdn/smart-cache.md
- [57] https://bunny.net/docs/cdn/performance/origin-shield.md
- [58] https://bunny.net/docs/cdn/request-coalescing.md
- [59] https://bunny.net/docs/cdn/perma-cache
- [60] https://bunny.net/docs/cdn/logging
- [61] https://bunny.net/sla/
- [62] https://bunny.net/super-bunnies-cdn-support/
- [63] https://bunny.net/pricing/dns/
- [64] https://bunny.net/docs/dns/scriptable/introduction.md
- [65] https://status.bunny.net/incidents/m34sk8cnvp35
- [66] https://status.bunny.net/incidents/j1syhng2crfy
- [67] https://bunny.net/blog/bunnycdn-domain-b-cdn-net-has-been-blocked-in-turkey/
- [68] https://bunny.net/docs/stream/pricing
- [69] https://www.peeringdb.com/api/net?asn=200325
- [170] https://bunny.net/docs/cdn/request-headers-to-origin
- [171] https://core-api-public-docs.b-cdn.net/docs/v3/public.json
- [172] https://github.com/BunnyWay/terraform-provider-bunnynet/blob/main/internal/provider/resource_pullzone.go (docs commit 2026-10-05)
- [173] https://bunny.net/docs/cdn/purge-cache
- [194] https://api.bunny.net/region (public region list with per-GB prices, read 2026-10-26)

Fastly
- [70] https://www.fastly.com/pricing
- [71] https://www.fastly.com/network-map
- [72] https://www.peeringdb.com/net/5520
- [73] https://docs.fastly.com/products/fastlys-full-site-delivery
- [74] https://docs.fastly.com/products/fastlys-streaming-delivery
- [75] https://www.fastly.com/documentation/guides/getting-started/hosts/shielding/
- [76] https://www.fastly.com/documentation/solutions/examples/using-s3-compatible-buckets-as-private-origins/
- [77] https://www.fastly.com/documentation/solutions/tutorials/custom-vcl/decoding-jwt-vcl/
- [78] https://www.fastly.com/documentation/reference/vcl/variables/backend-response/beresp-cacheable/
- [79] https://docs.fastly.com/products/network-services-service-availability-sla
- [80] https://www.fastlystatus.com/incidents?PageNumber=1&Search=Mumbai&StartDate=01%2F01%2F25&EndDate=10%2F22%2F26&SortBy=0
- [81] https://www.fastly.com/press/press-releases/fastly-expands-partnership-with-jio-platforms
- [176] https://www.fastly.com/documentation/guides/full-site-delivery/performance/enabling-http3-for-fastly-services/
- [177] https://www.fastly.com/documentation/guides/full-site-delivery/purging/getting-started-with-purging/

Akamai
- [82] https://www.akamai.com/products/adaptive-media-delivery
- [83] https://www.peeringdb.com/api/netfac?net_id=2
- [84] https://techdocs.akamai.com/adaptive-media-delivery/docs/add-token-auth
- [85] https://www.akamaistatus.com/incidents/cmlzltp4vfpq
- [184] https://techdocs.akamai.com/property-mgr/docs/cache-http-err-responses
- [185] https://techdocs.akamai.com/purge-cache/docs/purge-mechanisms
- [186] https://techdocs.akamai.com/adaptive-media-delivery/changelog/support-for-http3

Google Cloud
- [86] https://cloud.google.com/cdn/pricing
- [87] https://docs.cloud.google.com/cdn/docs/locations
- [88] https://docs.cloud.google.com/cdn/docs/using-signed-urls
- [89] https://docs.cloud.google.com/cdn/docs/configure-private-origin-authentication
- [90] https://docs.cloud.google.com/cdn/docs/caching
- [91] https://docs.cloud.google.com/cdn/docs/choose-cdn-product
- [92] https://docs.cloud.google.com/media-cdn/docs/overview
- [93] https://status.cloud.google.com/incidents/5fGQt4VbkDnr3Yp8PXPr
- [178] https://docs.cloud.google.com/cdn/docs/cache-invalidation-overview (updated 2026-10-22)
- [179] https://docs.cloud.google.com/load-balancing/docs/https (updated 2026-10-26)

Microsoft Azure
- [94] https://azure.microsoft.com/en-us/pricing/details/frontdoor/
- [95] https://learn.microsoft.com/en-us/azure/frontdoor/edge-locations-by-region
- [96] https://learn.microsoft.com/en-us/azure/frontdoor/front-door-faq
- [97] https://learn.microsoft.com/en-us/azure/frontdoor/front-door-caching
- [98] https://learn.microsoft.com/en-us/azure/frontdoor/origin-authentication-with-managed-identities
- [187] https://learn.microsoft.com/en-us/azure/frontdoor/cache-purge

Gcore
- [99] https://gcore.com/pricing/edge-network
- [100] https://gcore.com/developers/pay-as-you-go-cdn
- [101] https://gcore.com/network
- [102] https://www.peeringdb.com/net/5499
- [103] https://docs.gcore.com/cdn/cdn-resource-options/security/use-a-secure-token/configure-and-use-secure-token
- [104] https://docs.gcore.com/cdn/getting-started/create-a-cdn-resource/create-a-cdn-resource-for-video-streaming
- [105] https://docs.gcore.com/cdn/cdn-resource-options/general/use-a-private-bucket-as-an-origin
- [106] https://docs.gcore.com/cdn/cdn-resource-options/general/enable-and-configure-origin-shielding
- [107] https://docs.gcore.com/cdn/cdn-resource-options/cache/specify-cache-lifetime-on-a-cdn-resource-or-origin
- [108] https://gcore.com/legal
- [109] https://status.gcore.com/incident/cmp4g7cqp0007nwjs12ucojqr
- [180] https://docs.gcore.com/cdn/clear-cdn-resource-cache-by-url-pattern-or-all
- [181] https://docs.gcore.com/api-reference/cdn/cdn-resources/create-cdn-resource.md
- [182] https://docs.gcore.com/account-settings/billing/trial-conditions.md
- [183] https://docs.gcore.com/cdn/how-the-cdn-service-and-its-additional-options-are-billed

KeyCDN
- [110] https://www.keycdn.com/pricing
- [111] https://www.keycdn.com/network
- [112] https://www.keycdn.com/support/secure-token
- [113] https://www.keycdn.com/blog/new-feature-origin-shield
- [114] https://www.keycdn.com/features
- [188] https://www.keycdn.com/support/cdn-error-codes
- [189] https://www.keycdn.com/support/purge-cdn-cache

CacheFly
- [115] https://www.cachefly.com/pricing/ (modified 2026-09-15, re-read 2026-10-26)
- [116] https://www.cachefly.com/network-map/
- [117] https://www.cachefly.com/acceptable-use-policy/
- [118] https://portal.cachefly.com/api/2.5/docs/signedurls

5centsCDN
- [119] https://www.5centscdn.net/cdn-pricing/
- [120] https://www.5centscdn.net/network/
- [121] https://api.5centscdn.com/open/edgeservers/
- [122] https://www.5centscdn.net/help/origin-shield-for-pull-zones/
- [123] https://developer.5centscdn.net/api-reference/post-zones-http-pull
- [190] https://www.5centscdn.net/help/how-to-purge-cache-from-a-pull-or-push-zone/

CDN77
- [124] https://www.cdn77.com/pricing
- [125] https://client.cdn77.com/support/status
- [126] https://client.cdn77.com/support/knowledgebase/security-measures/secure-token
- [127] https://client.cdn77.com/support/api-reference/v3/cdn-resources/add-cdn-resource
- [191] https://client.cdn77.com/support/knowledgebase/cdn-resource/purge

Alibaba Cloud
- [128] https://www.alibabacloud.com/product/cdn/pricing
- [129] https://www.alibabacloud.com/help/en/cdn/product-overview/pop-distribution
- [130] https://www.alibabacloud.com/help/en/cdn/user-guide/configure-url-signing
- [131] https://www.alibabacloud.com/help/en/cdn/user-guide/back-to-origin-routing-overview
- [132] https://www.alibabacloud.com/help/en/live/product-overview/announcement-on-video-live-downline-india-live-center
- [192] https://www.alibabacloud.com/help/en/cdn/user-guide/what-is-the-quic-protocol
- [193] https://www.alibabacloud.com/help/en/cdn/developer-reference/api-cdn-2018-05-10-refreshobjectcaches

Tencent EdgeOne
- [133] https://edgeone.ai/document/55643
- [134] https://edgeone.ai/document/62479
- [135] https://edgeone.ai/blog/details/best-cdn-india
- [136] https://www.peeringdb.com/api/net/5005?depth=2
- [137] https://pib.gov.in/PressReleasePage.aspx?PRID=1635206

Second-tier and defunct CDNs
- [138] https://blazingcdn.com/features/
- [139] https://blazingcdn.com/pricing/ (re-read 2026-10-26)
- [140] https://www.medianova.com/en/network-map/
- [141] https://www.leaseweb.com/en/products-services/cdn/multi-cdn
- [142] https://www.akamai.com/newsroom/press-release/akamai-acquires-stackpath-cdn-customers
- [143] https://learn.microsoft.com/en-us/azure/cdn/edgio-retirement-faq

Indian and carrier CDNs
- [195] https://www.cdnetworks.com/products/cdnpro-pricing/ (seen through search results on 2026-10-26; direct reads refused)
- [196] https://console.cdnetworks.com/subscription/signup/cdn?lang=en (seen through search results on 2026-10-26)
- [197] https://www.tatacommunications.com/solutions/content-delivery-network (read 2026-10-26)
- [198] https://www.tatacommunications.com/solutions/content-delivery-network/video-cdn (read 2026-10-26)
- [199] https://www.airtel.in/business/b2b/edge-cdn (read 2026-10-26)

Object storage
- [144] https://www.backblaze.com/cloud-storage/pricing (re-read 2026-10-26)

India reachability and benchmarks
- [145] https://dnsblocks.in/assets/report.pdf
- [146] https://dnsblocks.in/data/compiled_blocklist.csv
- [147] https://ooni.org/post/2020-tls-blocking-india/
- [148] https://www.medianama.com/2026/03/223-isp-website-blocking-india-report/
- [149] https://x.com/mehulmpt/status/1950524151569248571
- [150] https://www.peeringdb.com/api/netixlan?asn__in=13335,200325,54113,16509,20940,199524,55836,9498,24560,45609,55410,9829,24309,17488
- [151] https://stat.ripe.net/data/asn-neighbours/data.json?resource=AS55836
- [152] https://stat.ripe.net/data/asn-neighbours/data.json?resource=AS9498
- [153] https://www.cdnperf.com/#!rum,India
- [154] https://punits.dev/blog/cloudflare-latency-india/
- [155] https://blog.apnic.net/2026/06/26/peering-capacity-at-public-internet-exchanges-what-the-data-reveals/

Players and multi-CDN
- [156] https://raw.githubusercontent.com/androidx/media/release/RELEASENOTES.md
- [157] https://raw.githubusercontent.com/video-dev/hls.js/master/docs/API.md
- [158] https://www.akamai.com/resources/customer-story/hotstar

Managed video platforms
- [159] https://developers.cloudflare.com/stream/pricing/ (updated 2026-10-15, re-read 2026-10-26)
- [160] https://developers.cloudflare.com/stream/faq/
- [161] https://www.mux.com/docs/pricing/video (re-read 2026-10-26)
- [162] https://www.gumlet.com/pricing/
- [163] https://www.vdocipher.com/site/pricing/
- [164] https://www.vdocipher.com/pricing/livestream/
- [165] https://api.video/pricing/
- [166] https://vimeo.com/ott/pricing
- [167] https://www.wowza.com/pricing/video
