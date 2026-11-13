# Seven-video retry completed — 27 October 2026

**All seven restored across11 existing course locations.**

| Video | Existing course locations | Retry result |
|---|---:|---|
| Glands 02 · Biology | 2 | Done; storage and production playback verified |
| Glands 03 · Biology | 2 | Done; storage and production playback verified |
| Glands 04 · Biology | 2 | Done; storage and production playback verified |
| Glands 05 · Biology | 2 | Done; storage and production playback verified |
| Internet | 1 | Done; storage and production playback verified |
| Internet 02 · Internet (2) | 1 | Done; storage and production playback verified |
| Internet 03 · Internet (2) | 1 | Done; storage and production playback verified |

All seven existing jobs succeeded on their first retry attempt after current same-asset source-row inputs were refreshed. The worker copied6408 segments and published24 distinct stored renditions. Every destination master/rendition was checked, with72 first/middle/last TS segment samples read from R2. Production admin-preview signing and real CDN delivery passed for all7 videos and72 further segment samples. Signed URLs stayed in memory; no learner views were recorded. These checks establish successful copying and bounded delivery tests, not full-duration decode or every buyer entitlement.

Execution was staged: Glands02 and Internet first; the other five were released only after both passed storage and production playback verification. Current source identity and per-quality inventory hashes matched the preceding complete-source survey, and fresh samples passed before retry.

The final audit confirms all36 blocked jobs byte-unchanged, all course placement records and catalogue ledgers unchanged, and zero active retry jobs. Only updatedAt,hlsAsset,streamStatus changed on the same seven Classes. Class IDs,titles,taxonomy,student progress/history and entitlements were preserved. The old legacy job unique-pair fields were retained; current download inputs changed to the verified AppX rows. Protected beforeimages/operations preserve the previous attempt counters and errors.

No backend/worker deployment,restart,new infrastructure,Quicktricks change,quality-drop workaround or source-segment skipping occurred. The two earlier source-gap canaries,historical jobs,Geometry replacements,PDF fixes and structure repairs remain excluded. This scoped operation does not deploy the proposed recurring recovery workflow.

Evidence: [result.json](result.json), [final-audit.json](final-audit.json), [storage-canary.json](storage-canary.json), [storage-rest.json](storage-rest.json), [playback-canary.json](playback-canary.json), [playback-rest.json](playback-rest.json), [source-preflight.json](source-preflight.json), [execution.md](execution.md). Completed 2026-10-27T12:04:47.863Z.
