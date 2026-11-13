---- MODULE FreeCourseEnroll ----
\* Vidyagram free-course enroll (vidyagram/plans/free-course-enroll.md), one student and one course.
\* Ground truth: quicktricks-backend worktree vg-free-enroll-backend, branch feat/vg-free-enroll @ 10125d5a3.
\* The class is not free on its own (Class.isFree false) and its placement is not free (CourseClass.isFree
\* false), so only the course's mode, the enrollment and the order decide. An order owns the course in full.
EXTENDS TLC

\* ENFORCE_ORDER_EXPIRY (config/videoProtection.ts:40). Off by default; unset on the quicktricks box.
CONSTANT EnforceExpiry

VARIABLES
    mode,            \* courseFreeMode(course): "paid" | "open" | "enroll" (courseFreeMode.ts:14-15)
    enrolled,        \* a CourseEnrollment row exists; written once, never removed (courseEnrollment.ts:33-37)
    order,           \* the student's successful order on the course: "none" | "active" | "expired"
    enrollInFlight   \* POST /:id/enroll has read the mode and not yet written (courseEnrollment.ts:30-37)

vars == <<mode, enrolled, order, enrollInFlight>>

Modes == {"paid", "open", "enroll"}
Orders == {"none", "active", "expired"}

TypeOK ==
    /\ mode \in Modes
    /\ enrolled \in BOOLEAN
    /\ order \in Orders
    /\ enrollInFlight \in BOOLEAN

------------------------------------------------------------------------------
\* What the code derives.

\* courseScopeFromOrders with { enforceExpiry }: an expired order opens the course only while the flag is off.
OrderOpens == order = "active" \/ (order = "expired" /\ ~EnforceExpiry)

\* myCourseCandidateIds lists every successful order's course, expiry ignored (myCourses.ts:13-15, 40-64).
OrderLists == order # "none"

\* authorizeClassAccess (classAccessAuthz.ts:122-138); authorizeCourseAccess (:243-258) reads the same.
CanPlay ==
    \/ mode = "open"
    \/ mode = "enroll" /\ enrolled
    \/ OrderOpens

\* getUserCourses: the course row matches (courseController.ts:2563-2566), then the tab (:2651-2656).
Listed ==
    \/ OrderLists /\ mode = "paid"                    \* MY_COURSES_COURSE_MATCH: isFree != true
    \/ (OrderLists \/ enrolled) /\ mode = "enroll"     \* ENROLL_MODE_MATCH
Tab == IF ~Listed THEN "none" ELSE IF mode = "enroll" THEN "Free" ELSE "Paid"

\* The reader's "holds a granting order": an order that opens the course right now.
HoldsOrder == OrderOpens

------------------------------------------------------------------------------
Init ==
    /\ mode \in Modes
    /\ enrolled = FALSE
    /\ order = "none"
    /\ enrollInFlight = FALSE

\* The admin flips the course form's Is Free / Who can watch at any time.
AdminSetsMode ==
    \E m \in Modes \ {mode}:
        /\ mode' = m
        /\ UNCHANGED <<enrolled, order, enrollInFlight>>

\* The enroll call reads the course and finds it in enroll mode (courseEnrollment.ts:30-32).
StudentTapsEnroll ==
    /\ mode = "enroll"
    /\ ~enrolled
    /\ ~enrollInFlight
    /\ enrollInFlight' = TRUE
    /\ UNCHANGED <<mode, enrolled, order>>

\* The upsert lands (courseEnrollment.ts:33-37). It does not read the mode again.
EnrollmentSaved ==
    /\ enrollInFlight
    /\ enrolled' = TRUE
    /\ enrollInFlight' = FALSE
    /\ UNCHANGED <<mode, order>>

\* 409 NOT_ENROLLABLE outside enroll mode; a repeat tap keeps the one row. Neither changes anything.
EnrollChangesNothing ==
    /\ ~enrollInFlight
    /\ (mode # "enroll" \/ enrolled)
    /\ UNCHANGED vars

\* A purchase, a renewal, an admin grant, or an AppX ₹0 import.
StudentGetsOrder ==
    /\ order # "active"
    /\ order' = "active"
    /\ UNCHANGED <<mode, enrolled, enrollInFlight>>

OrderExpires ==
    /\ order = "active"
    /\ order' = "expired"
    /\ UNCHANGED <<mode, enrolled, enrollInFlight>>

Next ==
    \/ AdminSetsMode
    \/ StudentTapsEnroll
    \/ EnrollmentSaved
    \/ EnrollChangesNothing
    \/ StudentGetsOrder
    \/ OrderExpires

Spec == Init /\ [][Next]_vars

------------------------------------------------------------------------------
\* The reader's rules.

\* Open: everyone can play.
OpenPlays == mode = "open" => CanPlay
\* Open: never in My Courses.
OpenNotListed == mode = "open" => Tab = "none"
\* Enroll: plays only with an enrollment or an order.
EnrollPlays == mode = "enroll" => (CanPlay <=> (enrolled \/ HoldsOrder))
\* Enroll: in the Free tab exactly when an enrollment or an order is held.
EnrollTab == mode = "enroll" => ((Tab = "Free") <=> (enrolled \/ HoldsOrder))
\* Paid: plays only with an order; an enrollment never grants it.
PaidPlays == mode = "paid" => (CanPlay <=> HoldsOrder)
\* Paid: in the Paid tab exactly when an order is held; an enrollment never lists it.
PaidTab == mode = "paid" => ((Tab = "Paid") <=> HoldsOrder)
\* The tab is decided by the mode, not by how the student got access.
TabFollowsMode ==
    /\ (Tab = "Paid" => mode = "paid")
    /\ (Tab = "Free" => mode = "enroll")

\* Nothing deletes an enrollment.
EnrollmentKept == [][enrolled => enrolled']_vars
\* Flipping back to enroll restores an old enrollment: the student plays and sees it in Free.
FlipBackRestores ==
    [][(mode # "enroll" /\ mode' = "enroll" /\ enrolled) => (CanPlay' /\ Tab' = "Free")]_vars
\* An enrollment is only ever written while the course is in enroll mode.
EnrollOnlyInEnrollMode == [][(~enrolled /\ enrolled') => mode = "enroll"]_vars

====
