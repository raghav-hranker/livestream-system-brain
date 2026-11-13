# AppX combos vs Vidyagram, 2026-11-09

AppX "Make this a combo" → Sub Courses is stored as `detail.allotment_id` (it lists the combo itself too). Our match is
course selling's "Make this a combo" (`Course.selling.combo.subCourses`). Audit:
`reference/scripts/vidyagram-appx-combo-audit.cjs` (read-only, AppX side = mirror's 11-07 capture). "Orders" are all orders
on the plan, which includes AppX purchases the order sync copies in.

**11 AppX combos.**

## AppX sells it, no course here: needs a combo course (4)

| AppX | Combo | AppX price | Our plan today | Orders (30 d) | Sub courses |
|---|---|---|---|---|---|
| 137 | 3 in 1 Mastery Course By Aditya Sir | ₹199, 2 y | ₹199, 731 d | 12,835 (1,646) | 134, 135, 136 — same |
| 132 | UPGK + Computer Combo | ₹199 (MRP 1,999), 12 m | ₹399, 365 d | 3,434 (1,464) | 130, 131 — same |
| 108 | UPSI + UP Constable Combo | ₹599 (MRP 1,598), 24 m | ₹899, 730 d | 1,926 (577) | 104, 107 — same, plus 38 here |
| 89 | English Special VOD Batch By Jai Sir | ₹249 (MRP 1,999), 12 m | ₹479, 365 d | 1,393 (412) | 85, 86, 87, 88 — same |

Each has only a same-named plan here: no course card, so the app can sell the plan but cannot show the combo in the
catalogue. Three of four are overpriced against AppX. 89's sub courses (85–88) are off sale on their own since 11-09
(AppX stopped selling them singly); the combo still sells them.

## AppX sells it, combo set up here (1)

| AppX | Combo | State |
|---|---|---|
| 171 | UPSSSC Mains (All in One) Foundation | ₹799 both sides; sub courses 150, 165, 168 match. AppX also lists 172, which is empty in AppX and has no course here. |

## AppX stopped selling it (enable 1, price −1) (6)

| AppX | Combo | Here | Action |
|---|---|---|---|
| 91 | प्रहार 2.0 COMBO | no course; plan ₹1,499 **on sale**, 11,203 orders (3 in 30 d) | take the plan off sale, keep it active |
| 128 | प्रहार 3.0 Combo | no course; plan ₹1,199 **on sale**, 6,874 orders (4) | same |
| 76 | प्रहार COMBO (Without Maths) | no course; plan ₹699 **on sale**, 464 orders (1) | same |
| 71 | GS SPECIAL BATCH | course off sale; plan off (status 0), 250 orders | none |
| 75 | प्रहार COMBO BATCH | course off sale; plan off (status 0), 6,056 orders | none |
| 100 | staff combo | no course; plan off (status 0), 302 orders; lacks 76, 89, 91, 128, 137 (no course here) | none (staff access; see open note) |

Open: the staff plan's own course list lacks the 5 combos above, since they have no course here; staff get their sub courses
directly, so access is the same.

## Done 11-09 14:36 IST

89, 108, 132 and 137 are combo courses now (course selling, "Make this a combo" with AppX's sub courses), each holding its old
same-named plan and its orders, at AppX's price. The nightly price step keeps them in step. 89's Sub Courses tab is empty
because 85–88 are off sale (the tab lists active courses only); buyers still get them. 76, 91, 128: not changed yet.

## 14:57 IST

76, 91, 128: plans hidden from every screen (displayOn []), still active so buyers keep access. Re-run of the match report:
141 of AppX's 153 courses have a course here (131 that morning); 12 missing, none with sellable content except 97 and 116.
