# Test two plans on one course by hand

**Type**: HITL
**Blocked by**: None, can start immediately
**Repo**: Admin on prod, with the user. No code

## What to build

On a test course, make two ordinary plans by hand with different lengths and prices. Check what the app and the website do on that course's page: whether both show, whether a student can pick one, and whether each buys the right plan with the right validity.

The result decides whether task 07 needs app work. Use a test account and a hidden test course, and remove the test plans afterwards. Follow `reference/hosts.md` and record the test in `prod-data-changes`.

## Acceptance criteria

- [ ] The app and the website are each recorded as: shows both, shows one, or breaks.
- [ ] A test purchase confirms the order takes the chosen plan's validity, or the reason it couldn't be run is recorded.
- [ ] The findings are written into this file and task 07 is updated to match.
- [ ] The test plans and orders are removed or switched off.

## User stories covered

- Stories 11

## Result (2026-11-06)

The user confirmed from the app: when a course is attached to two plans, the app shows both plans at checkout and the
student picks one. No hand test was run; no test course or plans were made, so nothing needs removing.

- App: **shows both.** Website: not checked yet.
- Validity: the backend sets an order on a course plan to that plan's duration whatever the client sends
  (`orderDurationFor`, task 07 and the 05 review), so the picked plan's length is what the student gets. Not checked with
  a real purchase.
- Task 07 needs no app work for the picker. Turning lengths on still waits on the admin deploy, because the admin's
  `NEXT_PUBLIC_DURATION_PRICING` shows the extra-length rows.

