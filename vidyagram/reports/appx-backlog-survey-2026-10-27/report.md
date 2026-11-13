# Failed-video backlog survey — 27 October 2026

**Read-only survey. All repairs remain on hold.**

183 of 183 failed-video jobs were checked against a fresh exact AppX source occurrence and asset identity. 133 belong to current courses according to the October26 mirror; 50 are historical. Current source row flags were checked live; full parent-folder visibility and every alternative course occurrence were not recaptured.

| Source result | Current videos | Historical videos | Total |
|---|---:|---:|---:|
| readable playlist | 47 | 3 | 50 |
| source manifest HTTP 404 | 4 | 6 | 10 |
| no playable URL returned | 82 | 41 | 123 |

**46 current videos passed the deeper source check**, covering **139 currently enabled course placements**. This requires the expected asset identity, an enabled/nondeleted source row, a readable media playlist and readable bounded samples from its first/middle/last segments. Source samples establish availability, not full-duration decoding, successful destination import or buyer entitlement. Encrypted sources may need normal worker decryption, which this survey did not exercise.

The deeper survey checked 50 readable sources. Five initial detail failures were resolved through a bounded complete course71 listing. A separate detail response triggered the client SessionLost safety stop; subsequent course-list authentication succeeded, and remaining media checks used course-list records instead. The safety stop did not establish a globally expired session. Completed: true. It walked one rendition per HLS master and read at most4096 bytes from each of three sample segments, without CMS cookies on media hosts. It did not modify or retry a job.

Current source decision table:

| Result | Videos |
|---|---:|
| Passed first/middle/last segment samples | 46 |
| Readable playlist, failed segment sample | 1 |
| AppX returned no playable URL | 82 |
| Source playlist still HTTP404 | 4 |

Incomplete source media:

- Periodic Table PYQs  — course 22, row 15716, job 6ace94dac9735682f04ef02b; sample failures: [{"index":321,"http":404,"bytesRead":507,"tsSync":false,"mp4":false,"looksLikeError":false,"mediaLike":false}]. Keep out of ordinary retry candidates until the missing media is resolved.

Examples of current recovery candidates:

- Surds & Indices 08 — AppX course 3, row 774; 14 course locations; job 6ace8ef7c9735682f04ed753.
- Mensuration 3D Class 12 — AppX course 3, row 907; 11 course locations; job 6ace8f53c9735682f04ed914.
- Average Class 18 — AppX course 10, row 6463; 10 course locations; job 6ace9257c9735682f04ee309.
- Ratio 02 — AppX course 13, row 8149; 7 course locations; job 6ace92b8c9735682f04ee4f3.
- Algebra Class 08 — AppX course 15, row 9770; 8 course locations; job 6ace92d2c9735682f04ee56f.

Examples still lacking a playable URL:

- Polygon 01 — AppX course 21, row 14219; job 6ace936cc9735682f04ee8bf.
- Polygon 02 — AppX course 21, row 14220; job 6ace936dc9735682f04ee8c2.
- Circle 01 — AppX course 21, row 14221; job 6ace936dc9735682f04ee8c4.
- Circle 02 — AppX course 21, row 14222; job 6ace936dc9735682f04ee8c7.
- Circle 03 — AppX course 21, row 14223; job 6ace936ec9735682f04ee8cb.

Database inventory: 2026-10-27T08:20:15.156Z. Initial source survey: 2026-10-27T08:05:54.049Z to 2026-10-27T08:17:20.392Z. Media walk completed: 2026-10-27T08:26:27.521Z. These are observed source results, not a promise that repairs will succeed. The two changed Geometry assets and two PDF repairs are separate from this183-job backlog. Historical assets are not proposed for restoration.

Evidence: [inventory.json](inventory.json), [live-source-survey.json](live-source-survey.json), [source-media-walk.json](source-media-walk.json), [summary.json](summary.json), [source-detail-fallback.json](source-detail-fallback.json), [source-media-walk-resume.json](source-media-walk-resume.json). Database joins: apxingestjobs.classId → classes._id / apxcatalogimports.classId / courseclasses.class. Student visibility count requires Class.status1 + CourseClass.status1/isActive true. 693 paced HTTP requests were made across all stages; 150 bounded video segment samples were read. No credentials or signed media URLs were saved.

Stored session use was explicitly authorized by the user for this read-only survey; the session was not changed or deleted. No temporary handoff was needed. **Production writes: zero. Newly imported/recovered items: zero.**

## Retry outcome — later on October27

The [authorized three-video retry](../appx-backlog-retry-2026-10-27/report.md) restored Glands01 in2 course locations. Surds08 and Mensuration3D12 failed on the same internal segment files as their original errors, despite passing sample checks. Remaining43 were not queued. Therefore the46 figure above remains a sampled source-candidate count; it must not be represented as46 fully verified/repair-ready recordings. Full source segment inventory checks are needed for old404 failures.
