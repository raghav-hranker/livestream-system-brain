# FreeCourseEnroll

TLC reached 27 states and 108 steps. The chart draws 9 states and 11 arrows.
The chart does not draw 15 steps that stay in one chart state.

## EnrollOnlyInEnrollMode breaks
TLC's counterexample is in tlc-EnrollOnlyInEnrollMode.out. It has 3 steps:
0. Admin set Free, enroll to unlock, Enrollment Not enrolled, Order No order
1. student taps Enroll: Admin set Free, enroll to unlock, Enrollment Enroll saving, Order No order
2. admin sets Paid course: Admin set Paid course, Enrollment Enroll saving, Order No order
3. the enrollment is saved: Admin set Paid course, Enrollment Enrolled, Order No order

## Rules that hold
TypeOK, OpenPlays, OpenNotListed, EnrollPlays, EnrollTab, PaidPlays, PaidTab, TabFollowsMode, NoDeadlock, EnrollmentKept, FlipBackRestores
