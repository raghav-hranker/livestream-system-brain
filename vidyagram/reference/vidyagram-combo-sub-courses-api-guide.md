# Vidyagram combo courses: listing and Sub Courses tab

> For the app and website teams. How to show a combo course: the combo mark on course lists, and the Sub Courses
> tab on the course page.
>
> Base URL: `https://backend.vidyagramar.com/api`.
>
> **Status (2026-11-06): live on production.** `subCourses` on the course page since 17:38 IST, on course lists since 18:16 IST. The samples come from the real Vidyagram database, for
> the course "UPSSSC MAINS (ALL IN ONE) FOUNDATION BATCH 2026-27". They are trimmed to the fields this guide discusses.

---

## 1. What a combo is

A combo is one course a student buys that opens several courses. "UPSSSC MAINS (ALL IN ONE)" costs ₹799, and a
buyer gets it plus UPSSSC RO/ARO 2026, UPSSSC VPO & VDO 2026 and UPSSSC Junior Assistant 2026. An admin picks
those courses on the admin course form. The app buys a combo exactly as any course: same plans, same checkout.

---

## 2. Course lists: sub courses and the Combo tab

Every course list now carries `subCourses` on each course, the same list the course page sends (§3): the combo
itself first, then each course inside it. A course that is not a combo has `subCourses: []`.

- `POST /api/courses/filter`
- `POST /api/courses/batch-filter`
- `GET /api/courses/active`

Use it to show what a combo includes right on the card, without opening the course.

```bash
curl -s https://backend.vidyagramar.com/api/courses/filter -H 'content-type: application/json' -d '{"tab":"all"}'
```

```json
{
  "data": {
    "courses": [
      {
        "id": "6aebd4de20c23da7c5515026",
        "title": "🚀 UPSSSC MAINS (ALL IN ONE) FOUNDATION BATCH 2026-27",
        "isCombo": false,
        "price": 799,
        "discountPrice": 799,
        "validity": "24 Months",
        "subCourses": [
          { "id": "6aebd4de20c23da7c5515026", "title": "🚀 UPSSSC MAINS (ALL IN ONE) FOUNDATION BATCH 2026-27", "price": 799, "validity": "24 Months", "...": "same fields as §3" },
          { "id": "6ae46684258d21c8696f895e", "title": "UPSSSC RO/ARO 2026 (शासन बैच)", "price": 599, "validity": "12 Months" },
          { "id": "6ad9d7c146f19feb52b126e3", "title": "UPSSSC VPO & VDO 2026 ग्रामोदय बैच", "price": 599, "validity": "12 Months" },
          { "id": "6ad5fa9d308a95d039c38a7a", "title": "🚀 UPSSSC Junior Assistant 2026 (सहायक बैच) 🚀", "price": 599, "validity": "24 Months" }
        ]
      },
      {
        "id": "6ae46684258d21c8696f895e",
        "title": "UPSSSC RO/ARO 2026 (शासन बैच)",
        "isCombo": false,
        "subCourses": []
      }
    ],
    "courseFolders": []
  }
}
```

**`isCombo` is a different thing.** It is the admin's "Combo" mark, and it decides only whether the course appears
on the catalogue's Combo tab (`{ "tab": "combo" }`) and any Combo badge. A course can be on the Combo tab with
`subCourses: []`, and a course with sub courses can have `isCombo: false`, as UPSSSC above. To show what a course
includes, read `subCourses`, never `isCombo`.

---

## 3. Course page: the Sub Courses tab

`POST /api/courses/by-id-2` with `{ "id": "<courseId>" }` now returns `data.subCourses`. For a combo it lists:

1. **the combo itself first**,
2. then each course inside it, in the order the admin set.

For a course that is not a combo, `subCourses` is `[]`. Only active courses are listed: a draft or deleted course
inside a combo is left out. No token is needed for this field.

```json
{
  "data": {
    "id": "6aebd4de20c23da7c5515026",
    "title": "🚀 UPSSSC MAINS (ALL IN ONE) FOUNDATION BATCH 2026-27",
    "isCombo": true,
    "price": 799,
    "discountPrice": 799,
    "validity": "24 Months",
    "subCourses": [
      {
        "_id": "6aebd4de20c23da7c5515026",
        "id": "6aebd4de20c23da7c5515026",
        "title": "🚀 UPSSSC MAINS (ALL IN ONE) FOUNDATION BATCH 2026-27",
        "banner": "https://appx-content-v2.classx.co.in/paid_course3/2026-11-04-0_9517326102042072.jpeg",
        "bannerWebsite": null,
        "shortDescription": "",
        "price": 799,
        "discountPrice": 799,
        "validity": "24 Months",
        "status": 1,
        "isLive": false,
        "isRecorded": false,
        "isFree": false
      },
      {
        "_id": "6ae46684258d21c8696f895e",
        "id": "6ae46684258d21c8696f895e",
        "title": "UPSSSC RO/ARO 2026 (शासन बैच)",
        "banner": "https://appx-content-v2.classx.co.in/paid_course3/2026-10-29-0_9731318032508535.jpeg",
        "bannerWebsite": null,
        "shortDescription": "",
        "price": 599,
        "discountPrice": 599,
        "validity": "12 Months",
        "status": 1,
        "isLive": false,
        "isRecorded": false,
        "isFree": false
      },
      { "id": "6ad9d7c146f19feb52b126e3", "title": "UPSSSC VPO & VDO 2026 ग्रामोदय बैच", "...": "same fields" },
      { "id": "6ad5fa9d308a95d039c38a7a", "title": "🚀 UPSSSC Junior Assistant 2026 (सहायक बैच) 🚀", "...": "same fields" }
    ]
  }
}
```

**How to draw it.** When `subCourses` is not empty, show a **Content → Sub Courses** tab. One card per entry, in
the order given: `banner` (or `bannerWebsite` on the website when it is set), `title`, and a **View Course** button
that opens that course's page by `id`. The first card is the combo itself; its View Course opens the same page, or
the app may scroll to the course's own classes instead.

**After purchase.** Nothing new is needed. A buyer of the combo finds every course inside it in My courses, as with
any purchase.

---

## 4. Checklist

- [ ] Course cards: show what a combo includes from the row's `subCourses` when it is not empty (optional).
- [ ] Combo badge from `isCombo`, if wanted. It is not the same as having sub courses.
- [ ] Combo tab: `POST /api/courses/filter { "tab": "combo" }`.
- [ ] Course page: show the Sub Courses tab from `by-id-2` `subCourses` when it is not empty, in order, the combo
      first.
- [ ] View Course on each card opens that course by `id`.
