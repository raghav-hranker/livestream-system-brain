# Cloudflare Enterprise call: prep and negotiation brief (2026-11-10)

Tenant: shared. Both tenants' media hosts sit in zone `hranker.org` (livev2, recordedvideosv2, vidyagram-live,
vidyagram-recorded). The figures are from quicktricks unless marked. Sources: memory notes
`cdn-provider-landscape`, `vi-cloudflare-reroute-1027`, `vi-asn-bunny-routing`, `live-r2-upload-stalls-404`,
`livev2-traffic-scan`, `selectionway-storage-audit`, and `reference/cdn-provider-landscape-2026-10-26.md`.

## 1. Where we stand (know these numbers cold)

| Fact | Value | Source / as of |
|---|---|---|
| Plan on `hranker.org` | **Pro, about $25/month** | landscape report |
| Other zone | `unlimitededucation.in` on **Business ($250/month)** | Vi note, 10-31 |
| Video traffic | livev2 + recordedvideosv2 = **7.7 TB in 24 h, about 232 TB/month** (one day, excludes Vi on Bunny) | analytics 11-04 |
| livev2 alone | 11.8 M requests, 4.4 TB/day, 87% cache HIT | analytics 10-27 |
| Audience | **96.6% India**; Jio 48%, Airtel 30%, Vi about 4% | 10-27 |
| Origin | R2 only (live + recorded), so we already meet the "video must sit on R2" self-serve rule | |
| R2 storage | SelectionWay 19 TB on main R2, **being deleted** (about $285/month gone). Quicktricks + Vidyagram bucket sizes: **pull before the call** | audit 11-09 |
| Second CDN | **Bunny is already live** for Vi users (recorded, replays and running classes since 11-03) | |

**Before the call, fill these gaps (30 min):**
1. Last 3 invoices: Pro, Business, R2 storage + operations, Logpush. That is our real current spend.
2. R2 storage total for the qt and VG buckets (`reference/scripts/storage_list_buckets.cjs`).
3. 30-day bytes and requests per media host from analytics, so we quote a 30-day figure, not one day.
4. Who signs. The Cloudflare account login is Deepak's; agree who on our side can say yes and to what number.

## 2. Our leverage

**We don't need Enterprise to keep running.** Video on R2 is allowed on every plan, and we pay no per-GB fee.
Each dollar they quote is on top of about $25. Don't let them frame it as "you're using too much for Pro". If they
say that, ask them to name the clause. The self-serve terms forbid CDN video only when it is *not* on R2/Stream/Images.

**Our walk-away options are real and priced** (landscape report, 10-26):

| Alternative | Monthly cost |
|---|---|
| Stay on Pro + Bunny as fallback for about 5% of bytes (what we run today) | about **$25 + $30–150** |
| Bunny Standard (Indian PoPs) for *all* traffic at about 230 TB | about **$7,000** |
| CloudFront flat-rate, Premium 125 TB level (x2 for about 230 TB) | about **$2,250–4,500** |
| Bunny Volume (no Indian PoP) for all traffic | about **$1,200** |

**We have already moved traffic off them.** Vi users have been on Bunny since 11-03 because Cloudflare's MAA path
broke. Say this plainly: we are multi-CDN today, and Enterprise is about how much traffic comes *back*.

**Their leverage:** Pro has no SLA, and Cloudflare's own Traffic Manager post says Free, then Pro, traffic is moved
out of a colo first under load. That matches about 25% of our Indian requests being served from SIN and FRA (10-24).
And IPv6-off, static IPs and per-parameter cache keys are Enterprise-only. These are the things worth paying for.

## 3. What we'd buy: problem → Enterprise feature

Lead with problems, not a feature list. Make them commit, in writing, to each one they claim to solve.

| Our problem (with evidence) | What to ask for | Must-have? |
|---|---|---|
| **Vi IPv6 via MAA:** 150–350 re-downloads per 1,000 vs 6–10 on IPv4, since 10-31. Cloudflare confirmed in writing (ticket 02407843, 11-03) that the fault is between MAA and Vi | (a) Turn off IPv6 compatibility (Enterprise only, zone-wide; ask whether a separate media zone can have it off). (b) **Their network team escalates peering with Vi** as a pre-signing condition. (c) Ask whether Enterprise traffic can be steered off MAA for an ASN | **Yes** |
| **Live R2 stalls:** encoder PUTs to R2 hang 20–124 s (10-20, 10-27); edge fills from R2 take 7–14 s on new segments (10-24). Ticket opened 10-28 | R2 SLA with credits; an R2 engineering contact; check Tiered Cache / Regional Tiered Cache for live | **Yes** |
| **No SLA, ticket-only support** | 100% uptime SLA with credits; P1 response ≤ 1 h by phone; named CSM/SE; an escalation path for India routing incidents | **Yes** |
| **ISP blocks on shared anycast IPs** (2025 India routing incident lasted about 6 days) | Static IPs or BYOIP for the media hostnames | Strong want |
| **India serving:** 25% of Indian requests served from SIN and FRA | Ask for their India colo share for Enterprise vs Pro traffic, and whether Enterprise is protected from Traffic Manager shifts | Ask, don't pay extra |
| **Catalogue scraping:** AWS/Hetzner downloaders rip 472 recordings with valid tokens, about 188 GB/day (10-27) | Bot Management + Advanced Rate Limiting. *Price separately.* ASN blocking works on Pro already, so this is a nice-to-have | Optional add-on |
| **No throughput data** (we can't see download speed per viewer) | Logpush with all fields (EdgeStartTimestamp/EndTimestamp, bytes) included; Instant Logs | Include in base |
| **Cache control gates:** Pro edge TTL floor 1 h, no per-parameter cache keys | Included in base Enterprise | Include in base |
| **R2 cost** | Committed R2 storage and Class A/B operation rates bundled in the contract | Want |
| `unlimitededucation.in` on Business | Fold into the Enterprise contract at no extra charge | Want |
| RTMP ingest exposed on the encoder ports (1935, 8937) | Spectrum quote, separately, only if cheap. Not a reason to sign | Later |

**Don't buy** (from our 10-13 CDN review): Argo, Cache Reserve, Stream, Images, Workers bundles. Each one raises the
bill and fixes nothing on our list. If they bundle one "for free in year 1", get the year-2 price in writing.

## 4. Numbers: anchor, target, walk-away

Public figures are rough. Vendor blogs and advisory sites put Enterprise entry at about $5,000–8,000/month, and say
buyers get about 20% off the first quote. None of that is official.

Our real comparison: today we pay about $275/month in plan fees (Pro + Business) plus R2. Pro + Bunny fallback already
works for under $500/month. **Enterprise is insurance (SLA, IPv6 control, static IPs, support), not bandwidth.** Price it
that way. My recommendation:

| | Monthly, all-in (plan + bandwidth + Business zone folded in), R2 at committed rates on top |
|---|---|
| **Opening anchor** | $1,000 |
| **Target** | $1,500–2,500 |
| **Walk-away** | about $3,000, and only if the IPv6/Vi item, the SLA and static IPs are all in. Above that, the CloudFront flat-rate + Bunny pair gives us a second network for less |

If their first number is $5k or more, don't counter on the spot. Say it's above what our alternatives cost and ask
them to come back with a version priced against our measured 230 TB.

**Volume:** commit to what we measure (about 230 TB/month), not to growth. Don't bring up the 2 PB figure; its source
was never confirmed and they would price the commit off it. Ask for growth tiers priced in advance instead: a set
rate per extra 100 TB, and no "true-up" surprise.

## 5. Contract terms to insist on

- **12 months**, not 3 years. No auto-renewal at a higher price; cap renewal uplift at 5%.
- **30–60 day free trial or POC first.** Exit test for the Vi item: Vi IPv6 via MAA at or under about 20
  re-downloads per 1,000 for 3 days (the same bar we set on 11-03).
- **Overage:** a written per-TB rate, a soft cap, and notice before any overage bill. No throttling.
- SLA credits that are automatic, not claim-on-request.
- Billing: monthly or quarterly, not annual upfront. Ask about INR invoicing from Cloudflare's India entity with GST
  input credit.
- Price lock on add-ons we might add later (Bot Management, Spectrum).
- Both tenants and every hostname in `hranker.org` covered by one contract; adding a new tenant hostname costs nothing.
- Data ownership and exit: no lock-in on R2 egress if we leave (R2 has no egress fee today; keep it in writing).

## 6. Questions to ask them

1. What does Enterprise change, concretely, for **Vi IPv6 users landing on MAA**? Can you escalate the Vi peering
   issue now, before we sign? (Ticket 02407843.)
2. Can IPv6 be turned off for one hostname or one zone only? If zone-wide only, can media move to its own zone?
3. Is Enterprise traffic protected from Traffic Manager moving it to SIN/FRA? What share of Indian Enterprise traffic
   stays in India?
4. What is the R2 SLA, and who looks at our PutObject stalls (ticket of 10-28)?
5. Static IPs vs BYOIP: what does each cost and how long to set up?
6. Which items are in the base plan, and which are add-ons (Logpush fields, Instant Logs, Bot Management, Spectrum)?
7. How is bandwidth priced: unmetered, committed, or per TB? What happens at 2x our current traffic?
8. Can we run a trial on our real traffic before signing?
9. Who is our named support contact, and what is the P1 response time in IST?

## 7. What they'll ask us, and what to say

| They ask | Say |
|---|---|
| "What's your monthly traffic?" | "About 230 TB a month, 97% India." Give the 30-day number from the homework, nothing about growth plans. |
| "What's your budget?" | "We'd like your proposal first. Our alternatives cost us under $500 a month today." |
| "Why not stay on Pro?" | "Pro works on price. It fails us on support, SLA and the Vi/MAA problem, which pushed some of our traffic to another CDN." |
| "Who else are you looking at?" | "Bunny is already live for part of our traffic; we priced CloudFront flat-rate too." True, and enough. |
| "When can you sign?" | "After a trial passes the Vi test, and once the proposal covers the items in our list." |

## 8. Opening (about 60 seconds)

> We run two education video platforms, about 230 TB a month, almost all India, on R2 behind a Pro zone. Price-wise
> Cloudflare works for us. What doesn't: Vi IPv6 users routed to Chennai have been buffering since end of October.
> Your team confirmed in writing it's between MAA and Vi, and we've had to move those users to another CDN. We also
> see R2 upload and fill stalls during live classes, and we have no SLA. We want to know whether Enterprise fixes
> those three things, and at what price compared with running a second CDN.

Close: ask for a written proposal with each item from section 3 marked as in base, add-on with a price, or not
possible, plus a trial plan. Don't agree to a number in the first call.
