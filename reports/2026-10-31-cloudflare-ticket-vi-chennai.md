# Cloudflare ticket: Vodafone Idea → MAA video delivery failures (2026-10-31)

Tenant: quicktricks. Zone `hranker.org` (Pro, id 37006234a9c877df3cc0faca5ef6f1da), account Deepaksharma7933@gmail.com.
The account also has `unlimitededucation.in` on Business (id 2f4b2fa8c5f31755d00f04d98d720744).

Data comes from GraphQL Analytics, pulled 2026-10-31 by `reference/scripts/cf_isp_colo_trend.sh`, `cf_user_sessions.sh`
and ad-hoc ASN × colo queries (memory `vi-cloudflare-reroute-1027`).

## Ticket text (paste as is)

**Subject:** Vodafone Idea (AS38266 / AS45271) users served from MAA: video downloads interrupted since 06:00 IST 31 Oct

**Zone:** hranker.org. Hosts: recordedvideosv2.hranker.org (recorded HLS) and livev2.hranker.org (live HLS).
Both are R2 custom domains.

**Problem**

Since about 00:30 UTC on 31 Oct 2026 (06:00 IST), our students on Vodafone Idea mobile data who reach the Chennai (MAA)
data center can't stream video. Downloads of HLS segments (~300–800 KB each) are interrupted, and the players re-request
the rest of the file (206) or give up (499). Students on other ISPs reaching the same MAA data center at the same time are
not affected. Vodafone Idea users reaching DEL or BOM at the same time are much less affected.

**Measurements on 31 Oct, segment (.ts) requests, rates per 1,000 requests**

| Clients, same hours (00:30–09:30 UTC) | Partial re-requests (206) | Client closed (499) |
|---|---|---|
| Vodafone Idea via MAA | 115–342 | 2–22 |
| Vodafone Idea via DEL / BOM | about 1–60 | under 1 |
| Airtel, Jio, BSNL via MAA | 0–30 | under 1.5 |
| Vodafone Idea via MAA, 23:30–00:30 UTC (before the problem) | 10 | 0.2 |

Edge TTFB p99 stays under 1 s and cache HIT is ~92%. Origin (R2) is healthy, and there are no 5xx. The data starts
reaching the client quickly, and the rest of the body then fails to arrive. This points to the path between MAA and
Vodafone Idea, not the origin or our configuration.

**Earlier change (possibly related):** until 26 Oct, 56–80% of Vodafone Idea requests on this zone were served from SIN,
with a client-closed rate of 0.03–0.08%. From 27 Oct they moved to BOM (~50%) and PNQ (~33%), and the rate rose to
0.2–0.55%. On 31 Oct, MAA takes about 28–34% of Vodafone Idea traffic.

**Sample Ray IDs (MAA, AS38266, recordedvideosv2.hranker.org, 31 Oct UTC)**
- 499: a530b08a1d9250fb (06:44:09), a530b08b997650fb (06:44:10), a530c276cc747f7a (06:56:24), a530c2761b3b7f7a (06:56:24)
- 206: a5309bdebee2cebc (06:30:03), a5309bdebee7cebc (06:30:03), a5309be50a938b04 (06:30:04)

**Our questions**
1. Can you check the MAA ↔ Vodafone Idea (AS38266 / AS45271) path for congestion or packet loss since ~00:30 UTC on
   31 Oct?
2. Can Vodafone Idea traffic for this zone be served from DEL or BOM, which work better for these users, until it's
   fixed?
3. What changed for Vodafone Idea routing on 27 Oct (off SIN, onto BOM/PNQ)?
4. Does a Business or Enterprise plan change which data center Vodafone Idea users reach? Our Business zone on the same
   account (unlimitededucation.in) also sees Vodafone Idea users at MAA (65% today).

It affects thousands of students in live and recorded classes daily, so we'd appreciate a quick look.

## Prompt for a browser agent (run in Deepak's Chrome profile, signed in to dash.cloudflare.com)

```
You are filing a Cloudflare support ticket for the account "Deepaksharma7933@gmail.com's Account".

1. Open https://dash.cloudflare.com/ and confirm you are in that account. Do not change any settings, plans or DNS.
2. Open Support → "Get help" / "Contact Cloudflare Support". If the account offers chat (it has a Business zone,
   unlimitededucation.in), prefer opening a technical ticket and note chat is available — do not switch plans.
3. Category: Technical / Performance (or "Network / Connectivity"). Zone: hranker.org.
4. Look in Support → "Tickets" for an open ticket from 2026-10-28 about R2 bucket livestream-hranker-v2 / slow livev2
   requests. If it exists, note its number and mention it at the end of the description as "Related: ticket #<n>".
5. Subject and description: paste the "Ticket text" section from
   ~/Projects/system-brain/reports/2026-10-31-cloudflare-ticket-vi-chennai.md exactly (keep the table; if the form
   does not render tables, keep it as plain lines).
6. Priority/impact: "Performance degradation affecting production users".
7. Before pressing Submit, show me a screenshot of the filled form and wait for my "OK".
8. After submitting, tell me the ticket number and the URL, and paste them into the "Filed" section of that report file.
```

## Filed

- Ticket number: **02407843**
- Ticket URL: https://www.support.cloudflare.com/s/case/500j2000000dWhcAAE
- Filed at: 2026-10-31 16:25 IST (10:55 UTC; submission confirmed in dashboard)
- Account: Deepaksharma7933@gmail.com's Account.
- Selected zones: `hranker.org` (Pro) and `unlimitededucation.in` (Business).
- Priority requested: **P2 — Service is partially impaired or intermittent**.
- Requested network engineering escalation and the fastest support available under the existing Business subscription. The description explicitly identifies `hranker.org` as the measured failure zone and asks Cloudflare to confirm whether Business support applies to this same-account issue; faster handling is not yet confirmed.
- Related open case: **02395323**, R2 latency spikes stalling live HLS delivery in APAC. Referenced as a distinct R2 upload/origin-fetch issue.
- Live chat was unavailable at filing; dashboard said it reopens 2026-11-02 06:30 IST.

## Monitoring

- 2026-11-04 14:57 IST: **New support clarification; Pending Customer, High**, last modified 14:16 IST. In response to a customer question about what the new reports would enable, Zaeem Quadir says Cloudflare will escalate request traces to Network Engineering **if** the captures locate the delay/drop on Cloudflare's side after reaching the edge. If captures locate the fault within the ISP before reaching Cloudflare, the customer would need to take that evidence to the ISP. This is a conditional future escalation, not confirmation that engineering is already engaged. No fix or Business entitlement confirmation. Next step remains affected-viewer network captures; no external changes made by monitoring.
  - Support reply: https://www.support.cloudflare.com/s/feed/0D5j20000011kjRCAQ
  - Customer question (separate workflow): https://www.support.cloudflare.com/s/feed/0D5j20000011iuaCAA

- 2026-11-04 13:55 IST: **Cloudflare replied; Pending Customer, High**, last modified 13:23 IST. Zaeem Quadir says client-side network captures remain necessary to isolate the route and cannot be replaced by backend telemetry. Support reports no regional colo downtime and says the two linked recent incidents do not match these symptoms. It suspects ISP routing and offers to monitor for the next **three days**, or resume investigation when an affected viewer can capture logs. No resolution, route change, Business entitlement or network-engineering escalation confirmation.
  - Reply: https://www.support.cloudflare.com/s/feed/0D5j20000011cauCAA
  - Next step: arrange an affected Vi viewer capture when feasible (IPv6 TCP MTR, stall PCAP, IPv4/IPv6 throughput comparison), or decide how to respond to support's proposed three-day monitoring. This monitor made no reply or configuration changes.

- 2026-11-04 12:55 IST: Case changed to **Open**, priority **High**, last modified 12:04 IST. A new customer follow-up asks whether repeating the tests is essential because finding affected viewers and arranging diagnostics is difficult: https://www.support.cloudflare.com/s/feed/0D5j20000011VSdCAM. This was posted outside the read-only monitor. No new Cloudflare reply or escalation confirmation is visible. Next step: await support's answer on whether it can proceed with existing evidence or reduce the requested captures.

- 2026-11-03 23:11 IST: **Monitoring access restored.** Case and feed loaded successfully in Deepak's signed-in Chrome profile. Status remains Pending Customer, priority High, last modified 10:52 IST; latest support reply is still https://www.support.cloudflare.com/s/feed/0D5j2000000xnMXCAY. No new reply, escalation confirmation or diagnostics request. Read-only monitoring continues.

- 2026-11-03, monitoring run triggered at 15:05 UTC: **Monitoring temporarily blocked.** Deepak's Chrome profile remains listed, but case navigation repeatedly timed out and attaching to the created tab failed. Current replies/status could not be verified. Last verified state: Pending Customer, High, awaiting the diagnostics requested in https://www.support.cloudflare.com/s/feed/0D5j2000000xnMXCAY. No external changes made. Retry on the next scheduled run; suppress duplicate alerts for this same access failure.

- 2026-11-03 10:52 IST: **Cloudflare replied by email.** They confirm the bodies arrive slowly over IPv6 via MAA even on cache HITs, and that their internal traces put the delay downstream, between the MAA edge and Vi. They say they can't pin users to a data center (anycast, ISP peering). They ask for an IPv6 TCP MTR on port 443, a PCAP during a stall, and repeated curl downloads of one segment over IPv6 and IPv4. They did not say what changed on 31 Oct. Our check at 12:49 IST, last 2 h on livev2: Vi IPv6 via MAA 312 re-downloads per 1,000 (139 addresses), Vi IPv4 via DEL/BOM 6–10.

- 2026-11-03 11:14 IST: **New Cloudflare reply; Pending Customer, priority High** (last modified 10:52 IST). Zaeem Quadir says the HARs and connection traces confirm slow IPv6 response bodies through MAA even on cache HITs, and reports fast internal cache/backend processing; support now confirms the delay is downstream between MAA and Vi. The exact degraded link remains unidentified. Support says it cannot manually pin users to another data center because Anycast routing depends on ISP BGP peering. No Business or network-team escalation confirmation.
  - Reply: https://www.support.cloudflare.com/s/feed/0D5j2000000xnMXCAY
  - Requests during an active stall on the affected Vi hotspot: IPv6 **TCP-capable** MTR on port 443 (standard WinMTR is ICMP), 100 probes, capture time/timezone, destination IPv6, and fresh `/cdn-cgi/trace`; a media TCP/443 packet capture (`.pcap`/`.pcapng`) with UTC window and client source IP/port; repeated downloads of the same segment using `curl -6` and `curl -4`, recording HTTP status, speed and total time.
  - Notes that IPv6 traceroute stopping at hop one can reflect ICMP filtering/rate limiting and does not itself establish forwarding failure.
  - Next step: arrange another affected-viewer capture session for these three diagnostics. The supplied command examples use Unix syntax despite the Windows request and need adaptation before use. No reply, upload or configuration change made by this monitor.

- 2026-11-02 19:55 IST: Portal now shows **Open**, priority **High**, last modified 19:53 IST. A customer follow-up with the IPv6 MAA / IPv4 DEL comparison and diagnostic attachments is visible at https://www.support.cloudflare.com/s/feed/0D5j2000000vDgYCAU (posted through a separate workflow; this monitor made no external changes). It requests network-team investigation and moving Vi IPv6 traffic off MAA. No new Cloudflare response or Business/network escalation confirmation is visible. Next step: await Cloudflare review of the submitted evidence; hourly read-only monitoring continues.

- 2026-11-02 14:42 IST: **Cloudflare replied; status is Pending Customer, priority High.** Zaeem Quadir acknowledged that the same-viewer MAA-versus-DEL comparison is valuable. Support reports no MAA platform incident in the supplied windows and suggests ISP/peering or origin delay as possibilities, without confirming the root cause. No Business support or network engineering escalation confirmation was provided.
  - Response: https://www.support.cloudflare.com/s/feed/0D5j2000000uhqJCAQ
  - Requested during an active stall on an affected Vi connection: full `https://<media-host>/cdn-cgi/trace` output (especially colo, IP, timestamp); browser HAR with Preserve log enabled; MTR to the media hostname (Mac/Linux TCP port 443, 100 probes; Windows WinMTR 100 cycles).
  - Requested equivalent HAR/MTR from a working Jio/Airtel connection for comparison.
  - Also requested enabling zone tracing under Observability → Traces → Settings, a media `.ts` rule at 100% sampling, and a delayed segment Trace ID. This request has **not** been executed; availability/suitability needs verification before any configuration change.
  - Next step: arrange an affected Vi viewer capture during a stall, ideally with a working-network comparison. No reply or dashboard configuration change made by monitoring.

- 2026-10-31 17:28 IST: Case portal shows **New**, priority **High** (the submitted P2 request). Created 16:24 IST, last modified 16:30 IST. Feed contains only the automated case-creation event; no support reply, diagnostics request, or Business/network escalation confirmation. No user action needed; hourly monitoring continues.

## Live class evidence (2026-10-31, class 6ae54be9…, 17:13 IST start)

These findings were **added to case #02407843 on 2026-10-31 at approximately 18:11 IST**, with student names omitted. The portal confirmed “Your update was shared,” and the feed shows one evidence follow-up plus the original case-creation event.
- Follow-up: https://www.support.cloudflare.com/s/feed/0D5j2000000rUoYCAU
- Submitted text is preserved in [`2026-10-31-cloudflare-case-02407843-followup.txt`](2026-10-31-cloudflare-case-02407843-followup.txt).
- Earlier posting attempts failed during a portal connection timeout; retry succeeded after confirming no duplicate was present.
- At posting, case status remained **New**, priority **High**, with no Cloudflare reply or escalation confirmation.

- **Chat:** 563 messages from 92 users. 16 of them mentioned buffering, most in 17:14–17:21 IST, and a few of those said it was fine.
- **Our side was clean:** the encoder was within 2–6 s of R2 on all rungs with no missing segments, there were no 404 bursts, and edge TTFB p99 was < 0.75 s.
- **Five complainers could be traced to their own requests**, because they started playback after the opening rush. All five were Vodafone Idea via MAA, and their players got one 4 s segment every 10–25 s (needs one per 4 s):
  - 17:18:41 (Shravan): segment 82, then 88 at +25 s, 89 at +49 s, 90 at +73 s, then stopped.
  - 17:19:31 (Ram Meena): 97, then 98 at +11 s, 100 at +43 s, 121 at +99 s. Their next playback at 17:22:27 was **Vodafone Idea via DEL**: 602 requests over 33 min, a segment every 2–5 s, all 200.
  - 17:14:35 (Dhruv, "Vi SIM"): segment 20, then 21 at +34 s.
  - 17:35:48 (Bijendra): 339, 341 at +14 s, 342 at +18 s, then stopped.
  - 17:18:22 (Samir): got only a playlist and no segments. They then re-opened the class 66 times, every ~5 s from 17:45 to 17:51.
- **Same minutes, other networks:** Airtel, Jio and Vodafone Idea via DEL or BOM played without stalls.
- Ram Meena is the cleanest single proof for Cloudflare: the same student and the same class, broken via MAA and fine via DEL three minutes later.
- **Joined in the first seconds (17:12:49–17:13:16):** Sheetal, Anuradha ("Airtel"), Sagar ("wifi too") and Priyanshu. Dozens of viewers share those token seconds, so their requests can't be told apart.

## Cloudflare's reply and our data (checked 2026-11-02 15:35 IST)

**Reply (seen in a screenshot cut off at the Traces steps):** no platform incident at MAA. They say the pattern points to ISP peering or origin delay, and ask for four things during a stall: `/cdn-cgi/trace`, a HAR, a TCP MTR on port 443, and Cloudflare Traces at 100% on `.ts`.

**Still happening.** Segment requests on both video hosts, partial re-requests (206) per 1,000; the last column is the cache HIT share of Vi via MAA:

| Day | Vi via MAA | Vi via DEL/BOM | Airtel via MAA | Vi via MAA HIT |
|---|---|---|---|---|
| 10-30 | 8.8 | 9.8 | 8.2 | 84% |
| 10-31 | 195 | 13.4 | 13.7 | 91% |
| 11-01 | 185 | 11.2 | 5.2 | 97% |
| 11-02 (to 15:35 IST) | 153 | 12.9 | 7.9 | 95% |

MAA's share of Vi traffic across MAA + DEL + BOM went from 6% on 10-30 to 31%, 42% and 32%. Most Vi via MAA requests are cache HITs and never reach R2, and Airtel at the same data center is normal. That rules out the origin; the fault is between MAA and Vi.

**Capture notes:**
- `/cdn-cgi/trace` returned 200 on both hosts from the Mac (colo BOM there).
- The HAR and MTR need a laptop on a Vi SIM hotspot, with `colo=MAA` confirmed first. Students on the app can't run them.
- A HAR holds signed video URLs and possibly login tokens: sanitise it before upload.
- Traces is a settings change on a zone carrying millions of `.ts` requests a day. Not enabled; limits and cost not checked.

## Student test, browser log (2026-11-02 17:00–17:06 IST)

Windows laptop in Chrome on a Vi phone hotspot, AS45271, `colo=MAA` in `/cdn-cgi/trace`. Recorded class 6a4558cfebb42f585d9a8c85, 10.4 s segments. Log with no tokens or private data: `reports/2026-11-02-vi-maa-student-clean.har`. The raw file stays out of the repo.

- All 17 segments returned 200 from MAA, 14 of them cache HITs. First byte took 0.1–1.2 s on all of them.
- The body is what crawled: `480p_0` was 460 KB in 98 s (5 KB/s). The player dropped to 240p.
- `240p_0`–`6` ran at 41–156 KB/s, then the speed fell to 24, 12, 9, 8, 14, 8, 5 and 4 KB/s. `240p_15` was 279 KB in 65 s for 10.4 s of video; 240p needs about 27 KB/s.
- Sample Ray IDs, matching Cloudflare analytics: a542cf033cb86cce (480p_0), a542d5caeaf72447 (240p_14), a542d7357ff22447 (240p_15).
- MTR not captured yet. A Bunny comparison on the same video has not run, so the student's own link is not fully excluded.

## Same student on Bunny (2026-11-02 17:19–17:24 IST)

Same laptop, same Vi hotspot, video call still on. Day 13 (6a4558cfebb42f585d9a8c85) was temporarily switched to Bunny, edge SG1 (Singapore). Log with no tokens or private data: `reports/2026-11-02-vi-maa-student-bunny-clean.har`.

- Bunny, 480p: about 2.3 s per 10.4 s piece, 400–700 KB/s typical, none slower than playback, no 4xx/5xx. Most were first fetches (MISS) and still kept up.
- Cloudflare via MAA, same connection: 4–5 KB/s at its worst on 240p (17:00–17:06), and a piece at 13 KB/s just before the switch. The user also reports another Cloudflare class getting stuck after the Bunny play.
- The status-0 rows in the Bunny log are requests the player cancelled when the student jumped ahead, not failures.
- Video was served over IPv6 while our API is IPv4-only, and Bunny still accepted the signed link. App not tested.
- Limits: one student, in a browser. Path test pending. Bunny reads the old bucket, so only classes from before 2026-09-10 work.

## The fault is Vi's IPv6 route into MAA (2026-11-02 ~17:30–17:40 IST)

Segment requests, partial re-requests (206) per 1,000. Vi rows cover the last 3 h, Airtel rows the last 1 h:

| Clients | Via | 206 per 1,000 |
|---|---|---|
| Vi, IPv6 (17,411 segments, 401 IPs) | MAA | 320 |
| Vi, IPv6 | DEL / BOM | 11 / 2 |
| Vi, IPv4 | DEL / BOM | 7 / 3 |
| Vi, IPv4 | MAA | none in the window |
| Airtel, IPv6 | MAA | 14 |
| Airtel, IPv4 | MAA | 5 |

Ping from the same student laptop on the same Vi hotspot, with the video call on:

| Target | Sent | Loss | Average | Worst |
|---|---|---|---|---|
| livev2.hranker.org over IPv6 (2606:4700:20::681a:136) | 37 | 70% | 427 ms | 3,571 ms |
| google.com over IPv6 | 10 | 0% | 42 ms | 56 ms |
| livev2.hranker.org over IPv4 (104.26.1.54, WinMTR) | 108 | 0% | 47 ms | 98 ms |

The Google sample is small. Still pending: `tracert -6`, and the IPv4-only playback test on Cloudflare.

## Reply to Cloudflare on ticket 02407843 (draft, not sent)

Thanks. We have narrowed this down: the fault is the IPv6 path between Vodafone Idea (AS38266 / AS45271) and MAA.

**Network data, last 3 hours, video segment requests, partial re-requests (206) per 1,000:**
- Vodafone Idea, IPv6, via MAA: 320 (17,411 requests from 401 addresses)
- Vodafone Idea, IPv6, via DEL / BOM: 11 / 2
- Vodafone Idea, IPv4, via DEL / BOM: 7 / 3
- Airtel, IPv6, via MAA: about 2–14
- Airtel, IPv4, via MAA: about 5

So MAA is fine for other networks, and Vodafone Idea is fine away from MAA.

**When it moved (same hours, 09:00–12:00 UTC):** on 30 Oct, Vodafone Idea's IPv6 traffic was served from PNQ (61% of its segments) and BOM (19%), with partial re-requests at 5–6 per 1,000 and none from MAA. On 31 Oct it was served from MAA (22% of its segments) at 280 per 1,000. Please tell us what changed in that route.

**One viewer, 2 Nov, Windows laptop on a Vodafone Idea hotspot (trace attached):**
- IPv6, colo=MAA: 200s and mostly cache HITs, first byte under about 1 s, then the body falls to 4–5 KB/s. Example Ray IDs: a542d5caeaf72447, a542d7357ff22447.
- Ping to livev2.hranker.org over IPv6: 70% loss of 37, average 427 ms, worst 3,571 ms.
- Ping to google.com over IPv6 on the same connection: 0% loss of 10, average 42 ms.
- WinMTR to livev2.hranker.org over IPv4 (104.26.1.54): 0% loss of 108, average 47 ms.
- With IPv6 turned off on that laptop, the same connection moved to colo=DEL and the video played normally: 150 requests, 4 partial re-requests.
- `tracert -6` shows nothing past the first hop, so we can't see where the loss is. Only you or Vodafone Idea can.

These results rule out the origin, our configuration and the viewer's device. On Traces: most of these requests are cache HITs that never reach our origin, so we haven't enabled it.

**Requests:**
1. Please have your network team check the IPv6 path between MAA and AS38266 / AS45271. It went bad around 00:30 UTC on 31 Oct.
2. Please move Vodafone Idea's IPv6 traffic for our zone off MAA until it's fixed.

Sanitised HAR files are attached.

## Fix options, checked 2026-11-02

- **Cloudflare or Vi fix the route:** costs nothing and fixes everything; timing is out of our hands.
- **Turn IPv6 off:** Cloudflare allows this only on Enterprise, and it applies to the whole zone. Not an option on Pro or Business.
- **Bunny for Vi students:** the only way round it in our hands that needs no app release. Needs Bunny connected to R2 (untested) and an ASN lookup on the server, and it hasn't been tested in the app. Our API is IPv4-only, so it sees Vi students' IPv4 and can recognise them.
- **App prefers IPv4 for video:** needs an app release, and does nothing for the website. Untested.
- **Android workaround:** set the Vi APN protocol to IPv4. Untested on a phone; menus vary.

Last hour's share of Vi segments: IPv6 via MAA 22%, 188 addresses. IPv4 elsewhere 68%. Vi is about 3% of the segments from Vi, Jio and Airtel combined.

Not done on 11-02: the replay with IPv6 back on, and the IPv4 browser log, because the student left first.

## What the Business plan does and doesn't do here

- **Routing:** no change. Vi users of the Business zone also land on MAA (65% today). Cloudflare says the ISP picks the
  data center, not the plan (`reference/cdn-provider-landscape-2026-10-26.md`). Moving video onto
  unlimitededucation.in wouldn't avoid MAA.
- **Support:** better than Pro (faster response; chat may be offered on the account). That's the useful part of the
  $200 plan for this problem.
- **Levers in our hands:**
  - Make the app's default quality Auto or 360p instead of 480p.
  - Build a second-CDN fallback (Bunny over R2) whose Chennai path may differ for Vi; per-student test before any build.
  - Have a Vi user in the south compare speed.cloudflare.com with another network, for direct speed proof.
