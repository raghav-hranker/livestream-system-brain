# Course class tabs: API contract

> Live on the quicktricks backend since 2026-09-25. Cards have carried the class's PDFs in `classPdf`
> since 2026-09-26.
> `POST /api/courses/:courseId/todays-classes` keeps its shape. Its cards now carry `classPdf` too; the
> change only adds data, so builds already shipped keep working.
> **`search` (see "Search inside a tab") is LIVE since 2026-09-29 (fork `3dbd03295`).**

## Endpoint

```
POST {BASE}/api/courses/{courseId}/class-tabs
Content-Type: application/json
Authorization: Bearer <login token>      (optional)
```

`BASE` in production: `https://backend.quicktricksbysahilsir.com`.

## Request body

| Field | Type | Values | Default | Notes |
|---|---|---|---|---|
| `tab` | string | `today` · `upcoming` · `previous` | **required** | |
| `watch` | string | `all` · `watched` · `partial` · `not_watched` | `all` | Filters Today and Previous. Ignored on Upcoming, but still validated there. |
| `cursor` | string \| null | the `nextCursor` from the previous page | first page | Upcoming and Previous only. Ignored on Today. |
| `limit` | integer | 1–50 | 20 | Upcoming and Previous only. Ignored on Today, but still validated there. |
| `search` | string \| null | what the student typed | whole tab | All three tabs. Blank = whole tab. 1 character = 400. See "Search inside a tab". |

- Omit a key rather than sending `null`. `watch: null` and `limit: null` return 400. `cursor: null` is fine.
- `limit` must be a JSON number. `"20"` returns 400.
- `userId` or any other extra key is **ignored**. The student is identified only by the token.

## Auth

| Caller | Result |
|---|---|
| No token | guest: every card is `not_watched` with `watchTime: 0` |
| Valid token | cards carry that student's watch status for **this course** |
| Invalid, expired or logged-out token | treated as a **guest**, still 200. This endpoint never returns 401 or 403. |

There is no access check. The app still computes the Locked badge, and playback still goes through
`GET /api/classes/{classId}/playback`.

## Response

```json
{
  "state": 200,
  "msg": "Class tab retrieved successfully",
  "data": {
    "classes": [ /* cards */ ],
    "nextCursor": "v1.…",
    "totalCount": 48,
    "tabCounts": { "today": 7, "upcoming": 8, "previous": 904 }
  }
}
```

`nextCursor` is `null` on the last page, and always `null` on Today.

`totalCount` is the number of classes in the requested tab across **all** pages, not just this one — use it
for the tab badge ("Previous (48)"). It follows the `watch` filter: `{"tab":"previous","watch":"watched"}`
counts only watched Previous classes. It is the same on every page of one tab, and on Today it always equals
`classes.length`.

`tabCounts` is the size of **all three** tabs of the course, on every response, whichever tab you asked
for — use it to badge every tab from one call. Unlike `totalCount` it **ignores** the `watch` filter: it is
always the whole tab. So on `{"tab":"previous","watch":"all"}` the two agree
(`totalCount == tabCounts.previous`); with `watch: "watched"`, `totalCount` is the filtered number.

## Tabs

Days are Indian Standard Time (IST) calendar days. A class's date is the course's own date for it, else
the class's date; it comes back as `startDate`.

| Tab | Contains | Order | Paged |
|---|---|---|---|
| `today` | classes dated today, **plus** any Live class (`streamStatus` `live`/`reconnecting`) from any day | Live first, then `startDate` ↑, then `_id` ↑ | no (whole day) |
| `upcoming` | classes dated after today that are not Live | `startDate` ↑, then `_id` ↑ | yes |
| `previous` | classes dated before today that are not Live and have `hasPlayback: true` | `startDate` ↓, then `_id` ↓ | yes |

These never appear in any tab: deactivated (cancelled) placements, inactive classes, and classes with no
date.

## Search inside a tab

Send what the student typed as `search`, with the same `tab`, `watch`, `limit` as usual:

```json
{ "tab": "previous", "watch": "all", "limit": 20, "search": "percentage" }
```

- The tab keeps only the classes whose card `title` matches. Nothing else changes: the **order is the
  tab's own order** (Previous newest first, Upcoming soonest first, Today Live first), and `watch` and
  paging work as usual. Results are never re-sorted by how well they match.
- Matching is the same as course search: every typed word must appear, in any order, ignoring case and
  punctuation; numbers are whole (`44` never matches `144`); longer words also match close spellings
  (`alligation` finds "Allegation").
- Each card gets `searchMatch`: `"exact"`, or `"similar"` when it was found only through a close
  spelling — show a small "similar spelling" hint on those.
- `data.search` = `{ "query": "percentage", "similarSpellings": [{ "word": "alligation", "alternatives": ["allegation"] }] }`.
  Use `similarSpellings` for a line like "Also showing results for allegation".
- `totalCount` counts the matching classes (after `watch`), and **`tabCounts` counts the matching classes
  in each tab** — so while searching, "Upcoming (2)" tells the student that another tab has results.
- Blank or whitespace-only `search` (or only punctuation) is the normal tab: the response is exactly the
  unsearched one, with no `searchMatch` and no `data.search`. Send `""` when the box is cleared.
- A 1-character `search` returns 400 (wait for 2 characters before calling); so does one over 100 characters.
- **Paging:** a `nextCursor` is tied to its search. Send it back with the **same** `search`. A cursor with a
  different search, a searched cursor without `search`, or a plain cursor with `search` returns 400
  `Cursor belongs to a different search` — reset to page 1 when the text changes. Case and spacing do not
  count as a change (`"Percentage "` = `"percentage"`).

## Watch status (Today and Previous)

- `watchTime` is the longest single session in seconds, capped at `duration`. It is never a sum.
- `watched`: the student marked it complete, or `watchTime` ≥ 90% of `duration`. A Live class is never
  `watched`.
- `partial`: `watchTime` ≥ 60 s and not watched.
- `not_watched`: everything else, including after "mark uncomplete".
- Upcoming cards are always `not_watched` with `watchTime: 0`.
- `manualCompleted` tells you *why* a card is `watched`: `true` means the student marked it, `false` with
  `watched` means they watched ≥ 90%. Use it to show the "mark as complete" toggle already ticked.
- A guest with `watch: watched` or `watch: partial` gets an empty list.
- The watch filter runs before paging, so every page except the last is full.

## Paging (Upcoming and Previous)

1. Page 1: send no `cursor`.
2. Next page: send the same `tab`, `watch` and course, with `cursor` = the `nextCursor` you received,
   unchanged.
3. Stop when `nextCursor` is `null`.
4. **Reset to page 1** when the tab, the watch chip, the search text or the course changes. A cursor sent with a different
   `watch` value or course is **not rejected**: it silently skips classes.
5. If a request with a cursor returns 400, reset to page 1.

## Card

This is the same card as `todays-classes`, **without** `isCompleted` and **with** `watchStatus`,
`watchTime` and `manualCompleted`. A field whose value is missing in the database is **omitted**, not sent as `null`, so treat
unmarked fields as optional.

| Field | Type | Notes |
|---|---|---|
| `_id`, `courseClassId` | string | placement id (same value); use it as the list key |
| `classId` | string | use it for `/playback`, `/class-progress` and mark complete |
| `course` | string | |
| `title` | string | per-course override already applied |
| `description`, `teacherName` | string? | |
| `startDate` | ISO datetime | always present |
| `endDate` | ISO datetime? | |
| `duration` | number? | seconds, can be a decimal |
| `streamStatus` | string? | `preparing` · `live` · `reconnecting` · `processing` · `ended`, or absent |
| `isBlinking` | bool | true only when `streamStatus` is `live` |
| `hasPlayback` | bool | there is something to play |
| `isLive` | bool? | schedule snapshot; **don't** use it for a LIVE badge |
| `isFree` | bool | free in this course, or free globally |
| `image`, `link` | string? | |
| `class_link` | string | `class_link`, else `link`, else `""` |
| `isYoutubeRedirect` | bool | |
| `isShort`, `isChat`, `isTopper` | bool? | |
| `priority`, `status`, `isActive`, `addedAt` | | placement metadata (`status` is always 1 and `isActive` always true here) |
| `classCreatedAt`, `classUpdatedAt` | ISO datetime? | |
| `viewCount`, `uniqueViewCount` | int? | |
| `classPdf` | array | the class's PDFs, see below; `[]` when it has none |
| `classTest` | array | always `[]` |
| `mainCategory` | `{_id, mainCategoryName}` \| null | |
| `category` | `{_id, categoryName}` \| null | |
| `internalSection` | `{_id, sectionName}` \| null | |
| `topic` | `{_id, topicName}` \| null | |
| `watchStatus` | string | `watched` · `partial` · `not_watched` |
| `watchTime` | int | seconds |
| `manualCompleted` | bool | the student tapped "mark as complete" on this class (in this course). Always `false` for guests and on Upcoming. Can be `true` on a Live card whose `watchStatus` is not `watched` |

### `classPdf` items

The class's active PDFs, in the order the admin set. Same item shape as `GET /api/classes/{classId}/pdfs`.
There is no file URL in the item. To open a PDF, call
`GET /api/classes/{classId}/pdfs/{id}/access` with the student token; it returns a short-lived signed URL.

| Field | Type | Notes |
|---|---|---|
| `id` | string | PDF id, used in the access URL |
| `title`, `description`, `teacherName` | string | `""` when missing |
| `priority` | int | display order in this class, 1 first |
| `isFree` | bool | free in this class, or free globally |
| `isDownloadable` | bool | whether the app may offer Download |
| `asset` | `{state, mimeType, sizeBytes?}` | `state` is `ready` or `legacy`; both open through the access URL |
| `image`, `link` | string | `""` when missing |
| `status`, `isLive` | | PDF metadata (`status` is always 1 here) |
| `mainCategory`, `category`, `section`, `topic` | object? | `{_id, …Name}` |
| `createdAt`, `updatedAt` | ISO datetime | |

## Errors

| HTTP | `msg` | When |
|---|---|---|
| 400 | `Invalid course ID format.` | `courseId` is not a 24-hex ObjectId |
| 400 | `Validation failed` (`data` = list of field errors) | bad or missing `tab`, bad `watch`, `limit` outside 1–50 or not an integer, empty or non-string `cursor` (applies on every tab) |
| 400 | `Invalid cursor` | the cursor is malformed or was edited (Upcoming and Previous) |
| 400 | `Cursor belongs to a different tab` | an Upcoming cursor sent to Previous, or the reverse |
| 400 | `Cursor belongs to a different search` | the cursor was issued for another `search` (or none) — reset to page 1 |
| 400 | `Validation failed` | `search` is 1 character or over 100 after trimming, or not a string |
| 404 | `Course not found.` | the course id is well-formed but no such course exists |
| 500 | the error message, or `Server Error` | unexpected failure |

## Examples

```bash
URL=https://backend.quicktricksbysahilsir.com/api/courses/$COURSE/class-tabs
H=(-H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN")

curl -sS -X POST "$URL" "${H[@]}" -d '{"tab":"today"}'
curl -sS -X POST "$URL" "${H[@]}" -d '{"tab":"today","watch":"not_watched"}'
curl -sS -X POST "$URL" "${H[@]}" -d '{"tab":"upcoming","limit":20}'
curl -sS -X POST "$URL" "${H[@]}" -d '{"tab":"previous","watch":"partial","limit":20}'
curl -sS -X POST "$URL" "${H[@]}" -d '{"tab":"previous","watch":"partial","limit":20,"cursor":"<nextCursor>"}'
```

```dart
final res = await dio.post('/api/courses/$courseId/class-tabs', data: {
  'tab': 'previous',
  'watch': 'not_watched',          // omit on upcoming
  'limit': 20,                     // omit on today
  if (cursor != null) 'cursor': cursor,
});
final classes = res.data['data']['classes'] as List;
final String? nextCursor = res.data['data']['nextCursor'];
```
