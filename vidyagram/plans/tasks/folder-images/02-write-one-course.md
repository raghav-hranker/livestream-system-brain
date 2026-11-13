# Write pictures for one course

**Type**: AFK
**Blocked by**: 01, Dry run for one course, end to end
**Repo**: backend

## What to build

The dry run from task 01 gains `--commit`: it copies each picture to our CDN and stores it on the course's outline
row. This task proves the whole write path on one course against a local or scratch database. The prod run is task 03.

- **Store.** New collection `course_outline_images`, one document per (`course`, `level`, `node`), with the fields in
  the PRD's Schema section (`image`, `source`, `removed`, `apxCourseId`, `apxFolderId`, `apxImageUrl`, `setBy`,
  timestamps). `autoIndex: false` and `autoCreate: false`. Interface: `imagesForCourse(courseId)` and
  `setFromAppx(rows)`.
  - `setFromAppx` inserts or updates `source: appx` rows only. It never changes a row whose `source` is `admin`,
    including `removed: true` ones.
  - Leave `setByAdmin`, `removeByAdmin` and `returnToAppx` to phase 2.
- **Index script.** Builds the unique (`course`, `level`, `node`) index by hand, with `commitQuorum: 'majority'`.
  It refuses any DB but `vidyagramdb`, prints rs0 member health and refuses while a member is unhealthy. The dry run
  lists what is missing. Copy the pattern of `reference/scripts/vidyagram-certificate-indexes.cjs` and the backend's
  own index-build scripts.
- **Re-host.** `rehost(apxUrl)` → our CDN URL.
  - Uses the same bucket and client as the Vidyagram class thumbnails (`THUMBNAIL_B2_*`), under
    `781/course-outline/`.
  - The object key comes from a hash of the AppX URL, so one AppX picture is stored once and a changed AppX picture
    gets a new key.
  - Skips the upload when the object already exists and keeps a per-run memo.
  - A non-image response or a fetch failure returns a failure value. It never throws and stores nothing.
- **Commit.** `--commit` with `COURSE=<apxCourseId>` re-hosts and calls `setFromAppx`. Re-hosting failures go in the
  report and leave the row as it was. Re-running changes nothing.

## Acceptance criteria

- [ ] Store integration tests (mongodb-memory-server) cover:
  - the same topic in two courses keeps two pictures;
  - `imagesForCourse` returns only that course's rows;
  - `setFromAppx` never touches a seeded `admin` row or a seeded `removed` row;
  - the unique key refuses a duplicate.
- [ ] Re-host unit tests with fake storage cover:
  - the same URL twice gives one upload;
  - an existing object gives no upload;
  - a 404, a timeout or a non-image response gives a failure and nothing stored.
- [ ] Local end to end: against a local copy of course 103's data and a fake or scratch bucket, `--commit` writes
      42 topic rows with CDN URLs. A second run reports 0 changes.
- [ ] The index script's dry run lists the missing index. With `--commit` it builds the index on a local
      replica set.
- [ ] Backend suite: `NO NEW FAILURES`.

## User stories covered

- Story 5: same topic, different picture per course.
- Story 9: pictures live on our CDN, so they survive AppX cutover.
- Story 17: an admin's choice is never overwritten.
- Story 24: one upload per AppX picture.
- Story 25: safe to re-run.
- Story 26: every row records the AppX folder and URL it came from.
- Story 27: a dead AppX link leaves the row alone and lands in the report.
