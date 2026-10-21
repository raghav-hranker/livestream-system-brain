# Upcoming tab

**Type**: AFK
**Blocked by**: 01 — Previous tab, end to end

PRD: `docs/plans/prd-course-class-tabs.md`. Glossary: `CONTEXT.md` → "Upcoming tab".

## What to build

`tab: 'upcoming'` on the class-tabs endpoint: this course's eligible placements whose effective
start falls on an IST day **after** today and which are not Live, soonest first, cursor-paginated
with the task-01 codec (effective start asc, placement id asc). The `watch` field is accepted and
ignored on this tab. Reuse the task-01 classifier, eligibility and card builder — no parallel query.

## Acceptance criteria

- [ ] Upcoming includes only future-IST-day placements; a class later today is NOT in Upcoming.
- [ ] A class scheduled tomorrow that is already Live is NOT in Upcoming.
- [ ] Order is effective start asc, then placement id asc; cursor paging returns each placement exactly once.
- [ ] `watch` values do not change the Upcoming result; cards carry no watch fields beyond what task 04 later adds.
- [ ] A cursor minted for Previous is rejected (400) when sent with `tab: 'upcoming'`.
- [ ] Integration tests cover membership, order and paging; `npx tsc --noEmit` clean.

## User stories covered

7–9, 25
