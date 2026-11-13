// Chart words for FreeCourseEnroll.tla. Three regions: what the admin set, and the two things the student
// holds. What the student sees (the model's CanPlay and Tab) is in the README table, not a region: a region
// derived from the others makes start combinations that never happen, and the chart falls back to 93 arrows.
// ENFORCE_EXPIRY=1 only changes the title; the config sets the model's constant.
const MODE = { paid: "Paid course", open: "Free, open to all", enroll: "Free, enroll to unlock" };
const ORDER = { none: "No order", active: "Order active", expired: "Order expired" };

const ENFORCE = process.env.ENFORCE_EXPIRY === "1";

export const title = ENFORCE
  ? "Free-course enroll, one student and one course (ENFORCE_ORDER_EXPIRY on)"
  : "Free-course enroll, one student and one course (ENFORCE_ORDER_EXPIRY off)";

export const state = (v) => ({
  "Admin set": MODE[v.mode],
  Enrollment: v.enrolled ? "Enrolled" : v.enrollInFlight ? "Enroll saving" : "Not enrolled",
  Order: ORDER[v.order],
});

export const step = (action, from, to) => {
  switch (action) {
    case "AdminSetsMode":
      return `admin sets ${MODE[to.mode]}`;
    case "StudentTapsEnroll":
      return "student taps Enroll";
    case "EnrollmentSaved":
      return "the enrollment is saved";
    case "EnrollChangesNothing":
      return "Enroll returns 409 or repeats";
    case "StudentGetsOrder":
      return "student buys or is granted an order";
    case "OrderExpires":
      return "the order expires";
    default:
      return action;
  }
};
