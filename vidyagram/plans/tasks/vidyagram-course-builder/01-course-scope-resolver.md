# One "what does this user own" check

**Type**: AFK
**Blocked by**: None — can start immediately
**Repo**: backend only

## What to build

Today five places in the backend separately decide whether a user owns a course. Replace them with one
function, `resolveCourseScope(userId, courseId, options?)`, and move every caller onto it **with no
change in behaviour**. This is the base the partial (chapter-level) scope builds on in task 05.

For now the function returns `{ kind: 'none' } | { kind: 'full' }`. Do not add the partial kind yet.

The five readers found during research (verify, there may be more):
1. Class access authz — `authorizeClassAccess` / `authorizeCourseAccess` / `ownedCourseIds` in the
   class access service (used by playback, downloads, realtime token).
2. PDF access issuance (falls back to the class or course rule).
3. The user test course gate (`allowUserTestCourse`, which reads purchased course ids).
4. The course access state flags service (is_buy / isExpired / daysLeft family).
5. The duplicate owned-course reader in the course-class controller.

"Owned" today means: an order with success status whose `courseId` or `latestCourseId` contains the
course, or whose plan's `course` list contains it. `Plans.course` is Mixed and holds both strings and
ObjectIds, so match both forms (see memory note `plan-entitlement-id-cast`). Expiry reads `expireDate`;
a null `expireDate` never expires. Callers differ on expiry today: the playback/PDF path only enforces it
behind `ENFORCE_ORDER_EXPIRY`, the listing and test paths always filter. Keep each caller's current
behaviour, for example with an `enforceExpiry` option. If two readers disagree on any other case, keep
each caller's current answer and list the difference in your report. Do not pick a winner.

Free checks (`Class.isFree`, placement `isFree`, `Course.isFree`, `Pdf.isFree`, `CourseTest.isFree`) are
not ownership. They stay in the callers.

## Acceptance criteria

- [ ] One resolver module; every course-ownership read in the five callers goes through it.
- [ ] The old reader functions are deleted, not left as wrappers, unless another caller outside this list
      still needs them (then say which).
- [ ] New resolver tests: no order; direct `courseId` order; `latestCourseId` order; plan carrying the
      course as a string and as an ObjectId; expired order with and without expiry enforcement; null
      `expireDate`; failed or pending order does not count.
- [ ] Existing suites: `NO NEW FAILURES` against `baseline-backend.txt`.
- [ ] Report lists every behavioural difference found between the old readers.

## User stories covered

- Story 41
