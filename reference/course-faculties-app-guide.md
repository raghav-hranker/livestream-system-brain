# Course faculties — app team guide

> A course can have several faculty, in an order the admin sets by dragging. The app shows them in
> that order, for example "Sahil Sir, +2 more" on a card and the full list behind "View more".
> No new endpoint and no new request field. Every course object the app already fetches carries a
> `faculties` array. Verified against production (`backend.quicktricksbysahilsir.com`, backend tip
> 18c8acef8) on 2026-10-22: every endpoint in §2 live except `my-courses`, which was checked in code.

---

## 1. The field

Each course object has two faculty fields:

| Field | Type | Meaning |
|---|---|---|
| `faculties` | array of faculty objects | **Every** faculty on the course, in the admin's order. Index 0 is the primary. |
| `facultyDetails` | one faculty object | The primary only (same as `faculties[0]`). Kept for older app builds. Do not use it for new UI. |

A faculty object:

```json
{
  "id": "6a9c4dabb7780840fa525c2f",
  "name": "Quick Tricks Team",
  "designation": "…",
  "bio": "A Dedicated team for Railways",
  "imageUrl": "https://hranker-server-v2.b-cdn.net/faculty/channels4_profile.jpg",
  "socialLinks": [],
  "videoUrl": "…",
  "experience": "30+ Years",
  "reach": "20 Lakh+ Students Taught",
  "description": "…"
}
```

Use `id` as the faculty id. Each object also has `"_id": 0`. That is a leftover of the server
projection and means nothing; ignore it. Any field other than `id` and `name` can be missing.

## 2. Where it appears

The same `faculties` array is on the course objects returned by:

| Endpoint | Used for |
|---|---|
| `POST /api/courses/filter` | course listing / tabs |
| `POST /api/courses/batch-filter` | batch listing |
| `POST /api/courses/by-id-2` | course detail |
| `GET /api/courses/:id` | course detail |
| `GET /api/courses/active` | active courses |
| `GET /api/courses/search` | in-app course search |
| `POST /api/courses/my-courses` | the student's purchased courses |

## 3. Rules the app can rely on

- **Order is meaningful.** Render `faculties` in array order. Never sort it by name.
- **Always present.** On the endpoints above `faculties` is always an array. A course saved before
  multi-faculty existed returns a one-item array built from its old single faculty.
- **Can be empty.** If the course has no faculty, or its faculty was deleted, `faculties` is `[]`.
  Hide the faculty line.
- **No duplicates.** The server drops a repeated id.
- **Changes show on the next fetch.** When the admin reorders, the next response has the new order.

## 4. Suggested rendering

The exact design is the app's call. One pattern that fits the "Faculty 1, … view more" idea:

- **Course card.** The first name, then the count of the rest: `Sahil Sir` when there is one,
  `Sahil Sir +2 more` when there are three.
- **Course detail.** The first one or two faculty with photo and designation, then **View more**
  opening a sheet that lists all `faculties` in order.

```ts
type Faculty = { id: string; name: string; imageUrl?: string; designation?: string };

function facultyLine(faculties: Faculty[] = []): string {
  if (faculties.length === 0) return '';
  const [first, ...rest] = faculties;
  return rest.length ? `${first.name} +${rest.length} more` : first.name;
}
```

For an app build that must also run against an older backend, fall back to
`course.faculties ?? (course.facultyDetails ? [course.facultyDetails] : [])`.

## 5. Source of truth (for the backend team)

| What | Where |
|---|---|
| Stored list + primary | `quicktricks-backend` `src/models/Course.ts` (`faculties`, `facultyDetails`) |
| Write rule (`facultyDetails = faculties[0]`) | `src/utils/courseFaculties.ts` `resolveCourseFaculties` |
| Ordered read (`$lookup` then re-ordered by the stored ids) | `src/utils/courseFaculties.ts` `getCourseFacultiesProjection` |
| Admin drag order | `quicktricks-admin` `components/admin/CourseForm.tsx` (sends `faculties` in list order) |
