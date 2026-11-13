Subject: OVH Mumbai → AWS Mumbai: repeated latency/loss episodes from BOTH our servers (148.113.49.18, 148.113.35.99) — please raise with OVH network

Hi team,

We have a recurring network problem on webserver2-2 (148.113.49.18, OVH). Several times a day, for 2 to 11 minutes, the round-trip
time from this box to AWS Mumbai (ap-south-1) jumps from 3 ms to 100–170 ms with packet loss and occasional spikes of 2–3 seconds.
Our Redis Cloud connections from this box time out during these windows and the quicktricks socket server restarts, which drops
every live-class viewer. It is the cause of the chat drops on 13, 14 and 15 Oct.

It is not the box and not the application:
- Link utilisation 0.76 % (25 Gbit port), CPU 90 % idle, zero interface errors or drops during the worst window (sar, 15:20–15:30 IST today).
- Every hop inside OVH (100.64.0.1 → 10.133.50.x → 10.75.24.x → 10.75.248.x → 103.5.12.x → 10.200.4.5) answers in 0.2–5 ms; 1.1.1.1 in 2.3 ms.
- The application was reading its sockets the whole time (kernel receive queue 0). TCP on the box shows RTT inflation, retransmits and
  9–12 s with no inbound bytes on every connection to the AWS endpoint, including idle ones and brand-new handshakes (0.6–3.2 s to connect).
- 148.113.35.99 (our other OVH box, same DC) had a 2.4 ms RTT to the same AWS region at the same minute and no errors.

Episodes so far (IST = UTC+5:30), the last one measured directly on the box with 2-second TCP samples:
| Date | IST | UTC | Note |
|---|---|---|---|
| 13 Oct | 15:47–15:50 | 10:17–10:20 | 2 restarts |
| 14 Oct | 13:27–13:50 | 07:57–08:20 | 7 restarts |
| 14 Oct | 14:54–14:55 | 09:24–09:25 | 1 restart |
| 15 Oct | 11:30–11:31 | 06:00–06:01 | recovered |
| 15 Oct | 12:20–12:22, 13:37–13:40, 14:38–14:41, 14:53–14:56 | 06:50, 08:07, 09:08, 09:23 | RTT 70–116 ms, no restart |
| 15 Oct | **15:26–15:37** | **09:56–10:07** | RTT 100–170 ms, spikes to 3 s, 4 restarts |
| 15 Oct | **16:08–16:16** | **10:38–10:46** | flat 108 ms + loss, three 1-min bursts, traceroutes captured, 1 restart |

The 16:08 episode was captured with traceroutes from the box while it was happening. Every OVH hop (100.64.0.1 → 10.133.50.x →
10.75.24.x → 10.75.248.x → 103.5.12.x → 10.200.4.5) stayed at 0.2–5 ms; the extra ~102 ms and 67 % loss appear only between OVH's edge
(10.200.4.5) and AWS. In the same seconds, TCP connects from this box to 148.113.35.99 (2 ms) and to 1.1.1.1 (5 ms) were normal, so it
is not the box's uplink and not whole-IP mitigation: it is specifically the egress/peering path from this host toward AWS Mumbai
(AS16509, 13.232.0.0/14 and 13.204.0.0/14). The latency is a fixed +105 ms, identical for both AWS destinations, which is what a route
detour (for example via Singapore) looks like rather than congestion, and it comes in bursts of about one minute. Both of our boxes are in
148.113.0.0/18, yet only this one is affected, so it is the exit path this host's pod uses, not our prefix.

Could you please:

1. Open a ticket with OVH network support for intermittent +105 ms latency and packet loss between 148.113.49.18 and AWS ap-south-1
   (13.234.240.182:15232 and 13.206.236.148:19504) at the times above, asking whether their egress/peering toward AS16509 Mumbai for
   this host flapped or detoured. We can supply 5-second connect-time logs and the traceroutes captured inside the episodes.
2. Still check the OVH manager for 148.113.49.18 → Anti-DDoS / Mitigation history for the same windows, to close that possibility formally.
3. Confirm nothing changed on the box's network side around 13 Oct (the Redis whitelist rules were added on 14 Oct); please confirm the
   appliance in front of this box is not policy-routing or inspecting flows to those AWS addresses.
4. If OVH offers a different gateway/pod or a vRack route for this host, tell us; moving the socket server to a host whose AWS leg is
   clean (148.113.35.99 was clean in every episode so far) is our fallback.

We are logging TCP connect times from the box to AWS and to two control hosts every 5 seconds, with a traceroute captured automatically
whenever the latency rises, so we can share exact hop-level data for the next episode on request.

Thanks,
Raghav


## Update 16 Oct (supersedes the per-host framing above)
Overnight on 15 Oct both servers recorded the same episodes at 20:16–20:37 and 21:15–21:17 IST: TCP connects from each box to every AWS
Mumbai destination (our two Redis endpoints and ec2.ap-south-1.amazonaws.com:443) rose to 100–1,000 ms with loss, while connects to a
Google Cloud destination stayed at 30 ms and connects between the two boxes stayed at 2–7 ms. 50-cycle TCP traceroutes during the bursts
show all OVH hops at 0.2–5 ms and 54–74 % loss with +100 ms appearing only beyond OVH's edge (10.200.4.5) toward AWS. So this is the
OVH Mumbai → AWS ap-south-1 (AS16509) leg for the site, not one host and not mitigation. Please open the OVH network ticket on that basis;
the probe logs and traceroutes are available on request. Separately, thank you for the 34.180.59.168:19593 whitelist; it is reachable.
