---
tenant: vidyagram
status: in-progress
date: 2026-11-12
---

# PYP Dictionary + Daily Editorial off toppers, onto Vidyagram

The Vidyagram app borrows both features from toppers (`node.topperswisdom.com`, repo `abhi092515/nodejs-server`
branch `toppers-wisdom-prod`, pm2 25 on webserver2-2, DB adminPanelDB). Both are hidden in the app since 2026-11-09.
Background and counts: [voice-phonetics-for-vidyagram.md](voice-phonetics-for-vidyagram.md).

## Endpoints the app calls (app `hranker-com/vidyagram` main 4e019dd)

"Today" = host the app calls now. Every row already exists on `backend.vidyagramar.com` with the same controller code
as toppers (diffed 11-12: `wordController.ts` identical; `editorialJournalController.ts` differs only by
`escapeRegex` on search; Vidyagram adds `adminWrite` on writes and an `isActive` index).

### PYP Dictionary (`vocab_repository.dart`)

| Call | Today | Vidyagram route | Data in vidyagramdb |
|---|---|---|---|
| `GET words/{unread\|read\|bookmarked}?userId&page&limit` | toppers | yes | words copied 11-12 |
| `GET words?type=daily_words&date&userId` | toppers | yes | yes |
| `GET words/{unread\|read\|bookmark}/search?userId&q` | toppers | yes (`/bookmark/search` exists only on Vidyagram; toppers has `/bookmarked/search`) | yes |
| `POST words/user-word`, `words/seen`, `words/bookmark`, `words/report` | toppers | yes | starts empty (per-student) |

### Daily Editorial (`editorial_repository.dart`)

| Call | Today | Vidyagram route | Data in vidyagramdb |
|---|---|---|---|
| `GET editorial-journals?type=ncert&userId` | toppers | yes | **0 journals** |
| `GET editorial-journals?type=daily_journal&date&userId` | toppers | yes | 0 |
| `GET editorial-journals/{id}` | toppers | yes | 0 |
| `GET editorial-journals/{id}/parts?user_id` | toppers | yes | 0 |
| `POST editorial/{like\|save\|feedback}` | toppers | yes | starts empty |
| `GET packages/explore-editorial/{userId}` | toppers | yes, but returns the hard-coded toppers plan `69f8e245…` | **needs a Vidyagram plan** |
| `POST voice.hranker.com/api/v1/translate` | phonetics box | n/a (tenant-free) | n/a |
| `POST voice.hranker.com/api/v1/analyze-editorial-journal?partId` | phonetics box, writes adminPanelDB | n/a | repoint after journals move |

### Shared screens while an editorial screen is open (`ApiManager._contentHostPaths`)

`instructions/series/`, `series/`, `saved-questions`, `user-test/`, `report-questions/`, `packages/`, `users/zones`,
`plans/filter-active/`, `coupons/apply-coupon`, `orders/get-razorpay-order`, `orders/submit-apple-iap-order`,
`qr-codes` go to toppers with the Vidyagram token. They exist natively on Vidyagram; they are redirected only because
the journals' 324 test series live in adminPanelDB. Once journals and their tests are in vidyagramdb (or the tests
are dropped), the whole scope is deleted from the app.

## Admin

- Toppers admin = `raghav-hranker/admin-dashboard` branch `toppers-admin`, sidebar "Boosters": Grammar, Editorial
  Journals, Editorial Tags, Words.
- Vidyagram admin (`quicktricks-admin` branch `vidyagram-admin`) already ships the same pages (`app/admin/editorials`,
  `editorial-tags`, `words`, assign-tests, `api/editorial-media-upload`), and `lib/permissions.ts` lists the screens.
  The "Boosters" section in `components/Sidebar.tsx` is **commented out**. Enabling = uncomment the three entries,
  deploy, tick the screens for the roles that need them.
- Toppers admin stays as is: toppers' own app reads the same collections in adminPanelDB, so removing its pages is
  a toppers decision, not part of this move.

## Steps

Decision 11-12: port the functionality first; toppers' editorial content (381 journals, 324 tests, 7,221
questions) comes later, if at all. The dependency census for that copy is
`reference/scripts/vidyagram-editorial-tests-census.cjs` (taxonomy: 1 section, 2 main categories, 4 categories,
15 topics; only partial name matches in vidyagramdb; copies must carry `customer_id 781`).

1. Words copied to vidyagramdb. DONE 11-12, 7,778 rows, ledger in prod-data-changes.
2. Vidyagram admin shows Boosters → Editorial Journals, Editorial Tags, Words (Grammar stays hidden).
   Commit `1238159f` on `feat/vg-editorial-admin` (worktree `~/Projects/worktrees/vg-admin-editorial`), checked in a
   local preview. **Pushed to `vidyagram-admin` 2026-11-12 ~16:20 IST** (ff b6fc871e → 1238159f; Vercel deploys
   admin.vidyagramar.com). Tick the three screens for the roles that need them.
3. `explore-editorial` offers Vidyagram's own Editorial plan, 404 when none (app hides the card). Commit `436428b71`
   on `feat/vg-editorial-plan` (worktree `~/Projects/worktrees/vg-backend-editorial`), 4 integration tests pass.
   **DEPLOYED 2026-11-12 16:26 IST:** rebased onto 45fc3f8e6 (Uday's deploy at 16:22) as b95a44bd5 + dist dccee8feb
   (`qt-surgical-dist.sh`, 0 foreign; compiled test 4/4), pushed `vidyagram-admin`, box ff to dccee8feb, pm2 92
   restart 385, backup `~/vg-dist-backup-20261112-1626.tar.gz`. Live: explore-editorial 404 "Editorial plan not
   found" (no VG plan yet; was 200 with the toppers plan id), words 200, editorial list 200 empty.
3b. **Toppers' 11 free editorials copied 2026-11-12 ~16:50 IST** (user: "Copy, give recent dates"), via
   `reference/scripts/vidyagram-free-journals-copy.cjs`: same _ids, no tests attached, likes 0; the 7 daily ones
   re-dated one per day 2026-11-06 → 11-12 (original date in `copiedFrom.date`), 4 NCERT; 5 tags (customer_id 781).
   Media still on `toppers-wisdom.hranker.org` (200). Live: daily for each day 200 with one journal, NCERT 4, detail +
   parts 200; voice analyze finds the copied journal. 5 are tagged "The Hindu". Undo in prod-data-changes.
   "Insular incentive" (11-12) audio was a 3GP phone recording named `.mP3`; replaced with a real MP3 on
   `assets.hranker.org` the same day. The other 10 are real MP3s.
4. Create a Vidyagram Editorial plan in admin (Plans form, `isEditorial`). Admin task, not done.
5. Media uploads: admin `api/editorial-media-upload` uses `lib/s3` with the Vercel env bucket, which can't be read
   without Vercel access. Check the host of the first image an admin uploads. **Gap:** this route and
   `api/question-media-upload` have no login check, so anyone can upload to that bucket; live on admin.vidyagramar.com
   today.
6. **Voice service switch: DONE 2026-11-12 ~10:05 IST** (phonetics box, pm2 0 `phonetics`, `~/phonetics/.env`), env only.
   - `mongoDB_URI` → rs0 `/vidyagramdb` (same hosts and options). This is the editorial connection only
     (`editorialjournals`, `userphonetics`, `paragraphs`, `paragraphresults`; new users get `customer_id` '446', the
     same default the Vidyagram backend reads). `MONGO_URI` (the service's own Atlas cluster, used by `index.js`) is
     untouched.
   - Storage → Vidyagram's **Cloudflare** bucket: `CLOUDFLARE_ACCOUNT_ID=1ff6f2…`, `CLOUDFLARE_ACCESS_KEY_ID` /
     `CLOUDFLARE_SECRET_ACCESS_KEY` = the Vidyagram backend's `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`,
     `R2_BUCKET_NAME=hranker-server`, `R2_PUBLIC_DOMAIN=assets.hranker.org`. Recordings land under
     `recordings/<userId>/…`. (The earlier draft said `hranker-server-v2`: wrong. That is the backend's Backblaze
     bucket; the R2 keys belong to `R2_MIGRATION_*` = `hranker-server`.)
   - Preflight from the box: put + public GET 200 + delete of a probe object; vidyagramdb reachable (0 journals,
     7,778 words). After `pm2 restart 0 --update-env`: translate 200; analyze with a toppers journal id
     (`69f8a071…`) → 404 "Editorial journal not found", so it reads vidyagramdb.
   - `.env` and the backup are now mode 600 (were 644).
   - Rollback: `cd ~/phonetics && cp -p .env.bak-20261112-pre-vidyagram .env && pm2 restart 0 --update-env`.
   - Scores and recordings saved before the switch stay in adminPanelDB / the toppers bucket.
7. App: [vidyagram-editorial-dictionary-app-guide.md](../reference/vidyagram-editorial-dictionary-app-guide.md),
   unsent. `contentApiBaseUrl` → Vidyagram, delete the content-host scope, unhide the rows once content is in.
