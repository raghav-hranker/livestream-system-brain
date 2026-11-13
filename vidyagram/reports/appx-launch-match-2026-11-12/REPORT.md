# AppX → Vidyagram launch match, 2026-11-12

Run 2026-11-12 12:45 IST. Read-only: nothing was changed on either side.

- **AppX side**: the live AppX admin course list (154 courses), this morning's content capture (`daily-2026-11-12`), and
  the AppX test / e-book mirrors. The public count was read off vidyagram.online.
- **Our side**: production `vidyagramdb`, and the public courses page at arvidyagram.com/courses.
- Scripts: `reference/scripts/vidyagram-appx-launch-match.cjs` (run on test-uday) and
  `vidyagram-appx-launch-match-csv.py`. Raw JSON: `outputs/vidyagram-appx-launch-match-2026-11-12/raw.json`.

## The short version

| Deliverable | AppX | Ours | Match | Open items |
|---|---:|---:|---|---|
| 1. Courses on the public site | 49 | 49 active | All 49 are here, active, same price and validity | 21 test courses also active here; 24 real paid courses sit under no tab of our courses page |
| 1. Courses, inactive | 99 | 99 inactive | All match | none |
| 2. Classes (49 public courses) | 6,008 | 6,001 | 99.9% | 7 classes with no video |
| 2. Classes (all 154 courses) | 31,578 | 30,480 | 96.5% | 1,091 more, all in courses AppX no longer sells |
| 3. PDFs on classes (49 public) | 5,128 | 5,125 | 99.9% | 3 |
| 3. PDFs on classes (all) | 12,321 | 12,260 | 99.5% | 58 more, in inactive courses |
| 4. Tests on classes (49 public) | 780 | 779 | 99.9% | 1 |
| 4. Tests on classes (all) | 2,313 | 2,276 | 98.4% | 36 more, in inactive courses |
| 5. E-books (paid + free) | 62 | 62 | All match | 8 test e-books of ours to hide or delete |
| 5. PDFs filed in courses (49 public) | 1,188 | 1,176 | 99.0% | 12 |
| 6. Tests | 7,292 | 6,937 | 95.1% | 18 published tests missing; 337 missing are unpublished in AppX |
| 6. Daily quizzes | 671 | 670 | 99.9% | 1 switched off here |
| 6. Test packages | 74 | 74 | 58 same | 16 switched off here that AppX still shows |

## 1. Courses: why 49 does not match

AppX's public site shows four folders: **Paid Courses 37 + Free Courses 12 = 49**, plus Exam Pattern and Syllabus (3)
and Live Test (3). The rule that reproduces the 49 exactly from the AppX admin: course is enabled, filed in the Paid or
Free folder, and its price is not −1 ("not for sale").

| | AppX | Ours |
|---|---:|---:|
| All courses | 154 | 178 |
| Active | 55 | 70 |
| Inactive | 99 | 108 |

Every one of AppX's 154 courses has a course here. The difference is these three groups:

1. **21 courses active here that AppX does not have.** 20 are test courses made in May–June (for example "Bank PO
   Reasoning Ability Batch 2026" at ₹12, "SSC MTS Complete Course 2026" at ₹46), each with no classes, and one is
   "Course Builder Demo". The 20 test courses are on the public courses page today. **The Live tab (6) and the VOD tab
   (13) list only these test courses**, and one more sits in the Free tab.
2. **24 of AppX's 37 paid courses are under no tab of our courses page.** They are active and can be bought, but a
   visitor finds them only through the Teacher tab or search. This includes Champions 5.0, English Special 4.0,
   Reasoning Special 4.0, GS Special 4.0 and Railway Foundation. The page shows 42 cards in all: 22 real, 20 test.
3. **6 courses AppX shows in its other two folders are inactive here**: SSC / State / Railway EXAMS under "Exam Pattern
   and Syllabus" (97, 116, 117) and under "Live Test" (144, 145, 146). All free.

Of the 49:

- **Status**: 49 of 49 active here.
- **Price**: 49 of 49 match, including the checkout plan behind each price.
- **Validity**: 49 of 49 match. 11 courses sell two lengths in AppX (for example ₹899 / 2 years and ₹999 / 3 years);
  all 11 offer the same two here.
- **Title**: one differs. AppX 168 is "UPPSC RO/ARO 2026 (शासन बैच)"; ours says "UPSSSC RO/ARO 2026 (शासन बैच)".

Files: `1-courses.csv` (all 178, one row each, with price, validity and every content count),
`1-courses-needs-attention.csv` (the 51 rows above).

## 2. Classes

Counted as AppX counts them: one per class per course, so a class shared by three courses counts three times.
"Ours" means the class is in the same course here and has a playable video.

| Group | AppX | Ours | Gap |
|---|---:|---:|---:|
| 49 public courses | 6,008 | 6,001 | 7 |
| 99 inactive courses | 25,570 | 24,479 | 1,091 |
| All | 31,578 | 30,480 | 1,098 |

- The 7 in live courses are present but have no video (the video import failed): 3 in Combo Special – SSC CGL Mains
  (160), 3 in Maths Special – SSC CGL Mains (161), 1 in UPSI दरोगा जी (107).
- The 1,091 in inactive courses: 787 are old MP4 classes never copied, 262 failed video imports, 42 have no usable
  link in AppX. Buyers of those old courses still open them, so they matter for existing students, not for the listing.

Files: `2-classes-by-course.csv`, `2-classes-gaps.csv` (every gap class by name).

## 3. PDFs attached to classes

| Group | AppX | Ours | Gap |
|---|---:|---:|---:|
| 49 public courses | 5,128 | 5,125 | 3 |
| 99 inactive courses | 7,193 | 7,135 | 58 |
| All | 12,321 | 12,260 | 61 |

The 3 in live courses: "Mensuration 2D 03" in 160 and 161, "Important Articles" in 160. All 61 are PDFs that were never
imported.

Files: `3-pdfs-on-classes-by-course.csv`, `3-pdfs-on-classes-gaps.csv`.

## 4. Tests attached to classes

| Group | AppX | Ours | Gap |
|---|---:|---:|---:|
| 49 public courses | 780 | 779 | 1 |
| 99 inactive courses | 1,533 | 1,497 | 36 |
| All | 2,313 | 2,276 | 37 |

In every gap the test exists here; it is just not attached to that class. The one in a live course: Maths VOD Batch
(103), class "Time, Speed & Distance 02". Most of the rest are in the old English Special Batch by Jai Sir (68).

Files: `4-tests-on-classes-by-course.csv`, `4-tests-on-classes-gaps.csv`.

## 5. E-books

| | AppX | Ours | Match |
|---|---:|---:|---|
| Paid e-books | 17 | 17 | all, shown/hidden the same |
| Free e-books | 45 | 45 | all, shown/hidden the same |
| Printed books | 59 | 69 | 21 same title, 34 retitled here, 2 hidden here, 2 missing |

- **8 e-books here are not in AppX**: 6 hidden test items ("Ebook 2", "Ebook 5", "SSC Ebook" …) and 2 shown ones in the
  old e-books list ("Current Affairs HINDI / ENGLISH June 2025 to 31 May 2026").
- **Printed books** were not asked for, but they sit in the same library, so they are in the file. Our titles were
  cleaned up on 11-05, so 34 are paired by similar title and need a glance. Hidden here though AppX shows them:
  "Railway Maths | English Medium" and "SSC General Studies 4200+". No match found: "UPP Constable 2025-26 | MATHS" and
  "रेलवे सामान्य विज्ञान Book English medium" (both probably among our 12 unpaired titles).

If "e-books" meant the PDFs filed inside courses, that count is:

| Group | AppX | Ours | Gap |
|---|---:|---:|---:|
| 49 public courses | 1,188 | 1,176 | 12 |
| All 154 | 10,600 | 10,568 | 32 |

The 12 are the same 4 PDFs in three courses that share the GS Decode content (122, 151, 158): "Planner", "Class 02 –
Salient Features of the Indian Constitution" (twice) and "Class 03 – Preamble".

Files: `5-ebooks-and-books.csv`, `5-course-pdfs-by-course.csv`, `5-course-pdfs-gaps.csv`.

## 6. Tests

| | AppX | Ours | Match |
|---|---:|---:|---|
| Tests | 7,292 | 6,937 of them | all 6,937 on/off the same as AppX |
| Daily quizzes | 671 | 670 same | 1 off here ("21 June 2026 GK/GS quiz") |
| Test packages | 74 | 74 | 58 same, 16 differ |

- **355 AppX tests are not here.** 337 are unpublished in AppX, so students never saw them. **18 are published and
  missing**: 10 "SET" tests in package 44, 3 in package 43, 4 in package 37 (Economic Planning, Demography) and 1 in
  package 77.
- **84 tests exist only here**: 51 AI tests, 19 in test series, 7 live-test entries (several named "Testing …"), and a
  few others. Worth a look for test data before launch. Same for 7 quizzes (DQ1–DQ4, "Quiz Testing") and 4 packages
  ("TestPackage", "SSC CGL Tier 1 Prev", "Chap Tese Pk 1", "Sec Test Pkg"; the first two are switched on).
- **16 packages AppX shows are switched off here.** 13 are AppX's free previous-year packages (SSC CGL Tier I 325
  tests, SSC CHSL Tier I 352, RRB Group D 263, NTPC Graduate 222 …). Their published tests are all here and switched on (898), but filed under
  our Sectional tab rather than inside the package, which is empty. The other 3 (Group D, SSC GD
  2026, RRB NTPC GL 2026) belong to the inactive Live Test courses 144–146.
- **Tests inside courses** (test packages AppX attaches to a course): 49 public courses hold 512 in AppX, 478 here.
  Of the 34 missing, 20 are unpublished in AppX and 14 are real: 6 each in Combo Special (160) and English Special
  (162) – SSC CGL Mains, from package 93, and 2 test rows in Railway Foundation (105).

Files: `6-tests.csv`, `6-tests-not-matching.csv`, `6-quizzes.csv`, `6-test-packages.csv`,
`6-tests-in-courses-by-course.csv`, `6-tests-in-courses-gaps.csv`.

## What was not checked

- The tab counts on our courses page were read once from the public site, logged out. The Teacher tab was not walked.
- AppX's public Paid folder page stopped loading after 20 cards, so only those 20 were compared card by card (all 20
  prices agree). The 37 and 12 totals come from the folder badges and match the admin list.
- Printed-book pairing by similar title is a guess per row.
- Whether a class's video actually plays was not tested; "playable" means a stored video or YouTube link exists.
