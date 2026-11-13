# Handoff: quicktricks attack response, 28 Oct 2026

Session: be9ec8b0 (system-brain). Tenant: quicktricks (customer 472) only. No student personal data in this file.
Read with: memory `livev2-traffic-scan`, `apx-first-password-claim`, `backend-authz-gaps`, `prod-data-changes`,
`quicktricks-prod-box`; briefing `reports/2026-10-28-quicktricks-attack-briefing.md` (written before the evening findings).

## Prod state at 18:40 IST

| Item | State |
|---|---|
| GitHub `abhi092515/quicktricks-backend` `quicktricks-admin` | tip `e2d225d93` (revert of the profile lock) |
| webserver2-2 checkout | `e2d225d93`, no tracked edits, pm2 27 restarted 18:07:52 |
| `.env.development` | `ORDER_HISTORY_AUTH=enforce` added 17:46 (backup `~/env.development.bak-*`) |
| Student list `GET /api/users`, `POST /search` | admin-only since 12:55 (`1a601af24` + `c9d1105e2`) |
| `POST /api/users/change-password` | own login or admin since 16:36 (`7c94ef898` + `f8712eee2`); kill switch `CHANGE_PASSWORD_AUTH=off` |
| Order reads | admin or owner since 17:12 (`858ee6f5f` + `0ee1286ec`); `/history` enforced 17:46 |
| Profile reads `GET /users/:id`, `/users/profile/:id` | OPEN again. Lock deployed 17:51, rolled back 18:07: the app calls `/users/profile/<id>` with no valid token ~37% of the time (450×401 in 11 min) |
| Cloudflare (hranker.org) | rule `7a1597dc…` blocks AS14618 on livev2 + recordedvideosv2; user added AS47583 (Hostinger) in a second/edited rule (confirm the action saved) |
| Bunny `hranker-private-assets` (PDFs) | Edge Rule "block aws ips": Remote IP 13.222.239.152, 54.196.194.223, 148.230.74.230 (one value each) |
| Scraper accounts | 4 locked 18:21 (random password, 9 sessions ended); backup `~/prod-backups/scraper-lock-2026-10-28T125126677Z.json`; ledger entry in `prod-data-changes` |
| dist backups on the box | `~/dist-backup-20261028T{125505,163610,171236,175132}.tar.gz` |

Verified after each deploy: anonymous probes → 401; real admin, website and app calls → 200 (watchers in Apache log).
After the 18:21 lock: zero script calls to the API through 18:36; no Amazon/Hostinger traffic on the video hosts.

## Local branches (worktrees under ~/Projects/worktrees), NOT deployed

| Branch | Commits | What | Next |
|---|---|---|---|
| `fix/login-no-password-claim` (qtb-login-claim) | `52877ddc5` + `ca2cc98d1` on `c9d1105e2` | Fix 2: no first-password claim via /login, same 401 as wrong password | Rebase on `e2d225d93`; merge with change-password (same handler); app 401 handling check; ~600 real students/day use the path |
| `fix/orders-write-require-admin` (qtb-orders-write) | `75d0063e2` + `0b65faabe` on `0ee1286ec` | 7 order write routes admin-only | ON HOLD by user; rebase before deploy |
| `revert/user-profile-lock` (qtb-user-profile) | `e2d225d93` (pushed, live) | the rollback | Next design: strip mpin/secrets from token-less profile responses |

## What is proven (for the pitch)
- Downloads → accounts: links carry class + issue second; `views` rows name the minting user. 1,511 Amazon + 977 Hostinger links all matched.
- First-password shortcut: in code (`05aba2cff`, 1 Sep); 88 accounts proven claimed (first-ever session = script); ~370 more consistent, unproven (25–26 Oct logs missing).
- Change-password route: open in code until 16:36; used 6× on 23 Oct by python-requests from 134.82.69.47 (Apache); the 5 looked-up ids are inferred as the targets; one (`6a3d7995…`) then used by the Hostinger downloader.
- Totals: 477 accounts with script logins (458 takeover script); 287 paid; 695,982 accounts still claimable via the shortcut.
- Timeline: first script login 26 Sep; Amazon downloads from 3 Oct (~7.1 TB); Hostinger 148.230.74.230 ~263 GB (23–24 Oct); takeover script from 25 Oct 22:06.
- Target list source: UNPROVEN. Victims look like active students (82% vs 14%), not the orders list (40% no order). pm2 log shows one bulk student-list read on 5 Oct 19:11 (22 pages), unattributable; no bulk pull during 24–28 Oct.
- Apache backend access logs for 24–26 Oct were deleted (other vhosts kept theirs). Ask the server team who/why.

## Open lead: account 6adaf93e3b633dadde31212c
Created 23 Oct 11:35 (app), paid ₹1,399 Razorpay 14:37, browser login 15:48 (same minute as a 134.82.69.47 login),
its links bulk-downloaded by the Hostinger server from 15:59. Only account created inside the attack. The user is
running the verification brief themselves (signup source + IP, no password reset before 15:48, exact-second login
match, normal use, Razorpay payer). Do not contact or ban it before evidence is saved; save the 23 Oct Apache file
(`.log.5.gz`) before it rotates (~10 days).

## Next actions, in order
1. Lock the remaining ~478 attacker-held accounts the same way (needs the user's yes; backup + ledger).
2. Fix 2 + OTP attempt cap/rate limits (stop new takeovers).
3. Per-account cap on PDF access and playback mints, sized from real students' peak per hour.
4. Profile routes: token-less callers get a record without mpin and other secrets.
5. Order write lock (held), passwordless default account on `GET /users/:id` (`PASSWORDLESS_TOKEN_USER_IDS`, default one id, `883098e23`), admin preAuthToken bypass, coins, `DELETE /users/:id`, forgot-password abuse, request logger writing passwords.
6. `app.set('trust proxy', 'loopback')` (one line; also fixes the search rate limiter sharing one bucket).
7. Log retention 30 days; old Cloudflare rules `2e25c470…`/`b4445f70…` refusing real students; legal check on exposed data.
8. Update the briefing with the evening findings; commit the scripts (nothing in system-brain is committed).

## Traps learned today
- A client "sends a token" is not "always has a valid token": the app called `/users/profile` without one ~37% of the time. Run report mode first or measure 401s before enforcing a read route.
- The app has two HTTP clients; `lib/core/network/dio_client.dart` has the Authorization header commented out.
- The local thedhronas checkout was stale (08-21); clone the live branch with gh before judging the website.
- Auto mode blocks deploys and some log forensics; hand the user the commands. Never run `pm2 update` on the shared box.
- PDFs are delivered by Bunny, not Cloudflare: a Cloudflare ASN block does not cover them.

## Scripts (reference/scripts, uncommitted)
`cf_traffic_probe.sh`, `cf_scraper_accounts.sh`, `qt_script_logins.sh` (FOLLOW=1 for live), `qt_password_claim_blast.sh`
(its pm2 part needs the timestamp prefix fixed), `qt_user_list_log_count.sh`, `qt_orders_route_traffic.sh`.
Cloudflare token: Keychain `cf-analytics-token` (Analytics:Read).

## Linked sessions
buffering-correlation (Cloudflare ticket reply drafted in reports/), otp-first-password (fix 2), orders-route-lock
(order read/write locks), student-list-log-count (pm2 log count script). All idle.
