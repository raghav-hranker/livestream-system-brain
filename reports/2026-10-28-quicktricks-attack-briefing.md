# Quicktricks content theft and account takeover: briefing and action items

Prepared 2026-10-28. No student personal data in this document. Numbers are measured from our login records,
order records, Cloudflare analytics and the server logs unless marked otherwise.

## The story (how to pitch it)

**1. One line.** Since 3 October an outside group has been copying our paid video library in bulk, and since
25 October it has been taking over student accounts to do it. We found it, traced it, and closed the biggest door
today. Three more doors need decisions this week.

**2. What happened, in order.**

| When | What |
|---|---|
| 26 Sep | First automated login into a student account (a test). |
| 3 Oct | Servers on Amazon's cloud start downloading our recordings. Nothing came from Amazon before this. |
| 3 Oct to 28 Oct | About **7.1 TB** downloaded (≈1.5 TB live classes, ≈5.6 TB recordings), peaking at 700–900 GB a day. |
| 23 Oct | The same group pages through our open orders list (1,078 pages), which carries buyers' names and contact details. |
| 25–28 Oct | A login script takes over student accounts: **477 accounts** now controlled, **287 of them paying students**. |
| 28 Oct | We lock the open student list, block Amazon on the video sites, and the downloads stop (12:54). |

**3. How it worked (plain words).**
- Video links work for anyone who has one, so a student login is enough to collect them. The group logs into real
  student accounts with scripts and downloads every class the account can see.
- Students imported from AppX who never set a password could be taken over by typing any first password. No OTP.
  That covers **695,982 accounts** today, about 90% of our students.
- Two lists that should be admin-only answered anyone: the full student list and the full orders list.

**4. How we found it.** Cloudflare traffic analysis showed Amazon servers pulling hundreds of GB a day. Each video
link carries the second it was issued, and our server records who asked for each link, so every link traced back to
an account (339/339 and 1,172/1,172 matched). Those accounts' login records showed Python scripts, not our app. The
code then showed the open first-password path and the open lists. The server logs show the same group switching
through 102 IP addresses in one day.

**5. Why it happened.** Not one bad commit. A process gap.
- The login check that protected every route by default was switched off on 22 April. Since then a route is open
  unless whoever writes it remembers to protect it.
- Changes go straight to the live branch with no review.
- The first-password shortcut was added on 1 September to make AppX students' first login easy, with no OTP.

**6. What it cost us.**
- Paid content: about 7.1 TB of classes copied, likely shared or resold.
- Students: 477 accounts in someone else's hands. Owners can still log in by OTP, but the script's logins can push
  them out of the app.
- Data exposure: student and buyer contact details were readable without a login. Whether this triggers a legal
  notice duty (India's DPDP Act) is a question for legal, not something we have assessed.
- Bandwidth: the downloads were about 4% of our video requests and a larger share of bytes (estimate).

**7. What we did today.**
- Locked the student list to admins (live 12:55, verified: anonymous calls refused, admin screens still work).
- Blocked Amazon's network on the two video sites in Cloudflare (live; downloads stopped and have not resumed).
- Built a live monitor of script logins (`reference/scripts/qt_script_logins.sh`) and the traffic probes.
- Got read access to the server logs, which gave us the attacker's IP pattern.
- Built, but did not ship, the fix for the first-password hole, and started the orders-list lock.

**8. What we need from the room.** Decisions on the items marked *decision* below, chiefly the account reset, the
app check for fix 2, and the process changes.

## Action items

### Now (today / tomorrow)

| # | Item | Why | Owner | Status |
|---|---|---|---|---|
| 1 | Reset the 477 controlled accounts: random password, end all sessions, keep a backup | Stops the group using accounts it already has | Backend | *decision*; ready to run |
| 2 | Ship fix 2: no first password without OTP, same reply as a wrong password | Stops new takeovers; closes the "which accounts are open" leak | Backend + app team | Built locally; **blocked on app check** (≈600 real students/day use this path) |
| 3 | Lock the orders list and related order routes | Buyers' contact details are open | Backend | Being built in its own session |
| 4 | Lock `GET /api/users/profile/:id` and `GET /api/users/:id` | Return a student's full record, including mpin | Backend | Not started |
| 5 | Treat mpins as exposed: force an mpin reset or disable mpin login | They were readable from the open list | Backend + app | *decision* |
| 6 | Keep watching for the downloader moving to another cloud | The Amazon block buys time, not a fix | Backend | Probes ready |

### This week

| # | Item | Why |
|---|---|---|
| 7 | Record real client IPs in the backend (`trust proxy`) | Today every login shows the proxy's address |
| 8 | Rate-limit login and OTP; cap OTP attempts | Scripts can try freely today |
| 9 | Same reply for "no such user" and "wrong password" on login | Stops number checking |
| 10 | Shorter-lived video links tied to the user or device | A collected link works for 6 hours for anyone |
| 11 | Review the two older Cloudflare rules that block real students on Jio, Airtel and BSNL | About 20k student requests a day refused |
| 12 | Find why some days of server logs are missing; keep 30 days | 10-24 to 10-26, when the takeovers began, are gone |

### Process (this month)

| # | Item | Why |
|---|---|---|
| 13 | Turn the default login check back on, with an explicit list of public routes | Routes should be closed unless opened on purpose |
| 14 | Require review before anything reaches the live branch | All three holes went live with no second pair of eyes |
| 15 | Stop writing request bodies (passwords, OTPs) to the server log | The log holds secrets today |
| 16 | Alerts: script logins, cloud-provider download spikes, bulk paging of lists | We found this by hand; it ran three weeks first |
| 17 | Legal check on data exposure and whether students must be told | *decision* for leadership |

## Open questions
- Where the target list came from. Victims look like a list of **active** students (82% active vs 14% of all
  imported students), not the orders list (40% of victims have no order). The open student list fits best but any pull
  predates the logs we still have. A one-off scan of the older backend log could settle it.
- Whether the downloader resumes from another network after the Amazon block.
