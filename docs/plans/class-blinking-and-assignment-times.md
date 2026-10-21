# Class blinking and assignment times

Design discussion: 2026-09-11. Agreed behavior below is not yet implemented.
Implementation specification: [PRD](prd-class-blinking-and-assignment-times.md).
Accepted decision: [backend ADR 0021 — stream-derived class timing](../../../quicktricks-backend/docs/adr/0021-stream-derived-class-timing.md).
This note records cross-service changes; authoritative LMS models remain in
[CourseClass](../../../quicktricks-backend/src/models/CourseClass.ts) and
[Class](../../../quicktricks-backend/src/models/Class.ts).

## Agreed behavior

- Derive listing `isBlinking` from `Class.streamStatus === 'live'`, replacing
  date-window calculations. Apply consistently to class indicators and their
  section/topic aggregates.
- New assignments default to start = current time and end = the end of that
  calendar day in Asia/Kolkata (23:59:59.999), replacing the one-year default.
- On the first live status update, the LMS records its current time and replaces
  the start date on every assignment for that Class. If actual streaming starts
  on another day, the assignments move to that day's classes across courses.
- On the first processing status update, the LMS records its current time and
  replaces every assignment's end date. This marks stream finalization, not VOD
  readiness. Ended preserves the recorded end date.
- Duplicate updates and reconnecting-to-live transitions preserve the original
  actual start; duplicate processing updates preserve the original actual end.
- Use LMS receipt time. A producer timestamp or timestamp payload extension is
  not required by this design; webhook delivery delay is accepted.
- The user confirms ended classes cannot be streamed again. A new-session reset
  on the same ended Class is outside the requested behavior.
- Leave existing assignment dates untouched: no backfill or shortening of old
  one-year windows. Future live/processing updates still apply the agreed actual
  times. The stream-status blinking rule applies to existing listings too.
- Assignments created after streaming starts inherit captured actual start/end
  times when available. Missing actual times use the new-assignment defaults
  (now for start, end of the current IST day for end). A later processing update
  replaces the provisional end time on assignments created during a live stream.

## Evidence and implementation boundaries

- [Assignment creation and class listings](../../../quicktricks-backend/src/controllers/courseClassController.ts)
  currently set a one-year assignment window and derive blinking from effective
  dates. Today's listings use effective start dates.
- [Section/topic listing](../../../quicktricks-backend/src/controllers/courseController.ts)
  currently aggregates date-based blinking.
- [LMS status webhook](../../../quicktricks-backend/src/controllers/streamStatusController.ts)
  currently writes Class status and optional asset only; assignment updates and
  durable first-transition tracking require implementation.
- [Student card](../../../thedhronas/sharedComponents/cards/batch-course/BatchCoursePaidClassCard.tsx)
  additionally gates the badge on class_link; consumer behavior needs alignment.
- Livestream's backend/lib/streamLifecycle.js on the manifest's shared branch
  emits processing before starting VOD generation. Its status reporter retries
  the latest pending transition per class, rather than retaining event history.
  A missed intermediate live/processing transition can leave an actual timestamp
  uncaptured. The user explicitly deferred delivery changes; retain current retry
  behavior and accept this limitation for this work.
- Backend source inspected on feat/cloudflare-vod-cdn; student source on
  quicktricksbysahilsir-new. This was source verification, not deployment verification.

## Source audit findings

Audit completed 2026-09-11; no runtime code or production data changed.

| Surface | Finding and implementation consequence |
| --- | --- |
| Course today's classes | courseClassController.ts:915 uses UTC day boundaries; timetable at :1246 uses getIstDayBounds. Align the course endpoint to IST for the agreed day semantics. Both filter by start day, so an overnight stream remains on its starting day unless separately changed. |
| Admin schedule | classController.ts:665 uses server-local days and assignment date overlap. Its live filter (:675) and statusTag (:762) use dates or stored isLive, not streamStatus. Correcting isBlinking does not correct these separate labels. Aligning runtime labels is recommended, but is additional scope requiring agreement. |
| Notifications | courseClassNotificationMiddleware.ts:76 treats start changes via findOneAndUpdate as rescheduling, resets notificationSent, and invokes reschedulers. classNotificationScheduler.ts:90 schedules five minutes before start and skips past notification times. Actual-time propagation should preserve sent history, cancel obsolete reminders, and avoid treating going live as an admin reschedule. updateMany alone bypasses those hooks; it needs explicit reminder handling. The send-time guard compares dates with a one-minute tolerance (:66), so it is not a complete cancellation substitute. |
| Playback authorization | classAccessAuthz.ts:231 selects active placements and entitlement without assignment date checks. Shortening assignment end dates does not revoke playback through this authorization path. |
| Assignment creation | courseClassController.ts:178 is the regular new-assignment default. Reactivation (:146) reuses existing dates, consistent with leaving existing assignments untouched. APX porting is separate (apxPortingService.ts:218) and creates placements without explicit dates; do not impose today's defaults on historical imports globally at schema level. |
| Manual edits | courseClassController.ts:1866 and admin AssignedClassesView.tsx:138 allow date editing. Once actual times exist, these edits can diverge from the canonical actual timestamps. Whether to retain this override is unresolved. |
| Legacy Class-date consumers | scheduleController.ts reads Class dates, not assignment dates, and formats UTC; classController.ts also has Class-date admin filters and a date-window listing. Separate actual timestamp fields plus assignment updates will not automatically alter those APIs. Avoid rewriting Class.startDate/endDate incidentally. |
| Ordering | Today's listing sorts partly by effective start (:1147); moving start times intentionally changes order. Its last-watched fallback (:1188) still uses Class.startDate; keep this separate recommendation behavior visible in review. |
| Student indicator | BatchCoursePaidClassCard.tsx:162 requires both isBlinking and class_link. Remove the legacy link gate for the agreed indicator behavior. Topic/section badges consume the aggregate boolean. API changes become visible on refetch; immediate push updates are not part of this design. |

## Implementation requirements and remaining decisions

- Persist distinct actual start/end timestamps on Class, set once using LMS time.
  Propagate their saved values to assignments; retries must complete partial
  propagation without changing timestamps. Late-assignment creation must account
  for concurrent status changes so it cannot miss the propagation window.
- Keep actual timestamps server-owned, outside ordinary admin mutation payloads.
- Do not derive actual times from existing placeholder Class/assignment dates.
- Handle a delayed start on a later day: replacing only start can temporarily
  leave end before start because the default end belongs to the assignment day.
  Agreed: advance the expired provisional end to the actual start day's IST end,
  until processing supplies the actual end.
- The user explicitly excluded redundant admin isLive labels. Preserve existing
  manual date editing as an override (implementation scope assumption recorded
  in the PRD), and leave other legacy schedule APIs outside this change.
- Verify first live, reconnect and duplicate updates, first processing, late
  assignment, partial propagation retry, IST midnight, delayed start, notification
  cancellation/history, existing dates, and playback access after end.
- Preserve the user's explicit deferral of status-delivery reliability changes.
