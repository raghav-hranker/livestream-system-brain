# Tasks: Automatic plan extension

Vertical-slice breakdown of [the PRD](../../prd-automatic-plan-extension.md). Decisions live in the
[design record](../../automatic-plan-extension.md) (D1–D17) and fork ADR
`0023-automatic-lapsed-holder-extension.md` (match fork ADRs by title) — tasks cite them, not restate them.

**Working-copy rules.**
- LMS: the **fork** `quicktricks-backend`, worktree `../quicktricks-backend-auto-extension`, branch
  `feat/automatic-plan-extension` off `origin/quicktricks-admin` (`10b18139a`; rebase before push —
  the client team pushes often). Fetch over HTTPS via the gh credential helper (ssh key fails).
  Deploy = surgical `dist` compile + commit → push → box pull → `pm2 restart 27`. No co-author
  trailers; commit as the work email.
- Admin: the **fork** `quicktricks-admin`, worktree off `origin/quicktricks-admin`; Vercel deploys on push.
- The seam for every offer is `src/services/planOffer.service.ts`; do not add a second one.

| # | Task | Type | Repo(s) | Blocked by |
|---|---|---|---|---|
| 01 | [Automatic extension offer, end to end, behind the switch](01-automatic-offer-behind-switch.md) | AFK | backend | — · **done** `75acc4775` |
| 02 | [iOS never gets the offer](02-ios-no-offer.md) | AFK | backend | 01 · **done** `167fd078d` (listings can't detect iOS — see task) |
| 03 | [Inactive plan = closed to new buyers](03-inactive-plan-closed-to-new-buyers.md) | AFK | backend | 01 · **done** (merge after `167fd078d`) |
| 04 | [Deploy dark, accept on prod, switch on](04-deploy-accept-switch-on.md) | HITL | backend (box) | 01, 02, 03, 07 |
| 05 | [Admin Plan form: remove the Extension card](05-admin-remove-extension-card.md) | AFK | admin | 04 |
| 06 | [Retire the older "extension plan" record mechanism](06-retire-extension-plan-records.md) | HITL | backend | 04 |
| 07 | [No offer on a plan that unlocks nothing or costs ₹0](07-no-offer-on-empty-or-free-plans.md) | AFK | backend | 03 · **done** `e9d273233` (+ Retired plan, My Courses hide — live on push) |
| 08 | [Course page shows the real price, not ₹0](08-course-page-shows-plan-price.md) | AFK | backend | — · **wontfix** (backfill covered it; 0 plan-sold courses at ₹0) |
| 09 | [Course state flags on every course endpoint](09-course-state-flags.md) | AFK | backend | — · **done** `6c744aa86` (local) |
| 10 | [Course page shows the Extension offer](10-course-page-extension-offer.md) | AFK | backend | 09 · **done** `aa9025447` (local) |
| 11 | [Extension orders stack their validity (+ QR duration)](11-extension-orders-stack-validity.md) | AFK | backend | — · **done** `1914f186d` (local) |
| 12 | [Extension window behind `LAPSED_EXTENSION_WINDOW_DAYS`](12-extension-window.md) | AFK | backend | 09, 11 · **done** `6818adfb3` (local; newman pending) |
| 13 | [Deploy, accept, open the window at 30](13-deploy-accept-open-window.md) | HITL | backend (box) | 09–12 · **live** `0173e013c` (window closed); test purchase pending |
| 14 | [Website reads `is_expire` and `isExtension`](14-website-reads-extension-flags.md) | HITL | thedhronas (client team) | 12 |

02 and 03 can run in parallel once 01 lands.

**State 2026-09-24:** 01–03 implemented by sandcastle (Opus 5.5), reviewed and merged into the local
`feat/automatic-plan-extension` — **not pushed, no `dist`**. Full suites vs pre-feature base `009903dd3`:
unit 29/29 and integration 7/7 pre-existing failures, identical; no new failures; `tsc` clean on touched files.
**2026-09-24 (later):** list-price cap dropped by product decision (₹799 original, ₹599 list ⇒ ₹400) —
policy + tests changed in the worktree, uncommitted; offer integration suites 46/46; unit failures 28, none
in offer code. Tasks 07 (empty APX copy plans / ₹0 renewals) and 08 (course page ₹0) added.
2026-09-25: 01–03 + 07 pushed to `quicktricks-admin` `e9d273233` (switch unset ⇒ dark; My Courses retired-plan filter and inactive-plan checkout close are live on the box's next pull).
2026-09-25 ~01:34 IST: **deployed to prod and switched ON** (`LAPSED_EXTENSION_ENABLED=true`, 50 % / 183 d); record in task 04.
Next: 04's remaining acceptance (real Razorpay purchase, Android tap-through), then 08.

**Next scope (grilled 2026-09-25, D11–D17):** course state flags (`is_buy`/`isPaid`/`isExtension`/`isExpired`/`daysLeft`)
on every course endpoint, the Extension offer on the course page, and the **Extension window** (renew up to 30 days
before expiry, validity stacks; env `LAPSED_EXTENSION_WINDOW_DAYS`, default 0). Tasks 09–14. 09 and 11 run in
parallel; 10 after 09; 12 after 09 + 11.
