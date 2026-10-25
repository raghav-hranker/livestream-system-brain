# Course-complete push

**Type**: AFK
**Blocked by**: 01, 03
**Repo**: backend

## What to build

The first time an admin marks a course complete, students who can already claim get one push.

- **Trigger.** Use the `firstTime` hook from task 01. When `notifiedAt` is empty at switch-on, set `notifiedAt` in
  the same conditional update, so two racing switch-ons send one push. Then queue the send. A later switch-on never
  sends.
- **Audience.** The course's owners (the same "ever owned" rule as task 03; for a free course, anyone with progress
  on it) whose progress is 100% and who hold no certificate.
  - Compute it with one aggregation over class progress for that course, applying the same Watched rule and the
    active class placements.
  - Do **not** run the per-user progress pipeline once per buyer. That pattern has caused heap crashes on this
    backend before.
  - The count must match what task 03's status would say for each user. Prove it on a fixture.
- **Send.** Use the existing FCM delivery path the plan broadcasts use.
  - Title: "Your certificate is ready". Body: "You've completed <course title>. Claim your certificate in the app."
  - Data: `{ type: 'certificate_ready', courseId }`, so the app can deep-link to the course.
  - The send runs after the HTTP response, and a failure is logged without undoing the switch.
- **Kill switch.** No push when `CERTIFICATES_ENABLED` is off. The switch itself still saves.

## Acceptance criteria

- [ ] Integration: a fixture with buyers at 100%, 99% and 100%-with-certificate, plus a non-buyer at 100%, gives an
      audience of exactly the first.
- [ ] Integration: the audience equals the set of users for whom task 03's status is `eligible`, ignoring
      `claims_closed`.
- [ ] Integration: switch on, then off, then on gives one send call (fake sender). Two concurrent first switch-ons
      give one send call.
- [ ] Integration: a sender that throws still leaves the switch on and logs the error.
- [ ] The audience query on a course with 5,000 fake owners runs as a single aggregation. Report the time.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 5, 33
