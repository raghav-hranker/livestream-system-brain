# Deploy and accept on prod

**Type**: HITL
**Blocked by**: #01, #02, #03

## What to build

Ship tasks 01–03 to the quicktricks prod box and prove the feature works with real data and the
real app. Human in the loop, because the box is blocked in auto mode and the auth assumption can
only be checked against real app traffic.

- Rebase onto `origin/quicktricks-admin`, compile the changed files into `dist`, commit (work
  email, no co-author trailers), push, box pull, pm2 restart. There is no env change and no
  migration.
- **First, check the unverified assumption:** one real search from the app must reach the
  controller with the token user recognised. If the app doesn't send `Authorization` on
  `/api/search`, nothing breaks, but everyone gets the guest view. In that case record it and
  raise it with the app team before calling this accepted.

## Acceptance criteria

- [ ] Deployed; every other search section returns the same results as before for a sample of
      queries.
- [ ] App search is recognised as the signed-in user (no raw token logged; redact credentials in
      any trace).
- [ ] A numbered-class query (`class 44 …`) returns the right class near the top.
- [ ] A class placed in several courses lists all eligible courses, with the student's bought
      course first.
- [ ] A student who bought a now-inactive batch sees it on its classes; a student who didn't,
      doesn't.
- [ ] A guest (no token) gets classes with no `isPurchased: true`.
- [ ] Tapping a result through to `/playback` plays when `canPlay` is true, and gets the usual 403
      when it is false.
- [ ] PRD and README updated with the deployed commit and acceptance date.

## User stories covered

- Acceptance of all stories on production
