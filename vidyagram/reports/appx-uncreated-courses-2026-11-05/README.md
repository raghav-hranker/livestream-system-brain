# Why 16 AppX courses have no Course in Vidyagram

Checked 2026-11-05 against live AppX (admin course list, course detail, content list, folder list, student tree) and `vidyagramdb`.
All 16 were captured by the nightly `daily-2026-11-05`, so none was missed by a failed capture. Per-course raw evidence: [`evidence.jsonl`](evidence.jsonl).

**Result:** 14 of the 16 have nothing that is missing as a course. The other two, 97 and 116, are a real gap: 12 PDFs and 17 images students cannot reach.
Course 146 also has one stuck purchase.

## The rule

A Course gets created in one of three ways. Code is the version deployed on test-uday.

1. **It has a class to place.** `runCourseImport` creates courses from the class import ledger (`placementPlan.byCourse`). PDFs and tests do not count.
2. **It is on sale at a real price, with no class yet.** `apxCatalogCourseImport.ts` (sha `3cae36a4a159`), lines 424-427, keeps only `status === 1 && price !== null`. Lines 33-36 say a sentinel-price folder course, an off-sale shell and a combo whose Plan grants its courses are never created. The planner sets price to null for -1 ("stopped selling") and -3 ("special").
3. **Someone runs the purchase script by hand.** `src/scripts/apxCreateMissingCatalogCourses.ts` creates a Course for a non-combo AppX course that has a stuck `no-item` purchase. It is not on the nightly.

## Combos: 8 courses

AppX holds no content in these. Live: 0 content rows, 0 folders, only the empty `Home` root. AppX's `allotment_id` lists the courses a combo contains, and buyers get those courses through a Plan of the same name.

| AppX | Combo | Price | AppX contains | Our Plan grants | Purchases processed / orders on Plan |
|---|---|---:|---|---|---:|
| 76 | प्रहार COMBO (Without Maths) | -1 | 68-73, 77, 122 | same | 463 / 463 |
| 89 | English Special VOD | 249 | 85-88 | same | 1,143 / 1,144 |
| 91 | प्रहार 2.0 COMBO | -1 | 92-96, 122 | same | 11,203 / 11,202 |
| 128 | प्रहार 3.0 Combo | -1 | 119-122, 129 | same | 6,872 / 6,873 |
| 132 | UPGK + Computer Combo | 199 | 130, 131 | same | 2,591 / 2,590 |
| 137 | 3 in 1 Mastery | 199 | 134-136 | same | 12,293 / 12,296 |
| 108 | UPSI + UP Constable Combo | 599 | 104, 107 | 104, 107 **+ 38** | 1,462 / 1,462 |
| 100 | staff combo | -1 | 74 courses | 71 courses, Plan off | 150 / 300 |

- The nightly's own report lists 89, 108, 132 and 137 under `soldAsPlan` (`apx-catalog-placement-daily-2026-11-05.json`).
- 76, 91, 100 and 128 stop earlier, at the price filter, because -1 gives price null.
- **108:** buyers get one course more than AppX lists now.
- **100:** AppX also lists 76, 89, 91, 128 and 137, which are combos with no Course. Our Plan adds 114 and 133. Orders are double the purchases, unexplained.

## Test series wrappers: 3 courses

144 "SSC EXAMS", 145 "STATE EXAMS" and 146 "RAILWAY EXAMS" sit under AppX folder 143. They have the test tab on and the content tab off, with 0 content rows live. Price is -3, so rule 2 skips them. Their tests are in Vidyagram as packages.

| AppX | Package | Our package | Tests AppX / ours |
|---|---:|---|---:|
| 144 | 85 | SSC CGL 2026 | 74 / 74 |
| 145 | 72 | UP Police 2026 | 12 / 12 |
| 145 | 84 | UPSSSC PET 2026 | 78 / 78 |
| 145 | 86 | SSC GD 2026 | 32 / 32 |
| 146 | 74 | RRB NTPC UGL 2026 | 16 / 16 |
| 146 | 75 | RRB NTPC GL 2026 | 12 / 12 |
| 146 | 80 | GROUP D | 25 / 25 |

Test counts compare our AppX test mirror with our package links. I did not open the tests in the app.

**146 has one stuck purchase:** a `no-item` row, payment id `amit`, price `-`. The "RAILWAY EXAMS" Plan points to course 117, a different AppX course with the same title.

## Nothing to import: 3 courses

| AppX | Course | Proof |
|---|---|---|
| 64 | SSC | Disabled in AppX, 0 rows, 0 folders, no purchases |
| 123 | GS Special Batch By Deepak Sir | Price -1, one disabled live stream only, no purchases |
| 172 | UPSSSC MAINS Foundation 2026-27 | New: AppX edited it 11-05 07:04, 0 rows live, no purchases. It gets a Course with its first class or when it goes on sale at a real price |

## Real gap: 2 courses

97 "SSC EXAMS" and 116 "STATE EXAMS" sit under AppX folder 57 with syllabus and exam overview files. They have content but no Course.

| AppX | Active PDFs | Images | In PDF ledger | Classes | Purchases |
|---|---:|---:|---:|---:|---:|
| 97 | 10 | 13 | 10 | 0 | 0 |
| 116 | 2 | 4 | 2 | 0 | 0 |

- **Why no Course:** no classes, so rule 1 skips them. Price -3, so rule 2 skips them. No purchases, so rule 3 skips them.
- **Nightly proof:** `apx-catalog-course-pdfs-daily-2026-11-05.json` marks both `"action": "no course"`.
- **Why it is inconsistent:** their sibling 117 "RAILWAY EXAMS" has the same shape, 2 PDFs and no class, and it does have a Course. Its Course id dates from 2026-10-22 09:30 UTC, the day the purchase script was committed, and 117 has one purchase. No run log survives, so the link to that script is inferred from those facts.
- **Images:** the planner has no IMAGE type, so all 17 are skipped as `unsupported type`.

## Open questions

- Plan "SSC EXAMS" (`…c6d69b`) is off with 0 courses, yet has 6 success orders. Those buyers' plan grants nothing. 97 and 144 have no matching purchases, so I do not know where those orders came from.

## Rerun

Scripts in `reference/scripts/`: `vidyagram-uncreated-courses-evidence.cjs`, `vidyagram-apx-package-lookup.cjs`, `vidyagram-course-origin.cjs`. All read-only.
