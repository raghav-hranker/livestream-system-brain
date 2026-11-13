# Test courses to switch off before launch — for approval

Checked 2026-11-12, read-only (`reference/scripts/vidyagram-test-courses-probe.cjs`). Nothing has been changed.
The list is `7-test-courses-to-switch-off.csv`, one row per course.

## What is proposed

1. **Switch off 21 courses** (status 1 → 0): the 20 May–June test courses and "Course Builder Demo".
   None is in AppX. The 20 have no classes, PDFs or tests. The demo holds 422 classes copied from the Maths VOD batch.
2. **Take their 20 own plans off sale** (₹12–₹46 each). The demo has no plan.

Switching a course off only takes it off the listing; anyone who holds it keeps it.

## What hangs off them

- **Buyers**: 11 successful orders on the 20 test plans, from 3 accounts, ₹176 in total, between 10-19 and 11-06.
  That pattern looks like team testing, but the accounts were not looked up.
- **12 real selling plans also list a test course** next to the real one (for example the Champions 5.0 ₹899 plan
  lists "SSC CHSL Complete Course 2026"; Reasoning Special 4.0 lists "SSC MTS Complete Course 2026"). A buyer of the
  real course therefore also holds an empty test course. The proposal leaves those plans alone.
- **One test plan grants real courses.** "SSC CHSL Complete Course 2026", ₹13, status on, was made a combo of UP
  Foundation Batch (AppX 167, ₹999) and UPSSSC RO/ARO 2026 (AppX 168, ₹599) on 11-07. It has 3 successful ₹13 orders
  from 2 accounts, the last on 11-06. Course selling marks it not on sale, but the plan record itself is switched on
  with no screen restriction. Whether a student can reach it in the app was not tested.

## Why the Live and VOD tabs are wrong

All 49 real courses have neither the Live nor the Recorded flag set; only the test courses do. So those two tabs list
only test courses today, and will be empty once the test courses are off. Filling them means flagging each real course
as Live or Recorded, which is a separate decision for whoever owns the catalogue.

## Decisions needed

1. Approve switching off the 21 courses and the 20 plans?
2. The ₹13 plan: also remove its two real courses, or is taking it off sale enough?
3. The 12 real plans: remove the test course from each, or leave them?
4. Who sets Live / Recorded on the 49 real courses?

Rollback for 1: set the same 21 courses and 20 plans back to status 1 (ids are in the CSV).
