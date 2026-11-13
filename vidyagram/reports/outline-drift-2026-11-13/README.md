# Course outline drift vs AppX — 2026-11-13

Read-only scan: `reference/scripts/vidyagram-outline-drift-scan.cjs`, run on test-uday from the nightly checkout. It uses the
nightly planner (latest capture of every course) to work out the filing and order the placement step would give each
class today, and compares that with the CourseClass rows. The nightly never updates a row once it exists. Raw output:
`drift.jsonl` (one line per course + totals).

## Totals (137 courses with a Course, 31,749 planned rows; 42 courses on sale)

| Drift | Courses (on sale) | Rows (on sale) |
|---|---|---|
| Topic groups in another order than AppX | 20 (10) | 326 (192) |
| Classes in another section/topic/subtopic | 12 (7) | 56 (45) |
| Classes out of order inside their topic | 12 (7) | 38 (24) |
| Active classes AppX doesn't have | 3 (3) | 3 |
| AppX classes we lack | 0 | 0 |

Course 175 (fixed earlier today) scans clean.

## Notes
- **Topic order is the main drift.** Worst on-sale: 107 UPSI दरोगा जी (57 topic groups out of place), 105 Railway Foundation 2.0
  (32), 160 Combo SSC CGL Mains (30), 151 प्रहार 4.0 (27), 158 GS Special 4.0 (19). None of these courses has a hand-set topic
  order (0 active `coursetopics` rows), so the website orders topics by their first class's priority, which is the stale
  import order.
- **Section/topic moves** are mostly AppX reorganising folders: 160/162 English split into Grammer / Comprehension, and
  4 GS courses moved 2 classes DPSP → President. Some may be a class AppX lists in two folders; the plan keeps the first.
  Check before refiling.
- **No admin-edit signal.** Almost every row was rewritten on 11-04 by the placement-dates apply, so "updated after create"
  can't tell admin edits apart. There are no hand-set topic orders. Before the nightly re-sorts anything, it needs a
  marker that an admin moved a row.
- Extra active rows: one each in 152, 169, 170 (not looked at).

## Fix applied 2026-11-13 08:31 UTC
Topic order fixed in the 10 on-sale courses (101, 104, 105, 107, 150, 151, 158, 160, 162, 164) with
`reference/scripts/vidyagram-course-order-sync.cjs`: 3,453 class priorities set to the planner's AppX rank, sections and topics
untouched. Re-scan `drift-after-order-sync.jsonl`: 0 on-sale courses with topic-order drift. 10 off-sale courses still have it.
