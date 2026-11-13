# Google Cloud CDN / Media CDN — committed-use pricing enquiry (draft, 2026-11-09)

Status: **draft, not sent.** Send through https://cloud.google.com/contact (Sales) or to the GCP account rep.
Numbers come from `reference/cdn-provider-landscape-2026-10-26.md` and the 11-04 Cloudflare analytics read
(memory `cdn-provider-landscape`). The 2 PB tier is the user's planning figure; its source is not established.

---

**Subject:** Committed-use pricing for Cloud CDN / Media CDN — HLS video delivery in India (~230 TB/month, scaling to 1–2 PB)

Hello Google Cloud Sales team,

We are Hranker, an Indian ed-tech video platform that runs live classes and recorded lectures for several
learning apps. We already run our live encoders on Google Cloud (project `genial-analogy-477417-r7`,
asia-south1 / asia-south2). We are evaluating Google for video delivery and would like a quote for discounted
CDN pricing against a committed spend or committed volume.

**Current workload**

- Content: HLS video (live streams plus recorded VOD), 240p–1080p renditions, 4–6 s `.ts` segments plus `.m3u8` playlists.
- Egress: about **230 TB/month** today (7.7 TB measured in 24 hours on 2026-11-04), and growing.
- Requests: on the order of 1 billion HTTP requests/month (estimate; mostly segment and playlist fetches).
- Audience: about 95% India, mainly mobile users on Jio, Airtel, Vi and BSNL. The rest is other APAC.
- Peaks: concurrent live classes in the morning and evening, IST.
- Origin: S3-compatible object storage (Cloudflare R2) today. We are open to Cloud Storage as the origin if
  it changes the price.

**What we would like quoted**

1. Committed-use pricing for **Cloud CDN** and for **Media CDN** at these monthly volumes:
   250 TB, 500 TB, 1 PB and 2 PB. Please quote 1-year and 3-year terms.
2. Whether the commit can be a spend commit (USD or INR) rather than a fixed-volume commit, and how overage
   and unused commit are billed.
3. The effective per-GB rate for India-delivered egress at each tier, and whether cache-fill, cache-lookup
   and load-balancer charges are included or waived under a commit.
4. Any startup, migration or onboarding credits for moving our delivery to Google.
5. Billing in INR through a Google Cloud India entity, with GST invoicing.

**Technical questions that decide the choice**

1. **Indian edge coverage:** which Indian metros Media CDN serves from (our research found Mumbai, Delhi and
   Chennai for Cloud CDN), and whether Google has caches embedded in Jio, Airtel or Vi networks.
2. **Token enforcement:** we sign every playback URL with an HMAC path-prefix token that covers the master
   playlist, child playlists and segments. Media CDN dual-token authentication appears to cover this; please
   confirm it rejects unsigned requests at the edge, including on cache hits.
3. **Private external origin:** can Media CDN or Cloud CDN pull from a private S3-compatible origin (Cloudflare
   R2) with SigV4, and does origin shielding reduce fetches to one location?
4. **Live HLS caching:** short-TTL caching for live playlists (2–4 s) and request coalescing for segments.
5. **Purge:** prefix or tag purge, and how long it takes.
6. **SLA and support:** the delivery SLA under a commit, which support tier is included, and the response time
   during an India incident.
7. **Logs:** real-time or near-real-time access logs per request (status, cache result, client ASN).

We can share traffic graphs and a sample signed playback URL on a call. Please let us know a convenient time
for a discussion with your media/CDN specialist.

Thank you,

Raghav Sharma
Hranker
raghavsharma@hranker.com
