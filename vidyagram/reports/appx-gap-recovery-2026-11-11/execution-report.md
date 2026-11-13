# AppX segment-gap videos: import from complete qualities (2026-11-11, Vidyagram 781)

**Result: all 33 imported and playing.** Each video now plays from the qualities AppX holds in full. The qualities with missing segments were left out of the menu.

- Ran 2026-11-11 16:25 to 2026-11-11 18:29 IST, one video at a time. The user's go-ahead was "yes build it and run it".
- Copied 23.7 GB to R2 `recordedvideos-vidyagram` under `781/<classId>/hls/`. The preview estimated about 25 GB, but its per-video numbers ran low (the first video came to 0.9 GB against 0.36 GB estimated); the total landed close anyway.
- **Final audit** (`final-audit.json`, run after the last copy) checked all 33 against `before.ejson`. All 33 jobs are `done`, and every Class has `hlsAsset` `781/<classId>/hls/master.m3u8` and `streamStatus` ended. Class status (1), `apxAssetKey` and all 96 placements (all active) are unchanged.
- **Playback**: a signed admin-preview walk per video (`playback-<classId>.json`) read the master, every quality, and the first, middle and last segment of each, with TS sync checked on every sample. All 33 passed, and each master lists exactly the planned qualities.

## How each video was done
1. Guards came first. The DB state had to match the snapshot (job `dead`, attempts and updatedAt unchanged, no video, same status). The AppX row had to be the same asset. Every planned quality's playlist had to keep the same inventory hash and segment count as the 11-11 scan.
2. The operation was written to `operation-<job>-a<attempts>.json`, then the job was claimed by compare-and-set (dead → claimed, attempts + 1).
3. The worker ran inside `apx-ingest-781` (image a75c030) on the bastion. Before copying it re-checked each playlist and ffprobed segment 0. It validated TS sync on every segment, published the master last with the standard `mirror-master.js` menu (complete qualities only; 144p only when there is no 1080p; 1080p last), then called the normal class-link and complete callbacks.
4. Completion check (job done, video set, placements hash unchanged), then the playback walk. The run was set to stop on the first failure, and none happened.

One false start: the first attempt on Trigonometry Class 02 (job 6ace9582c9735682f04ef311) failed before copying anything, because of a script bug where the job map was not filled in. That job was released back to `dead` (attempts 5 → 6), fixed, and then imported cleanly (attempts 7). Its operation files are `-a5` and `-a6`. Every other job went from 5 attempts to 6.

## Videos
| Title | AppX course/row | Menu | Copied (rung segments) | GB | Active placements | Attempts |
|---|---|---|---|---|---|---|
| Algebra Class 08 · ALGEBRA (बीजगणित ) | 15/9770 | 360p 480p 720p 1080p | 1080p 334, 480p 333, 360p 332 | 1.11 | 8 | 6 |
| Algebra Class 11 · ALGEBRA (बीजगणित ) | 15/9773 | 240p 360p 1080p | 1080p 322, 360p 320, 240p 321 | 1.01 | 8 | 6 |
| Algebra Class 16 · ALGEBRA (बीजगणित ) | 15/9779 | 240p 480p 720p 1080p | 1080p 308, 480p 308, 240p 306 | 0.83 | 8 | 6 |
| Algebra Class 19 | 15/9782 | 360p 480p 720p 1080p | 1080p 294, 480p 295, 360p 294 | 0.93 | 8 | 6 |
| Analogy 03 · Analogy | 22/15166 | 360p 480p 720p 1080p | 1080p 275, 480p 276, 360p 276 | 0.70 | 1 | 6 |
| Average Class 18 | 10/6463 | 144p 240p | 240p 365 | 0.13 | 10 | 6 |
| Botany 03 · BOTANY | 42/31407 | 360p 480p 720p 1080p | 1080p 299, 480p 299, 360p 299 | 0.88 | 1 | 6 |
| Botany 09 | 42/31414 | 240p 480p 720p 1080p | 1080p 363, 480p 363, 240p 363 | 0.85 | 1 | 6 |
| Carbon & Its Compouns 01 | 22/15706 | 144p 240p 480p 720p | 480p 314, 240p 314 | 0.33 | 1 | 6 |
| Class 13 (World Geography) | 22/16137 | 144p 240p 360p | 360p 300, 240p 300 | 0.25 | 1 | 6 |
| commission (आयोग) | 22/15990 | 144p 240p 360p | 360p 280, 240p 279 | 0.20 | 1 | 6 |
| Compound Interest Class 07 · Compound Interest (चक्रवृद्धि ब्याज) (3) | 17/11239 | 360p 480p 720p 1080p | 1080p 320, 480p 320, 360p 319 | 1.10 | 7 | 6 |
| Economics Class 03 | 22/15824 | 240p 480p 720p 1080p | 1080p 200, 480p 205, 240p 203 | 0.45 | 1 | 6 |
| Electric Potential | 42/31789 | 360p 480p 720p 1080p | 1080p 337, 480p 337, 360p 337 | 1.08 | 1 | 6 |
| IMPORTANT AWARD (महत्वपूर्ण पुरस्कार ) | 22/16484 | 480p 720p 1080p | 1080p 201, 480p 201 | 0.48 | 1 | 6 |
| PARLIAMENT 04 | 22/16237 | 360p 480p 720p 1080p | 1080p 235, 480p 235, 360p 235 | 0.53 | 1 | 6 |
| Periodic Table PYQs | 22/15716 | 144p 240p | 240p 322 | 0.10 | 1 | 6 |
| Preamble (CLASS 01) | 22/16186 | 360p 480p 720p | 480p 313, 360p 313 | 0.41 | 1 | 6 |
| Profit & Loss Class 12 · Profit & Loss (लाभ और हानि) (3) | 18/11652 | 240p 360p 1080p | 1080p 298, 360p 298, 240p 299 | 0.77 | 7 | 6 |
| Ratio 02 · RATIO (अनुपात) | 13/8149 | 360p 480p 720p | 480p 385, 360p 385 | 0.50 | 7 | 6 |
| Remainder Class 06 | 18/12067 | 240p 480p 720p 1080p | 1080p 300, 480p 300, 240p 300 | 0.86 | 7 | 6 |
| Similarity 03 | 22/15391 | 240p 360p 1080p | 1080p 311, 360p 311, 240p 312 | 0.70 | 1 | 6 |
| Statement - Assumption 02 | 22/15352 | 240p 480p 720p 1080p | 1080p 379, 480p 379, 240p 379 | 0.83 | 1 | 6 |
| SUPER SET-01 (HIGH LEVEL) | 87/42132 | 144p 240p 360p | 360p 950, 240p 950 | 0.66 | 1 | 6 |
| SUPER SET-06 (HIGH LEVEL) | 87/42137 | 144p 240p | 240p 827 | 0.16 | 1 | 6 |
| Trigonometry Class 02 · TRIGONOMETRY (6) | 25/18628 | 240p 480p 720p 1080p | 1080p 314, 480p 314, 240p 320 | 0.90 | 2 | 7 |
| Trigonometry Class 19 · TRIGONOMETRY (2) | 17/10970 | 1080p | 1080p 443 | 0.90 | 1 | 6 |
| Trigonometry Class 19 · TRIGONOMETRY (7) | 25/18648 | 240p 480p 720p 1080p | 1080p 443, 480p 442, 240p 442 | 1.48 | 2 | 6 |
| Work & Wages Class 01 · WORK & WAGES (4) | 45/33744 | 360p 480p 720p 1080p | 1080p 296, 480p 296, 360p 296 | 0.96 | 1 | 6 |
| अलंकार 02 · अलंकार | 22/16039 | 240p 480p 720p 1080p | 1080p 222, 480p 223, 240p 228 | 0.70 | 1 | 6 |
| तत्सम और तद्भव शब्द 02 | 22/16552 | 240p 360p 1080p | 1080p 225, 360p 225, 240p 226 | 0.50 | 1 | 6 |
| हिंदी साहित्य | 22/16028 | 360p 480p 720p 1080p | 1080p 375, 480p 377, 360p 375 | 1.24 | 1 | 6 |
| हिंदी साहित्य 02 | 22/16029 | 240p 360p 1080p | 1080p 415, 360p 415, 240p 433 | 1.15 | 1 | 6 |

AppX labels vs folders: AppX's "720p" is the /480p/ folder (854x480), so the menu shows 480p and 720p as the same rendition. "1080p" is 1600x900. 144p is an alias of 240p.

## Undo
For each video:
- Restore the job's `status`, `attempts`, `error` and `updatedAt`, and the Class's `hlsAsset`, `streamStatus` and `updatedAt`, from `before.ejson` (unset `hlsAsset`).
- Delete `781/<classId>/hls/` in `recordedvideos-vidyagram`.

Undo puts the classes back to "listed but won't play".

## Files
`plan.json`, `before.ejson` (mode 600, URLs stripped), `operation-*.json`, `execution-*.json` (the full run is `execution-2026-11-11T105909980Z.json`; the first video is in an earlier file), `playback-*.json`, `final-audit.json`.
Scripts are in `reference/scripts/`: `vidyagram-gap-recovery-apply.cjs` (driver) + `-apply-runtime.js`, `-worker.cjs` and `-write.cjs`.
