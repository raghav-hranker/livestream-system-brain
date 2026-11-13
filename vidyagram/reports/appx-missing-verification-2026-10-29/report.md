# Vidyagram: live AppX verification — 29 October 2026

The requested sheet snapshot contains **169 videos**. All were considered. The earlier confirmed segment-gap set contains 32 jobs; 32 are in this sheet. Today's pass additionally confirms a segment gap in Periodic Table PYQs, making 33. “Gone from AppX” is the migration job label, not proof of catalogue absence.

## Results

- 48: Present; disabled/deleted source occurrences
- 119: Present; enabled source occurrence
- 2: Absent from all listed course occurrences

- 48: Source disabled or changed; media not tested
- 33: Confirmed missing source segment(s)
- 82: AppX returned no playable URL; missing media unproven
- 4: Required source quality playlist unavailable
- 2: Absent from listed course; media not tested

## Scope and evidence

Sheet read at 2026-10-29T10:12:30.937Z; source audit 2026-10-29T10:15:38.654Z to 2026-10-29T10:44:21.375Z. Exact listed course/row IDs and source asset identities were compared against fresh CMS listings. Enabled, unchanged source assets were requested through AppX's video-token endpoint. Required media renditions follow the migration worker's quality policy. Missing segment responses are checked twice; a confirmed gap stops that video's scan. Complete checks range-read each referenced media object, not every byte or decoded frame. A missing segment proves an incomplete rendition; it does not prove that every alternative AppX quality is broken.

The maintained Vidyagram session is read afresh for each CMS request and used only as an HTTPS cookie to cms.appx.co.in. Initial positive control: passed. Alternative-placement audit: 162/162 checks; ending positive control: passed. An earlier static-session attempt expired and is retained in interrupted-session.json; its post-expiry outcomes are excluded. The four quality-playlist failures were independently reminted and rechecked; transient alternative request failures were retried in playlist-recheck.json. No source URLs, cookies, credentials or token response bodies are saved. No migration jobs, classes, placements or spreadsheet cells were changed.

A row marked “no playable URL” is unavailable through the tested AppX endpoint; it is **not** confirmed deleted or physically missing. Disabled/deleted catalogue flags are distinct from absent rows. Any missing listing, authentication failure or changed asset remains inconclusive. This audit is limited to listed occurrences and does not search the whole catalogue for unrelated replacement recordings.

The browser spot check found exact AppX row 9770 (Algebra Class 08) listed as Recorded; its player modal did not start during the spot check. This establishes catalogue presence, not full-duration playback.

Machine evidence: [verification.json](verification.json), [sheet snapshot](sheet.json), [summary](summary.json), [playlist and timeout rechecks](playlist-recheck.json), [alternate occurrence probes](alternate-verification.json).

## Confirmed segment gaps

First confirmed gap per video; segment indexes are zero-based. All 33 have repeat HTTP404 responses.

| Video | Tested course/row | Quality | Segment index | HTTP / confirmation |
|---|---|---|---|---|
| Algebra Class 08 · ALGEBRA (बीजगणित ) | 15/9770 | 240p | 215 | 404 / 404 |
| Algebra Class 11 · ALGEBRA (बीजगणित ) | 15/9773 | 480p | 227 | 404 / 404 |
| Algebra Class 16 · ALGEBRA (बीजगणित ) | 15/9779 | 360p | 249 | 404 / 404 |
| Algebra Class 19 | 15/9782 | 240p | 289 | 404 / 404 |
| Analogy 03 · Analogy | 22/15166 | 240p | 59 | 404 / 404 |
| Average Class 18 | 10/6463 | 1080p | 2 | 404 / 404 |
| Botany 03 · BOTANY | 42/31407 | 240p | 145 | 404 / 404 |
| Botany 09 | 42/31414 | 360p | 48 | 404 / 404 |
| Carbon & Its Compouns 01 | 22/15706 | 360p | 158 | 404 / 404 |
| Class 13 (World Geography) | 22/16137 | 480p | 106 | 404 / 404 |
| commission (आयोग) | 22/15990 | 480p | 249 | 404 / 404 |
| Compound Interest Class 07 · Compound Interest (चक्रवृद्धि ब्याज) (3) | 17/11239 | 240p | 144 | 404 / 404 |
| Economics Class 03 | 22/15824 | 360p | 147 | 404 / 404 |
| Electric Potential | 42/31789 | 240p | 21 | 404 / 404 |
| IMPORTANT AWARD (महत्वपूर्ण पुरस्कार ) | 22/16484 | 360p | 14 | 404 / 404 |
| PARLIAMENT 04 | 22/16237 | 240p | 67 | 404 / 404 |
| Periodic Table PYQs | 22/15716 | 360p | 21 | 404 / 404 |
| Preamble (CLASS 01) | 22/16186 | 240p | 5 | 404 / 404 |
| Profit & Loss Class 12 · Profit & Loss (लाभ और हानि) (3) | 18/11652 | 480p | 24 | 404 / 404 |
| Ratio 02 · RATIO (अनुपात) | 13/8149 | 240p | 239 | 404 / 404 |
| Remainder Class 06 | 18/12067 | 360p | 154 | 404 / 404 |
| Similarity 03 | 22/15391 | 480p | 308 | 404 / 404 |
| Statement - Assumption 02 | 22/15352 | 360p | 174 | 404 / 404 |
| SUPER SET-01 (HIGH LEVEL) | 87/42132 | 480p | 875 | 404 / 404 |
| SUPER SET-06 (HIGH LEVEL) | 87/42137 | 480p | 533 | 404 / 404 |
| Trigonometry Class 02 · TRIGONOMETRY (6) | 25/18628 | 360p | 141 | 404 / 404 |
| Trigonometry Class 19 · TRIGONOMETRY (2) | 17/10970 | 480p | 59 | 404 / 404 |
| Trigonometry Class 19 · TRIGONOMETRY (7) | 25/18648 | 360p | 45 | 404 / 404 |
| Work & Wages Class 01 · WORK & WAGES (4) | 45/33744 | 240p | 279 | 404 / 404 |
| अलंकार 02 · अलंकार | 22/16039 | 360p | 168 | 404 / 404 |
| तत्सम और तद्भव शब्द 02 | 22/16552 | 480p | 57 | 404 / 404 |
| हिंदी साहित्य | 22/16028 | 240p | 359 | 404 / 404 |
| हिंदी साहित्य 02 | 22/16029 | 480p | 216 | 404 / 404 |

## Per-video results

| Sheet row | Video | Listed course/rows | AppX catalogue | Source media result | Prior gap set |
|---|---|---|---|---|---|
| 2 | 08 Chemical Bonding | 7/4362 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 3 | 12 Periodic Classification of Elements | 7/4363 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 4 | Algebra Class 08 · ALGEBRA (बीजगणित ) | 15/9770 17/10908 18/11731 21/13817 22/14595 23/16882 24/17734 28/21205 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 5 | Algebra Class 11 · ALGEBRA (बीजगणित ) | 15/9773 17/10911 18/11734 21/13820 22/14599 23/16885 24/17738 28/21209 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 6 | Algebra Class 16 · ALGEBRA (बीजगणित ) | 15/9779 17/10917 18/11740 21/13826 22/14605 23/16891 24/17744 28/21215 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 7 | Algebra Class 19 | 15/9782 17/10920 18/11743 21/13829 22/14608 23/16894 24/17747 28/21218 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 8 | Alligation 01 (2) · ALLIGATION (2) | 46/34371 47/35126 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 9 | Alligation 02 (2) | 46/34372 47/35127 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 10 | Alligation 03 · ALLIGATION (3) | 46/34373 47/35128 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 11 | Alligation 03 (2) | 46/34616 47/35316 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 12 | Analogy 03 · Analogy | 22/15166 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 13 | Average Class 18 | 10/6463 13/8576 15/10419 17/11562 18/12405 19/13391 21/14464 22/15021 23/17560 28/21844 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 14 | Botany 03 · BOTANY | 42/31407 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 15 | Botany 09 | 42/31414 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 16 | Carbon & Its Compouns 01 | 22/15706 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 17 | CGL Mains 2024 Strategy | 31/23241 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 18 | Circle 01 · GEOMETRY (ज्यामिति) (2) | 21/14221 22/14829 23/17320 24/18166 25/19009 26/19912 27/20777 28/21601 29/22522 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 19 | Circle 02 · GEOMETRY (ज्यामिति) (2) | 21/14222 22/14830 23/17321 24/18167 25/19010 26/19913 27/20778 28/21602 29/22523 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 20 | Circle 03 · GEOMETRY (ज्यामिति) (10) | 24/18168 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 21 | Circle 03 · GEOMETRY (ज्यामिति) (11) | 25/19011 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 22 | Circle 03 · GEOMETRY (ज्यामिति) (12) | 26/19914 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 23 | Circle 03 · GEOMETRY (ज्यामिति) (13) | 27/20779 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 24 | Circle 03 · GEOMETRY (ज्यामिति) (14) | 29/22524 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 25 | Circle 03 · GEOMETRY (ज्यामिति) (7) | 21/14223 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 26 | Circle 03 · GEOMETRY (ज्यामिति) (8) | 22/14831 28/21603 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 27 | Circle 03 · GEOMETRY (ज्यामिति) (9) | 23/17322 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 28 | Circle 04 · GEOMETRY (ज्यामिति) (2) | 21/14225 22/14833 23/17324 24/18170 25/19013 26/19916 27/20781 28/21605 29/22526 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 29 | Circle 05 · GEOMETRY (ज्यामिति) (2) | 21/14224 22/14832 23/17323 24/18169 25/19012 26/19915 27/20780 28/21604 29/22525 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 30 | Circle 06 · GEOMETRY (ज्यामिति) (2) | 21/14226 22/14834 23/17325 24/18171 25/19014 26/19917 27/20782 28/21606 29/22527 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 31 | Circle 07 · GEOMETRY (ज्यामिति) (3) | 21/14227 22/14835 23/17326 24/18172 25/19015 26/19918 27/20783 28/21607 29/22528 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 32 | Circle 08 · GEOMETRY (ज्यामिति) (2) | 21/14228 22/14836 23/17327 24/18173 25/19016 26/19919 27/20784 28/21608 29/22529 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 33 | Circle 09 · GEOMETRY (ज्यामिति) (2) | 21/14229 22/14837 23/17328 24/18174 25/19017 26/19920 27/20785 28/21609 29/22530 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 34 | Circle 10 · GEOMETRY (ज्यामिति) (2) | 21/14230 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 35 | Circle 10 · GEOMETRY (ज्यामिति) (3) | 23/17329 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 36 | Circle 10 · GEOMETRY (ज्यामिति) (4) | 24/18175 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 37 | Circle 10 · GEOMETRY (ज्यामिति) (5) | 25/19018 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 38 | Circle 10 · GEOMETRY (ज्यामिति) (6) | 26/19921 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 39 | Circle 10 · GEOMETRY (ज्यामिति) (7) | 27/20786 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 40 | Circle 10 · GEOMETRY (ज्यामिति) (8) | 29/22531 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 41 | Circle 10 (2) | 21/14232 22/14838 23/17331 24/18177 25/19020 26/19923 27/20788 28/21610 29/22533 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 42 | Circle 10 (3) | 21/14233 22/14840 23/17332 24/18178 25/19021 26/19924 27/20789 28/21612 29/22534 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 43 | Circle 11 · GEOMETRY (ज्यामिति) (2) | 21/14231 22/14839 23/17330 24/18176 25/19019 26/19922 27/20787 28/21611 29/22532 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 44 | Class 13 (World Geography) | 22/16137 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 45 | Classification 04 · CLASSIFICATION BIOLOGY | 42/31448 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 46 | Classification 05 | 42/31449 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 47 | Classification 05 (2) | 42/31450 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 48 | Classification 06 | 42/31451 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 49 | Classification 07 | 42/31452 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 50 | Classification 08 | 42/31453 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 51 | Classification 09 | 42/31455 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 52 | Classification 09 (2) | 42/31454 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 53 | Classification 10 | 42/31456 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 54 | Classification of No. 01 · NUMBER SYSTEM (संख्या पद्धति) (3) | 45/33939 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 55 | Classification of No. 02 · NUMBER SYSTEM (संख्या पद्धति) (3) | 45/33940 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 56 | Classification of No. 03 · NUMBER SYSTEM (संख्या पद्धति) (2) | 45/33941 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 57 | commission (आयोग) | 22/15990 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 58 | COMPOUND INTEREST & SIMPLE INTEREST CLASS 02 | 7/4222 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 59 | Compound Interest Class 07 · Compound Interest (चक्रवृद्धि ब्याज) (3) | 17/11239 18/12012 21/14092 23/17191 24/18037 25/18880 28/21471 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 60 | Disease 02 | 42/31389 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 61 | Disease 03 | 42/31390 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 62 | Disease 04 | 42/31391 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 63 | Disease 05 | 42/31392 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 64 | Economics Class 03 | 22/15824 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 65 | Electric Charge (2) | 42/31782 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 66 | Electric Potential | 42/31789 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 67 | Factor 01 · NUMBER SYSTEM (संख्या पद्धति) (4) | 45/33944 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 68 | Factor 02 · NUMBER SYSTEM (संख्या पद्धति) (4) | 45/33945 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 69 | Factor 03 · NUMBER SYSTEM (संख्या पद्धति) (4) | 45/33946 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 70 | Height & Distance 01 · HEIGHT & DISTANCE (3) | 30/22999 31/23360 35/38749 43/32905 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 71 | Height & Distance 01 · HEIGHT & DISTANCE (5) | 45/33879 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 72 | Height & Distance 02 · HEIGHT & DISTANCE (3) | 45/33880 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 73 | Height & Distance 03 · HEIGHT & DISTANCE (4) | 45/33881 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 74 | Height & Distance 04 · HEIGHT & DISTANCE (3) | 45/33882 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 75 | Height & Distance Completed | 26/19599 27/20507 29/22253 30/23000 31/23361 32/23796 33/24630 34/25467 35/38750 35/39866 37/27416 39/28336 41/29643 42/30345 43/32906 44/33349 107/194066 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 76 | HISTORY OF COMPUTER | 69/40106 159/185940 74/40105 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 77 | IMPORTANT AWARD (महत्वपूर्ण पुरस्कार ) | 22/16484 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 78 | Internet 02 (2) | 69/43443 159/185984 74/43442 95/43441 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 79 | Matter & it's States | 114/181076 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 80 | Maxima & Minima 01 · Maxima & Minima (Trigonometry) | 45/34026 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 81 | Maxima & Minima 02 · Maxima & Minima (Trigonometry) | 45/34027 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 82 | Mixture 06 · MIXTURE (3) | 46/34460 47/35172 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 83 | Mixture 07 · MIXTURE (3) | 46/34461 47/35173 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 84 | PARLIAMENT 04 | 22/16237 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 85 | Percentage 01 · PERCENTAGE (प्रतिशत ) (4) | 30/23007 31/23368 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 86 | Percentage 02 · PERCENTAGE (प्रतिशत ) (4) | 30/23008 31/23369 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 87 | Percentage 03 · PERCENTAGE (प्रतिशत ) (4) | 30/23009 31/23370 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 88 | Percentage 04 · PERCENTAGE (प्रतिशत ) (3) | 30/23010 31/23371 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 89 | Percentage 05 · PERCENTAGE (प्रतिशत ) (3) | 30/23011 31/23372 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 90 | Percentage 09 · PERCENTAGE (प्रतिशत ) | 10/5973 13/8127 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 91 | Percentage Class 01 · PERCENTAGE (प्रतिशत ) (8) | 24/17884 28/21351 47/35191 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 92 | Percentage Class 14 (2) | 47/35200 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 93 | PERCENTAGE(प्रतिशतता) CLASS 11 (2) | 3/407 3/425 4/1470 5/2588 6/3594 9/5076 14/9373 19/12911 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 94 | Periodic Table PYQs | 22/15716 | Present; enabled source occurrence | Confirmed missing source segment(s) |  |
| 95 | Phenomenal Sound | 42/31719 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 96 | PHYSICAL DIVISION OF INDIA (CLASS 01) | 22/15417 | Present; enabled source occurrence | Required source quality playlist unavailable |  |
| 97 | Pipe & Cistern 01 · PIPE & CISTERN (2) | 23/16850 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 98 | Pipe & Cistern 01 · PIPE & CISTERN (3) | 24/17702 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 99 | Pipe & Cistern 01 · PIPE & CISTERN (4) | 25/18547 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 100 | Pipe & Cistern 01 · PIPE & CISTERN (5) | 26/19387 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 101 | Pipe & Cistern 01 · PIPE & CISTERN (6) | 27/20294 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 102 | Pipe & Cistern 01 · PIPE & CISTERN (7) | 29/22019 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 103 | Pipe & Cistern 02 · PIPE & CISTERN | 23/16851 24/17703 25/18548 26/19388 27/20295 29/22020 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 104 | Pipe & Cistern 03 · PIPE & CISTERN | 23/16853 24/17705 25/18550 26/19390 27/20297 29/22022 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 105 | Pipe & Cistern 03 (2) · PIPE & CISTERN | 23/16852 24/17704 25/18549 26/19389 27/20296 29/22021 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 106 | Polygon 01 · GEOMETRY (ज्यामिति) (2) | 21/14219 22/14827 23/17318 24/18164 25/19007 26/19910 27/20775 28/21599 29/22520 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 107 | Polygon 02 · GEOMETRY (ज्यामिति) (2) | 21/14220 22/14828 23/17319 24/18165 25/19008 26/19911 27/20776 28/21600 29/22521 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 108 | Practice Set (11) | 69/40592 159/185967 74/40591 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 109 | Practice Set (9) | 69/176321 159/186009 74/176320 95/176319 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 110 | Preamble (CLASS 01) | 22/16186 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 111 | Profit & loss 01 · Profit & Loss (लाभ और हानि) | 30/22870 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 112 | Profit & loss 01 · Profit & Loss (लाभ और हानि) (2) | 31/23230 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 113 | Profit & Loss 01 · Profit & Loss (लाभ और हानि) (2) | 30/22869 31/23229 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 114 | Profit & loss 02 | 30/22872 31/23232 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 115 | Profit & Loss Class 12 · Profit & Loss (लाभ और हानि) (3) | 18/11652 21/13736 23/16807 24/17659 25/18504 26/19344 28/21130 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 116 | Profit, loss & Discount 02 | 30/23018 31/23379 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 117 | Properties of Sound Waves | 42/31717 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 118 | PYQ Sound and Waves | 42/31720 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 119 | race-class-01 | 5/2313 | Present; enabled source occurrence | Required source quality playlist unavailable |  |
| 120 | Ratio 01 · RATIO (अनुपात) (3) | 23/17065 24/17912 25/18755 26/19636 27/20544 29/22290 32/23832 41/29652 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 121 | Ratio 01 (2) · RATIO (अनुपात) | 23/17064 24/17911 25/18754 26/19635 27/20543 29/22289 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 122 | Ratio 02 · RATIO (अनुपात) | 13/8149 15/10003 17/11147 18/11920 19/12956 21/14000 28/21379 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 123 | Ratio 02 · RATIO (अनुपात) (3) | 23/17066 24/17913 25/18756 26/19637 27/20545 29/22291 32/23833 41/29653 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 124 | Ratio 03 (2) · RATIO (अनुपात) (2) | 23/17067 24/17914 25/18757 26/19638 27/20546 29/22292 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 125 | Remainder Class 06 | 18/12067 21/14147 23/17246 24/18092 25/18935 26/19838 28/21527 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 126 | Similarity 03 | 22/15391 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 127 | Simplification 06 (2) · Simplification by Anurag Sir | 101/175414 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 128 | Statement - Assumption 02 | 22/15352 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 129 | Strategy & Guidance · STRATEGY & GUIDANCE (11) | 31/23240 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 130 | Strategy & Guidance · STRATEGY & GUIDANCE (9) | 28/21142 32/23610 41/29464 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 131 | Strategy & Guidance (2) · STRATEGY & GUIDANCE | 28/21143 32/23611 41/29465 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 132 | SUPER SET-01 (HIGH LEVEL) | 87/42132 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 133 | SUPER SET-06 (HIGH LEVEL) | 87/42137 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 134 | Temple 05 (2) | 72/40570 | Absent from all listed course occurrences | Absent from listed course; media not tested |  |
| 135 | Temples 01 | 72/40471 | Absent from all listed course occurrences | Absent from listed course; media not tested |  |
| 136 | tesi | 66/40099 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 137 | testing (4) | 66/40328 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 138 | Testing (4) | 66/39914 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 139 | Testing Reasoning (2) | 66/40031 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 140 | Time & Work Class 01 · TIME & WORK (6) | 22/14550 | Present; enabled source occurrence | Required source quality playlist unavailable |  |
| 141 | Time, Speed & Distance 01 (2) · TIME , SPEED & DISTANCE | 46/34655 47/35330 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 142 | Time, Speed & Distance 02 (2) | 46/34656 47/35331 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 143 | Time, Speed & Distance 03 (2) · TIME , SPEED & DISTANCE (2) | 46/34657 47/35332 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 144 | Time, Speed & Distance 04 (2) | 46/34658 47/35333 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 145 | Time, Speed & Distance 05 (2) | 46/34659 47/35334 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 146 | Time, Speed & Distance 06 (2) · TIME , SPEED & DISTANCE | 46/34660 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 147 | Time, Speed & Distance 06 (2) · TIME , SPEED & DISTANCE (2) | 47/35335 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 148 | Time, Speed & Distance 07 (2) · TIME , SPEED & DISTANCE | 46/34661 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 149 | Time, Speed & Distance 07 (2) · TIME , SPEED & DISTANCE (2) | 47/35336 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 150 | Time, Speed & Distance 08 (2) | 46/34662 47/35337 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 151 | Time, Speed & Distance Class 03 · TIME , SPEED & DISTANCE (2) | 45/34046 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 152 | Train Class 01 · TRAIN (4) | 45/33822 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 153 | Trigonometry 05 · TRIGONOMETRY (3) | 30/22942 31/23303 35/38720 43/32864 160/191284 161/190823 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 154 | Trigonometry 06 · TRIGONOMETRY (2) | 30/22943 31/23304 35/38721 43/32865 160/191285 161/190824 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 155 | Trigonometry 07 · TRIGONOMETRY (2) | 30/22944 31/23305 35/38722 43/32866 160/191286 161/190825 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 156 | Trigonometry Class 02 · TRIGONOMETRY (6) | 25/18628 28/21248 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 157 | Trigonometry Class 19 · TRIGONOMETRY (2) | 17/10970 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 158 | Trigonometry Class 19 · TRIGONOMETRY (7) | 25/18648 28/21268 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 159 | Types of Sound | 42/31718 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 160 | UNIT DIGIT 01 | 45/33942 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 161 | UNIT DIGIT 02 | 45/33943 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 162 | Work & Wages 01 · WORK & WAGES (2) | 23/16842 24/17694 25/18539 26/19379 27/21101 29/22830 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 163 | Work & Wages 02 · WORK & WAGES (2) | 23/16843 24/17695 25/18540 26/19380 27/21102 29/22831 | Present; enabled source occurrence | AppX returned no playable URL; missing media unproven |  |
| 164 | Work & Wages Class 01 · WORK & WAGES (4) | 45/33744 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 165 | अलंकार 02 · अलंकार | 22/16039 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 166 | तत्सम और तद्भव शब्द 02 | 22/16552 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 167 | विलोम शब्द 02 · विलोम शब्द | 22/16508 | Present; enabled source occurrence | Required source quality playlist unavailable |  |
| 168 | संसद 02 | 101/189321 104/189320 | Present; disabled/deleted source occurrences | Source disabled or changed; media not tested |  |
| 169 | हिंदी साहित्य | 22/16028 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |
| 170 | हिंदी साहित्य 02 | 22/16029 | Present; enabled source occurrence | Confirmed missing source segment(s) | Yes |

## Disabled-video playback follow-up

A later read-only playback check found 3 of the 48 disabled recordings decodable at the beginning, middle and end; 6 returned repeat404 for all tested advertised/derived quality playlists, and 39 returned no playable URL. See [the disabled-video playback report](disabled-playback-report.md). No entries were enabled. These sampled playback results do not certify full-duration integrity.
