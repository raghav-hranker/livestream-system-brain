#!/usr/bin/env bash
# One-call read-only health check of quicktricks prod. Run from the Mac:
#
#   bash reference/scripts/qt-health.sh            # print the report
#   bash reference/scripts/qt-health.sh --save     # also write ~/Library/Logs/qt-health/<stamp>.txt
#                                                  # (+ latest.txt) and raise a macOS notification
#
# Covers the webserver2-2 box (load, disk, pm2 quicktricks-* status and restarts, OOMs), the API
# (5xx and >30 s counts from the tail of the pm2 out log), every rs0 member (state, lag, queue,
# long-running ops, disk, cache) and notifications stuck in "sending". Ends with a verdict block:
# one WARN line per threshold crossed, or "OK".
#
# Prints counts, route names and collection names only, never raw log lines: request bodies in the
# pm2 out log hold passwords and JWTs (memory prod-logs-contain-jwts). Mongo is queried from the box
# with the checkout's own driver, because the box has no mongosh and the Mac's IP is not always on
# the Atlas-style allowlist.
#
# Deeper dives once a WARN points somewhere:
#   api_failure_probe.sh (per-route 5xx/slow/abandoned, restarts), mongo-top.js / mongo-live.js
#   (busiest collections, live slow ops), notification_duplicate_probe.js (double sends).
set -uo pipefail

SAVE=0
OUT_BYTES=1G
for a in "$@"; do
  case "$a" in
    --save) SAVE=1 ;;
    --out-bytes=*) OUT_BYTES="${a#*=}" ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown arg: $a" >&2; exit 64 ;;
  esac
done

run() {
# ServerAlive: a connection that dies mid-run (Mac sleeps, network drops) fails within ~60 s
# instead of hanging until the next wake.
ssh -i ~/.ssh/hranker-webserver2-2 -o ConnectTimeout=15 -o BatchMode=yes \
  -o ServerAliveInterval=15 -o ServerAliveCountMax=4 hranker@148.113.49.18 \
  "OUT_BYTES=$OUT_BYTES bash -s" <<'REMOTE'
set -uo pipefail
export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH
APP=/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend
L=~/.pm2/logs
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
warn() { echo "WARN: $*"; }

echo "=== qt-health  $(TZ=Asia/Kolkata date '+%F %T') IST"

echo; echo "=== box"
read -r L1 L5 L15 _ < /proc/loadavg; NP=$(nproc)
echo "load $L1 $L5 $L15 on $NP cpus"
awk -v l="$L15" -v n="$NP" 'BEGIN{ if (l+0 > n+0) print "WARN: box load15 " l " > " n " cpus" }'
free -m | awk 'NR==2{ printf "mem used %d / %d MB, available %d MB\n", $3, $2, $7; if ($7 < 1024) print "WARN: box available memory " $7 " MB" }'
df -hP / /home 2>/dev/null | awk 'NR>1 && !seen[$6]++ { print "disk " $6 " " $5 " used (" $4 " free)"; u=$5; sub("%","",u); if (u+0 >= 95) print "WARN: box disk " $6 " at " $5 }'
echo "HEAD $(git -C $APP log -1 --format='%h %cr: %s' | cut -c1-90)"
D=$(git -C $APP status --porcelain -uno | wc -l); echo "dirty tracked files: $D"
[ "$D" -gt 0 ] && warn "box checkout has $D dirty tracked files (a pull will refuse or stash)"

echo; echo "=== pm2 quicktricks-*"
pm2 jlist 2>/dev/null | node -e '
const raw = require("fs").readFileSync(0, "utf8"); const a = JSON.parse(raw.slice(raw.indexOf("[")));
for (const p of a) { if (!/^quicktricks/.test(p.name)) continue; const e = p.pm2_env;
  const up = (Date.now() - e.pm_uptime) / 36e5;
  console.log(`${String(p.pm_id).padStart(3)} ${p.name.padEnd(28)} ${e.status.padEnd(8)} up ${up.toFixed(1)} h  restarts ${e.restart_time}  mem ${Math.round(p.monit.memory / 1e6)} MB  cpu ${p.monit.cpu}%`);
  if (e.status !== "online") console.log(`WARN: pm2 ${p.name} is ${e.status}`);
}'
# pm2.log lines look like "2026-10-14T13:27:01: PM2 log: App [quicktricks-backend:27] exited with code [1] via signal [SIGINT]"
grep -a 'quicktricks' ~/.pm2/pm2.log 2>/dev/null | tail -n 20000 | node -e '
const cut = Date.now() - 864e5; const c = {};
for (const l of require("fs").readFileSync(0, "utf8").split("\n")) {
  const t = Date.parse(l.slice(0, 19)); if (!(t >= cut)) continue;
  const m = l.match(/\[(quicktricks[\w-]*):\d+\] exited with code \[(\w+)\] via signal \[(\w+)\]/); if (!m) continue;
  const k = `${m[1]} code=${m[2]} sig=${m[3]}`; c[k] = (c[k] || 0) + 1; }
// code=0 is a graceful stop (deploy, pm2 restart); any other code is a crash.
const ks = Object.keys(c); console.log("exits in last 24 h: " + (ks.length ? "" : "none"));
for (const k of ks.sort()) { console.log(`  ${String(c[k]).padStart(4)}  ${k}${/code=0 /.test(k) ? "  (graceful)" : "  (crash)"}`); }
const crash = {}; for (const k of ks) if (!/code=0 /.test(k)) { const app = k.split(" ")[0]; crash[app] = (crash[app] || 0) + c[k]; }
for (const [app, n] of Object.entries(crash)) console.log(`WARN: ${app} crashed ${n}x in 24 h (non-zero exit)`);'
# OOM stack lines carry no timestamp; date each by the last ISO timestamp seen above it.
# Size-limit rejections the backend itself makes (multer per-route fileSize, express.json 200mb)
# are counted here; anything over Apache's 100 MB LimitRequestBody never reaches the backend
# and only shows in the apache section below. The global error handler logs each one twice.
tail -c 50M $L/quicktricks-backend-error.log 2>/dev/null | node -e '
const cut = Date.now() - 864e5; let t = 0, n = 0, big = 0;
require("readline").createInterface({ input: process.stdin, crlfDelay: Infinity })
  .on("line", (l) => { const m = l.match(/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)/); if (m) t = Date.parse(m[1]);
    if (t < cut) return;
    if (/heap out of memory|Allocation failed/.test(l)) n++;
    if (/Global Error Handler: (File too large|request entity too large)|PayloadTooLargeError: request entity/i.test(l)) big++; })
  .on("close", () => { console.log(`heap-OOM lines in the backend error log, last 24 h: ${n}`);
    console.log(`uploads/bodies the backend rejected as too large, last 24 h: ${big}`);
    if (n) console.log(`WARN: backend hit heap OOM ${n}x in 24 h`);
    if (big) console.log(`WARN: backend rejected ${big} upload(s) as too large in 24 h (multer fileSize / body limit)`); });'

echo; echo "=== API (tail -c $OUT_BYTES of the backend out log)"
cat > $T/api.js <<'JS'
const rl = require("readline").createInterface({ input: process.stdin, crlfDelay: Infinity });
const FIN = /(GET|POST|PUT|PATCH|DELETE) (\S+) → (\d{3}) \((\d+)ms\)/;
const norm = (u) => u.replace(/^https?:\/\/[^/]+/, "").split("?")[0]
  .replace(/\/[0-9a-f]{24}(?=\/|$)/gi, "/:id").replace(/\/\d+(?=\/|$)/g, "/:n").replace(/\/[A-Za-z0-9_\-.%]{25,}(?=\/|$)/g, "/:tok");
let n = 0, e5 = 0, s30 = 0, first = null, last = null; const r5 = {}, rs = {};
rl.on("line", (l) => {
  const m = l.match(FIN); if (!m) return; n++;
  const ts = l.match(/^(\d{4}-\d\d-\d\d[T ]\d\d:\d\d)/); if (ts) { first = first || ts[1]; last = ts[1]; }
  const k = m[1] + " " + norm(m[2]); const st = +m[3], ms = +m[4];
  if (st >= 500) { e5++; r5[k] = (r5[k] || 0) + 1; }
  if (ms > 30000) { s30++; rs[k] = (rs[k] || 0) + 1; }
});
rl.on("close", () => {
  console.log(`requests ${n}${first ? `  (${first} → ${last})` : ""}  5xx ${e5} (${n ? (100 * e5 / n).toFixed(2) : 0}%)  >30s ${s30}`);
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `    ${String(v).padStart(5)}  ${k}`).join("\n");
  if (e5) console.log("  top 5xx routes:\n" + top(r5));
  if (s30) console.log("  top >30s routes:\n" + top(rs));
  if (n && e5 / n > 0.01) console.log(`WARN: API 5xx rate ${(100 * e5 / n).toFixed(2)}% (>1%)`);
  if (s30 >= 20) console.log(`WARN: ${s30} API requests took >30 s`);
});
JS
tail -c "$OUT_BYTES" $L/quicktricks-backend-out.log 2>/dev/null | node $T/api.js

echo; echo "=== apache (backend vhost, current log = since the midnight rotation)"
# Apache answers these itself, so they never reach the pm2 logs: 413 = body over
# LimitRequestBody (100 MB), 502/503/504 = backend down, restarting or slower than ProxyTimeout.
AL=/var/log/apache2/backend.quicktricksbysahilsir.com-access.log
AE=/var/log/apache2/backend.quicktricksbysahilsir.com-error.log
if [ -r "$AL" ]; then
  LC_ALL=C grep -aE '" (413|502|503|504) ' "$AL" | node -e '
const c = {}, r = {};
require("readline").createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (l) => {
  const m = l.match(/"(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) (\S+)[^"]*" (\d{3}) /); if (!m) return;
  const st = m[3]; c[st] = (c[st] || 0) + 1;
  const k = st + " " + m[1] + " " + m[2].split("?")[0].replace(/\/[0-9a-f]{24}(?=\/|$)/gi, "/:id").replace(/\/\d+(?=\/|$)/g, "/:n");
  r[k] = (r[k] || 0) + 1;
}).on("close", () => {
  const n = (s) => c[s] || 0;
  console.log(`413 too large ${n("413")}   502 ${n("502")}   503 ${n("503")}   504 ${n("504")}`);
  const top = Object.entries(r).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (top.length) console.log(top.map(([k, v]) => `    ${String(v).padStart(5)}  ${k}`).join("\n"));
  if (n("413")) console.log(`WARN: apache rejected ${n("413")} request(s) as too large (>100 MB) today`);
  const gw = n("502") + n("503") + n("504"); if (gw >= 20) console.log(`WARN: apache returned ${gw} 502/503/504 today (backend down or timing out)`);
});'
  if [ -r "$AE" ]; then
    echo "error log, today:"
    LC_ALL=C grep -aoE 'AH[0-9]{5}' "$AE" | sort | uniq -c | sort -rn | head -6 | sed 's/^/    /'
  fi
else
  echo "access log not readable by $(whoami) (/var/log/apache2 is root:adm 750); 413s over 100 MB stay invisible until it is"
fi

echo; echo "=== mongo rs0 (per member, direct)"
cat > $T/mongo.js <<'JS'
const mongoose = require(require.resolve("mongoose", { paths: [process.cwd()] }));
const { MongoClient } = mongoose.mongo;
const m = process.env.MONGO_URI.match(/^mongodb:\/\/([^@]+@)?([^/]+)\/([^?]*)/);
const creds = m[1] || "", hosts = m[2].split(","), dbName = process.env.DB_NAME || m[3] || "quicktricksdb";
const W = (s) => console.log("WARN: " + s);
const gb = (b) => (b / 1e9).toFixed(1);
(async () => {
  let primaryOptime = null; const rows = [];
  for (const h of hosts) {
    const c = new MongoClient(`mongodb://${creds}${h}/?authSource=admin&directConnection=true`, { serverSelectionTimeoutMS: 8000, connectTimeoutMS: 8000 });
    try {
      await c.connect(); const a = c.db("admin");
      const ss = await a.command({ serverStatus: 1, tcmalloc: 0 });
      const hello = await a.command({ hello: 1 });
      const ops = await a.aggregate([{ $currentOp: { allUsers: true } }, { $match: { active: true, ns: { $not: /^(local|admin|config)\./ } } }]).toArray();
      const st = await c.db(dbName).command({ dbStats: 1 });
      let rs = null; try { rs = await a.command({ replSetGetStatus: 1 }); } catch {}
      rows.push({ h, ss, hello, ops, st, rs });
    } catch (e) { console.log(`${h}  UNREACHABLE  ${String(e.message).slice(0, 80)}`); W(`mongo member ${h} unreachable from the box`); }
    finally { await c.close().catch(() => {}); }
  }
  const rs = (rows.find((r) => r.rs) || {}).rs;
  if (rs) {
    const p = rs.members.find((x) => x.stateStr === "PRIMARY"); primaryOptime = p && p.optimeDate;
    for (const x of rs.members) {
      const lag = primaryOptime && x.optimeDate ? Math.round((primaryOptime - x.optimeDate) / 1000) : null;
      console.log(`rs  ${x.name.padEnd(22)} ${x.stateStr.padEnd(10)} health ${x.health}${lag !== null && x.stateStr !== "PRIMARY" ? `  lag ${lag}s` : ""}`);
      if (x.health !== 1 || !["PRIMARY", "SECONDARY", "ARBITER"].includes(x.stateStr)) W(`rs member ${x.name} is ${x.stateStr} (health ${x.health})`);
      if (x.health === 1 && lag !== null && lag > 10) W(`rs member ${x.name} lags ${lag}s`);
    }
  }
  for (const { h, ss, hello, ops, st } of rows) {
    const q = ss.globalLock.currentQueue, ac = ss.globalLock.activeClients;
    const cache = ss.wiredTiger.cache, used = cache["bytes currently in the cache"], max = cache["maximum bytes configured"];
    const fsPct = st.fsTotalSize ? (100 * st.fsUsedSize / st.fsTotalSize) : null;
    const role = hello.isWritablePrimary ? "PRIMARY" : hello.secondary ? "SECONDARY" : "OTHER";
    console.log(`\n${h} ${role}  conns ${ss.connections.current}  active ${ac.readers}r/${ac.writers}w  queued ${q.readers}r/${q.writers}w  ops ${ops.length}  cache ${gb(used)}/${gb(max)} GB` +
      (fsPct !== null ? `  disk ${fsPct.toFixed(0)}% of ${gb(st.fsTotalSize)} GB` : ""));
    if (q.readers + q.writers > 50) W(`${h} has ${q.readers + q.writers} queued ops`);
    if (fsPct !== null && fsPct >= 85) W(`${h} disk at ${fsPct.toFixed(0)}%`);
    const slow = ops.filter((o) => (o.secs_running || 0) >= 5).sort((a, b) => b.secs_running - a.secs_running);
    for (const o of slow.slice(0, 5))
      console.log(`    ${String(o.secs_running).padStart(5)}s  ${o.op} ${o.ns}  ${o.planSummary || ""}  from ${(o.client || "").split(":")[0]}`);
    const long = slow.filter((o) => o.secs_running >= 60);
    if (long.length) W(`${h} has ${long.length} ops running >60 s (longest ${long[0].secs_running}s on ${long[0].ns})`);
  }
  // Notifications whose send job died: still "sending" long after they started.
  const c = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  try {
    await c.connect(); const db = c.db(dbName); const cut = new Date(Date.now() - 30 * 6e4);
    console.log("");
    // Only stuck sends from the last 3 days warn; older ones are past incidents (see memory
    // notification-stuck-sending-second-sender) and are listed once as a count.
    const recent = new Date(Date.now() - 3 * 864e5);
    for (const coll of ["notifications", "advancenotifications"]) {
      const n = await db.collection(coll).countDocuments({ status: "sending", updatedAt: { $lt: cut, $gte: recent } });
      const old = await db.collection(coll).countDocuments({ status: "sending", updatedAt: { $lt: recent } });
      console.log(`${coll} stuck in "sending": ${n} new (30 min – 3 days)${old ? `, ${old} older` : ""}`);
      if (n) W(`${n} ${coll} stuck in "sending" (started in the last 3 days)`);
    }
  } catch (e) { console.log("notification check failed: " + String(e.message).slice(0, 80)); }
  finally { await c.close().catch(() => {}); }
})().catch((e) => { console.log("WARN: mongo check crashed: " + String(e.message).slice(0, 100)); });
JS
cd $APP && DOTENV_CONFIG_PATH=.env.development timeout 90 node -r dotenv/config $T/mongo.js
echo "=== end"
REMOTE
}

# A run that never reached "=== end" is partial; retry once, then say so in the verdict
# rather than passing off the sections that did arrive as the whole picture.
REPORT=$(run 2>&1); RC=$?
if ! printf '%s\n' "$REPORT" | grep -q '^=== end$'; then
  sleep 30; REPORT=$(run 2>&1); RC=$?
fi
if ! printf '%s\n' "$REPORT" | grep -q '^=== end$'; then
  REPORT="$REPORT
WARN: run incomplete (ssh exit $RC); sections after the last one shown are missing"
fi
REPORT=$(printf '%s\n' "$REPORT" | grep -v '^=== end$')
WARNS=$(printf '%s\n' "$REPORT" | grep '^WARN:' || true)
NW=$(printf '%s' "$WARNS" | grep -c '^WARN:' || true)
{
  printf '%s\n' "$REPORT" | grep -v '^WARN:'
  echo; echo "=== verdict"
  if [ "$NW" -eq 0 ]; then echo "OK"; else printf '%s\n' "$WARNS"; fi
} > "${TMPDIR:-/tmp}/qt-health.$$"

cat "${TMPDIR:-/tmp}/qt-health.$$"
if [ $SAVE -eq 1 ]; then
  D=~/Library/Logs/qt-health; mkdir -p "$D"
  F="$D/$(date '+%Y-%m-%d-%H%M').txt"
  cp "${TMPDIR:-/tmp}/qt-health.$$" "$F"; cp "$F" "$D/latest.txt"
  ls -1t "$D"/2*.txt 2>/dev/null | tail -n +61 | xargs rm -f   # keep ~2 months of daily reports
  if [ "$NW" -eq 0 ]; then MSG="All clear"; else MSG="$NW warning(s): $(printf '%s' "$WARNS" | head -1 | cut -c7-90)"; fi
  MSG=${MSG//\"/\'}
  osascript -e "display notification \"$MSG\" with title \"qt-health\"" 2>/dev/null || true
fi
rm -f "${TMPDIR:-/tmp}/qt-health.$$"
