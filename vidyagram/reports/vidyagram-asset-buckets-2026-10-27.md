# Vidyagram assets: where they live, and what still points at AppX — 2026-10-27

Read-only. Tenant 781, `vidyagramdb` only. Every collection was scanned for http(s) URLs
(`reference/scripts/vidyagram-url-host-census.cjs`; `users`, `orders` and the large `apx_*` raw tables were sampled
at 50k), then a second probe (`vidyagram-appx-residue-probe.cjs`) checked playback and visibility. No writes.

## Where the migrated assets live

| Asset | Storage | Served from | Count |
|---|---|---|---|
| Recorded video (HLS, up to 1080p) | R2 `recordedvideos-vidyagram` (own bucket) | `vidyagram-recorded.hranker.org`, signed | 9,252 classes (`hlsAsset.bucket=recorded`, `781/…`) |
| Live recordings | R2 `livestream-vidyagram` (own bucket) | `vidyagram-live.hranker.org`, signed | 3 test classes |
| PDFs (notes + standalone) | B2 `hranker-private-assets` (shared, private) | Bunny `hranker-private-assets.b-cdn.net`, signed | 8,666 of 8,666 Pdfs (`pdfAsset.bucket=documents`, `781/…`) |
| Class thumbnails, banners, faculty, learn library, current affairs, invoices, testimonials | B2 `hranker-server-v2` (shared with quicktricks) | Bunny `hranker-server-v2.b-cdn.net` | 6,568 class images + small sets |
| Question/solution images, profile pics, package images, ebook PDFs | R2 behind `assets.hranker.org` (env names `hranker-server` as the migration bucket; not checked in Cloudflare) | `assets.hranker.org` | ~126k questions, ~9k sampled users, 44 packages |
| Certificates | R2 `vidyagram-certificates` (own bucket) | `vidyagram-certificates.hranker.org` | 1 |

Only video, live and certificates have Vidyagram-owned buckets. Everything else is in shared Hranker buckets under a
`781/` prefix. The 10-26 audit found no independent backup of any of these.

## Still served from AppX (students see these)

| What | Field | Hosts | Count |
|---|---|---|---|
| Course banners | `courses.banner` | `appx-content-v2.classx.co.in` 78, `appxcontent.kaxa.in` 2 | 80 courses, 44 of them active |
| Ebook covers | `ebooks.image1` | `appx-content-v2.classx.co.in` | 2 |
| Images inside question/solution HTML | `questions.question/solution`, copied into `testsectionquestionmaps.test[]` | `appxcontent.kaxa.in`, one `appx-content-v2` | ~8 questions, ~4 test maps |

Not AppX, but also not ours: 20 course banners are YouTube thumbnails (`i.ytimg.com`), and 1,215 classes (1,208
visible) play through YouTube links.

## Broken, not linked

372 student-visible classes have no playable video. Their only AppX reference is `apxAssetKey`, which no student route
reads, so they show up empty rather than pointing back at AppX:

- 239 external MP4/m3u8 sources (`migrationvideos.kaxa.in`, `migration-contents-v2.classx.co.in`,
  `liveclasses.cloud-front.in`) that were never mirrored (`MIRROR_MP4` is off on the worker).
- 133 failed ingest jobs (AppX `vid:`/`drm:` assets). These match the 10-27 backlog survey: 46 can be recovered now.

Another 113 hidden classes are in the same state.

## AppX URLs that are only provenance

- `classes.apxAssetKey` and `pdfs.apxAssetKey` hold the AppX source URL as a dedup key. Every Pdf also has our
  `pdfAsset`, and the backend reads `apxAssetKey` only in the import/ingest code.
- 204 class thumbnails have an AppX URL inside the object *name* (`…/thumbnails/url_https_//migrationvideos.kaxa.in/…`),
  but they are served from our Bunny zone.
- The `apx*` and `*_raw` collections (catalogue mirror, ingest ledgers, raw questions/test series/users/orders) are full
  of AppX hosts by design. That includes ~198k `static-appxdb-v2.akamai.net.in` question images, which are already
  re-hosted into `questions` on `assets.hranker.org`.

## Process dependency

The nightly sync on test-uday still pulls new classes and PDFs from AppX every night at 02:30 IST, so new content
keeps arriving from AppX until cutover.

## Re-host done (same day, user approved)

`reference/scripts/vidyagram-appx-image-rehost.cjs` COMMIT=1: 81 images copied to R2 behind `assets.hranker.org`, each
byte-checked against AppX; 78 course banners, 2 ebook covers, 1 question and its test map rewritten. The live catalogue
(`POST /api/courses/filter`) served the new URLs straight away. Backup and undo: box `~/vg-appx-image-rehost-2026-10-27/before.json`.

Left on AppX:
- ~~2 courses whose banner 404s at AppX's origin~~ — rescued the same day from an edge-cached copy (MD5 = AppX ETag)
  with `reference/scripts/vidyagram-banner-file-rehost.cjs`; both now on `assets.hranker.org`, 0 courses left on AppX.
  Undo: box `~/vg-banner-file-rehost-2026-10-27/before.json`.
- 13 question images (and their test-map copies) that AppX serves as 0-byte PNGs. The questions are mostly just the
  image, so students already see them blank. The images have to come from the client.

Several banners are 11–14 MB animated GIFs, the same bytes AppX served. `assets.hranker.org` answers `cf-cache-status: DYNAMIC`.

## Second pass, 2026-11-06

Six courses created after 10-27 had AppX banners again, because the importer copies AppX's URL when it creates a course.
These were UPSSSC MAINS, UPSSSC RO/ARO, UP Foundation, GS Special Decode, Railway Group D and Railway Station Master,
and there was 1 new question image. Same script, COMMIT=1: 7 images byte-checked onto `assets.hranker.org`, 8 fields
rewritten, 0 courses left on AppX. For the UPSSSC combo and its 3 sub courses, every course field, the 69 placed classes
(thumbnails on Bunny, 5 YouTube), their 74 PDFs (all `pdfAsset` in B2), faculty and plans hold no served AppX URL. The
only AppX strings left there are `apxAssetKey` provenance keys. Undo: box `~/vg-appx-image-rehost-2026-11-06/before.json`.

