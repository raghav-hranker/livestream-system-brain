# Course-made plans on the Plans page

**Type**: AFK
**Blocked by**: 03
**Repo**: Backend + admin

## What to build

Plans made by a course are hidden from the default Plans list, with a filter to see them. Opening one shows price, length and state locked, with a link to the course. Hand-made plans, reports and the bulk Extension dialog keep working.

## Acceptance criteria

- [ ] The default list leaves out course-made plans, and the filter shows them.
- [ ] The API refuses a change to a managed field, and accepts a form that resends stored values unchanged.
- [ ] Deleting a course-made plan from the Plans page is refused. `deletePlan` can set `status: 0` today, which cuts off buyers who only get access through the plan.
- [ ] Hand-made plan create and edit are unchanged.
- [ ] Orders and reports still group by plan id.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 48, 49, 50, 52
