# Vidyagram copy-quality cross-check — 14 October 2026

## Finding

**Not all source qualities are copied. The source's separately served 1080p variant is omitted.**

Verified the deployed OCI container `apx-ingest-781` (image `apx-ingest-781:b8e9f79`), three completed database jobs, the corresponding R2 masters/media playlists/object listings, and fresh AppX token responses and source playlists. Source inspection was explicitly approved; no jobs, media, configuration or database records were changed and no playback view was registered.

## Source versus destination

All three sampled AppX responses advertise:

| AppX menu label | Source directory | Copied destination |
| --- | --- | --- |
| 240p | /240p/ | 240p.m3u8, complete |
| 360p | /360p/ | 360p.m3u8, complete |
| 480p | /480p/ | 480p.m3u8, complete |
| 720p | /480p/ (alias) | 480p.m3u8 (alias), complete |
| 1080p | /1080p/, HTTP 200, valid HLS | **Missing** |

The destination additionally advertises 144p, pointing at 240p.m3u8. Its five labels are 144p/240p/360p/480p/720p, but they reference only three distinct playlists. Source /720p/ directories return 404 in these samples; the AppX API's 720p label uses /480p/ instead. Actual encoded pixel dimensions of /1080p/ were not decoded in this audit; what is established is a separately served, advertised source variant with a valid playlist that is absent from the copy.

## Completed-job checks

| Class ID | Copied 240p segments | Copied 360p segments | Copied 480p segments | Source 1080p segments, omitted |
| --- | ---: | ---: | ---: | ---: |
| 6ace4d4c9e33840b2256c225 | 294 | 290 | 287 | 284 |
| 6ace4d519e33840b2256c22c | 643 | 632 | 634 | 634 |
| 6ace4d539e33840b2256c233 | 549 | 545 | 544 | 542 |

- All three jobs are `done`.
- All copied media playlists have `EXT-X-ENDLIST`.
- **4,418 referenced copied segments checked; zero missing R2 objects.** Source segment counts match destination counts for each copied variant.
- Three MP4 objects exist for the first class; the other two have none. The running worker has `MIRROR_MP4=off`, so current copies do not produce MP4 downloads. This is separate from the omitted HLS 1080p variant.

## Cause and scope

The deployed `mirror-rung-url.js` hardcodes `RUNGS = ['240p', '360p', '480p']`. Its comment explicitly excludes additional physical renditions under the old customer-472 policy. The deployed `mirror-master.js` advertises five labels over those three playlists, with 720p pointing to 480p.m3u8.

This inherited policy is unsuitable for Vidyagram videos that advertise a separate 1080p source variant. Successful completion validates only the selected three variants, so a `done` job does not mean all AppX qualities were archived.

The sample establishes the omission for these three classes and the selection behavior of the inspected deployed worker. It does not quantify how many of the full catalogue have 1080p. A correction should select Vidyagram's advertised distinct source variants, preserve genuine aliases, publish an honest matching master, and backfill higher variants for already-completed affected classes. No correction or deployment was performed by this read-only audit.

Output target confirmed: `STORAGE_PROVIDER=r2`, `CF_BACKUP_BUCKET=recordedvideos-vidyagram`, `CLIENT_ID=781`, `MIRROR_CLIENTS=781`.
