# demoadmin.hranker.com — storage buckets and isolation plan (2026-10-22)

Shared sales demo for prospects. Not a tenant: neither quicktricks (472) nor Vidyagram (781).
**Creating the buckets below did not isolate the demo.** Nothing is connected to them yet.

Sources inspected (read-only): quicktricks-admin `origin/26-Support-Chat` @ a6f8331, quicktricks-backend
`Sep26_Support_Chat` @ ba49d7206 (the commit test-uday runs), test-uday env files and pm2 process, Vercel env
names for project `quicktricks-admin`, R2 bucket configs through the Cloudflare API.

## Buckets created

Account: **Deepaksharma7933@gmail.com's Account, `1ff6f2000c9aa34ca2ec88c066af092a`** (`wrangler whoami`,
OAuth as deepaksharma7933@gmail.com). Created with `wrangler r2 bucket create <name> --location apac --storage-class Standard`.

| Bucket | For | Location | Class | r2.dev | Custom domain | CORS | Events / queue | Objects |
|---|---|---|---|---|---|---|---|---|
| `hranker-server-demo` | general assets (images, banners, editor media) | APAC | Standard | off | none | none | none | 0 |
| `hranker-private-assets-demo` | private documents (PDFs) | APAC | Standard | off | none | none | none | 0 |
| `tempvideos-demo` | class video source intake | APAC | Standard | off | none | none | none | 0 |

APAC/Standard matches every existing bucket in the account (`hranker-server-v2`, `hranker-private-assets`,
`tempvideos-recorded-v2`, the Vidyagram set). Each bucket has only Cloudflare's default multipart-abort lifecycle rule.
No lock rules, no Sippy.

**Changed after creation (2026-10-22, at Raghav's request to connect the demo admin):**
- CORS on `tempvideos-demo` and `hranker-private-assets-demo`: PUT from `https://demoadmin.hranker.com` only, headers `*`,
  expose `ETag`, max-age 3600. No GET rule.
- Custom domain `demo-assets.hranker.org` (zone `hranker.org`, min TLS 1.2) on `hranker-server-demo`. This makes the bucket
  **publicly readable**, so only demo content may ever be written there. r2.dev stays off.
- [`reference/scripts/demo-connect-vercel-storage.sh`](../reference/scripts/demo-connect-vercel-storage.sh) sets the
  branch-scoped Vercel variables (class intake → `tempvideos-demo`, lib/s3 chain → `hranker-server-demo`, public base
  `https://demo-assets.hranker.org`). Raghav runs it after creating the demo R2 token, then redeploys `26-Support-Chat`.

**Connected 2026-10-22 16:30–17:10 IST:**
- Raghav created the demo R2 token in the dashboard and ran the script. That set 12 variables on Preview, branch
  `26-Support-Chat` only. Production and the shared Preview values are unchanged (last edited 42 and 72 days ago).
  Vercel project `vidyagram-admin` was not touched.
- `UPLOAD_BUCKET` is set to `tempvideos-demo`, not the general bucket. `lib/s3.ts:192/290/309` references the undeclared
  `PDF_BUCKET_REGION` whenever the upload bucket equals `B2_BUCKET_NAME`, so `GET /api/uploads` threw a ReferenceError
  (seen in the runtime logs). That list feeds "Processing videos", so the class intake is the right bucket for it anyway.
  The undeclared variable is still a code bug for the quicktricks line (hidden by `ignoreBuildErrors`).
- I redeployed (`vercel redeploy`, preview) and confirmed `demoadmin.hranker.com` aliases the new build. The video-status
  stream (`/api/multipart_uploads/uploads-sse`) lists `tempvideos-demo` with the demo key and returns `[]`.

**Decision 2026-10-22 (Raghav):** test-uday pm2 9 `quicktricks-backend` (`quicktricks.multistreaming.site`) exists
for the demo only. So the demo keeps using it, and its storage moves to the demo buckets in place (option B)
instead of starting a second process. Its idle callers (the APX ingest poller, two old admin feature branches) and the
pm2 6/7 processes that share its checkout get the demo storage too; that is accepted.
[`reference/scripts/demo-backend-storage-env.sh`](../reference/scripts/demo-backend-storage-env.sh) backs up
`.env.development`, sets the storage block (`B2_ENDPOINT`/`B2_S3_ENDPOINT` → R2, `B2_REGION=auto`,
`R2_BUCKET_NAME`/`B2_BUCKET_NAME` → `hranker-server-demo`, `B2_DOCUMENTS_BUCKET` → `hranker-private-assets-demo`,
`THUMBNAIL_*` → `hranker-server-demo`, public base `https://demo-assets.hranker.org`) and restarts pm2 9.
It needs a second demo R2 token (Object Read & Write on `hranker-server-demo` + `hranker-private-assets-demo`).
PDF *reads* still sign against the production Bunny documents zone (`services/bunnyAssetSigner.ts` is Bunny-only for
documents), so demo PDFs upload but won't open until a demo signer exists.

**Backend storage switched and image path verified, 2026-10-22 17:10 IST:** Raghav created the backend token and ran the
script (backup `.env.development.bak-demo-storage-20261022-113600`). pm2 9 restarted on `quicktricks-launch-test`
with no `NODE_ENV` in the process env. A 69-byte synthetic PNG was posted to `POST /api/uploads/images`:
HTTP 201, URL `https://demo-assets.hranker.org/uploads/images/1792669807182-demo-storage-test.png`. Read back
byte-identical from R2 `hranker-server-demo` (wrangler) and over the public domain (200, image/png). No copy in
`hranker-server-v2`. The test object is left in place (a demo artifact); delete it on request.

**PDF upload path verified, 2026-10-22 17:25 IST:** Raghav uploaded a PDF in the demo admin (Pdf
`6ad9d483402a52d31d4e827a` in `quicktricks-launch-test`). `pdfAsset` = `{bucket:'documents', key:'pdfs/dd39…e334bee2dd66b.pdf'}`,
390,036 bytes. The object is in R2 `hranker-private-assets-demo` with the recorded sha256, and starts `%PDF-`. It is
absent from `hranker-private-assets`, and the public domain returns 404 for it (the documents bucket stays private).
The cover image went to `hranker-server-demo` (`demo-assets.hranker.org/pdfs/images/…`, 200). Still open: `/access`
signs against `BUNNY_DOCUMENTS_CDN_BASE` (the production Bunny zone `hranker-private-assets.b-cdn.net`), so this PDF
can't be opened yet.

**PDF reads: demo Bunny documents zone (chosen 2026-10-22).** No code change: the backend already signs per-file
Bunny tokens (`services/bunnyAssetSigner.ts`, file scope). Steps:
1. R2 token with **Object Read** only on `hranker-private-assets-demo`, used by Bunny to fetch from the private bucket.
2. Bunny pull zone (e.g. `hranker-demo-docs`), origin URL
   `https://1ff6f2000c9aa34ca2ec88c066af092a.r2.cloudflarestorage.com/hranker-private-assets-demo` with S3
   authentication (that key, region `auto`). Token Authentication on, token IP validation off (PDF tokens are not IP-bound).
3. [`reference/scripts/demo-backend-docs-zone-env.sh`](../reference/scripts/demo-backend-docs-zone-env.sh)
   `https://<zone>.b-cdn.net` sets `BUNNY_DOCUMENTS_CDN_BASE`/`_SECURITY_KEY`, restarts pm2 9, and checks the signed
   (200) and unsigned (403) responses on the box.

**PDF reads verified, 2026-10-22 17:40 IST:** the Bunny zone is `hranker-private-assets-demo.b-cdn.net` (R2 origin with
S3 auth, token auth on). The first script run used the planned name `hranker-demo-docs.b-cdn.net`, which Bunny answered with
"Domain suspended or not configured". I then corrected `BUNNY_DOCUMENTS_CDN_BASE` on the box (backup
`.env.development.bak-demo-docs-host-20261022-120824`; the key from the script run was kept) and restarted pm2 9. With the
backend's own signer (file scope), the uploaded PDF returned 200 `application/pdf`, 390,036 bytes, with the recorded sha256.
Unsigned returned 403, and a tampered expiry returned 403. Images and PDFs, upload and read, now all use demo storage.

**Not created, on purpose:**
- `recordedvideos-demo`: only the transcoder writes there. Create it together with an isolated transcoder lane.
- `livestream-demo`: only the live encoder writes there. Create it when demo live streaming is designed.
- Shorts buckets: the demo has no working shorts lane today (see the table). Decide whether the demo needs shorts first.

## Feature → path → bucket

"Vercel" means variables scoped to the git branch `26-Support-Chat` only. "Backend" means a demo backend (see work item 1).

| Feature | Current upload path (verified) | Demo bucket | Configuration variables | Credential permission |
|---|---|---|---|---|
| Images, banners, thumbnails, Q-Hub/support files, voice notes | **Backend-managed.** Admin posts multipart to test-uday. Multer proxies the bytes (`config/s3Upload.ts:117-196`) to **Backblaze** `s3.us-east-005.backblazeb2.com`, bucket `hranker-server-v2`. The key is `<folder>/<ts>-<name>`, built by the server. `/api/uploads/files` lets the client pick the folder. The returned URL is public and unsigned (`B2_PUBLIC_BASE_URL`). | `hranker-server-demo` | Backend: `B2_ENDPOINT`=R2 S3 endpoint, `B2_REGION`=`auto`, `R2_BUCKET_NAME` (read first) and `B2_BUCKET_NAME`, `B2_ACCESS_KEY_ID`/`B2_SECRET_ACCESS_KEY`, `B2_PUBLIC_BASE_URL`. Practice batch also reads `B2_PUBLIC_BATCH_BUCKET`/`THUMBNAIL_BUCKET_NAME`, `THUMBNAIL_B2_*`, `THUMBNAIL_PUBLIC_BASE_URL`. | Object Read & Write, this bucket only |
| Editor (CKEditor), Feed, Notice, user avatar | **Frontend-managed.** Next route `app/api/editorial-media-upload` → `lib/s3.ts:503` using the Vercel `B2_*` chain. On any error it falls back to the backend `/uploads/files`. | `hranker-server-demo` | Vercel: `B2_ENDPOINT`, `B2_ACCESS_KEY_ID`, `B2_SECRET_ACCESS_KEY`, `B2_REGION`, `UPLOAD_BUCKET` (the bucket lib/s3 actually uses, `s3.ts:82`) plus `B2_BUCKET_NAME`, `B2_PUBLIC_BASE_URL` | Object Read & Write, this bucket only |
| PDFs | **Backend mints, browser uploads.** `/api/admin/pdf-upload-sessions` → presigned PUT (900 s TTL) straight to Backblaze `hranker-private-assets`. The key is `pdfs/<48 hex>.pdf`. Reads go through `/access`, which signs a **Bunny** documents-zone URL (`BUNNY_DOCUMENTS_*`). | `hranker-private-assets-demo` | Backend: `B2_DOCUMENTS_BUCKET`, `B2_S3_ENDPOINT` (**beats `B2_ENDPOINT`**, `config/documentStorage.ts:49`; set both), `B2_ACCESS_KEY_ID`/`SECRET` (no separate documents key). Bucket CORS: PUT from `https://demoadmin.hranker.com`. | Object Read & Write, this bucket |
| Class videos | **Frontend-managed.** Browser multipart with presigned parts via `/api/multipart_uploads` → `lib/video-storage.ts:56-79`. The key is `472/<classId>/<file>` (client-built path). The variables are **Production-only** in Vercel, so this fails on the demo today. In production the intake `tempvideos-recorded-v2` fires `recordedvideos-hranker-v2-queue`, which is production processing. | `tempvideos-demo` (intake only, no notification) | Vercel: `R2_VIDEO_UPLOAD_ENDPOINT`, `R2_VIDEO_UPLOAD_BUCKET`, `R2_VIDEO_UPLOAD_KEY_ID`, `R2_VIDEO_UPLOAD_KEY_SECRET`. Bucket CORS: PUT from the demo origin, expose ETag. | Object Read & Write, this bucket only |
| Shorts | **Frontend-managed intake.** Variables `SHORTS_UPLOAD_*` are Production-only, so it doesn't work on the demo. In production it goes to a public intake lane, then the public recorded output. The backend `PATCH /shorts/:id/video` accepts any logged-in user and does not check the client id. `SHORTS_PUBLIC_BASE_URL` is unset on test-uday. | none yet | — | — |
| Live video | The admin stores nothing. It mints a Streamer JWT with the **production `STREAMER_JWT_SECRET`** (set for Preview too) and opens the ls viewer at `/472/<classId>`. The encoder writes live buckets; the backend signs the Bunny live zone. | none yet | Remove `STREAMER_JWT_SECRET` from the demo | — |

Recommended keys: **one backend key** with Object Read & Write on `hranker-server-demo` and `hranker-private-assets-demo`.
The backend uses one key pair for both, so it can't be split without code. **One Vercel key** with Object Read & Write
on `hranker-server-demo` and `tempvideos-demo`. Neither key gets account-wide or Admin scope.

## Existing `hranker-demo-*` buckets

The seven earlier buckets (`hranker-demo-assets`, `-documents`, `-class-intake`, `-class-recorded`, `-shorts-intake`,
`-shorts-recorded`, `-live`) were empty and unconnected when checked on 2026-10-22. They didn't follow the `<base>-demo`
convention. Raghav deleted them the same day; the API list afterwards shows 24 buckets, and only the three
`*-demo` buckets above contain "demo".

## What the demo touches today (verified)

- **Backend is shared, not demo-only.** `config.ts:12-13` hard-codes `https://quicktricks.multistreaming.site/api`. That
  is test-uday pm2 9 `quicktricks-backend` on :5916, which also serves other quicktricks test and preview work.
  `CUSTOMER_ID = 472` is a compile-time constant in the backend (`config/baseConstants.ts:3`) and in the admin (`config.ts:32-34`).
- **Database:** the process connects to `quicktricks-launch-test` on the **production rs0 cluster**. No `NODE_ENV` is set in
  the pm2 env, so `.env.development` loads first. But `.env.testing` holds `MONGO_URI=…/quicktricksdb`, which is
  **production quicktricks**. If the box is ever started with `NODE_ENV=testing` in the process env, the demo writes to production data.
- **Storage:** backend uploads go to Backblaze `hranker-server-v2` and `hranker-private-assets`, the same names as the
  production buckets. Vercel Preview carries `B2_*` keys and `R2_BUCKET_NAME` for **every** Preview deployment, not just the demo.
- **Billable integrations** are live on that backend: Razorpay and Website Razorpay keys, SMS (`GET /api/users/sendOtp/:mobile`
  is public with no rate limit, and `SMS_API_KEY` has a hard-coded fallback in source), SMTP mail, FCM (falls back to
  `firebase-service-account.json`, project `quick-tricks-sahil-sir`). `DISABLE_CRONS` stops crons only, not request-path sends.
- **No rate limiting anywhere** (`express-rate-limit` is a dependency but never imported). Many upload routes have no auth:
  `/api/uploads/images`, `/api/uploads/files`, categories, legacy `/api/pdfs/upload`. The admin's
  `/api/multipart_uploads` and `/api/uploads` DELETE routes don't check auth either.

## Remaining work (prepared, not applied)

1. **Dedicated demo backend.** Run a separate process (or box) instead of reconfiguring test-uday pm2 9, which other work
   uses. Give it its own port, nginx host (e.g. `demoapi.hranker.com`), env file and `NODE_ENV` set explicitly in pm2 so the load order can't flip.
2. **Demo database.** Create a new database (e.g. `hrankerdemo`), not on the production rs0 cluster if possible, with
   synthetic content only. Use a demo customer id instead of 472. The id is a constant, so this needs a code change or an env-driven constant.
3. **Admin branch config.** In `26-Support-Chat`, point `config.ts` at the demo backend and the demo customer id. This
   is a code change on that branch only.
4. **Vercel, branch-scoped to `26-Support-Chat`:**
   - add `B2_ENDPOINT`, `B2_REGION=auto`, `B2_ACCESS_KEY_ID`/`SECRET`, `UPLOAD_BUCKET`, `B2_BUCKET_NAME` → `hranker-server-demo`;
   - add `R2_VIDEO_UPLOAD_*` → `tempvideos-demo`;
   - override `R2_BUCKET_NAME`;
   - override `STREAMER_JWT_SECRET` with a demo-only value, or remove it;
   - leave `SHORTS_*` unset.
   Branch-level values take precedence over the general Preview values for that branch only.
   Separately, move the production `B2_*`, `B2_VIDEO_UPLOAD_*` and `STREAMER_JWT_SECRET` out of the shared Preview target.
   That affects every preview, so it is your call.
5. **Demo R2 keys** with the scopes in the table. Paste them straight into Vercel and the demo backend env, never into chat.
6. **Bucket CORS:** PUT from `https://demoadmin.hranker.com` on `tempvideos-demo` and `hranker-private-assets-demo`, exposing ETag.
7. **Read path for assets.** The backend returns unsigned public URLs, so images in a private bucket won't display.
   Options: a custom domain on `hranker-server-demo` (public read, demo content only) or signed reads (code change). This needs a decision.
8. **PDF read path.** `/access` signs against the production Bunny documents zone. The demo needs its own zone or a
   Cloudflare-signed host in front of `hranker-private-assets-demo`. Until then, demo PDFs upload but don't open.
9. **Server-side authorization and object paths.** Add `requireAdmin` on the open upload routes, ignore the client
   `folder`, add auth on the admin Next routes, and build server-side keys under a demo prefix.
10. **Limits and cleanup.** Add `express-rate-limit` on uploads and OTP, lower the multer caps for the demo, and add R2
    lifecycle rules (e.g. delete after 7–30 days on all three buckets). Add a scheduled reset of the demo database to the synthetic seed.
11. **Separation between prospects.** One shared admin login means every prospect sees everyone's uploads. If that
    matters, give each prospect their own login and key prefix, or reset between demos.
12. **Video processing, later.** Create `recordedvideos-demo`, a demo queue, an event notification on `tempvideos-demo`,
    a transcoder instance with demo-only keys and its own `TRANSCODER_WEBHOOK_SECRET`, and a callback URL pointing at the demo backend.
    Never enable the notification while the queue feeds production processing.
13. **Billable integrations off in the demo env.** Use Razorpay test keys or none, leave SMS, mail and FCM unset (and
    remove the FCM file fallback and the SMS key fallback in code, or guard them with a flag), leave Apple IAP unset.

## Uncertain or not verified

- The string "no recognized upload bucket configured" is not in either codebase. `/api/uploads` uses the `lib/s3`
  `UPLOAD_BUCKET` chain, not the R2 intake, which explains an empty or failing list, but the exact log source wasn't found.
- The Vercel values of `R2_BUCKET_NAME` and `B2_ENDPOINT` weren't read (no `env pull`, to keep secrets off disk). So
  whether the frontend editor upload hits Backblaze or R2 is unknown.
- Whether Backblaze `hranker-server-v2` on test-uday is the same physical bucket production writes to. The names match;
  the production box env wasn't checked in this pass.
- The contents of `quicktricks-launch-test` (real user copies, FCM tokens, phone numbers?) weren't inspected.
- Whether the Razorpay keys on test-uday are test or live keys.
- Account-level R2 API tokens weren't listed. The wrangler OAuth token has no token-read scope, so I couldn't check
  whether any existing token already covers the new `*-demo` buckets.
- `wrangler r2 bucket list` (4.43.0) shows only 20 of the 28 buckets. The full list came from the API.

## Why the demo needs its own backend (answer, 2026-10-22)

**Short answer:** the demo needs a backend that is *not a quicktricks backend*. pm2 9 on test-uday is a quicktricks
build: customer 472 is compiled in, it holds live quicktricks keys, and its database sits on the production cluster.
Turning it into a demo backend changes its build, env and DB, and other things depend on all three: an APX
ingest worker, two other online pm2 processes that run from the same checkout, and some admin feature branches.
"Its own backend" means its own process, checkout, env and DB. It does not need its own machine: a second pm2
process on test-uday is enough.

### Who uses pm2 9 (`quicktricks-backend`, :5916)

How this was attributed: the shared `/var/log/nginx/access.log` doesn't log the host, and every request reaches
nginx through Cloudflare, so the client IPs are Cloudflare's. The reliable source is pm2 9's own request log. It
holds five days (2026-10-18 → 10-22, ~576k requests), and every request in it has host `quicktricks.multistreaming.site`.
nginx proxies that host, port 80 only, to :5916, which is pid `node …/quicktricks-backend/dist/src/app.js`.

| Caller | Evidence | Status |
|---|---|---|
| **`apx-ingest` container on the OCI bastion** (image `apx-ingest:r2-mirror-20260909`, up 6 weeks) | Its env has `API_URL` and `LMS_BASE` = `quicktricks.multistreaming.site`. It sends ~113k `POST /api/apx-ingest-jobs/claim` a day (UA `node`, ~50k of the "no referer" requests in today's nginx log). Every claim gets 204, so its queue in `quicktricks-launch-test` is empty. The route has no auth (`apxIngestJobRoutes.ts:27`); with a job queued, it would hand anyone a freshly minted APX `sessionLink`. | **Verified.** Idle; the APX migration was declared complete on 09-22. |
| **demoadmin.hranker.com** (browsers) | The only browser referer on pm2-9 routes (dashboard analytics, classes, taxonomy, support chat, admins). On 10-21: 14 admin OTP logins from 3 admin ids, and 18 real SMS sent through the `HRNKER` sender. | **Verified.** |
| **A server-side website fetcher** (UA `undici`, no referer) | Fetches student-website routes (`testimonials`, `faqs`, `top-bar-announcements`, `course-folders`, `packages`, `banners`): ~1,100 a day on 10-18 to 10-20, 623 on 10-21, none so far on 10-22. Two browser hits had referer `www.guruleak.com`. | **Inferred:** some website's server rendering. Which site wasn't found. It seems to have stopped on 10-21. |
| **quicktricks-admin feature branches** | `config.ts` points at test-uday on `26-Support-Chat` (the demo), `global-seacrh-admin-oct` (last commit 10-21) and `final` (08-31). The Vercel previews of those branches call pm2 9. The main `quicktricks-admin` branch only has the host as an ApiTester placeholder. | **Code verified.** No `*.vercel.app` referer in today's log, so no previews were in use today. |

Checked and **not** pm2 9:
- **www.hrankerdesk.online and supportcrm.hranker.com** are Hranker's own CRM and support desk (`hranker-crm` repo,
  `Frontend-client-service`). They aren't quicktricks properties. Their routes (`/api/notifications`, `/api/tickets`,
  `/api/leads`, `/api/logs`) never appear in pm2 9's log. nginx sends `backend.hrankerdesk.online` to :7100, which is
  pm2 8 `client-service-backend`. They show up in the access log only because the log is shared.
- **The Dart app** (~9.6k requests, user-test and leaderboard routes) goes to pm2 0 `test` (`nodejs-server`). Its log has
  ~4.7k of those calls; pm2 9's log has none.
- **The Razorpay webhook** (81 calls to `/api/razorpay/webhook`) isn't in pm2 9's log.
- **thedhronas and ls** don't name the host on any branch. video-transcoder and livestream aren't checked out on the
  Mac, so they weren't searched. pm2 9's log has no recordings or transcoder callbacks this week.

### Why separate, even if the demo were the only user

1. **The customer id is compiled in.** `CUSTOMER_ID = 472` is a constant (`src/config/baseConstants.ts:3`). A demo
   id means a different build, or an env-driven constant that the quicktricks line has to accept too.
2. **The env is a quicktricks env:** live Razorpay keys, SMS (OTP texts really go out, see above), SMTP, FCM (file
   fallback to project `quick-tricks-sahil-sir`), and Backblaze buckets with the production names. The demo env has
   to blank all of these, and that is a different env file, not an edit to this one.
3. **The database sits on production rs0.** `quicktricks-launch-test` is on the production cluster, and `.env.testing`
   in that checkout points at production `quicktricksdb`. Only the missing `NODE_ENV` keeps it on the test DB.
4. **Demo-only code is needed:** auth on the open upload routes, rate limits on uploads and OTP, a nightly reset. None
   of it belongs on the quicktricks line yet.
5. **The checkout is shared.** pm2 6 `quicktricks-dlqConsumerRunner` and 7 `quicktricks-userTestMicroservice` (both
   online), plus about 15 stopped one-off APX jobs, run from `/home/raghav/quicktricks-backend` and read the same env
   files. A demo build or env in that folder changes them too.

### Recommendation

pm2 9 is not demo-only, but its other callers are idle or minor. Point 5 decides it anyway: converting pm2 9 in
place would also convert the processes that share its checkout. So:

- **Run a second pm2 process on test-uday**, for example `demo-backend`:
  - its own checkout or worktree with the demo customer id and the demo-only changes;
  - its own port and nginx host (for example `demoapi.hranker.com`);
  - its own `.env` with `NODE_ENV` set explicitly in the pm2 config;
  - its own database, off rs0 if possible;
  - demo R2 keys only.

  This is "separate" without a new machine.
- **Leave pm2 9 as it is.** Repoint `26-Support-Chat` `config.ts` to the demo host.
- **Separate from the demo, your call:** stop the bastion `apx-ingest` container. It polls an empty queue around
  1.3 times a second, through an unauthenticated route.

Converting pm2 9 in place would only be enough if all of these were true:
- the demo were its only caller;
- nothing else ran from `/home/raghav/quicktricks-backend`;
- nobody needed a quicktricks-shaped test backend for the feature-branch previews.

None of the three holds today.
