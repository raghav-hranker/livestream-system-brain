# Proposed task breakdown

Parent: [PRD](../../prd-class-blinking-and-assignment-times.md)

Draft for breakdown review; implementation issues have not yet been published.
All four slices are AFK and include behavior tests with their implementation.
Deployment is not included. Backend work targets the Quicktricks fork and
coordinates applicable upstream parity under the existing branch discipline.

## 01 — Show live indicators from stream status

Type: AFK. Blocked by: none. User stories: 1–5.

Deliver the complete LMS listing-to-student-card path: class blinking is true only
for streamStatus live, and section/topic indicators aggregate that same truth.
Remove the student badge's dependency on class_link. Keep the existing refetch
lifecycle, visibility rules, navigation and playback metadata.

Acceptance criteria:

- [ ] Class, topic, section and timetable response indicators use runtime status.
- [ ] Missing status, preparing, reconnecting, processing and ended do not blink,
      even with dates containing now or a stored isLive value of true.
- [ ] A live class can render its badge without class_link; fetched non-live state
      removes it. Existing navigation works.
- [ ] Listing integration and focused UI verification cover contradictory dates,
      aggregate membership, visibility and protected asset non-disclosure.
- [ ] Admin isLive labels and livestream delivery remain unchanged.

## 02 — Create assignments with an IST day window

Type: AFK. Blocked by: none. User stories: 6–8, 15–16.

Deliver new regular assignment creation through today's listing: start defaults
to now, end to the current IST day's final millisecond, and course today's classes
uses IST consistently with the timetable. This slice establishes provisional
defaults; actual-time inheritance is added with the corresponding lifecycle slices.

Acceptance criteria:

- [ ] Regular new assignments use now through 23:59:59.999 Asia/Kolkata.
- [ ] Calendar behavior is independent of server timezone and correct on both
      sides of IST midnight; course today and timetable agree on day boundaries.
- [ ] Existing assignments, reactivations, and historical APX import defaults
      are unchanged; there is no backfill.
- [ ] Start-day membership remains unchanged for overnight classes.
- [ ] Assignment creation and listing integration tests prove these behaviors;
      entitled playback still works after assignment end.

## 03 — Record actual start and synchronize course assignments

Type: AFK. Blocked by: 02. User stories: 9–11, 13–15, 17.

Deliver first live receipt through durable actualStartedAt, assignment dates,
today's listings and reminder cancellation. Include assignments created after or
concurrently with the first live update: they inherit actual start rather than
getting a fresh placeholder. This keeps the schema, writer and its consumers in
one usable slice.

Acceptance criteria:

- [ ] First live captures LMS time once in server-owned actualStartedAt; ordinary
      admin payloads cannot write it and placeholder dates cannot seed it.
- [ ] Every assignment, including inactive ones, receives actual start without
      changing visibility/status. The class moves into its actual starting day.
- [ ] Absent or expired provisional ends advance to that starting day's IST end;
      later provisional ends remain until actual end is known.
- [ ] Reconnects and duplicates preserve actual start. Completed duplicate updates
      do not undo subsequent manual assignment-date overrides.
- [ ] Late assignments inherit actual start; concurrent creation cannot miss the
      capture/propagation boundary.
- [ ] Concurrent status calls and incomplete propagation retries preserve the
      original timestamp and converge without prematurely reporting success.
- [ ] Actual-start propagation preserves sent notification history, cancels or
      suppresses obsolete paid/free reminders, and sends no reschedule/live-start
      notification. Ordinary future admin scheduling still works.
- [ ] Handler/persistence and listing integration tests cover these cases, with
      explicit notification behavior tests and no producer delivery changes.

## 04 — Record actual finish and inherit completed stream times

Type: AFK. Blocked by: 03. User stories: 3, 12–16.

Deliver first processing receipt through durable actualEndedAt, every assignment's
end date, and new assignments created during/after finalization. Reuse the
consistency mechanism established for actual start and verify the complete live
to processing to ended path.

Acceptance criteria:

- [ ] First processing captures LMS time once as server-owned actualEndedAt and
      updates every assignment end without altering actual start or visibility.
- [ ] New assignments inherit captured actual start/end independently; each
      missing actual timestamp uses its PRD-defined provisional default.
- [ ] Concurrent assignment creation/finalization and partial failure retries
      converge using the original end time. Completed duplicates preserve later
      manual overrides.
- [ ] Ended never replaces end or invents missing actual timestamps, including
      prerecorded ended reports; existing asset handling remains compatible.
- [ ] Live → reconnecting → live → processing → ended integration demonstrates
      stable start, actual finish, correct returned dates and continued playback.
- [ ] Existing historical assignments are not migrated. Skipped intermediate
      statuses remain the explicitly accepted delivery limitation.

## Coverage and execution

Every PRD user story is covered above; stories repeated across slices represent
shared regression requirements. 01 and 02 have no functional dependency on each
other, although both touch listing code and should use coordinated integration.
03 follows 02; 04 follows 03. Tests belong to each behavior slice, not a separate
final test-only task. No architectural decision or human-operated migration is
required by these implementation tasks.
