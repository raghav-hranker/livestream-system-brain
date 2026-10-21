# 01 — Show live indicators from stream status

State: ready-for-agent
Execution: implemented and verified locally; not deployed
Type: AFK

## Parent

[PRD](../../prd-class-blinking-and-assignment-times.md)

## What to build

Type: AFK. Blocked by: none. User stories: 1–5.

Deliver the complete LMS listing-to-student-card path: class blinking is true only
for streamStatus live, and section/topic indicators aggregate that same truth.
Remove the student badge's dependency on class_link. Keep the existing refetch
lifecycle, visibility rules, navigation and playback metadata.

## Acceptance criteria

- [x] Class, topic, section and timetable response indicators use runtime status.
- [x] Missing status, preparing, reconnecting, processing and ended do not blink,
      even with dates containing now or a stored isLive value of true.
- [x] A live class can render its badge without class_link; fetched non-live state
      removes it. Existing navigation works.
- [x] Listing integration and focused UI verification cover contradictory dates,
      aggregate membership, visibility and protected asset non-disclosure.
- [x] Admin isLive labels and livestream delivery remain unchanged.

## Blocked by

None — can start immediately

## Implementation evidence

See [implementation report](implementation-report.md) for commits, tests, and remaining release coordination.
