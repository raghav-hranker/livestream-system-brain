# Vidyagram: every AppX quality of the 33 segment-gap videos — 11 November 2026

**All 33 have at least one complete quality in AppX.** The 10-29 check stopped at the first missing segment in one quality, so it reported these videos as broken. In fact each one is missing segments in some qualities only. 24 have a complete copy at AppX's top label ("1080p"). Three have only a complete 240p copy: Average Class 18, Periodic Table PYQs and SUPER SET-06. Nothing was imported or changed.

Best complete quality per video: 1080p 24, 720p 3, 360p 3, 240p 3.

## How this was checked

Each video was tested at the course and row used on 10-29, with a fresh AppX token. Every quality the token endpoint lists was tested, plus the worker's derived 240p/360p/480p paths, de-duplicated by path. Every segment of every quality was range-read (first 1 KB) and checked for a media signature. A 404 was retried once, and the first confirmed gap ends that quality's scan. "Complete" means every segment in the playlist was readable, the same standard as 10-29. It does not mean every byte was downloaded or every frame decoded.

Run 2026-11-10T18:22:42.138Z to 2026-11-10T20:31:42.732Z UTC: 35,060 media and 48 CMS requests, 0 production writes. The Glands01 control passed at the start and at the end. No URLs, cookies or tokens were saved.

Quality labels are AppX's own, and AppX labels are known to be wrong. Wave 1 found that "720p" is the /480p/ folder, and that the real higher levels are /720p/ (1024x576) and /1080p/ (1600x900). Measure dimensions before publishing a master. Segment counts are about equal across qualities, so no complete playlist is a shortened copy.

## Per video

Cells: complete (segments), or gap @ first missing zero-based segment (HTTP / retry HTTP). A blank cell means that quality was not offered.

| Course/row | Video | 1080p | 720p | 360p | 240p | Best complete |
|---|---|---|---|---|---|---|
| 15/9770 | Algebra Class 08 · ALGEBRA (बीजगणित ) | complete (334) | complete (333) | complete (332) | gap @215 (404/404) | 1080p |
| 15/9773 | Algebra Class 11 · ALGEBRA (बीजगणित ) | complete (322) | gap @227 (404/404) | complete (320) | complete (321) | 1080p |
| 15/9779 | Algebra Class 16 · ALGEBRA (बीजगणित ) | complete (308) | complete (308) | gap @249 (404/404) | complete (306) | 1080p |
| 15/9782 | Algebra Class 19 | complete (294) | complete (295) | complete (294) | gap @289 (404/404) | 1080p |
| 22/15166 | Analogy 03 · Analogy | complete (275) | complete (276) | complete (276) | gap @59 (404/404) | 1080p |
| 10/6463 | Average Class 18 | gap @2 (404/404) | gap @2 (404/404) | gap @8 (404/404) | complete (365) | 240p |
| 42/31407 | Botany 03 · BOTANY | complete (299) | complete (299) | complete (299) | gap @145 (404/404) | 1080p |
| 42/31414 | Botany 09 | complete (363) | complete (363) | gap @48 (404/404) | complete (363) | 1080p |
| 22/15706 | Carbon & Its Compouns 01 |  | complete (314) | gap @158 (404/404) | complete (314) | 720p |
| 22/16137 | Class 13 (World Geography) |  | gap @106 (404/404) | complete (300) | complete (300) | 360p |
| 22/15990 | commission (आयोग) |  | gap @249 (404/404) | complete (280) | complete (279) | 360p |
| 17/11239 | Compound Interest Class 07 · Compound Interest (चक्रवृद्धि ब्याज) (3) | complete (320) | complete (320) | complete (319) | gap @144 (404/404) | 1080p |
| 22/15824 | Economics Class 03 | complete (200) | complete (205) | gap @147 (404/404) | complete (203) | 1080p |
| 42/31789 | Electric Potential | complete (337) | complete (337) | complete (337) | gap @21 (404/404) | 1080p |
| 22/16484 | IMPORTANT AWARD (महत्वपूर्ण पुरस्कार ) | complete (201) | complete (201) | gap @14 (404/404) | gap @72 (404/404) | 1080p |
| 22/16237 | PARLIAMENT 04 | complete (235) | complete (235) | complete (235) | gap @67 (404/404) | 1080p |
| 22/15716 | Periodic Table PYQs | gap @10 (404/404) | gap @5 (404/404) | gap @21 (404/404) | complete (322) | 240p |
| 22/16186 | Preamble (CLASS 01) |  | complete (313) | complete (313) | gap @5 (404/404) | 720p |
| 18/11652 | Profit & Loss Class 12 · Profit & Loss (लाभ और हानि) (3) | complete (298) | gap @24 (404/404) | complete (298) | complete (299) | 1080p |
| 13/8149 | Ratio 02 · RATIO (अनुपात) |  | complete (385) | complete (385) | gap @239 (404/404) | 720p |
| 18/12067 | Remainder Class 06 | complete (300) | complete (300) | gap @154 (404/404) | complete (300) | 1080p |
| 22/15391 | Similarity 03 | complete (311) | gap @308 (404/404) | complete (311) | complete (312) | 1080p |
| 22/15352 | Statement - Assumption 02 | complete (379) | complete (379) | gap @158 (None/206) | complete (379) | 1080p |
| 87/42132 | SUPER SET-01 (HIGH LEVEL) |  | gap @550 (None/206) | complete (950) | complete (950) | 360p |
| 87/42137 | SUPER SET-06 (HIGH LEVEL) |  | gap @491 (None/206) | gap @69 (None/206) | complete (827) | 240p |
| 25/18628 | Trigonometry Class 02 · TRIGONOMETRY (6) | complete (314) | complete (314) | gap @141 (404/404) | complete (320) | 1080p |
| 17/10970 | Trigonometry Class 19 · TRIGONOMETRY (2) | complete (443) | gap @59 (404/404) | gap @295 (404/404) | gap @330 (404/404) | 1080p |
| 25/18648 | Trigonometry Class 19 · TRIGONOMETRY (7) | complete (443) | complete (442) | gap @45 (404/404) | complete (442) | 1080p |
| 45/33744 | Work & Wages Class 01 · WORK & WAGES (4) | complete (296) | complete (296) | complete (296) | gap @279 (404/404) | 1080p |
| 22/16039 | अलंकार 02 · अलंकार | complete (222) | complete (223) | gap @168 (404/404) | complete (228) | 1080p |
| 22/16552 | तत्सम और तद्भव शब्द 02 | complete (225) | gap @57 (404/404) | complete (225) | complete (226) | 1080p |
| 22/16028 | हिंदी साहित्य | complete (375) | complete (377) | complete (375) | gap @359 (404/404) | 1080p |
| 22/16029 | हिंदी साहित्य 02 | complete (415) | gap @216 (404/404) | complete (415) | complete (433) | 1080p |

## What this means for recovery

The ingest worker needs all of 240p, 360p and 480p complete, so it will keep failing these jobs. Recovery would follow the 10-29 three-disabled pattern: copy only the complete qualities, publish the master last, and advertise only the measured dimensions. That writes to the existing Class and to R2, so it needs approval. The three 240p-only videos would come in at low quality.

Evidence: [gap-qualities.json](gap-qualities.json). Driver: `reference/scripts/vidyagram-missing-verification.cjs --gap-qualities`.
