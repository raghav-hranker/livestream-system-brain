# Website (thedhronas) reads `is_expire` and `isExtension`

**Type**: HITL (the client team's repo, `GontinaUdayKumar/thedhronas`, branch `quicktricksbysahilsir-new`)
**Blocked by**: 12 (the wire is fixed by then; the handoff can go out earlier)
**Status**: blocked
**Decisions**: design record D12, D15.

## Why

Two website gaps stop an in-window holder from reaching an offer the API now makes. Checked against a
2026-08-21 clone, so re-check the live branch.

- **Plans page** `/user/plans/{courseId}/course` (`GET /plans/active/:userId`) reads only `is_buy`, so
  `is_buy: 1, is_expire: 1` renders "Purchased". It must show Buy (offer price) when `is_expire == 1`,
  the same as the Flutter gate `!(is_buy==1 && is_expire==0)`.
- **Course page** `/user/courses/[slug]/[id]` (`by-id-2`): CTA is `enrolled ? 'Enrolled ✓' : …` and
  `openPlansTypePage` returns early when `enrolled` (`isPaid`). With `isExtension: true` it must show an
  "Extend" CTA that opens the plans page. It should also render `validity` as the string the API sends
  ("6 Months"), not `{n} YEARS`.
- The public `/courses/...` page is SSG with `userId: '0'` and never personalises. That's fine, no change.

## What to do

Write a short handoff for the site team (wire table from design record D13 + D12, the two code spots above),
send it with the user's go-ahead, and confirm on the live site after task 13.

## Acceptance criteria

- [ ] Handoff sent (the user relays it).
- [ ] On the live site: in-window holder sees Buy on the plans page and Extend on the course page; lapsed
      holder sees the half price + "6 Months" on the course page.
