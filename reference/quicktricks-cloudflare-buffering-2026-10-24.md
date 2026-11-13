# qt: Cloudflare/R2 buffering inspection — 2026-10-24

> **Follow-up:** [One-minute delivery investigation](quicktricks-cloudflare-minute-delivery-2026-10-24.md) found brief multi-second segment latency spikes hidden by these aggregates, including slow cache HITs. Read that updated finding before using this initial aggregate verdict; broad outage/WAF causation remains unestablished.

Read-only inspection in Deepak's signed-in Cloudflare account using the Chrome extension. No settings, rules, DNS, cache, objects, or purges changed. Dashboard zone: `hranker.org` (Pro). All HTTP measurements below explicitly filter Host equals `livev2.hranker.org`. Class measurements additionally filter Path contains the full class ID. Values retain dashboard rounding; top-statistic panels explicitly reported a 50% sample.

## Verdict

The inspected sampled analytics do **not establish a broad R2 outage, origin connection failure, or WAF/rate-limit cause** for simultaneous buffering. Both classes had zero observed 5xx and 100% origin reachability in the measured baseline and incident windows. Main-window security summaries for each class showed zero mitigated requests, custom-rule requests, managed-rule requests, and rate-limiting requests.

There is a segment latency-tail signal: class B's main-window segment edge TTFB p99 was 2.2 seconds, versus 789 ms in its small baseline. Class A's segment p99 increased from 488 to 666 ms. This is a possible contributor, **not a demonstrated cause**. TTFB does not measure complete segment download time, throughput, playlist freshness, or player buffering. Per-ASN/per-colo latency, player network traces, and timestamp-aligned segment-level evidence remain necessary to localize the cause.

The host-wide 403 increase is misleading if attributed directly to these classes: their main-window class/segment results contain no listed 403s. Many host top paths belonged to older classes. No causal attribution of those older requests was established.

## Verified storage

R2 bucket Settings showed `livestream-hranker-v2`, APAC location, custom domain `livev2.hranker.org` Active/Enabled. Public development URL disabled. Data Access Logs disabled. This verifies **R2**, not Backblaze B2, for this domain. Settings were viewed only.

## Windows

| Window | IST | UTC |
|---|---|---|
| Known upload-stall comparison | 17:30–17:35 | 12:00–12:05 |
| Quiet baseline | 17:45–18:05 | 12:15–12:35 |
| Main buffering | 18:12–18:25 | 12:42–12:55 |
| Second buffering | 18:28–18:33 | 12:58–13:03 |

## Host-wide HTTP analytics

These include all classes served on the host, not solely the incident classes.

| Window | Requests | 200 | 403 | 404 | 499 | 5xx | HIT | Edge p50 / p95 / p99 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Upload-stall comparison | 89.64k | 86.94k | 1.55k | 699 | 117 | 0 | 75.33% | 10 / 402 / 512 ms |
| Baseline | 340.38k | 328.14k | 11.09k | 10 | 146 | 0 | 75.25% | 10 / 394 / 553 ms |
| Main | 246.72k | 226.71k | 18.17k | 30 | 359 | 0 | 68.86% | 11 / 412 / 595 ms |
| Second | 85.09k | 77.8k | 6.63k | not listed | 70 | 0 | 69.54% | 10 / 400 / 518 ms |

Other statuses: upload-stall 206=212, 304=118; baseline 206=888, 304=102; main 206=1.28k, 304=171; second 206=382, 304=215. An unlisted status is not an exact unsampled zero.

| Window | HIT | MISS | DYNAMIC | NONE | BYPASS |
|---|---:|---:|---:|---:|---:|
| Upload-stall | 67.52k | 1.23k | 18.52k | 1.67k | 697 |
| Baseline | 256.12k | 3.85k | 69.16k | 11.24k | 9 |
| Main | 169.9k | 11.83k | 46.43k | 18.53k | 27 |
| Second | 59.18k | 3.46k | 15.75k | 6.7k | not listed |

EXPIRED was not listed in these summaries.

## Class-scoped HTTP and origin analytics

A = `6adc14d63b633dadde981053`; B = `6adc15013b633dadde983694`.

| Class/window | Requests | 2xx | 3xx | 4xx | 5xx | HIT | Edge p50 / p95 / p99 | Origin p50 / p95 / p99 |
|---|---:|---:|---:|---:|---:|---:|---|---|
| A baseline | 145.75k | 145.6k | 102 | 51 | 0 | 52.28% | 154 / 431 / 578 ms | 198 / 463 / 668 ms |
| A main | 82.61k | 82.28k | 140 | 185 | 0 | 50.43% | 168 / 451 / 605 ms | 197 / 486 / 605 ms |
| A second | 23.84k | 23.58k | 215 | 41 | 0 | 43.15% | 174 / 425 / 587 ms | 192 / 442 / 587 ms |
| B baseline | 1.3k | 1.29k | 0 | 13 | 0 | 39.95% | 247 / 576 / 710 ms | 340 / 602 / 779 ms |
| B main | 12.09k | 11.98k | 31 | 80 | 0 | 38.43% | 201 / 571 / 1,000 ms | 238 / 583 / 857 ms |
| B second | 4.5k | 4.5k | 0 | 0 | 0 | 41.42% | 188 / 555 / 745 ms | 240 / 587 / 780 ms |

All six origin views showed 100% reachability, 100% connection success, zero connection failures and zero origin 5xx. Origin requests: A baseline 69.51k, main 40.79k, second 13.51k; B baseline 767, main 7.36k, second 2.64k. A origin 404: baseline 10, main 30, second 0; B origin 4xx: zero in all three views. B baseline traffic is much smaller than its incident traffic, so its percentile comparison is not workload-matched.

## Segments versus playlists

Additional Path contains `.ts` or `.m3u8` filters; main incident unless stated.

| Scope | Requests | HIT | 4xx | 5xx | Edge p50 / p95 / p99 |
|---|---:|---:|---:|---:|---|
| A baseline segments | 78.77k | 96.74% | 44 | 0 | 8 / 371 / 488 ms |
| A main segments | 43.57k | 95.61% | 160 | 0 | 10 / 414 / 666 ms |
| A main playlists | 39.04k | 0% | 25 | 0 | 203 / 484 / 598 ms |
| B baseline segments | 684 | 75.88% | 13 | 0 | 165 / 630 / 789 ms |
| B main segments | 5.7k | 81.47% | 69 | 0 | 150 / 656 / 2,200 ms |
| B main playlists | 6.38k | 0% | 11 | 0 | 227 / 528 / 623 ms |

A main segments: 200=43.21k, 206=196, 499=130, 404=30; no 403 listed. Cache HIT=41.66k, MISS=1.75k, NONE=130, BYPASS=27. A playlists DYNAMIC=39.01k, NONE=25; 304=140. B main segments: 200=5.59k, 206=46, 499=69; no 403/404 listed. B playlists DYNAMIC=6.37k, NONE=11; 304=31. The low combined cache hit percentage is heavily influenced by dynamic playlist requests; it must not be presented as the segment cache hit rate.

Main-window class A and B Security summaries separately showed zero mitigations, custom-rule requests, rate-limiting requests, managed-rule requests, and no top security product. Security action was labelled Unknown. This is a summary-analytics finding; a separate filtered Security Events export was not collected.

## Geographic and network scope

Main host traffic: India 240.28k of 246.72k. Host top colos: BOM 61.41k, DEL 50.59k, SIN 38.67k, FRA 24.7k, MAA 24.12k, HYD 16.04k, JRG 10.6k, PAT 6.56k, IAD 6.44k. Baseline also had substantial SIN/FRA traffic (59.97k/41.27k), so their presence is not incident-specific evidence.

Main host ASNs: Jio 55836 120.41k; Airtel mobile 45609 41.12k; Airtel telemedia 24560 39.42k; Vi 45271 5.2k and 38266 3.96k; BSNL/National Internet Backbone 9829 4.54k. These are request volume distributions, not failure-rate or latency distributions.

B main segments ASNs: Jio 2.29k; Airtel mobile 1.89k; Airtel telemedia 462; Vi 38266 451; BSNL 228; Vi 45271 221; Sparklink 93; OVH 70. No ISP/colo cause can be inferred without per-network latency/error denominators.

## R2 bucket metrics and limits

| Window | Class A operations headline / chart | Class B operations headline / chart |
|---|---:|---:|
| Baseline | 2.7k / 2.47k | 76.48k / 72.77k |
| Main | 3.35k / 3.11k | 62.26k / 57.74k |
| Second | 1.23k / 1.11k | 25.31k / 21.16k |

The dashboard's headline and chart totals differed; preserved here without inventing a reconciliation. These are bucket-wide operation classes, not tenant/class-specific read counts. The bucket includes tenant prefixes 472 and 641. Request Distribution remained 1.31M and APAC Writes 68.63k across all three selected windows, so it was not accepted as scoped incident evidence. Data Retrieved reported 0 B with no data available; this is not proof that no bytes were served. Second-window storage also showed 0 B/no data; this is not evidence of an empty bucket.

No R2 request errors or latency panel was exposed on the inspected metrics page. Object Data Access Logs were disabled, so no historical object access-log evidence was available through that feature. No logging was enabled.

## Remaining limitations

- Top-statistic panels reported 50% sampling. Dashboard rounding, sampling and partial loading make these observational estimates, not complete request logs.
- One-minute chart bins were visible, but a complete per-minute status/cache/latency export for every requested window was not collected. No synthetic per-minute numbers are supplied.
- No separate Security Events export, per-ASN/per-colo error/latency comparison, complete segment transfer timing, or playlist freshness audit was collected in this pass.
- Same-day ranges were available. Retention bounds and exact plan-specific dataset entitlements were not independently established; Pro was visible in the zone header.
- Conclusions cover observed request handling and TTFB. They do not exclude a localized network throughput problem, a small long-tail population, stale/late playlist contents, or player behavior.

Source UI: [HTTP analytics](https://dash.cloudflare.com/1ff6f2000c9aa34ca2ec88c066af092a/hranker.org/analytics/requests) and [R2 bucket metrics](https://dash.cloudflare.com/1ff6f2000c9aa34ca2ec88c066af092a/r2/default/buckets/livestream-hranker-v2/metrics). Reapply the explicit filters and UTC ranges above; default ranges are not incident-scoped.
