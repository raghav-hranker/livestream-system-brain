# AppX → Vidyagram match report, 2026-11-09

The checklist we were given: Courses, Classes, Ebooks (PDF), Assigned PDFs to Classes, Sub Courses, Prices Sync, Daily Sync,
Validity Sync, Faculty Sync, Main Category, Category, Section, Topic, Sub Topics, Tags.

- Script: `reference/scripts/vidyagram-appx-match-report.cjs`, run 2026-11-09 ~12:55 IST on test-uday from the nightly
  checkout, against prod vidyagramdb (secondary reads) and the live AppX CMS course list (153 courses). Read-only.
- Spreadsheet: `outputs/vidyagram-appx-match-2026-11-09/Vidyagram - AppX match report 2026-11-09.xlsx` (built with
  `vidyagram-appx-match-xlsx.py`). One Summary sheet, one sheet per item. The raw JSON is in the same folder (mode 600).
- AppX side = each course's last done capture, which for every course was `daily-2026-11-07` (02:30 IST 11-07; no run
  11-08). Today's catch-up nightly (`daily-2026-11-09`, started 12:39 IST) was still capturing, so anything AppX changed
  after 11-07 is not in the report.
- Nothing was fixed.

## Per item

| Item | Matched | Gaps | What the gaps are |
|---|---:|---:|---|
| Courses | 131 of 153 | 22 | 14 AppX courses empty, never created (known: placement step makes a course with its first class). 2 with content and no Course: 97 SSC EXAMS + 116 STATE EXAMS (known since 11-05). **6 status differs**: 85–88 (Jai Sir recorded batches) are price −1 "stopped selling" in AppX but on sale here at ₹199/₹99; 114 + 133 (UPSSSC PET) disabled in AppX, active here. |
| Classes | 29,808 of 30,939 placements | 1,131 | 548 MP4 not copied, 365 ingest job dead, 145 no ingest job, 73 AppX row has no usable link. Same set as 11-05; mostly old courses 3–23. |
| Ebooks (PDF) | 10,415 of 10,430 | 15 | 12 in 97/116 (no Course), 3 never imported (22 "PRINTED NOTES", 95 + 96 "Glands (Handwritten Notes)"). |
| PDFs on classes | 12,132 of 12,232 | 100 | All "not in PDF import ledger": courses 77, 95, 96 (31 each), 74 (6), 160 (1). |
| Sub Courses | 6 of 11 combos | 5 | 71 GS SPECIAL and 75 प्रहार COMBO: no combo and no same-named Plan grants their courses. 100 "staff combo" (74 courses) has no Course. 108: our Plan adds course 38 AppX doesn't grant (known stray). 171: our combo lacks 172, which has no Course (empty in AppX). |
| Prices | 104 of 137 | 33 | **AppX's price is lower than ours on 33 courses, mostly about half** (Champions 5.0 ₹449 vs ₹899, GS Special 4.0 ₹449 vs ₹899, CGL Mains Combo ₹649 vs ₹1,999), MRP blank in AppX. Includes 85–88 above. Nothing syncs prices after import. |
| Daily Sync | 3 of 13 runs clean | 10 | Every run since 11-01 ends done-with-failures on the same one class (Geometry 06 (2), "no usable unreserved source placement"). No 11-08 run (nightly was down 11-08/09). Every course captured in the newest run. |
| Validity | 107 of 137 | 30 | 29 courses sell two lengths in AppX (Access Duration Based Pricing), ours one or none. 79: label 100 Years, plan 184 days. Labels themselves all match. |
| Faculty (courses) | 1 of 96 | 95 | Every course AppX names a teacher for still carries "Vidyagram Team": Aditya (Ranjan) Sir 62, Jai Sir 8, Shubham Grover Ma'am 6, Akash Chaturvedi Sir 4, Arti Ma'am 4 … |
| Faculty (classes) | 0 of 5,038 | 5,038 | Classes whose AppX folder or title names a teacher are all on the placeholder. Top: Shubham Ma'am 1,330, Deepak Sir 740, Arti Ma'am 714, Himanshu Sir 601, Pushpendra Sir 525. 25,828 more name no teacher. |
| Main Category | 0 of 137 | 137 | AppX files courses in folders (58: 66 courses, top level: 56, Free Courses: 14, 57: 1); ours are all on the import default "Vidyagram" except 134–136 (Skills) and 170 (Railways). Folder names are not in the mirror. |
| Category | 0 of 125 | 125 | AppX tags courses with exams (SSC CPO 38, Free Courses 16, State Exams 14, GK/GS 12, Maths 11, English 9, Science 7, Reasoning 5, Combo 5 …); ours are all "All Courses" except 4 the admin re-filed. |
| Section | 41,097 of 41,131 | 34 | Renames, mostly in course 160. |
| Topic | 41,046 of 41,131 | 85 | Renames ("Circular Motion" → "RACE ." across the old physics courses), course 160 has 19. |
| Sub Topics | 30,723 of 30,752 | 29 | 17 ours blank, 12 renamed. |
| Tags | 90 of 137 | 47 | AppX has no tag field. Its `web_featured` (31) / `app_featured` (18) "featured" switches have nothing on our side. |

## Questions for whoever gave the task

1. **Prices**: are AppX's lower prices (often half) the prices Vidyagram should sell at, or an AppX-only sale? Our app
   still charges the import-time price. Same for 85–88: should they come off sale here?
2. **Category / Main Category**: should we file courses by AppX's exams (`exam_name`) as categories? The mapping is in
   the Category sheet. Which main category does each AppX folder (58, 57) mean?
3. **Faculty**: are the title names right to apply (Aditya vs Aditya Ranjan, Akash vs Akash Chaturvedi)? This is the
   import planned on 10-22 (`vidyagram-class-teacher-import.cjs`), still unrun.
4. **Combos 71, 75, 100**: should they be sold here?
5. **Tags**: does "Tags" mean AppX's featured switches, or something else?

## Done after the report (11-09, ledger in memory `prod-data-changes`)

- **Prices follow AppX** (user: "we should keep the prices in sync with appx"). `vidyagram-appx-price-sync.cjs`, price and
  enable from the live AppX list: 35 courses and 15 plans written; 85–88, 114, 133 off sale (plans untouched).
- **Two lengths, one plan each** (user: "add the course to both plans"). `vidyagram-appx-length-plans.cjs` put 101, 105 and
  151–159 on course selling with AppX's two lengths. Each kept its existing selling plan (and orders) for one length and got a
  new plan for the other.
- **Faculty**: 140 is Aditya Ranjan Sir; 134–137 (Skills) are the other Aditya. Not applied yet.
- **Combos 71, 75, 100** are AppX off-sale combos already handled here (off-sale plans hold exactly AppX's courses; all AppX
  orders imported). The Sub Courses check now counts off-sale plans.
- **Still open**: combo plans of AppX combos with no Course here keep old prices (132 ₹399 vs ₹199, 108 ₹899 vs ₹599) or stay
  on sale though AppX stopped them (76, 91, 128). No nightly price step yet.
