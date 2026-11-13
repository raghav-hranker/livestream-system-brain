# Vidyagram: recovery preview for the 33 AppX segment-gap videos — 11 November 2026

**All 33 can be recovered from their complete AppX qualities.** That means 84 renditions, about 25.0 GB in R2, estimated as segment 0 × segment count. Nothing has been written. This is the plan an apply run would carry out, and it needs the user's go.

## What is true now

- All 33 ingest jobs are `dead` with `fetch … failed: 404`, after 5 attempts each.
- All 33 Classes are status 1 with no `hlsAsset`. They sit in **96 active course placements**, so students can see these classes today, but they won't play.
- Source: `current-state.json`, read from the vidyagramdb primary, read-only.

## What was checked today

Each video got a fresh AppX token at its 10-29 course/row, and AppX still lists it with the same asset. Every quality was re-read: all 125 playlists match the 11-11 scan, segment for segment. For each of the 84 complete qualities, segment 0 was downloaded whole and run through ffprobe. The dimensions match what the Vidyagram quality menu expects: AppX "1080p" = 1600x900 (24), "720p" = 854x480 (21), 360p = 638x360 (19), 240p = 256x144 (20). Requests: 209 media and 47 CMS. The Glands01 control passed at the start and at the end. 0 production writes. No URLs, cookies or tokens were saved.

## What apply would do, per video

1. Guard: the job is still `dead` with the same attempts and updatedAt, the Class still has no `hlsAsset`, the AppX asset key is unchanged, and the playlist inventory hash and segment count match `plan.json`.
2. Claim the job by compare-and-set, `dead`→`claimed`, and save the operation record first, as on 10-29.
3. Copy each planned rendition with the deployed `apx-ingest-781` mirror code on the OCI bastion. The worker validates every segment body (TS sync bytes) and fails the whole video on any miss. It never skips a segment.
4. Write the master last, using the standard Vidyagram menu (`mirror-master.js`, one file per label): 1080p as 1920x1080; 720p and 480p as byte copies of the 854x480 playlist; 360p; 240p, plus 144p only when there is no 1080p. **Only labels whose rung is complete appear.**
5. The job is reported done, and the Class gets its `hlsAsset` through the normal callback. Class status and placements are not touched.
6. Check the R2 objects and a signed admin-preview walk (master → each rung → first, middle and last segment) before the next video starts.

Menus the 33 would get:

- `1080p 720p 480p 360p`: 9
- `1080p 720p 480p 240p`: 8
- `1080p 360p 240p`: 5
- `240p 144p`: 3
- `360p 240p 144p`: 3
- `720p 480p 360p`: 2
- `720p 480p 240p 144p`: 1
- `1080p 720p 480p`: 1
- `1080p`: 1

The gaps are the qualities left out: viewers on those videos see fewer menu entries. Three videos would be 240p only: Average Class 18, Periodic Table PYQs and SUPER SET-06.

## Per video

| Course/row | Video | Copies | Left out | Menu | Est. MB | Active placements |
|---|---|---|---|---|---|---|
| 15/9770 | Algebra Class 08 · ALGEBRA (बीजगणित ) | 1080p (1600x900, 334), 720p (854x480, 333), 360p (638x360, 332) | 240p | 1080p 720p 480p 360p | 951 | 8 |
| 15/9773 | Algebra Class 11 · ALGEBRA (बीजगणित ) | 1080p (1600x900, 322), 360p (638x360, 320), 240p (256x144, 321) | 720p | 1080p 360p 240p | 885 | 8 |
| 15/9779 | Algebra Class 16 · ALGEBRA (बीजगणित ) | 1080p (1600x900, 308), 720p (854x480, 308), 240p (256x144, 306) | 360p | 1080p 720p 480p 240p | 613 | 8 |
| 15/9782 | Algebra Class 19 | 1080p (1600x900, 294), 720p (854x480, 295), 360p (638x360, 294) | 240p | 1080p 720p 480p 360p | 444 | 8 |
| 22/15166 | Analogy 03 · Analogy | 1080p (1600x900, 275), 720p (854x480, 276), 360p (638x360, 276) | 240p | 1080p 720p 480p 360p | 653 | 1 |
| 10/6463 | Average Class 18 | 240p (256x144, 365) | 1080p, 720p, 360p | 240p 144p | 140 | 10 |
| 42/31407 | Botany 03 · BOTANY | 1080p (1600x900, 299), 720p (854x480, 299), 360p (638x360, 299) | 240p | 1080p 720p 480p 360p | 1894 | 1 |
| 42/31414 | Botany 09 | 1080p (1600x900, 363), 720p (854x480, 363), 240p (256x144, 363) | 360p | 1080p 720p 480p 240p | 555 | 1 |
| 22/15706 | Carbon & Its Compouns 01 | 720p (854x480, 314), 240p (256x144, 314) | 360p | 720p 480p 240p 144p | 287 | 1 |
| 22/16137 | Class 13 (World Geography) | 360p (638x360, 300), 240p (256x144, 300) | 720p | 360p 240p 144p | 301 | 1 |
| 22/15990 | commission (आयोग) | 360p (638x360, 280), 240p (256x144, 279) | 720p | 360p 240p 144p | 201 | 1 |
| 17/11239 | Compound Interest Class 07 · Compound Interest (चक्रवृद्धि ब्याज) (3) | 1080p (1600x900, 320), 720p (854x480, 320), 360p (638x360, 319) | 240p | 1080p 720p 480p 360p | 1127 | 7 |
| 22/15824 | Economics Class 03 | 1080p (1600x900, 200), 720p (854x480, 205), 240p (256x144, 203) | 360p | 1080p 720p 480p 240p | 524 | 1 |
| 42/31789 | Electric Potential | 1080p (1600x900, 337), 720p (854x480, 337), 360p (638x360, 337) | 240p | 1080p 720p 480p 360p | 893 | 1 |
| 22/16484 | IMPORTANT AWARD (महत्वपूर्ण पुरस्कार ) | 1080p (1600x900, 201), 720p (854x480, 201) | 360p, 240p | 1080p 720p 480p | 559 | 1 |
| 22/16237 | PARLIAMENT 04 | 1080p (1600x900, 235), 720p (854x480, 235), 360p (638x360, 235) | 240p | 1080p 720p 480p 360p | 760 | 1 |
| 22/15716 | Periodic Table PYQs | 240p (256x144, 322) | 1080p, 720p, 360p | 240p 144p | 185 | 1 |
| 22/16186 | Preamble (CLASS 01) | 720p (854x480, 313), 360p (638x360, 313) | 240p | 720p 480p 360p | 227 | 1 |
| 18/11652 | Profit & Loss Class 12 · Profit & Loss (लाभ और हानि) (3) | 1080p (1600x900, 298), 360p (638x360, 298), 240p (256x144, 299) | 720p | 1080p 360p 240p | 1105 | 7 |
| 13/8149 | Ratio 02 · RATIO (अनुपात) | 720p (854x480, 385), 360p (638x360, 385) | 240p | 720p 480p 360p | 274 | 7 |
| 18/12067 | Remainder Class 06 | 1080p (1600x900, 300), 720p (854x480, 300), 240p (256x144, 300) | 360p | 1080p 720p 480p 240p | 474 | 7 |
| 22/15391 | Similarity 03 | 1080p (1600x900, 311), 360p (638x360, 311), 240p (256x144, 312) | 720p | 1080p 360p 240p | 452 | 1 |
| 22/15352 | Statement - Assumption 02 | 1080p (1600x900, 379), 720p (854x480, 379), 240p (256x144, 379) | 360p | 1080p 720p 480p 240p | 1468 | 1 |
| 87/42132 | SUPER SET-01 (HIGH LEVEL) | 360p (638x360, 950), 240p (256x144, 950) | 720p | 360p 240p 144p | 633 | 1 |
| 87/42137 | SUPER SET-06 (HIGH LEVEL) | 240p (256x144, 827) | 720p, 360p | 240p 144p | 155 | 1 |
| 25/18628 | Trigonometry Class 02 · TRIGONOMETRY (6) | 1080p (1600x900, 314), 720p (854x480, 314), 240p (256x144, 320) | 360p | 1080p 720p 480p 240p | 359 | 2 |
| 17/10970 | Trigonometry Class 19 · TRIGONOMETRY (2) | 1080p (1600x900, 443) | 720p, 360p, 240p | 1080p | 1456 | 1 |
| 25/18648 | Trigonometry Class 19 · TRIGONOMETRY (7) | 1080p (1600x900, 443), 720p (854x480, 442), 240p (256x144, 442) | 360p | 1080p 720p 480p 240p | 2205 | 2 |
| 45/33744 | Work & Wages Class 01 · WORK & WAGES (4) | 1080p (1600x900, 296), 720p (854x480, 296), 360p (638x360, 296) | 240p | 1080p 720p 480p 360p | 1551 | 1 |
| 22/16039 | अलंकार 02 · अलंकार | 1080p (1600x900, 222), 720p (854x480, 223), 240p (256x144, 228) | 360p | 1080p 720p 480p 240p | 629 | 1 |
| 22/16552 | तत्सम और तद्भव शब्द 02 | 1080p (1600x900, 225), 360p (638x360, 225), 240p (256x144, 226) | 720p | 1080p 360p 240p | 755 | 1 |
| 22/16028 | हिंदी साहित्य | 1080p (1600x900, 375), 720p (854x480, 377), 360p (638x360, 375) | 240p | 1080p 720p 480p 360p | 1361 | 1 |
| 22/16029 | हिंदी साहित्य 02 | 1080p (1600x900, 415), 360p (638x360, 415), 240p (256x144, 433) | 720p | 1080p 360p 240p | 973 | 1 |

## Not built yet

The apply step. The 10-29 worker (`vidyagram-three-disabled-worker.cjs`) is pinned to its three jobs, and it writes `<height>p` files with no menu. Apply needs a 33-job allowlist from `plan.json` and the menu builder above. It runs one video at a time, and the preview must be under an hour old when it starts. Cloudflare: these are new masters, so there is no stale cache to purge.

Evidence: [preview.json](preview.json), [plan.json](plan.json), [current-state.json](current-state.json). Scripts: `reference/scripts/vidyagram-gap-recovery.cjs` (+ `-runtime.js`, `-db.cjs`).
