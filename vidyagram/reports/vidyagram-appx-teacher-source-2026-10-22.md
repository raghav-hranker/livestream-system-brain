# Can AppX give Vidyagram classes their real teacher? (2026-10-22)

Tenant: Vidyagram (781, AppX org 2177599). Read-only. Nothing was written to any database, nothing was deployed,
and no AppX calls were made. Auto mode blocked a live vidyagramdb read, so the counts come from the saved
2026-10-19 export (`outputs/vidyagram-import-verify-2026-10-19/`). That export has 10,731 classes (9,773 active),
the import ledger, the AppX mirror and `facultydetails`. Today's 10,826 classes include about 95 later nightly
classes. Those are not counted here.

Script: [`reference/scripts/vidyagram-class-teacher-sources.cjs`](../../reference/scripts/vidyagram-class-teacher-sources.cjs)
(offline, no DB). Output: `outputs/vidyagram-class-teachers-2026-10-22/`, with `class-teachers.csv` (one row per
class: teacher, signal, confidence, every name seen), `courses.csv`, `names.csv` and `summary.json`.

## Answer

AppX has **no per-class teacher field**. It does keep teachers by name **in titles and folder names**, and it
has a **course-level teacher registry**. Together these name a teacher for **72% of classes** (7,688 of 10,731).
For active classes the share is 70% (6,888 of 9,773). Where several signals cover the same class, they never
disagree. The other 28% sit in multi-subject combo batches, where AppX names nobody. A person has to supply
those teachers.

## 1. What AppX exposes

| Source | Teacher data? |
|---|---|
| Content rows (`get_pc4_contents`, `get_content_by_id`, student `folder_contentsv3`; mirror `apxcatalogrows`, `apxcatalogtree`) | **None.** I scanned every key, and no field names a teacher, faculty, instructor or author. This matches the quicktricks finding in memory note `apx-teacher-names`. |
| Folder rows (`getFolderPaths`) | `teacher_id` is `-1` on all 11,239 folders. `creator_id` (0, 1, 51, 54, 58, 69, 75) is the AppX admin account that made the folder, not a teacher. Account 75 made folders in 41 courses. |
| Course detail (`get_course_by_id`, `apxcatalogcourses.detail.teacher_id`) | **Yes, but sparse.** 15 of 147 courses carry AppX teacher ids 61–79, for example 63 Jai Sir (course 68), 62 Akash Chaturvedi (70), 74 Pushpendra (110, 125), 73 Shubham Grover (126, 127), 64 and 78 Arti Ma'am (73, 124), 66,65 "GS Expert Team" (77), and 79 on the UPSSSC courses 130/131/132/150. The other 130 courses have `-1`. |
| AppX teacher list (ids → names, maybe photos) | We have not captured it. The capture uses only the four `paid_course4/*` endpoints and the student tree. We hold no teacher endpoint or page. Reading it would take one admin-session call. I did not make it, because the session cookie is in vidyagramdb. |

Names in titles take three forms: `… | Deepak Sir`, `(By Aditya Sir)` and `… By Pulkit Sir`. Folders read like
`Complete GS By Deepak Sir`, `Science (By Arti Mam)` and `Shivant Sir Polity`. Course titles read like
`ENGLISH SPECIAL BATCH By Jai Sir`. The catalogue planner already pulls a teacher out of a dropped teacher folder
as `facultyHint` (tasks 03c/03d). The class import never used it and stamped `CLASS_IMPORT_TEACHER =
'Vidyagram Team'` (`apxCatalogClassImport.ts:21`).

## 2. Coverage and confidence

The script picks one teacher per class, trying four signals in order:

| Signal | Rule | Classes | Confidence |
|---|---|---|---|
| title | the class's own AppX title, on any placement, names one teacher | 1,038 | high |
| folder | a folder on any placement path names one teacher | 1,332 | high |
| sibling | no name of its own, but ≥3 classes in the same folder all name the same one teacher | 190 | medium |
| course | an AppX course the class is in names exactly one teacher and no "Team" | 5,128 | medium |
| multiple | two names in one signal | 1 | review |
| none | — | 3,042 | — |

- **Agreement.** No class gets one name from its title or folder and a different one from its course. The two
  course titles that name several teachers are UPSI 22 ("BY VIKRAMJEET SIR, ADITYA RANJAN SIR AND RANKERS GURUKUL
  TEAM") and UP SI 42. Those are not used as a course signal.
- **Aditya Ranjan Sir dominates the course signal**: 4,274 of the 5,128 course-signal classes. They come from
  about 50 Maths batches titled "… by ADITYA SIR" or "BY ADITYA RANJAN SIR". Their class titles carry no names at
  all, which fits a one-teacher batch. The AppX org is `armaths` (AR Maths).
- **The unmatched 3,042** are almost all in combo batches with subject folders and unnamed titles. By AppX
  course: UP SI 42 (842), UPSI 22 (679), SSC GD 2027 101 (389), UP Police 2027 104 (363), UPSI 107 (334), UPSSSC
  PET 114 (194), CGL Mains 2020 7 (149), UPSSSC PET crash 133 (74). The rest are small UPSSSC and Railway
  courses. A class can count under more than one course.
- **Courses** (our 149 Course docs): 100 have one teacher across their named classes, 25 have several (the combo
  and GS Expert Team batches, so `Course.faculties` would be an ordered list), 4 have no teacher found, and 20
  have no classes.

**Teachers found: 21.** By classes: Aditya Ranjan Sir 4,407; Jai Sir 718; Shubham Grover Ma'am 397;
Deepak Sir 375; Arti Ma'am 323; Akash Chaturvedi Sir 256; Anurag Sir 238; Himanshu Sir 199; Pushpendra Sir 141;
Shivant Sir 130; Mohit Sir 119; Ajeet Sir 104; Ankit Sir 102; Pulkit Sir 89; D.S Sir 42; Amit Sir 36; VK Sir 5;
Riya Ma'am 3; Vishal Sir 2; Manoj Sir 1; Anshi Ma'am 1.

**FacultyDetails.** The 10-19 export has one profile, "Vidyagram Team". Since then "Test Faculty (QA)" was added
(10-22). **None of the 21 teachers has a profile**, so every one would need creating.

Spelling merges: "Shubham Mam/Ma'am" becomes Shubham Grover Ma'am, and "Arti Mam" becomes Arti Ma'am.
**Aditya Sir = Aditya Ranjan Sir in the Maths batches: confirmed by the user on 2026-10-22.** That merge decides
4,000+ classes. It is still open for the 46 classes in the "Mobile Video Editing / Graphic Design / AI Mastery …
By Aditya Sir" courses (134–136), which may be a different Aditya. Two merges are still **guesses** to confirm:
Jay Sir = Jai Sir, and Akash Sir = Akash Chaturvedi Sir.

## 3. Recommendation

The source is **reliable enough for a bulk import of the high-confidence rows**: 2,370 classes named by their own
title or folder. It is **probably right for the course-signal rows** (5,128). "Aditya Sir = Aditya Ranjan Sir" in the Maths
batches is confirmed. What remains is confirming that the named English and Reasoning batches have a single
teacher, and keeping courses 134–136 out until their Aditya is known. It is
**not enough for the 3,042 combo-batch classes**. Those need a small human table from the client: AppX course ×
subject folder → teacher, for example "SSC GD 2027 › Hindi = Mohit Sir". That is about 60–80 rows, and the
script's folder output gives the list to fill in.

What the import would look like (a later step, after approval):

1. **Create the profiles.** One `FacultyDetails` per confirmed teacher (customer 781, status 1). Profiles for
   teachers with upcoming live classes need an `rtmpUrl`, because the stream settings fall back to finding the
   encoder by `teacherName` when the streamer token's admin id has none
   (`classStreamSettingsController.ts:104`).
2. **Dry run.** A `vidyagram-importClassTeachers` script in the backend (shape of
   `vidyagram-backfillClassFacultyId.ts`) re-runs this script's rules against live vidyagramdb. It lists class →
   teacher, signal, confidence and the old values, and writes nothing. Filters: `--confidence high|medium` and
   `--only-placeholder` (touch only classes still on "Vidyagram Team" with no `facultyId`, so a manual Change
   faculty is never overwritten).
3. **`--commit`.** Sets `teacherName` and `facultyId` together, the same write as `POST
   /api/admin/classes/faculty` (`adminClassFacultyController.ts:64`). It runs high first, then medium, then the
   client table. It writes a backup file of old values first and records the run in the prod-data-changes ledger.
4. **Re-snapshot.** `vidyagram-resnapshotClassFeedbackFaculty.ts`, dry run then `--commit`, so earlier class
   ratings move to the new teachers.
5. **Courses.** Set `Course.faculties` from the ranked teachers in `courses.csv`, the admin drag order. This is
   a separate decision: 25 courses have several teachers, and "Vidyagram Team" stays where no teacher was found.

**Nightly sync.** Put the same rule into the nightly class import instead of `CLASS_IMPORT_TEACHER`. Use the
title, then the planner's `facultyHint`, then the course name, then the client table. Fall back to "Vidyagram
Team" when nothing matches. New classes then get their teacher on the night they arrive. Keep the stamp
first-import-only, as today, so Change faculty is never undone. Most new rows are LIVE_STREAM recordings in
courses 95, 129, 105, 74 and 107. Their titles mostly carry "| X Sir", so they would mostly match.

## Open questions for the user

1. ~~Is Aditya Sir = Aditya Ranjan Sir across the Maths batches?~~ Yes (user, 2026-10-22). Still open: is the
   "Aditya Sir" of the Mobile Video Editing / Graphic Design / AI Mastery courses (134–136) the same person?
2. Are **Jay Sir = Jai Sir** and **Akash Sir = Akash Chaturvedi Sir**? What are the full names of D.S Sir, VK
   Sir, Amit Sir, Vishal Sir, Manoj Sir and Anshi Ma'am?
3. May I make **one AppX admin call** to read the teacher list (ids 61–79 → names)? It would confirm the merges
   and might give photos for the new profiles. It needs a read of the stored AppX session.
4. Will the client fill in a **course × subject → teacher table** for the combo batches (3,042 classes)? Or do
   those stay "Vidyagram Team"?
5. Should the bulk import take **high only**, or **high + course-signal**?
6. Should course faculty be set from the class teachers in the same run, or later?

## Appendix: faculty profiles to create (draft, 2026-10-22)

The public site vidyagram.online has no faculty page, and course pages repeat only the title's name. The
captured AppX course descriptions (`apxcatalogcourses.detail.description`) give subjects and two full names.
They also support the alias guesses: "English Expert Jai Sir" alongside "English By Jay Sir" in the English
folders, and "Reasoning Expert Akash Chaturvedi Sir" alongside "🧠 Reasoning: Akash Sir". The combo batch
descriptions list subject → teacher ("Hindi: Mohit Sir", "Reasoning – Pulkit Sir", "UP GK – VK Sir"). That is
the course × subject table the 3,042 unmatched classes need, already written by the client.

The admin form requires name, experience, reach and description. Picture, subject, designation, rating and RTMP
are optional. No teacher photos were found.

| # | Name (= `teacherName`) | Subject chip | Classes | Evidence |
|---|---|---|---|---|
| 1 | Aditya Ranjan Sir | Maths | 4,407 | Maths batches; confirmed alias |
| 2 | Jai Sir | English | 718 | "English Expert Jai Sir" |
| 3 | Shubham Grover Ma'am | Static GK & Computer | 397 | "Static GK Expert", "Computer Expert" |
| 4 | Deepak Sir | GK/GS | 375 | "Deepak – GS Expert" |
| 5 | Arti Ma'am | Science | 323 | Science batches |
| 6 | Akash Chaturvedi Sir | Reasoning | 256 | "Reasoning Expert" |
| 7 | Anurag Sir | Maths | 238 | "Maths: Aditya Sir & Anurag Sir" |
| 8 | Himanshu Sir | GK/GS | 199 | GS batches |
| 9 | Pushpendra Sir | Science | 141 | Science batches |
| 10 | Shivant Sir | Polity | 130 | "Shivant Sir Polity", "Static GK by Shivant Sir" |
| 11 | Mohit Sir | Hindi | 119 | "Hindi – Mohit Sir" |
| 12 | Ajeet Sir | Polity | 104 | "Polity (By Ajeet Sir)", "GK/GS – Ankit Sir & Ajeet Sir" |
| 13 | Ankit Sir | GK/GS | 102 | "GK/GS – Ankit Sir" |
| 14 | Pulkit Sir | Reasoning | 89 | "Reasoning – Pulkit Sir" |
| 15 | D.S Sir | Geography | 42 | "Indian Geo by D.S Sir"; full name unknown |
| 16 | Amit Sir | Static GK | 36 | "Static GK by Amit Sir" |
| 17 | VK Sir | UP GK | 5 | "UP GK – VK Sir" |
| 18 | Riya Ma'am | Computer | 3 | "Riya Mam – Computer Specialist" |
| 19 | Vishal Sir | Geography | 2 | "Orientation Class by Vishal Sir" (Geography) |
| 20 | Manoj Sir | Maths | 1 | "Manoj Sir – Maths" |
| 21 | Anshi Ma'am | Bihar GK | 1 | "Anshi Ma'am – Bihar GK" |
| 22? | Vikramjeet Sir | ? | 0 | Named only in UPSI course titles 22/42; no class matched |

**Created 2026-10-22.** The user ran `reference/scripts/vidyagram-create-faculties.cjs` with `COMMIT=1`. It created all 22
rows above, including Vikramjeet Sir with no subject chip and "UPSI Faculty" as his description. Experience and reach
are "—". Faculty went from 2 to 24. Ids are in `outputs/vidyagram-class-teachers-2026-10-22/faculty-create-commit.log`.
No class or course is linked yet.

## Live dry run: class → teacher (2026-10-22, read-only)

Script: [`reference/scripts/vidyagram-class-teacher-import.cjs`](../../reference/scripts/vidyagram-class-teacher-import.cjs).
It reads only and has no write path yet. It ran on webserver2-2 against live vidyagramdb. Output is in
`outputs/vidyagram-class-teacher-import-2026-10-22/`: `class-teacher-dryrun.csv` (one row per class, sorted by
confidence), `dryrun.json` and `summary.json`.

It covers 10,822 imported classes (9,863 active). **All of them are still "Vidyagram Team" with no `facultyId`**,
so none was changed by hand.

| Tier | Rule | Classes | What it is |
|---|---|---|---|
| high | title | 1,061 | the class's own title names the teacher |
| high | folder | 1,356 | a folder on its path names the teacher |
| medium | course | 5,148 | the AppX course title names one teacher (mostly Aditya Ranjan's Maths batches) |
| medium | description | 105 | subject line in the course description (courses 74, 105, 133, 150, 161–164) matched to the class's subject folder |
| medium | sibling | 208 | same folder, every stated class has one teacher (only 3 of 2,647 such folders are mixed) |
| low | subject | 378 | same top subject folder in the course, every stated class has one teacher (15 of 423 mixed, ~3.5%) |
| — | conflict | 2 | "Maths Operator" in course 74: course says Akash, another signal says Aditya |
| — | review | 80 | description gives several teachers for the subject (GS, Science in 133/114/150) |
| — | none | 2,484 | mostly UPSI 42/22, UP Police 104, SSC GD 101, UPSI 107, UPSSSC 114 |

Changes from the offline estimate:
- The course descriptions were added as a source.
- A rule that assumed a whole course had one teacher was dropped. It put course 7's Chemistry classes on Aditya
  Ranjan Sir.
- The tallies behind the inferred rules now count every stated teacher, not only title and folder names. Before,
  Shivant Sir's Polity folder made all of UPSI 22 look like his.

**Proposed for commit:** high + medium = **7,878 classes (73%)**, plus low = 378 more if you accept a ~3.5% risk.
That is 8,256 in all (76%). Conflict, review and none stay "Vidyagram Team".

| Teacher | high | medium | low |
|---|---|---|---|
| Aditya Ranjan Sir | 97 | 4,333 | 245 |
| Jai Sir | 77 | 667 | 44 |
| Shubham Grover Ma'am | 320 | 83 | 3 |
| Deepak Sir | 384 | 0 | 0 |
| Arti Ma'am | 325 | 4 | 0 |
| Akash Chaturvedi Sir | 70 | 213 | 0 |
| Anurag Sir | 230 | 12 | 0 |
| Himanshu Sir | 206 | 2 | 14 |
| Mohit Sir | 87 | 62 | 46 |
| Pushpendra Sir | 143 | 0 | 0 |
| Pulkit Sir | 90 | 19 | 21 |
| Shivant Sir | 130 | 0 | 0 |
| Ajeet Sir | 84 | 22 | 0 |
| Ankit Sir | 84 | 19 | 0 |
| D.S Sir | 42 | 0 | 0 |
| Amit Sir | 36 | 0 | 0 |
| Riya Ma'am | 3 | 17 | 5 |
| VK Sir | 5 | 8 | 0 |
| Vishal Sir, Anshi Ma'am, Manoj Sir | 2, 1, 1 | 0 | 0 |
| Vikramjeet Sir | 0 | 0 | 0 |

Course 164's description also names "Rashika Ma'am – English". No class maps to her yet, and she has no profile.
