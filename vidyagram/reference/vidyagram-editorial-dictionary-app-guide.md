# PYP Dictionary and Daily Editorial on the Vidyagram backend, app team guide

> Both features stop borrowing `node.topperswisdom.com` and run on Vidyagram's own backend.
>
> Base URL: `https://backend.vidyagramar.com/api`. Paths and response shapes do not change: the Vidyagram backend runs
> the same dictionary and editorial code as the toppers host. Closes the `free.md` row "PYP Dictionary + Daily
> Editorial data" and the `ApiManager.contentApiBaseUrl` TODO.

---

## 1. What to change in the app

1. `ApiManager.contentApiBaseUrl` → `"$baseUrl/api/"` (or delete it and use relative paths in `VocabRepository` and
   `EditorialRepository`, like every other repository).
2. Delete the content-host scope: `_contentHostPaths`, `_contentHostScopes`, `enterContentHostScope` /
   `exitContentHostScope`, the interceptor branch that swaps `options.baseUrl`, and the calls in `editorial_screen.dart`
   and `editorial_section.dart`. Test instructions, attempts, analysis, saved questions, plans, coupons and orders opened
   from an editorial then go to Vidyagram like the rest of the app.
3. Keep the two `voice.hranker.com` URLs (`/api/v1/translate`, `/api/v1/analyze-editorial-journal`). Since
   2026-11-12 the voice service reads Vidyagram's editorials and saves reading scores to Vidyagram; the URL is the same.
   Toppers editorial ids now return 404 there.
4. Unhide the PYP Dictionary and Daily Editorial rows only when we say content is in (section 4).

## 2. Endpoints, all on `backend.vidyagramar.com/api`

**PYP Dictionary** (`vocab_repository.dart`), unchanged:

| Call | Note |
|---|---|
| `GET words/{unread\|read\|bookmarked}?userId&page&limit` | |
| `GET words?type=daily_words&date&userId` | |
| `GET words/{unread\|read\|bookmark}/search?userId&q` | `bookmark/search` exists on Vidyagram. On the toppers host it never existed (toppers has `bookmarked/search`), so bookmark search failed until now. |
| `POST words/user-word`, `words/seen`, `words/bookmark`, `words/report` | Saved per Vidyagram student. |

Every word is free and unlocked on Vidyagram (`isFree: true`, `isLocked: false`); no plan is needed.

**Daily Editorial** (`editorial_repository.dart`), unchanged:

| Call | Note |
|---|---|
| `GET editorial-journals?type=ncert&userId` and `?type=daily_journal&date&userId` | |
| `GET editorial-journals/{id}`, `GET editorial-journals/{id}/parts?user_id` | Parts carry the student's reading score (the voice service writes to Vidyagram since 2026-11-12). |
| `POST editorial/{like\|save\|feedback}` | |
| `GET packages/explore-editorial/{userId}` | See section 3. |

## 3. The buy card (`explore-editorial`)

- It now offers Vidyagram's own plan with the Editorial feature (price and `planId` from that plan), instead of the
  toppers ₹49 plan id that does not exist on Vidyagram. Live since 2026-11-12.
- `is_buy: 1` and no `planId` when the student holds any active plan with the Editorial feature.
- **404** when Vidyagram has no Editorial plan on sale and the student has no access. The app already returns `null`
  on a non-200, so the buy card simply does not show. Keep that behaviour.
- Free editorials (`is_free: true`) open without a plan, as before.

## 4. Content

- Words: all 7,778 PYP Dictionary words are in (copied 2026-11-12). The dictionary can be tested as soon as step 1 is
  in a build.
- Editorials: 11 free ones copied from toppers on 2026-11-12 (one daily per day 6–12 Nov, 4 NCERT, no tests
  attached), so both tabs can be tested once step 1 is in a build. New ones come from admin.vidyagramar.com
  (Boosters → Editorial Journals). Days after 12 Nov stay empty until admins add editorials.
- The copied editorials keep their toppers ids; everything added from now on gets new Vidyagram ids. Don't cache ids
  from the toppers host across this change.
