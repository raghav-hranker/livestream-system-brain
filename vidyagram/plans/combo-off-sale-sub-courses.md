# Combo 89: off-sale sub courses on the Sub Courses tab (proposal)

Tenant: Vidyagram (781, vidyagramdb). 2026-11-09. **Status: proposal, not agreed. Nothing written to prod.**

Read against the live `vidyagram-admin` backend (b6d965aaf, 09:28 UTC) and vidyagramdb. Probe:
`reference/scripts/vidyagram-combo-sub-status-probe.cjs`.

## What is true today

- Six courses are combos on course selling. Only **89** loses entries: its tab lists 1 of 5 cards, the combo itself.
  85, 86, 87 and 88 are status 0 because AppX stopped selling them singly (price -1). The tabs for 108, 132, 137, 171
  and SSC CHSL list every course in them.
- The backend has only one "not on sale" state, status 0. ADR-0009's AppX sync (`apxCourseStatusSync`, daily catch-up)
  and our nightly price sync both set it for AppX -1. The admin's **Delete** sets the same status 0 and also removes the banner.
  Catalogue queries skip status 0, and also `apxPrice: -1` (`excludeHiddenApxCourses`).
- Access does not look at status. A combo buyer gets 85–88 in My Courses, and they open.
- `by-id-2` opens a status-0 course: 85 returns 200 with status 0 and ₹1,999/₹199.
- A sub course's page already lists the combo's plan. `withoutOtherCoursesPlans` says: "a sub course with a blank
  price is bought only that way". 85's page offers ₹199 Grammer Pro and the ₹249 combo.
- **Problem: the four single plans are still on sale on every screen, the app's Plans page included.**

  | Course | Plan | Price | Screens |
  |---|---|---|---|
  | 85 Grammer Pro | `6ad5c040a5b976f0a42f84cf` | ₹199 | no `displayOn`, so every screen |
  | 86 Comprehension King | `6ad5c041a5b976f0a42f8a34` | ₹199 | no `displayOn`, so every screen |
  | 87 Practice Pro | `6ad9af9b318dee53a5c6d68f` | ₹99 | packages, course, studyPlan, plans |
  | 88 Vocab Ocean | `6ad9af9b318dee53a5c6d689` | ₹99 | no `displayOn`, so every screen |

  Orders on these plans in the last 30 days: 98 imported from AppX (the last on 11-03), 2 Razorpay purchases made
  here (10-29 and 11-06), and 5 that were started but not finished. AppX no longer sells these, but we still do.

## Answers

1. **Should a combo's list include its off-sale sub courses?** Yes. The tab should show what a buyer gets, and access
   already ignores status. A sub course that no longer exists stays out.
2. **Off sale vs hidden.** Keep a single state. Status 0 means "not sold on its own": the course is out of the catalogue,
   search, course folders and the teacher catalogue. It is still listed inside any combo that holds it, its page still
   opens by id, and buyers keep access. Once its own plans are off screens, its page sells it only through the combo's
   plan. To take a course off a combo's tab, remove it from the combo on the admin form. An admin-deleted sub course
   left in a combo would show on the tab too. That is correct, since buyers still get it, and the admin row already
   shows each sub course's status. We need no new `comboOnly` flag.
3. **Course lists and catalogue.** One function, `subCourseListsFor`, builds `subCourses` for `by-id-2` and for the
   rows of `/courses/filter`, `/courses/batch-filter` and `/courses/active`. A change there covers all four.
   The catalogue itself does not change: 85–88 stay out of course lists on their own, as in AppX.
4. **Other combos.** None are in this state today. It will happen again whenever AppX stops selling a combo's sub course singly.
5. **App and website.** The contract does not change, because each entry already carries `status`. Nothing is required once
   step A is done. Ask the app team one thing: on a status-0 course's page, the buy button must come from the plan list,
   which will hold only the ₹249 combo. It must not come from the course's own `discountPrice` (₹199).

## Changes, in order

| Step | What | Who | Reversible |
|---|---|---|---|
| A | Take the four single plans above off every screen: `displayOn: []`, **status stays 1**, so buyers keep access. Same as 76/91/128 on 11-09. Record it in the ledger. | us, needs your yes | yes (backup old `displayOn`) |
| B | `src/services/courseSelling/combo.ts` `subCourseListsFor`: drop `status: 1` from the course read, so a sub course is listed whatever its status. Fix the doc comments ("active courses only") and add a test with a status-0 sub course. | client team (their course-selling code, same-day ship); we hand them the diff | yes |
| C | Guide `vidyagram/reference/vidyagram-combo-sub-courses-api-guide.md` §3: replace "Only active courses are listed" with the status-0 rule and the buy-button note, then resend it to the app team. | us | — |

Do A first: it stops the four singles selling today, and B does not depend on it. If B shipped before A, more students
would reach 85–88's pages while the single plans are still on them.

## Rejected

- **Put 85–88 back to status 1 and rely on `apxPrice: -1` to hide them.** The ADR-0009 sync and our nightly would set
  them back to 0, and status 1 would show their single plans on more screens.
- **Turn off View Course on status-0 cards.** The page shows that part of the combo (outline, demo classes) and now sells
  only the combo. If the app team prefers a card without a link, they can do that from `status` without a backend change.

## Follow-up (not this proposal)

Other courses AppX stopped selling (status 0 here) still have a single plan on screens: 114 UPSSSC PET (प्रारंभ बैच)
₹299, 133 UPSSSC PET Crash Course ₹149, and 119 Champions 4.0 Maths LIVE ₹899. 38 sits inside 104's plan and 108's combo
plan; leave it. On 11-09 the match report said "none selling here that AppX stopped", but it counted courses, not plans.
