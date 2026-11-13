# Four videos restored at complete available qualities — 27 October 2026

All four are restored across **six existing course locations**. Only complete source qualities were imported. The player lists actual probed resolutions, without advertising unavailable qualities.

| Video | Available playback qualities | Course locations |
|---|---|---:|
| काल | 144p, 480p | 1 |
| CLASS 01 | 360p, 480p | 1 |
| Size And Location (Practice Class) | 144p | 1 |
| Demo 01 (Percentage) | 480p | 3 |

Size And Location is available only at **144p**: its higher-quality source versions contain confirmed gaps. No lecture segments were skipped, no incomplete quality was published, and no upscaling was performed.

All 2,262 selected source segments were copied, producing six distinct renditions. Origin storage and signed production admin-preview playback passed, including first/middle/last samples in every rendition (18 origin and 18 CDN samples). These checks establish successful complete copying and sampled playback; the entire duration was not decoded frame by frame. No learner views were recorded.

All four ingest jobs are done, with no selected job still active. The other 32 blocked jobs are byte-unchanged. Course placements and catalogue ledgers are byte-unchanged. Class IDs were preserved; only updatedAt, hlsAsset and streamStatus changed on the Classes. No student progress writes, deployment, worker restart or persistent worker configuration change was part of this recovery.

The isolated command initially failed before any worker execution; no Class changed. The quoting issue was corrected, a harmless command test passed, and the exact failed-job state was checked before the guarded resume. The first successful recovery then passed storage and production playback before the remaining three proceeded. The original and resume beforeimages are retained with restricted permissions.

Evidence: [result](result.json), [source-quality proof](source-qualitycheck.json), [execution](execution.json), [storage](storage.json), [production playback](playback.json), [before/after audit](final-audit.json), and [execution details](execution.md).
