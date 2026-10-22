# Ranked tabs per kind

**Type**: AFK
**Blocked by**: 01
**Repo**: backend + admin

## What to build

The Feedback page becomes the dashboard: an Overview tab and one ranked tab per kind (Courses, Practice
batches, Classes, PDFs, Tests, Ebooks), worst first, with a drawer per item. Tabs for kinds that have no
registry entry yet render empty; they fill as 02, 03 and 04 land.

Backend, under `/api/admin/feedback`, same auth and permission as 01:
- `GET /overview?from&to`: per kind the count, average, low-rating count (1 or 2 stars), weekly trend.
- `GET /items?kind&from&to&parentKind&parentId&facultyId&sort`: one row per item with `id`, `title`,
  `count`, `average`, `lowCount`, `score`, top three tags with counts; paged. `score` per the README
  vocabulary.
- `GET /` gains the filters `kind`, `id`, `parentKind`, `parentId`, `facultyId`, `minRating`,
  `maxRating`, `tag`, `hasNote`, `from`, `to`.
- Live aggregation on the indexed collection. Record the `/items` response time on the local copy of
  `vidyagramdb` with seeded volume in the report; a rollup is out of scope unless it passes 1 s.

Admin:
- Tabs: Overview, then one per kind. Each kind tab is a ranked table (title, score, average, count,
  low count, top tags) with filters for date range, parent, star range, tag and "has a note".
- A row opens a drawer: star histogram, tag breakdown, weekly trend, notes list (student, mobile, date,
  consumed badge), served by `GET /` with `kind` and `id`.

## Acceptance criteria

- [ ] Integration: with kind mean 3, two five-star ratings score 3.33 and two hundred four-star ratings
      score 3.95; `items` best-first lists the second first.
- [ ] Integration: `items` filtered by a parent returns only content rated inside that parent.
- [ ] Integration: overview counts and low counts match a known fixture.
- [ ] Integration: each new `GET /` filter narrows the rows as named.
- [ ] Admin component tests: ranked order follows `score`; filters build the right query string; the
      drawer lists notes for the clicked item.
- [ ] Response time of `/items` recorded in the report.
- [ ] `NO NEW FAILURES` against both baselines.

## User stories covered

- Stories 9, 10, 12, 13, 14, 15, 16
