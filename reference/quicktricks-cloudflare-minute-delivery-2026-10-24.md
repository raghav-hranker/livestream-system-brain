# qt: One-minute Cloudflare delivery investigation — 2026-10-24

Follow-up to [the aggregate inspection](quicktricks-cloudflare-buffering-2026-10-24.md). All actions were read-only in Deepak's signed-in Chrome profile. No changes to rules, settings, DNS, caching, logging or objects; no purge. The hypothetical “around 6:15 PM” example was **not** used as a complaint timestamp.

## Updated finding

**There are measured, short-lived segment response-latency spikes that the 13-minute aggregate obscured.** At 18:14 IST, both affected classes show elevated segment p99; class B also shows a multi-second p95. Similar spikes affect A at 18:19 and 18:29, and B at 18:13, 18:17 and 18:20. These are candidate delivery events within the real incident windows, not verified matches to complaint bursts.

The evidence supports investigating intermittent slow segment responses. It does **not** establish which Cloudflare/R2 subsystem, network path, or client behavior caused them, nor prove that they drained viewer buffers. Some spikes persist when restricted to cache HIT responses, so they cannot be explained solely by a burst of cache misses or missing origin objects. Successful 2xx responses and 100% origin reachability do not rule out these latency tails.

## Strongest candidates

All times are IST on October 24; latency values below are milliseconds. A = `6adc14d63b633dadde981053`; B = `6adc15013b633dadde983694`.

| Minute | Class | Segment requests | Edge p95 / p99 | Origin requests | Origin p95 / p99 | Playlist p99 |
|---|---|---:|---|---:|---|---:|
| 18:14 | A | 2,769 | 452 / 3,830 | 106 | 769 / 1,022 | 595 |
| 18:14 | B | 563 | 2,241 / 5,796 | 61 | 2,229 / 10,472 | 629 |
| 18:19 | A | 3,639 | 467 / 10,851 | 147 | 839 / 14,460 | 604 |
| 18:20 | B | 491 | 510 / 6,276 | 80 | 1,372 / 7,617 | 691 |
| 18:29 | A | 3,048 | 428 / 9,345 | 146 | 720 / 868 | 595 |
| 18:29 | B | 464 | 538 / 721 | 92 | 705 / 730 | 717 |

The 18:14 candidate aligns across both classes. The 18:29 candidate does not show a matching large tail in B. Playlists do not show multi-second p99 at these same minutes. Origin and edge percentiles summarize different populations; do not subtract or treat them as measurements of the same individual request.

## Cache-HIT isolation

Additional filters: Cache status equals HIT; for slow counts, Edge time to first byte (ms) greater than 2000.

| Scope | HIT denominator | HITs above 2 seconds | Approximate slow share | HIT-only edge p99 |
|---|---:|---:|---:|---:|
| A baseline 17:45–18:05 | 76.2k | 9 | 0.012% | not remeasured for whole baseline |
| A 18:14 minute | 2,661 | 51 | 1.92% | 4,237 ms |
| A 18:19 minute | 3,480 | 62 | 1.78% | not separately remeasured |
| A 18:29 minute | 2,896 | 55 | 1.90% | 9,819 ms |
| B baseline 17:45–18:05 | 519 | 0 observed | 0% observed | not remeasured for whole baseline |
| B 18:14 minute | 498 | 24 | 4.82% | 5,641 ms |

All inspected slow-HIT subgroup summaries showed 2xx responses and no 4xx or 5xx. The A 18:19 subgroup (>2 seconds) had p50 10.9s, p95 13.3s, p99 13.9s. The A 18:29 subgroup had p50 9.8s, p95 12.6s, p99 12.7s. B 18:14 subgroup had p50 4.1s, p95/p99 10.2s.

A data-transfer anomaly also deserves follow-up: the 51 slow A HITs at 18:14 reported only 36.34 kB total, and the 55 at 18:29 only 39.06 kB, despite .ts paths and 2xx statuses. The 62 at 18:19 reported 26.45 MB, and B's 24 at 18:14 reported 9.59 MB. This is a dashboard accounting observation; it is **not** proof of truncated/corrupt segments, cancellations, or complete downloads. Response headers/body lengths and player traces would discriminate those possibilities.

## ISP and colo checks

For A at 18:29, slow HITs above 2 seconds were spread across several colos. Denominators are **all A segment HITs in that same minute**, not host-wide traffic.

| Colo | Slow HITs | All HITs | Approximate slow share |
|---|---:|---:|---:|
| DEL | 21 | 555 | 3.78% |
| SIN | 11 | 451 | 2.44% |
| BOM | 10 | 637 | 1.57% |
| FRA | 5 | 228 | 2.19% |
| MAA | 5 | 251 | 1.99% |
| JRG | 2 | 105 | 1.90% |
| PAT | 1 | 78 | 1.28% |

Other all-HIT colos included LUH 463, HYD 89, UDR 27 and COK 12; none appeared in this slow subgroup's list. Sampling means absence is not a verified unsampled zero.

| ASN, A 18:29 | Slow HITs | All HITs | Approximate slow share |
|---|---:|---:|---:|
| Jio 55836 | 24 | 1.64k | 1.46% |
| Airtel mobile 45609 | 19 | 668 | 2.84% |
| Vi 45271 | 6 | 103 | 5.83% |
| Vi 38266 | 1 | 60 | 1.67% |
| ELXIRE 153252 | 3 | 12 | 25% (very small sample) |
| Coastal Broadband 138797 | 2 | 10 | 20% (very small sample) |

Airtel telemedia had 231 total HITs and BSNL 9829 had 5; neither appeared in the slow subgroup. These are small sampled populations, with no same-ISP baseline-rate comparison; do not label an ISP faulty from this table. Jio's largest absolute count is not the highest rate.

At 18:14, A's 51 slow HITs spanned BOM 11, DEL 9, FRA 8, MAA 8, HYD 7, SIN 6 and JRG 2. Its ASNs were Jio 26, Airtel mobile 14, Airtel telemedia 5, RailTel 3 and Coastal Broadband 3. B's 24 slow HITs spanned DEL 9, SIN 4, MAA 3, FRA/BOM/HYD/PAT 2 each, and Jio 12, Airtel mobile 6, Airtel telemedia 4, BSNL 1 and Vi 38266 1. This rules out a claim that the observed events are confined to one ISP or one colo; it does not locate the shared cause.

## Baseline and known-stall comparison

A's 20 quiet-baseline segment minute bins had edge p95 319–415 ms and p99 424–697 ms. The main-window candidates are far above that minute-level tail baseline. A's baseline segment origin p99 ranged 578–1,914 ms, versus 14,460 ms at 18:19. A baseline playlist minute p99 ranged 509–1,201 ms, with no comparable multi-second playlist tail in the candidate minutes.

B had **no segment requests until the 18:02 minute** in the baseline. Its only active baseline bins were 18:02/03/04: 124/230/330 segment requests, edge p99 893/697/789 ms, origin p99 885/840/817 ms, and playlist p99 570/710/591 ms. This is a small, ramping baseline, not a workload-matched control.

Known upload-stall comparison, A segments:

| IST minute | Requests | 4xx | Origin 4xx | Edge p95 / p99 | Origin p95 / p99 |
|---|---:|---:|---:|---|---|
| 17:30 | 4,034 | 29 | 0 | 347 / 450 | 603 / 659 |
| 17:31 | 4,532 | 380 | 346 | 374 / 641 | 707 / 1,604 |
| 17:32 | 4,757 | 171 | 154 | 368 / 484 | 535 / 783 |
| 17:33 | 4,450 | 219 | 199 | 360 / 435 | 478 / 708 |
| 17:34 | 4,146 | 2 | 0 | 322 / 524 | 580 / 993 |

The whole 17:30–17:35 A-segment status list showed 699 404s and 102 499s (200=21.1k, 206=142). This differs from the later slow-2xx/HIT candidates. B had not begun its measured request traffic during that comparison window.

## Full incident minute table

Each row represents the minute starting at the labelled IST time. Windows inspected include two minutes before each requested interval and the minute starting at its end: 18:10–18:25 and 18:26–18:33. All latency columns are milliseconds; counts are dashboard estimates. “—” means no origin requests, so a percentile is not meaningful. **All segment 5xx bins and all origin connection-failure/5xx bins were zero** across these rows.

The table records status-class 4xx counts. Prior main-window status breakdowns showed A segment errors as 30 404s plus 130 499s, B as 69 499s, with no listed 403s. Origin 4xx in A occurred at 18:12 (27) and 18:13 (3); no later incident origin 4xx were observed. Playlist rows have separate request populations and are not included in segment error counts.

### Class A

| IST minute | Segments | HIT | MISS | Segment 4xx | Edge p95 | Edge p99 | Origin requests | Origin p95 | Origin p99 | Playlists | Playlist p95 | Playlist p99 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 18:10 | 3449 | 3327 | 122 | 0 | 405 | 527 | 122 | 676 | 1616 | 3038 | 470 | 730 |
| 18:11 | 3748 | 3607 | 141 | 0 | 396 | 611 | 141 | 832 | 1528 | 2897 | 488 | 995 |
| 18:12 | 3412 | 3262 | 124 | 29 | 411 | 547 | 148 | 581 | 845 | 3066 | 473 | 606 |
| 18:13 | 3484 | 3357 | 121 | 6 | 398 | 529 | 124 | 598 | 1228 | 3018 | 467 | 552 |
| 18:14 | 2769 | 2661 | 106 | 2 | 452 | 3830 | 106 | 769 | 1022 | 3080 | 486 | 595 |
| 18:15 | 2868 | 2720 | 130 | 18 | 424 | 870 | 130 | 1634 | 2010 | 3223 | 485 | 605 |
| 18:16 | 2770 | 2619 | 127 | 24 | 419 | 638 | 127 | 651 | 709 | 3115 | 470 | 596 |
| 18:17 | 3773 | 3623 | 138 | 12 | 408 | 684 | 138 | 1375 | 3276 | 3024 | 476 | 597 |
| 18:18 | 3656 | 3491 | 147 | 18 | 421 | 617 | 147 | 1325 | 1923 | 2986 | 470 | 596 |
| 18:19 | 3639 | 3480 | 147 | 12 | 467 | 10851 | 147 | 839 | 14460 | 2917 | 482 | 604 |
| 18:20 | 2997 | 2891 | 89 | 17 | 419 | 720 | 89 | 1102 | 2460 | 2892 | 504 | 608 |
| 18:21 | 3395 | 3207 | 174 | 14 | 416 | 603 | 174 | 707 | 1398 | 2997 | 475 | 595 |
| 18:22 | 3522 | 3373 | 149 | 0 | 407 | 532 | 149 | 568 | 804 | 2896 | 498 | 604 |
| 18:23 | 3626 | 3477 | 147 | 2 | 400 | 513 | 147 | 617 | 1328 | 2961 | 485 | 600 |
| 18:24 | 3656 | 3495 | 155 | 6 | 400 | 492 | 155 | 538 | 594 | 2863 | 493 | 594 |
| 18:25 | 3540 | 3374 | 164 | 2 | 412 | 549 | 164 | 636 | 698 | 2867 | 496 | 595 |
| 18:26 | 3731 | 3551 | 176 | 4 | 405 | 563 | 176 | 723 | 812 | 2820 | 489 | 613 |
| 18:27 | 3581 | 3434 | 144 | 3 | 403 | 507 | 144 | 596 | 677 | 2838 | 482 | 600 |
| 18:28 | 3408 | 3240 | 167 | 1 | 406 | 506 | 167 | 603 | 765 | 2800 | 486 | 611 |
| 18:29 | 3048 | 2896 | 146 | 6 | 428 | 9345 | 146 | 720 | 868 | 2857 | 497 | 595 |
| 18:30 | 1922 | 1884 | 29 | 9 | 403 | 435 | 29 | 800 | 800 | 3112 | 427 | 528 |
| 18:31 | 1207 | 1206 | 1 | 0 | 287 | 404 | 1 | 202 | 202 | 2456 | 428 | 541 |
| 18:32 | 1061 | 1059 | 0 | 2 | 290 | 402 | 0 | — | — | 1965 | 439 | 502 |
| 18:33 | 982 | 982 | 0 | 0 | 302 | 415 | 0 | — | — | 1773 | 425 | 476 |

### Class B

| IST minute | Segments | HIT | MISS | Segment 4xx | Edge p95 | Edge p99 | Origin requests | Origin p95 | Origin p99 | Playlists | Playlist p95 | Playlist p99 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 18:10 | 430 | 375 | 55 | 0 | 628 | 741 | 55 | 794 | 851 | 410 | 502 | 689 |
| 18:11 | 456 | 394 | 62 | 0 | 581 | 891 | 62 | 870 | 888 | 519 | 563 | 966 |
| 18:12 | 517 | 451 | 66 | 0 | 631 | 1044 | 66 | 850 | 850 | 512 | 539 | 623 |
| 18:13 | 532 | 472 | 52 | 8 | 689 | 4276 | 52 | 855 | 869 | 480 | 535 | 634 |
| 18:14 | 563 | 498 | 61 | 4 | 2241 | 5796 | 61 | 2229 | 10472 | 558 | 535 | 629 |
| 18:15 | 233 | 185 | 47 | 1 | 736 | 1040 | 47 | 1022 | 1942 | 557 | 550 | 705 |
| 18:16 | 296 | 214 | 75 | 7 | 692 | 1331 | 75 | 1325 | 1325 | 495 | 504 | 591 |
| 18:17 | 300 | 239 | 54 | 7 | 659 | 3446 | 54 | 1589 | 3967 | 471 | 557 | 613 |
| 18:18 | 257 | 184 | 70 | 3 | 740 | 1996 | 70 | 1113 | 7278 | 562 | 568 | 594 |
| 18:19 | 578 | 482 | 81 | 15 | 515 | 1324 | 81 | 682 | 2031 | 456 | 509 | 752 |
| 18:20 | 491 | 390 | 80 | 21 | 510 | 6276 | 80 | 1372 | 7617 | 447 | 516 | 691 |
| 18:21 | 519 | 379 | 138 | 2 | 663 | 1028 | 138 | 981 | 1212 | 437 | 513 | 611 |
| 18:22 | 480 | 392 | 87 | 1 | 566 | 666 | 87 | 657 | 877 | 461 | 523 | 602 |
| 18:23 | 474 | 383 | 91 | 0 | 542 | 724 | 91 | 708 | 847 | 437 | 529 | 557 |
| 18:24 | 463 | 377 | 86 | 0 | 561 | 753 | 86 | 652 | 780 | 512 | 509 | 630 |
| 18:25 | 464 | 388 | 72 | 4 | 537 | 773 | 72 | 812 | 935 | 488 | 501 | 592 |
| 18:26 | 511 | 428 | 83 | 0 | 529 | 706 | 83 | 770 | 843 | 443 | 502 | 589 |
| 18:27 | 476 | 376 | 100 | 0 | 664 | 719 | 100 | 711 | 736 | 442 | 506 | 660 |
| 18:28 | 466 | 362 | 104 | 0 | 677 | 754 | 104 | 746 | 1413 | 461 | 514 | 585 |
| 18:29 | 464 | 372 | 92 | 0 | 538 | 721 | 92 | 705 | 730 | 407 | 527 | 717 |
| 18:30 | 472 | 383 | 89 | 0 | 522 | 728 | 89 | 720 | 824 | 416 | 573 | 596 |
| 18:31 | 519 | 419 | 100 | 0 | 532 | 697 | 100 | 686 | 804 | 427 | 491 | 925 |
| 18:32 | 434 | 329 | 105 | 0 | 617 | 989 | 105 | 949 | 1403 | 437 | 529 | 622 |
| 18:33 | 461 | 389 | 72 | 0 | 510 | 667 | 72 | 657 | 2437 | 481 | 451 | 607 |

## Method and limits

- Used dashboard HTTP analytics with explicit host, full class-ID Path contains, and .ts/.m3u8 Path contains filters. Origin measurements came from the Origin tab with the same filters. Read chart accessibility series in chunks of at most ten minutes so the chart's first-ten-items truncation could not hide later bins. Timestamps in the series advance by 60,000 ms.
- The chart menu explicitly offered a 1-minute interval; Auto already yielded one-minute bins for these narrow ranges. No security or cache configuration was changed by selecting analytics filters.
- Top-statistic panels reported 50% sampling. Counts/percentiles are sampled estimates, not complete logs. Small subgroup p99s and rounded denominators can be unstable. Zero observed errors does not prove absence.
- A chart JSON download attempt did not return a local file and the browser control connection required a fresh tab. No export file was accepted as evidence. The continuation used ordinary supported read-only chart and filter controls.
- **TTFB is not full segment transfer duration, effective throughput, playlist freshness, or player buffer level.** Those measurements were unavailable from the inspected dashboard.
- Actual complaint timestamps are still missing. The most discriminating next correlation is whether complaint bursts begin during/just after 18:14, 18:19–18:20, or 18:29 IST, allowing for different viewer buffer depths and delays before commenting. An actual timestamp outside those periods would weaken these candidates and require checking its own preceding delivery window.
- We cannot identify affected students or conclude that a given fraction of requests equals the same fraction of viewers. One viewer can make many requests; the two classes need not have identical playback buffers.
- The prior aggregate report remains useful for storage mapping and security/error context, but its mild aggregate latency impression must be read alongside this minute-level evidence.

