# "Exchange to" list on single-course plans

**Type**: AFK
**Blocked by**: None, can start immediately
**Repo**: backend + admin

## What to build

An admin opens a plan that holds exactly one course and picks the plans it can be exchanged for.

Backend:
- `Plans.exchangeToPlanIds: ObjectId[]`, default `[]`.
- Plan create and update reject a non-empty list with 400 in any of these cases:
  - the plan does not hold exactly one course;
  - any target does not exist;
  - any target does not hold exactly one course;
  - any target is the plan itself.
- Course ids in `Plans.course` are Mixed (ObjectId or string). Count and compare them in both forms.
- The plan read routes the admin uses return the field.

Admin:
- An "Exchange to" picker on the plan form, built from the Upgrade source-plans picker (search box, name
  sort).
- Its options are limited to single-course plans other than the current one.
- The picker shows only when the plan has exactly one course. When the course count changes away from one,
  the form clears the list.

## Acceptance criteria

- [ ] Integration: a single-course plan saves a list of two single-course targets, and a read returns them.
- [ ] Integration: a combo plan with a list, a course-less plan with a list, a combo target, a missing
      target and a self target each return 400 and write nothing.
- [ ] Integration: a plan whose `course` holds the id as a string is counted as single-course.
- [ ] Admin component test: the picker is hidden for a 2-course plan, shown for a 1-course plan, and sends
      the selected ids.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 18, 19, 20, 21, 22
