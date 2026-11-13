# Connect the 46 courses and first release

**Type**: HITL
**Blocked by**: 04, 05
**Repo**: Prod, with the user

## What to build

The user approves each of the 10 price conflicts. Before any admin uses the new form on prod, confirm the two `courseSale` indexes on `Plans` exist. `autoIndex` never builds on prod, and without the unique one two saves at once can make two plans for one key. Deploy the backend first, because the strict update schema refuses unknown fields, then the admin. Run the tool for the 46 courses, recording the change and its restore command in `prod-data-changes`. Check real courses in the app.

## Acceptance criteria

- [ ] The user's price choices are recorded here.
- [x] Both `courseSale` indexes are confirmed built with `commitQuorum: 'majority'`, with no duplicate keys. (2026-11-06, all six indexes, `reference/scripts/vidyagram-course-selling-indexes.cjs`, 0 duplicates.)
- [ ] Backend and admin are live, using the surgical dist rule and a dist backup. (Backend live 2026-11-06 17:38 IST, d2aa025ab, backup `~/vg-dist-backup-20261106-1738-course-selling.tar.gz`. Admin not yet.)
- [ ] 46 courses are connected, with no new plans and order counts per plan unchanged.
- [ ] An edit on one connected course reaches its plan, and a test purchase works.
- [ ] The APX nightly's status and price writes are handled for connected courses, because `apxCourseStatusSync` skips the sync.

## What the 05 review found to plan for

- The first save after connecting sets the plan's `displayOn` to `['course']`, so the plan leaves the general Plans and packages screens.
  Students who found the course there won't any more. Decide whether that's wanted before running.
- Close Admission courses (`Course.price` null) go off sale at commit, not at the next save. New buyers are refused from that moment.
- Admins must not edit courses while `--commit` runs. A form opened before the commit sends price fields without `selling`, and that save is silently ignored.
- The tool's counts can differ from the probes' 46 / 10 / 26. It also skips Extension plans, offer plans and plans with an Upgrade offer.
- After connecting, other courses' pages no longer list a course's plan (`withoutOtherCoursesPlans`). This matters for strays in 17.
- An order on a course plan runs for the plan's duration, whatever duration the client sends (`orderDurationFor`).
- The connect tool's MRP fallback writes the course's struck-out price onto connected plans as MRP. That changes My plans' `credit` and `savePct`, which goes beyond the 10 price conflicts. Review the dry run's "first save changes" lines.
- `DURATION_PRICING_ENABLED` (task 07) is a save gate, not a kill switch. Turning it off leaves existing extra lengths on sale and refuses any save of those courses until a length is removed. Keep it off at this release.

## User stories covered

- Stories 53, 54
