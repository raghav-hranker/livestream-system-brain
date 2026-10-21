# Today tab

**Type**: AFK
**Blocked by**: 01 — Previous tab, end to end

PRD: `docs/plans/prd-course-class-tabs.md`. Glossary: `CONTEXT.md` → "Today tab", "Live class".

## What to build

`tab: 'today'` on the class-tabs endpoint: every eligible placement whose effective start falls on
the current IST day — not started, Live, or finished, playable or not — **plus** any Live class
(stream status `live|reconnecting`) whatever its scheduled day. Unpaginated: the whole set in one
response, `nextCursor: null`, `cursor`/`limit` ignored. Order: Live first, then effective start
asc, then placement id asc. Reuse the task-01 classifier, eligibility and card builder.

## Acceptance criteria

- [ ] A class scheduled today but not yet started, a finished one with nothing playable, and a late one (start passed, not Live) all appear.
- [ ] A class scheduled yesterday 23:30 IST that is still Live appears in Today and not in Previous.
- [ ] A reconnecting class counts as Live (top of list); its `isBlinking` stays false.
- [ ] A class scheduled tomorrow is absent; deactivated/status-0 placements are absent.
- [ ] Order: Live classes first, then effective start asc, then placement id asc.
- [ ] Integration tests cover the above around the IST day boundary; `npx tsc --noEmit` clean.

## User stories covered

1–6
