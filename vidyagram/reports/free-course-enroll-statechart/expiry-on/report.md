# FreeCourseEnroll

TLC reached 27 states and 108 steps. The chart draws 9 states and 11 arrows.
The chart does not draw 15 steps that stay in one chart state.

## EnrollTab breaks
The shortest path has 2 steps:
0. Admin set Free, enroll to unlock, Enrollment Not enrolled, Order No order
1. student buys or is granted an order: Admin set Free, enroll to unlock, Enrollment Not enrolled, Order Order active
2. the order expires: Admin set Free, enroll to unlock, Enrollment Not enrolled, Order Order expired

## PaidTab breaks
The shortest path has 2 steps:
0. Admin set Paid course, Enrollment Not enrolled, Order No order
1. student buys or is granted an order: Admin set Paid course, Enrollment Not enrolled, Order Order active
2. the order expires: Admin set Paid course, Enrollment Not enrolled, Order Order expired

## EnrollOnlyInEnrollMode breaks
TLC's counterexample is in tlc-EnrollOnlyInEnrollMode.out. It has 3 steps:
0. Admin set Free, enroll to unlock, Enrollment Not enrolled, Order No order
1. student taps Enroll: Admin set Free, enroll to unlock, Enrollment Enroll saving, Order No order
2. admin sets Paid course: Admin set Paid course, Enrollment Enroll saving, Order No order
3. the enrollment is saved: Admin set Paid course, Enrollment Enrolled, Order No order

## Rules that hold
TypeOK, OpenPlays, OpenNotListed, EnrollPlays, PaidPlays, TabFollowsMode, NoDeadlock, EnrollmentKept, FlipBackRestores
