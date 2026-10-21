# PRD: Plan Broadcast Audience Rules (Advanced mode)

Status: ready-for-agent · Repos: quicktricks-backend (fork, branch `quicktricks-admin`), quicktricks-admin (fork, branch `quicktricks-admin`) · Designed 2026-09-30

## Problem Statement

In the admin notification composer, a **Subscription Plan Broadcast** couples two things to the one
plan the admin picks: where the notification opens (the Plans page with that plan) and who is kept out
of the audience (that plan's active holders — the "exclude buyers" rule live since 2026-09-29).

An admin running a promotion cannot control the audience beyond that. They cannot:

- send a 2027 batch upsell only to people currently on the 2026 plan who have not bought 2027 yet;
- win back only the lapsed buyers of a plan, without reaching every prospect on the platform;
- announce something to the current holders of a plan while opening the Plans page;
- target the buyers of an off-sale (inactive) plan with a successor plan's offer.

Everything today is either "everyone except this plan's active holders" or a plain General broadcast.

## Solution

The Subscription Plan Broadcast gets two audience modes:

- **Default** — exactly today's behaviour, zero extra friction: the promoted plan's active holders are
  excluded, everyone else with a push token receives it.
- **Advanced** — the admin builds the audience from up to five **audience rows**. Each row is one
  (base) plan with three checkboxes — **Active**, **Expired**, **Never bought** — meaning "for this plan,
  the user's state must be one of the ticked ones". Rows combine with **AND**. Switching to Advanced
  pre-fills one row for the promoted plan with *Expired + Never bought* ticked, so the switch is
  behaviour-neutral until the admin edits it.

The promoted plan keeps its one job — the tap destination. The audience plans are chosen separately, so
a notification can promote plan A to an audience defined by plan B.

A live, exact recipient-device count updates as the rows change, and the notification cannot be sent or
scheduled while that count is zero. The chosen mode and rows are saved on the notification and shown in
history; the audience itself is resolved at send time, and the resolved count is recorded.

Reading a row, for reference:

| Ticked | Audience for that plan |
|---|---|
| Active + Expired | everyone who ever held the plan ("all users of this plan") |
| Active | current holders |
| Expired | lapsed holders (win-back) |
| Never bought | prospects |
| Expired + Never bought | everyone except current holders (= Default) |
| all three | the whole platform — the row filters nothing (allowed, with a hint) |

## User Stories

1. As an admin, I want the Subscription Plan Broadcast to keep working exactly as it does today by default, so that routine plan promos stay a one-picker task.
2. As an admin, I want to switch a Subscription Plan Broadcast into an Advanced audience mode, so that I can control precisely who receives it.
3. As an admin, I want Advanced mode to open with a row for the promoted plan pre-ticked Expired + Never bought, so that switching modes does not silently change who receives the notification.
4. As an admin, I want to pick audience plans independently of the promoted plan, so that I can promote one plan to the holders of another.
5. As an admin, I want each audience row to offer Active, Expired and Never bought checkboxes, so that I can target current holders, lapsed holders, prospects, or any combination.
6. As an admin, I want rows to combine with AND, so that I can express upsells like "active on the 2026 plan and never bought the 2027 plan".
7. As an admin, I want to add up to five rows, so that I can express multi-plan conditions without the form turning into a segment builder.
8. As an admin, I want to remove any row, including the pre-filled promoted-plan row, so that I am not forced to filter on the promoted plan.
9. As an admin, I want the form to stop me from saving a row with no checkbox ticked, so that I never send to nobody by accident.
10. As an admin, I want a hint when all three checkboxes of a row are ticked, so that I understand that row now matches every user rather than "all buyers of this plan".
11. As an admin, I want the form to stop me from adding the same plan twice, so that rows cannot contradict each other.
12. As an admin, I want Advanced mode to require at least one row, so that an empty Advanced list can never become an accidental platform-wide send.
13. As an admin, I want the audience plan picker to list off-sale (inactive) plans with an "Off-sale" badge, so that I can target buyers of retired plans who still have access.
14. As an admin, I want the audience picker to list base plans only, so that I do not have to reason about extension plans separately.
15. As an admin, I want a holder of a plan's extension to count as a holder of the base plan, so that a renewal promo does not hit someone who just renewed.
16. As an admin, I want a user with both an expired and an active order on a plan to count as Active, so that current holders are never treated as lapsed.
17. As an admin, I want voided, failed and pending orders to count as never bought, so that abandoned checkouts and voided grants do not make someone a "buyer".
18. As an admin, I want free and admin-granted orders to count as holding the plan, so that people with access are treated the same whether or not they paid.
19. As an admin, I want a live, exact count of recipient devices as I edit the rows, so that I know the reach before I send.
20. As an admin, I want Send and Schedule disabled when the count is zero, so that I do not publish a notification that reaches no one.
21. As an admin, I want my rows kept when I toggle between Default and Advanced while composing, so that I can compare without re-entering them.
22. As an admin, I want whichever mode is selected at save time to be the one stored, so that what I see is what is sent.
23. As an admin, I want a scheduled notification's audience to be evaluated when it is sent, so that people who buy in the meantime are handled correctly at send time.
24. As an admin, I want to edit the mode and rows of a notification that is still scheduled, so that I can correct a campaign before it goes out.
25. As an admin, I want resending a notification to re-apply its saved audience rules, so that a resend reaches the audience the rules describe now.
26. As an admin, I want notification history to show whether a broadcast used Default or Advanced, and which rows, so that I can audit who a campaign was aimed at after the 10-day delivery logs expire.
27. As an admin, I want the history to show the recipient count resolved at send time, so that I can compare estimate against actual reach.
28. As an admin, I want notifications created before this change — including ones already scheduled — to behave as Default, so that the rollout changes nothing for existing campaigns.
29. As a student who currently holds a plan, I want not to receive that plan's promotion under Default, so that I am not upsold something I already own.
30. As a student excluded by a notification's audience, I want it absent from my in-app notification list too, so that the in-app list matches what was pushed to me.
31. As an operator, I want the backend to reject invalid audience settings (bad mode, zero or more than five rows, duplicates, empty checkboxes, non-base or unknown plans) even if a client bypasses the form, so that the API is the source of truth.
32. As an operator, I want the backend to ship before the admin UI and treat a missing mode as Default, so that the deploy order cannot break the live admin.

## Implementation Decisions

**Scope.** Audience rows apply only to the Subscription Plan Broadcast type (connectWith general + open
page Plans + a promoted plan). Other notification types are unchanged. The stored shape is type-neutral
so other types can adopt it later without a model change.

**Unit of targeting: plan, not course.** A user's state is derived from orders on the plan (plus its
extension plans) by plan id. A direct course purchase, or a different plan that happens to carry the
same courses, does not count. Batch/course targeting was explicitly deferred to avoid confusion with the
existing "Specific Plans / Specific Course" paid-unpaid-by-batch types.

**Schema — Notification.** Two new optional fields:
- `audience`: `{ mode: 'default' | 'advanced', rules: [{ planId, planName, states: ('active' | 'expired' | 'never')[] }] }`. `planName` is a display snapshot for history. `rules` is empty/absent in Default mode.
- `resolvedAudienceCount`: number of users the audience resolved to at send time (recorded alongside the existing recipient/success/failure counts).
A notification without `audience` (all existing documents, including ones already scheduled) is Default.

**Module 1 — Plan state resolver (backend, deep).** Interface: given a set of base plan ids and "now",
return, per base plan, a map of userId → `active | expired`; users absent from the map are
`never`. Internally it expands each base plan to its family (the base plus every plan whose extension
base is that plan), loads successful, non-voided orders for the family in one query per family, and
classifies each user with best-state-wins (any active ⇒ active; else any expired ⇒ expired). Active /
expired use the existing plan-extension order predicates (the ones that treat a missing expire date via
days-left), so this feature shares one definition of "active" with plan extension and the Default-mode
exclusion. Free and admin-assigned orders count. Order `planId` is stored as a string — query with the
string form (and guard for mixed forms, per the known `Plans.course` id-cast trap). The per-user
classification is a pure function over order rows.

**Module 2 — Audience rule compiler (backend, pure, deep).** Interface: `(rules, statesByPlan) →
{ includeUserIds?: Set, excludeUserIds: Set }` — the same target-rules shape the send loop and
estimator already consume. Per row with ticked set S:
- if S lacks `never` ⇒ the user must be a holder whose state ∈ S — contributes an include constraint;
  multiple include constraints are intersected;
- if S contains `never` ⇒ holders whose state ∉ S are excluded — contributes to the exclude union;
- all three ticked ⇒ contributes nothing.
Default mode compiles to today's rule (exclude the promoted plan's active holders), so both modes flow
through one path.

**Module 3 — Audience settings validation (backend).** One normaliser used by create, update (while
scheduled), and the audience-estimate endpoint: mode ∈ {default, advanced}; missing mode ⇒ default;
advanced requires 1–5 rows, unique plan ids, each with a non-empty subset of the three states, each plan
existing and being a base plan (not an extension). Inactive plans are allowed. Rejects with 400 and a
field-level message.

**Module 4 — Wiring (backend).**
- The target-rule builder used at send time delegates plan-broadcast audiences to modules 1–3; audience
  is still resolved at send time (immediate send, scheduler, and resend all re-resolve).
- `resolvedAudienceCount` is written when the send job resolves its audience.
- The audience-estimate endpoint accepts the audience settings and returns an **exact** count of users
  with a valid push token who match (no longer the approximate "token users minus buyers" subtraction
  for this type). Accept a count latency of a second or two for large "Never bought" audiences.
- Create / schedule / update refuse to persist a Subscription Plan Broadcast whose exact count is 0.
- The plan list used by the audience picker returns base plans only, including inactive ones, with an
  active/inactive flag for the badge. The promoted-plan picker is unchanged.

**Module 5 — Audience rows editor (admin, isolated component).** Controlled component, no data fetching
of its own beyond the injected plan-search source: rows of (plan picker, three checkboxes), add/remove,
max 5, duplicate prevention, per-row "tick at least one" error, "matches every user" hint when all three
are ticked, "Off-sale" badge for inactive plans.

**Module 6 — Notification form wiring (admin).** Default/Advanced toggle shown only for the
Subscription Plan Broadcast type; switching to Advanced pre-fills the promoted-plan row with
Expired + Never bought; rows persist in form state across toggles; the saved mode is the selected one;
live estimate sends the audience settings; Send/Schedule disabled at count 0 and while the count is
loading; history/detail shows mode, rows (by snapshot name) and resolved count; editing a scheduled
notification loads its saved mode and rows.

**API contract changes.**
- `POST /api/notifications` and the scheduled-notification update accept `audience` as above.
- `POST /api/notifications/audience-estimate` accepts `audience`; for a Subscription Plan Broadcast it
  returns an exact count (`isApproximate: false`).
- Missing `audience` everywhere ⇒ Default (backward compatible with the admin currently deployed).

**Rollout.** Backend first (missing mode ⇒ Default, so the live admin and queued scheduled
notifications are unaffected), then the admin UI. First real Advanced send: a small row set (e.g.
Active on a plan with a handful of holders), then compare the recorded count and the delivery log
against the rows. Fork repos: push to `quicktricks-admin` on both forks; backend deploy is box pull +
surgical dist + pm2 restart; admin deploys via Vercel. No co-author trailers on fork commits.

## Testing Decisions

A good test here exercises external behaviour only: given orders and rules, who is in the audience;
given settings, whether they are accepted. It does not assert query shapes or internal helper calls
beyond what is needed to stub the database.

- **Module 1 — state resolver (unit, `node:test`):** best-state-wins across multiple orders; extension
  orders fold into the base plan; voided / failed / pending ⇒ never; free and admin-assigned count;
  missing expire date resolved via days-left; string/ObjectId plan-id forms both matched.
- **Module 2 — rule compiler (unit, pure):** every row in the "reading a row" table; AND of an include
  row and an exclude row (the 2026→2027 upsell); intersection of two include rows; all-three row is a
  no-op; Default mode compiles to exactly today's exclusion.
- **Module 3 — validation (unit):** missing mode ⇒ default; advanced with 0 or 6 rows, duplicate plans,
  empty states, unknown or extension plan ⇒ rejected; inactive base plan ⇒ accepted.
- **Integration (one test, real Mongo, `src/tests/integration`):** seed users with tokens and orders
  (including an extension order and a voided order); assert the exact estimate count equals the
  audience the send path resolves, for one Default and one Advanced upsell configuration.
- **Module 5 — admin component test (vitest + Testing Library):** add/remove rows, max 5, duplicate
  prevention, empty-row error, all-three hint, off-sale badge.
- **Module 6:** no automated test; verified by the rollout check on prod.

Prior art: the backend plan-broadcast notification unit test (stubbed `Order.find`, fixed `now`,
`node:test`), the plan-extension unit and integration tests, and the admin's existing component tests
such as the course form test.

## Out of Scope

- Targeting by course/batch (direct course purchases or other plans carrying the same courses).
- OR combinations, nested rules, or more than five rows — send two notifications instead.
- Audience rows on any notification type other than Subscription Plan Broadcast.
- Hand-picked user lists, CSV audiences, or a preview of the actual recipient users.
- Separating paid from free/admin-granted holders.
- A cancel control for an in-flight send (today only a process restart stops one).
- A small-population "test send" mode.
- Unifying the older paid/unpaid-by-batch "active order" predicate with the plan-extension one for the
  other notification types.
- Snapshotting the resolved user list; only the count is recorded.

## Further Notes

- Design settled in a grilling session on 2026-09-30; builds on the "exclude buyers" change
  (backend `e05d257e5` / `9ea6843e9`, admin `fa72313`, live 2026-09-29).
- "Never bought" is most of the user base; a row with all three ticked is the whole platform, not
  "all buyers of this plan" (that is Active + Expired). The UI hint exists because this is the likeliest
  misreading.
- Delivery logs expire after 10 days and drive the in-app list; excluded users therefore never see the
  notification in-app either. The saved rules plus `resolvedAudienceCount` are the long-lived audit trail.
- Notifications have no cancel; the zero-count guard and the rollout check are the safety net.
