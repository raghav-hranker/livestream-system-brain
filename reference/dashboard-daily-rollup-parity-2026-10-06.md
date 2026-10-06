# Dashboard daily rollup — read-only parity on prod data, 2026-10-06

Branch feat/dashboard-daily-rollup @ 38070cefb (src) / aac9de91c (dist). Prod DB read via secondaryPreferred; nothing written (the --commit backfill was blocked by the auto-mode classifier).

## Run 1: Σ per-day facets + live today window vs live range (probe ran live first, per-day minutes later)
DIFF 7d all orders at data.statusStats[2].revenue: rollup=3445567.3999999994 live=3445567.4
ok   7d all signups
DIFF 7d all orderTypes at data.types[0].revenue: rollup=167672.94999999998 live=167672.95
time 7d all: live-range 8187 ms | per-day total 14092 ms over 6 days | today-window 565 ms
DIFF 7d web orders at data.subscriptionRows[3].amount: rollup=2049.4500000000003 live=2049.45
ok   7d web signups
ok   7d web orderTypes
time 7d web: live-range 8506 ms | per-day total 8170 ms over 6 days | today-window 467 ms
DIFF 7d mobile orders at data.subscriptionRows[2].amount: rollup=223904.84999999998 live=223904.85
ok   7d mobile signups
DIFF 7d mobile orderTypes at data.types[0].revenue: rollup=165331.94999999998 live=165331.95
time 7d mobile: live-range 9884 ms | per-day total 11130 ms over 6 days | today-window 402 ms
DIFF 30d all orders at data.paymentReconciliation[1].revenue: rollup=2388172.8999999994 live=2388172.9
DIFF 30d all signups at data.total[0].count: rollup=27612 live=27611
DIFF 30d all orderTypes at data.types[0].revenue: rollup=393702.94999999995 live=393702.95
time 30d all: live-range 24238 ms | per-day total 25260 ms over 29 days | today-window 407 ms
DIFF 30d web orders at data.paymentReconciliation[1].revenue: rollup=123434.40000000001 live=123434.4
ok   30d web signups
ok   30d web orderTypes
time 30d web: live-range 34322 ms | per-day total 35501 ms over 29 days | today-window 473 ms
DIFF 30d mobile orders at data.paymentReconciliation[1].revenue: rollup=2261069.5999999996 live=2261069.6
DIFF 30d mobile signups at data.total[0].count: rollup=24073 live=24071
DIFF 30d mobile orderTypes at data.types[0].revenue: rollup=386782.94999999995 live=386782.95
time 30d mobile: live-range 37981 ms | per-day total 42393 ms over 29 days | today-window 358 ms
DIFF 90d all orders at data.paymentReconciliation[1].payments: rollup=15915 live=15914
DIFF 90d all signups at data.total[0].count: rollup=65959 live=65952
DIFF 90d all orderTypes at data.types[0].revenue: rollup=393702.94999999995 live=393702.95
time 90d all: live-range 46404 ms | per-day total 100850 ms over 89 days | today-window 403 ms
DONE differences=15

Integer diffs (signups +1/+2/+7, payments +1) are records that arrived between the two reads; decimal diffs are float summation order (fixed by rounding in 38070cefb).

## Run 2: completed days only, float noise ignored
ok   30d all orders (fp noise only)
ok   30d all signups
ok   30d all orderTypes (fp noise only)
ok   30d mobile orders (fp noise only)
ok   30d mobile signups
ok   30d mobile orderTypes (fp noise only)
ok   90d all orders (fp noise only)
ok   90d all signups
ok   90d all orderTypes (fp noise only)
DONE real-differences=0

## Sizing probe
earliest order 1969-12-31T18:30:00.000Z earliest user 2020-01-07T00:48:21.000Z
orders by IST year [{"_id":1970,"n":6},{"_id":2022,"n":23},{"_id":2023,"n":28259},{"_id":2024,"n":108736},{"_id":2025,"n":365702},{"_id":2026,"n":618102}]
users by IST year [{"_id":2020,"n":2},{"_id":2022,"n":6},{"_id":2023,"n":88448},{"_id":2024,"n":261708},{"_id":2025,"n":214160},{"_id":2026,"n":179742}]
earliest apx capture created_at 1670418797
excluded signup ids 0
--- day 2026-10-05
orders all 558 ms bytes 14759 total 1990 locationRows 164 plans 32 recon 2
users all 103 ms bytes 10065 total 1023 states 23 cities 276
orders web 500 ms bytes 3641 total 92 locationRows 21 plans 8 recon 1
users web 98 ms bytes 3002 total 92 states 14 cities 72
orders mobile 661 ms bytes 14238 total 1894 locationRows 155 plans 32 recon 2
users mobile 100 ms bytes 9697 total 931 states 23 cities 265
--- day 2026-08-22
orders all 1150 ms bytes 6044 total 2208 locationRows 34 plans 28 recon 1
users all 151 ms bytes 1135 total 999 states 17 cities 12
orders web 704 ms bytes 2943 total 92 locationRows 10 plans 10 recon 1
users web 129 ms bytes 837 total 166 states 15 cities 5
orders mobile 977 ms bytes 5978 total 2114 locationRows 33 plans 28 recon 1
users mobile 148 ms bytes 767 total 832 states 10 cities 8

## Run 3 (after full backfill, 2026-10-06 ~18:30 IST): dashboardDailyFactsParity.ts through the real stored-days read path

Backfill: 1,374 days × 3 variants = 4,122 docs (2023-01-01..2026-10-05); first run died at 2025-07-05 on a 30 s socket connect timeout, resumed with --from 2025-07-05.

[dashboard-facts-parity] DIFF transactions financial_year all at data.metrics.initiatedTransactions: rollup=25955 live=25954
[dashboard-facts-parity] 48 views, 1 differing
47 of 48 views ok. The one diff (financial_year all, metrics.initiatedTransactions 25955 vs 25954) is a today-window transition: an initiated order changed status between the rollup read and the live read. Stored days 2026-10-03..05 recomputed fresh = unchanged (stale-check), so no stored data differs.

## Timing, loaders rollup vs forced live, device all, 3 runs each (ms), default read preference

```
7d: signups rollup 677/242/241 ms live 326/248/288 ms | transactions rollup 413/845/760 ms live 4389/4177/4265 ms | transaction-summary rollup 211/244/242 ms live 2770/2755/2831 ms | order-types rollup 314/338/319 ms live 413/391/380 ms || all four sections: rollup 1615/1669/1562 ms live 7898/7571/7764 ms
30d: signups rollup 398/344/370 ms live 556/553/574 ms | transactions rollup 805/601/686 ms live 13235/12831/12642 ms | transaction-summary rollup 249/443/251 ms live 7073/7400/6916 ms | order-types rollup 339/372/370 ms live 1300/1230/1217 ms || all four sections: rollup 1791/1760/1677 ms live 22164/22014/21349 ms
90d: signups rollup 530/435/315 ms live 1435/1359/1414 ms | transactions rollup 827/857/885 ms live 25397/25021/26762 ms | transaction-summary rollup 211/239/250 ms live 16705/16475/16982 ms | order-types rollup 421/386/343 ms live 1605/1458/1381 ms || all four sections: rollup 1989/1917/1793 ms live 45142/44313/46539 ms
financial_year: signups rollup 595/844/685 ms live 2462/2488/2393 ms | transactions rollup 1419/1178/1010 ms live 43219/43909/42508 ms | transaction-summary rollup 426/412/467 ms live 31359/35218/31043 ms | order-types rollup 433/450/437 ms live 1840/2342/1691 ms || all four sections: rollup 2873/2884/2599 ms live 78880/83957/77635 ms
```
Limiter on the rollup side is the live today window (~0.4–0.6 s per pipeline), not the stored-day reads.
