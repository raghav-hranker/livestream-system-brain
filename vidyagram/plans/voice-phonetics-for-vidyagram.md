---
tenant: vidyagram
status: needs-info
date: 2026-10-30
---

# Word meanings + editorial reading test for Vidyagram

> **2026-11-12:** done as an env switch of the one instance (no second instance). See step 6 of
> [editorial-dictionary-bifurcation.md](editorial-dictionary-bifurcation.md).

## 2026-11-11: the Oct 30 premise was wrong. Do not repoint the service yet

- The Vidyagram app (`hranker-com/vidyagram`, `lib/repository/editorial_repository.dart`) loads **all** editorial
  content from `ApiManager.contentApiBaseUrl = https://node.topperswisdom.com/api/`: journal lists, journal, parts with
  the student's results, and like/save actions. That is the toppers backend on **adminPanelDB**. Only translate and
  analyze go to `voice.hranker.com`, and both are hard-coded in that file.
- The reported journal `6adc7c37…` ("Jantar Mantar", 2026-10-24) is in **adminPanelDB** (381 journals, 1,121
  userphonetics). **vidyagramdb has 0 journals and 0 userphonetics.** The user `6adf2f0f…` is a vidyagramdb user.
  Probe: `reference/scripts/editorial-journal-locate.cjs`.
- So phonetics on adminPanelDB matches what the app reads. Repointing it at vidyagramdb would 404 every journal.
- Both routes work: translate 200 (11-11); the last real analyze call returned 200 on 11-07 (`partId=p1`, 1.5 s).
  Traffic 11-07..11-11: 11 translate, 1 analyze, the rest health checks and bots. The Oct 30 failure was the outage.
- Recordings still go to R2 `selectionway-server` (`R2_PUBLIC_DOMAIN=selectionwayserver.hranker.com`).

### App repo check (2026-11-11, `hranker-com/vidyagram` main 4e019dd)

- `ApiManager.contentApiBaseUrl` carries `TODO(pending: PYP Dictionary + Daily Editorial APIs)`: a **temporary host
  until `backend.vidyagramar.com` serves them**, added 10-28 (merged 11-05). The app team's tracker row
  (`doc/pending_apis/free.md`, `pending_apis.csv`) is open and asks for these on the Vidyagram backend.
- On that host: `words/*` (PYP Dictionary: list, daily, search, user-word, seen, bookmark, report),
  `editorial-journals/*`, `editorial/{like,save,feedback}`, `packages/explore-editorial/`.
- While an editorial screen is open (`enterContentHostScope`), these also go to toppers, with the **Vidyagram bearer
  token**: `instructions/series/`, `series/`, `saved-questions`, `user-test/`, `report-questions/`, `packages/`,
  `users/zones`, `plans/filter-active/`, `coupons/apply-coupon`, `orders/get-razorpay-order`,
  `orders/submit-apple-iap-order`, `qr-codes`. So an editorial test-series purchase would be a toppers order.
- `voice.hranker.com` translate + analyze are hard-coded absolute URLs in `editorial_repository.dart`.
- **Both features are hidden since 2026-11-09, by request**: no code constructs `DailyEditorialScreen` or
  `PypDictionary` (one stale comment on the home screen). So no student reaches any of this today.
- The Vidyagram backend already mounts every one of those routes: `/api/words`, `/api/editorial-journals`,
  `/api/editorial/{like,save,feedback}` (compat), `/api/packages/explore-editorial/:userId`. vidyagramdb has 0
  journals; words and the editorial series/plans were not counted.

### Content census (2026-11-11, `reference/scripts/vidyagram-editorial-content-census.cjs`)

| | adminPanelDB (toppers) | vidyagramdb |
|---|---|---|
| Journals | 381: daily 281 (7 free, 2 inactive; 2026-04-30..10-26), NCERT 100 (4 free) | 0 |
| Editorial tags | 10 | none |
| Test series linked to journals | 324, all in adminPanelDB | 0 of those 324 |
| Words | 7,778: PYQ 4,994 (one 04-24 import), daily 2,784 (05-05..09-24) | 0 |
| Plans unlocking editorial | 7, all toppers `customer_id 695`, incl. the hard-coded `69f8e245…` "Reading Library – Monthly Pass" ₹49/₹39 | 0 |
| Reading-test results | userphonetics 1,121 (all `customer_id 446`), paragraphresults 9,491, paragraphs 4,998 | none |
| Vidyagram students among those results | **0** | |
| Interactions / feedback / word progress / word searches | 5,771 / 267 / 367,146 / 9,646 | 0 (collections exist) |

Journal images and audio (622 links) are all on `toppers-wisdom.hranker.org`. Toppers stopped adding daily journals on
10-26 and daily words on 09-24. No Vidyagram history needs moving. This is toppers' (customer 695) authored content:
copying it to Vidyagram is a business call for the user, not a technical one.

Moving the reading test to vidyagramdb means moving the **whole editorial feature**, in this order: copy the
journals (and tags/series links) into vidyagramdb; switch the app's editorial calls from `node.topperswisdom.com` to
`backend.vidyagramar.com` (its `editorialJournalController` already reads vidyagramdb); then point phonetics at
vidyagramdb with a Vidyagram bucket, in place if toppers does not use it, else as a second instance (Step 1 below).
Past results in adminPanelDB `userphonetics`/`paragraphresults` for Vidyagram users would need copying too.

The app calls two routes on `voice.hranker.com`:

- `POST /api/v1/translate` `{word, sentence?}`: Hindi + English meaning of one word.
- `POST /api/v1/analyze-editorial-journal?partId=pN` (multipart: `audio`, `user_id`, `journal_id`, `text`, `partId`):
  scores a student reading one part of an editorial journal aloud.

Both are served by the **phonetics** service (`raghav-hranker/phonetics`, branch `master`, last commit 4210de8 from May 13).
It runs on the GCP box `phonetics` (see `reference/hosts.md`) under pm2 user `raghav`, at `~/phonetics`, on :5209. nginx
there serves `voice.hranker.com` behind Cloudflare. No local clone exists on the Mac.

## Why both routes fail today (2026-10-30)

- Every path on voice.hranker.com returns a Cloudflare **502**: nothing listens on :5209.
- The box's root disk is **100% full (9.3 of 9.7 GB)**. pm2 has logged `ENOSPC` since **2026-09-26 15:14**.
- The pm2 daemon restarted at 06:07 today with an **empty process list**. `~/.pm2/dump.pm2` (Sep 10) still lists
  `phonetics` and `quicktricks-lms`, both `online`. Neither is running now. `quicktricks-lms` is the nodejs-server
  standby, which `hosts.md` names as the GPU manager's `LMS_BASE_URL`, so check that dependency too.
- Space hogs: `~/.pm2/logs` 369 MB (`quicktricks-lms-error.log` 236 MB, `apx-test-results-live-shard6-out.log` 131 MB),
  `/var/log/journal` 351 MB, plus `admin-dashboard` / `nodejs-server` / `quicktricks-backend` checkouts (~2.4 GB with
  node_modules).

This outage hits **toppers wisdom too**, not just Vidyagram.

## Why Vidyagram needs its own instance even once it is back

- `analyze-editorial-journal` loads the journal with `findById(journal_id)` from `editorialjournals` in the database
  named by `mongoDB_URI`. On the box that is **`adminPanelDB`** on rs0 (toppers). The ids from the report
  (journal `6adc7c37…`, created 2026-10-24; user `6adf2f0f…`, created 2026-10-26) date from after the Vidyagram import.
  They are almost certainly Vidyagram ids, so this route would return **404 "Editorial journal not found"**. A DB lookup
  to confirm this was not run because the prod read was not approved; the script is
  `reference/scripts/editorial-journal-locate.cjs`.
- The service writes its results (`userphonetics`, `paragraphs`, `paragraphresults`) to that same connection. The
  Vidyagram backend already reads those three collections from **vidyagramdb**
  (`src/controllers/editorialJournalController.ts`, models `UserPhonetic` / `Paragraph` / `ParagraphResult`). So
  results written to adminPanelDB would never appear in Vidyagram progress.
- Student recordings upload to R2 bucket `selectionway-server`, which is SelectionWay's bucket.
- `translate` has no tenant dependency: an OpenAI `gpt-4.1-mini` call plus a word cache in the Atlas `MONGO_URI`.
  It works for Vidyagram as-is once the service is up.

## Plan

**Step 0: restore voice.hranker.com (toppers + translate).** DONE 2026-10-30 ~11:25 UTC: four pm2 logs truncated
(disk 94%, ~560 MB free), `phonetics` + `quicktricks-lms` started, pm2-logrotate (50M × 5) added, `pm2 save`. translate
returns 200. systemd boot unit `pm2-raghav` enabled. Still open: the 10 GB disk was not resized.
1. Free disk: truncate the three big pm2 logs, run `journalctl --vacuum-size=100M` and `apt clean`. Better still, grow
   the disk to 20 GB (`gcloud compute disks resize` + `growpart` + `resize2fs`), because 10 GB has filled once already.
2. `pm2 resurrect` (or start only `phonetics`), then `pm2 save`. Add `pm2-logrotate` so the logs cannot fill the disk again.
3. Check: `curl -X POST https://voice.hranker.com/api/v1/translate -d '{"word":"astronomical"}'` returns 200.

**Step 1: Vidyagram instance. No code change: same build, different env.**
- Second pm2 process `vidyagram-phonetics` from the same `~/phonetics` dist, on **:5210**, with its own env file.
  Set `mongoDB_URI` to rs0 `/vidyagramdb` and `R2_BUCKET_NAME` / `R2_PUBLIC_DOMAIN` to a Vidyagram bucket. Keep
  `AZURE_SPEECH_*` and `OPENAI_API_KEY`, and keep the Atlas `MONGO_URI` for the shared word cache.
  - Check: phonetics loads `.env` via `dotenv.config()` from the cwd. A second instance needs `DOTENV_CONFIG_PATH`
    or a separate copy of the directory.
- New hostname plus an nginx server block, proxied to :5210 with a Cloudflare origin cert.
- The app sends `customer_id=781` on analyze calls (the default is toppers' `446`). It only tags `userphonetics`.
- Vidyagram app: switch the base URL for these two routes. Paths and payloads stay the same.

## Open decisions

- Hostname: `voice.vidyagramar.com` (needs the vidyagramar.com Cloudflare zone and an origin cert) or `voice-vg.hranker.com`.
- Recordings bucket: a new `vidyagram-voice` R2 bucket, or a `781/` prefix in an existing Vidyagram bucket.
- Host: the phonetics box (after the resize) or webserver2-2 next to `vidyagram-backend`. Recommendation: the
  phonetics box, because Azure plus ffmpeg streams should stay off the shared prod API box.
- Azure Speech quota is shared with toppers. Check the tier before Vidyagram traffic arrives (May's fix was an OOM on
  Azure quota errors).
