# Stream-based class blinking and actual assignment times

State: ready-for-agent
Date: 2026-09-11

## Problem Statement

Students see classes marked live merely because the current time falls inside an
assignment's dates. Normal assignment creation sets start to now and end to a year
later, so the indicator can remain active long after teaching finishes. Assignment
dates also fail to reflect when the class actually ran.

## Solution

Show blinking only while the shared Class has streamStatus live. Give new
assignments a provisional window from now through the end of the current IST day.
When the LMS receives the first live and processing updates, record actual times
and apply them to every assignment of that Class. Later assignments inherit known
actual times. Leave historical assignments untouched unless future status updates
apply; do not backfill dates.

## User Stories

1. As a student, I want a class to blink only while streaming is live, so that the indicator is trustworthy.
2. As a student, I want preparing and reconnecting classes not to blink, so that blinking has one clear meaning.
3. As a student, I want blinking to stop during processing, so that recording preparation is not mistaken for live teaching.
4. As a student, I want section and topic indicators to reflect their live classes, so that I can find ongoing teaching.
5. As a student, I want the live badge to work without a legacy class link, so that protected streams are represented correctly.
6. As an administrator, I want a new assignment to start now by default, so that it appears in today's classes before streaming begins.
7. As an administrator, I want the provisional end to be the end of the current IST day, so that new assignments do not carry year-long windows.
8. As a student, I want today's classes to use IST consistently, so that calendar-day boundaries match my expectations.
9. As an administrator, I want actual streaming start to replace the placeholder across every course assignment, so that their times agree.
10. As a student, I want a class that starts a day late to move to that day's classes, so that the listing reflects what happened.
11. As an administrator, I want a delayed start to advance an expired provisional end, so that the temporary end does not precede the start.
12. As an administrator, I want the processing transition to record the end, so that VOD preparation time does not extend the class duration.
13. As an administrator, I want reconnects and repeated updates to preserve actual timestamps, so that they do not rewrite history.
14. As an administrator, I want assignments made during or after streaming to inherit known actual times, so that new course placements agree with existing ones.
15. As an administrator, I want existing historical dates left unchanged, so that this release does not rewrite the catalogue.
16. As a student, I want recording access to remain available after assignment end, so that finishing a stream does not revoke playback.
17. As an administrator, I want actual-time updates to preserve notification history and cancel obsolete reminders, so that live transitions are not treated as manual rescheduling.

## Implementation Decisions

- The LMS owns durable Class state and assignment dates. Target the Quicktricks
  backend fork and student website; coordinate upstream LMS parity using the
  repository's existing branch/fork discipline. Livestream remains the status
  producer and requires no payload or retry changes. Admin dashboard runtime
  labels require no change.
- Keep isBlinking as a response boolean, derived solely from streamStatus live.
  Missing status and every other status yield false, regardless of dates,
  stored isLive, class_link, or playback availability. Section/topic aggregation
  uses this same rule over the classes included in the listing. Preserve existing
  entitlement, visibility, taxonomy and filtering rules.
- Maintain optional, server-owned actualStartedAt and actualEndedAt timestamps on
  Class, separate from its existing schedule fields. They are not writable through
  ordinary admin mutation payloads. Do not infer them from placeholder dates.
- First live received with no captured actual start sets actualStartedAt to LMS
  current time. First processing received with no captured actual end sets
  actualEndedAt to LMS current time. Preparing, reconnecting and ended capture
  neither. Ended alone must not invent a historical start or end, including for
  prerecorded transcoding. The existing status and asset contract remains intact.
- Propagate saved actual start/end values to every assignment of the Class,
  including inactive assignments, without changing assignment visibility/status.
  Reconnecting-to-live and duplicates do not replace captured timestamps.
- For the initial actual-start propagation, if an assignment's provisional end is
  absent or precedes the actual start, advance it to that start day's IST end.
  Preserve a later provisional end until processing supplies the actual end.
  A captured actual end takes precedence over provisional defaults.
- New regular assignments inherit each available actual timestamp. Otherwise
  start defaults to now and end to 23:59:59.999 Asia/Kolkata on the creation day.
  During streaming, the provisional end is replaced when processing arrives.
- Use explicit IST calendar boundaries independent of process timezone. Align
  the course today's-classes endpoint with the existing IST timetable convention.
  Retain start-day membership: an overnight class belongs to its starting day;
  adding ongoing classes to subsequent days is outside this change.
- Do not apply new defaults globally to historical APX import placement creation.
  Existing assignment reactivation preserves dates. No historical migration.
- Preserve existing manual assignment-date editing as an administrator override;
  do not add UI restrictions in this work. Canonical actual timestamps remain
  immutable, and new assignments inherit canonical values. A later first
  processing update still replaces assignment end dates. Completed duplicate
  status updates must not continually undo subsequent manual edits.
- Make first capture and assignment propagation safe under concurrent requests.
  Return success only after required propagation completes. An implementation
  must either commit the logical operation atomically or retain enough progress
  to retry incomplete propagation with the original timestamps. Coordinate late
  assignment creation with status changes so a new placement cannot miss an
  already-captured time. Prefer the existing persistence seam, not a new service.
- Actual-start propagation is not manual rescheduling: preserve notificationSent,
  cancel obsolete scheduled reminders, and prevent a queued reminder from sending
  after the class has started. Do not introduce a new live-start notification.
- Student cards must not require class_link for blinking. Keep status refresh on
  the existing fetch lifecycle; do not add sockets or a polling subsystem.

## Testing Decisions

Test observable status writes, persisted assignment results, listing responses,
notification behavior and rendered badges rather than duplicating implementation
expressions. Prefer the existing status-handler dependency seam and Mongo-backed
listing integration harness. Existing status controller/schema, listing liveness
and class-access authorization suites provide prior art.

- Status handler plus persistence: first live/processing, repeats, reconnects,
  ended without a live session, unchanged asset handling, invalid requests, and
  server ownership of actual timestamps.
- Assignment integration: propagation to multiple active/inactive assignments,
  assignments created during/after streaming, concurrent creation, concurrent
  status updates and retry after partial failure. Verify original capture time is
  retained and already-completed retries do not override later manual edits.
- Date behavior with a controlled clock: end-of-day IST, dates around midnight,
  delayed start advancing an expired provisional end, later provisional end
  preservation, course today/timetable agreement, and no historical backfill.
- Listing integration: every status with conflicting date windows and isLive
  values; consistent class/topic/section booleans; preserve listing visibility and
  existing playback metadata without exposing protected assets.
- Notifications: sent history survives actual-start propagation, pending paid and
  free reminders are cancelled/suppressed, and no reschedule notification is
  introduced. Keep ordinary future admin scheduling working.
- Playback authorization: entitled viewers still obtain playback after assignment
  end; shortened dates do not change entitlement.
- Student UI: live badge appears without class_link, disappears on a fetched
  non-live response, and existing navigation remains intact.

## Out of Scope

- Changing the redundant admin isLive labels, counts or filters.
- Migrating existing year-long windows or reconstructing historical timestamps.
- Changing livestream retry delivery, queuing every transition, or adding
  producer timestamps. Delivery delays and skipped intermediate statuses remain
  accepted limitations.
- Restarting an ended Class; the user confirms this is not allowed.
- Reworking legacy Class-date schedule APIs, historical APX imports, recommendation
  ordering, or existing manual assignment-date controls.
- A realtime listing push system, new polling policy, or new notifications.
- Deployment or runtime implementation as part of creating this PRD.

## Further Notes

The [audit and discussion record](class-blinking-and-assignment-times.md) contains
source locations and branch observations. Authoritative vocabulary remains in the
[shared glossary](../../GLOSSARY.md) and linked owning-repo domain docs.

The existing [status-delivery decision](../adr/0002-stream-status-at-least-once.md)
retains only the latest pending transition. Actual timestamps are therefore best
effort observations at LMS receipt, not guaranteed broadcast event times. If live
or processing is skipped, the corresponding timestamp may remain missing; do not
silently invent it from ended or assignment placeholders. This limitation was
explicitly accepted during design.

Before implementation, verify the intended checkout and deployment targets.
The audit inspected local source, not the running production deployment. Follow
[branch discipline](../../BRANCHES.md) and the manifest's fork exceptions.
