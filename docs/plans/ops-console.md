# Ops console: phone-first monitoring for the boxes I own

Status: live. Decided 2026-10-20; Watch, Triage, Ask, Act and the 08:30 digest all live on the OCI bastion by 2026-10-21 14:00 IST (repo `raghav-hranker/ops-console`).

## What it is
One Telegram bot, my chat id only, that does three things.
- **Watch.** Checks every few minutes on every box, pages once per WARN, quiet until it clears or I snooze.
- **Ask.** "status", "what's wrong with the socket". Answers from the live checks and recent logs. The AI reads and summarizes, nothing else.
- **Act.** A fixed menu I already run by hand (pm2 list / restart, Redis restart, log tail, rerun health). Runs over ssh, confirms before any restart, logs every run.

### Ask vocabulary (added 2026-10-20)
Every answer is scoped to one machine or one pm2 process, never a blended "all good".
- `load <box>` — load per cpu, memory, disk, top pm2 apps by cpu and rss. Source: `/proc/loadavg`, `free`, `df`, `pm2 jlist`.
- `mongo` / `mongo <member>` — every rs0 member: state, lag, queue, ops ≥5 s, cache, disk; `mongo top` = busiest
  collections. Source: the qt-health rs0 section and `mongo-top.js`, run on the box with the checkout's driver.
- `api <pm2-name>` — last 15 min and 24 h: req/min, 5xx count and top 5xx routes, >30 s count, crashes, OOMs. Source:
  that app's pm2 out/err log tail (quicktricks-backend request lines `METHOD url → status (Nms)`). Apps whose log has
  no request lines answer with pm2 status + restarts only, and say so.
- `pm2 <box>` / `pm2 <name>` — status, mode, cpu, rss, max_memory_restart, restarts in 24 h, last exit reason.
- `status` — the WARN lines only, one per box/process, then "rest OK".
Plain-English forms ("what's wrong with the socket", "is mongo slow") map onto these; the AI picks the command and
summarizes its output, it does not invent numbers.

Not in v1: autonomous recovery, runbook-reading triage loop, incident state machine, resume-after-crash, a monorepo.
The action log earns v2: after a few weeks it shows which actions deserve to run on their own.

## Why not an agent first
Every incident this month was a rate, not an http 200: R2 upload p95 (10-20), app-events/min (10-16), socket restarts in
10 min, notifications stuck in `sending`. `qt-health.sh` already collects most of it but runs once a day from a Mac that
sleeps, and never looks at the encoder. See memories `qt-health-morning-check`, `live-r2-upload-stalls-404`,
`app-events-flood-stalls-backend`, `quicktricks-socket-redis-stalls`.

## Order
1. **Supervisors.** Run `reference/scripts/ops-supervisor-audit.sh`. Fix what it shows: Redis under systemd
   `Restart=always`, pm2 boot unit, `max_memory_restart` on the backend. No new software. One evening.
2. **Monitor VM.** One small GCP VM. Uptime Kuma (Telegram notifier, push checks) plus a Healthchecks-style dead man's
   switch for every cron: nightly Vidyagram sync, class reminders, VOD finalize, qt-health itself. Push checks:
   the remote half of `qt-health.sh` every 5 min; encoder `live-upload-timing` p95 per minute; app-events per minute;
   a synthetic student (`qt-playback-check.cjs`, signed URL + one live segment, TTFB).
3. **Sentry** in quicktricks-backend. Catches the swallowed catches (`forgot-password` 500s, `series/package/null`).
4. **The bot.** Ask + Act, a few hundred lines of TypeScript on the monitor VM, SQLite action log. One guarded
   restart: `quicktricks-livestream` refuses while a class is live (`livestream-vod-finalize-serial-reconcile`).
5. **Loki** last, once the bot shows which questions I keep asking. Fixes the 69 GB out log and root-only Apache logs.

## Step 1 findings (audit run 2026-10-20 23:32 IST on webserver2-2)
- Local Redis is the Docker container `hranker-redis` (`redis:7-alpine`, 127.0.0.1:6379), not a systemd unit. Low
  priority per Raghav; the critical Redis is the managed Redis Cloud GCP instance the socket uses. Still check the
  container's restart policy (`docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' hranker-redis`).
- pm2 survives reboots (`pm2-hranker.service` enabled). pm2 daemon and CLI versions differ ("In-memory PM2 is
  out-of-date"); `pm2 update` restarts every app, so only in a window.
- `max_memory_restart` is unset on `quicktricks-backend` (27) and `quicktricks-socket` (28). Restart counts since the
  daemon started: backend 536, socket 356, user-test 510, dlq 263, vidyagram-backend 159. The socket's are the
  watchdog exits (`quicktricks-socket-redis-stalls`).
- The cloud Redis cannot be supervised by us. Its failure mode is reachability from the box, so the Watch check is
  PING RTT and timeouts from webserver2-2 to the Redis Cloud endpoint every minute, plus socket restarts per 10 min.
- Ten `.env.development.bak-*` files and a `.env.swp` in the backend checkout hold `REDIS_PASSWORD`. Delete.
- Encoder VM is off 23:00–07:00 IST (hosts.md); the monitor needs that maintenance window or it pages nightly.

## v1 boxes
webserver2-2, GCP encoder. Others from `reference/hosts.md` join by one config block each.

## Decisions 2026-10-21
- Disk WARN threshold 95% (was 85%); pm2 logs on webserver2-2 stay as they are.
- Ask model: `claude-haiku-5-5` ($0.10 / $0.50 per MTok up to 100K-token prompts), ceiling $25 per month. At roughly
  20K input + 1K output per question that is about $0.0025 per question, so the ceiling is a safety net, not a
  constraint: enforce it as a daily cap in the bot (stop answering, keep paging) plus a per-question `max_tokens`.
- Next check (encoder upload timing) deferred.

## Open questions (mine to answer)
- Telegram bot token and my chat id (never in the repo).
