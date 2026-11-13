# Handoff: offers on other courses for existing buyers (2026-10-06 → 10-07)

**Status: exploration only. Nothing built, nothing configured on prod, nothing decided.**
Raghav is **not sold on any approach covered so far**. Do not re-pitch them, do not
refine them, do not start building one. The gate for proceeding is Raghav liking an
approach *as a user of the app*, not a feature matrix. Next session should open by
asking what he wants to see next, or by bringing genuinely new angles.

## The ask

Students who already bought one Quicktricks batch should be offered other batches they
do not own. Audience is Indian tier 2-3 exam prep (SSC / Railway / Banking, Hindi belt).
Raghav wants it **extensible**, not a one-off feature, and he wants to *feel* the offer
from the student's side before committing.

Clarification on 10-06: it is **not** a literal upgrade (replace A with a combo
containing A). It is "because you hold X, here is Y".

## Approaches covered (all seen, none accepted)

| # | Approach | Where | Raghav's reaction |
|---|----------|-------|-------------------|
| 1 | Literal upgrade with pro-rated credit for the owned course (combo price − credit) | artifact "Course Upgrade Offers" v1 | Wrong framing, not what he wants |
| 2 | Student offer: holders of X see Y at a special price (fixed / % off / flat / tiered), curated pairs or a global loyalty % | "Course Upgrade Offers" v2 + "Upgrade Offer Demos" v2 | "Doesn't feel extendible" |
| 3 | Offer engine: audience × trigger × reward × surface as rows in an `offers` collection; 13 patterns from PW / Adda247 / Testbook / Unacademy / Jio / Duolingo (pass, tier editions, scholarship test, coins, exam-date trigger, micro packs, UPI split, progress unlock, group buy, festival bands, checkout add-on, WhatsApp, Q-Hub) | "Quicktricks Offer Engine" + "Offer Engine Demos" | Asked for demos, then moved to the mechanics question; no approval |
| 4 | Mechanics for thousands of existing buyers: listing resolver + audience compiler already compute from orders, no backfill; 6-step no-code pilot | "Reaching Existing Buyers" | Read, no verdict |

Artifacts (private, Raghav's account):
- Course Upgrade Offers: https://claude.ai/artifact/Ppch2JcAm54gHRSfcP99b2
- Upgrade Offer Demos: https://claude.ai/artifact/LPLRmsJSdawRNsKftiPZ4P
- Quicktricks Offer Engine: https://claude.ai/artifact/VrJynHj62NH5nS8ksngAY1
- Offer Engine Demos: https://claude.ai/artifact/8Dm2gNTbY3Pzj8RTqPjGjh
- Reaching Existing Buyers: https://claude.ai/artifact/XgPZSVdjUPvNhqAgfZXrP8

## What the platform already has (verified on origin/quicktricks-admin, 2026-10-07)

- `Plans.upgradationEnabled / upgradationPlanIds / upgradationPrice`: holders of any
  listed source plan see the target at the fixed price. Resolver
  `src/services/planOffer.service.ts` (`resolvePlanOffersForUser`, two Order queries per
  listing, cheaper-wins vs the automatic lapsed extension). Orders get `isUpgradeOrder` +
  `upgradesFromOrderId`. Upgrade-only visibility (`planAvailability.service.ts`) hides a
  flagged plan from non-holders; a cross-sell target must NOT be flagged.
- Plan-broadcast audience compiler `src/services/notificationAudience/` with per-plan
  states `active | expired | never`, 1–5 rows, estimate before send. "Holds X, never Y"
  is expressible today.
- Coins ledger + referral cap, class-progress spans, `isFree` per class, test engine,
  Q-Hub pinned posts: all live levers the engine patterns lean on.
- App wire (Flutter) reads only `amount`, `originalAmount`, `is_buy`, `is_expire`,
  `isUpgrade`. No new fields without a release.
- Traps: Razorpay sync cron resurrects voided orders that keep their `orderId`; Apple
  path bypasses offer pricing; eligibility failures are almost always a voided source
  order, not the admin form.
- Local `../quicktricks-backend` checkout is on `agent/course-qa` and lacks the resolver;
  read from origin.

## Artefact added to the repo

`reference/scripts/offer_pockets.js` — read-only, run on the box from the backend
checkout. Prints per source→target plan: holders of source without target (active /
lapsed), source buyers who later bought target, and whether the pair is already wired.
Syntax-checked, **not run**. Running it is a reasonable first move only if Raghav wants
data before taste.

## Research sources used (for the engine page)

PW Infinity/Pro editions and monthly festival sales; PWNSAT scholarship test; PW ₹1,000
referral; Adda247 Mahapack; Testbook Pass; Unacademy Plus→Iconic unused-days credit;
Jio ₹19/₹29 add-on packs and per-day pricing; Razorpay UPI Autopay / EMI; tier 2-3 card
penetration <2%; Duolingo streaks in India; campaignhq course-completion upsell playbook.
Links are at the bottom of the Offer Engine artifact.

## How to resume

1. Ask Raghav what he wants to look at, or what felt off in the four pages. Do not
   summarise them back to him.
2. If he wants new angles: untouched directions include a student-side "my prep map"
   (where the owned batch sits in the exam syllabus and what is missing), teacher-recorded
   video pitches inside the owned batch, offline-coaching-style counselling calls, and
   anything that starts from the student's exam goal rather than from the catalogue.
3. Only after he says he likes something as a user: PRD via `/to-prd`, then tasks.
