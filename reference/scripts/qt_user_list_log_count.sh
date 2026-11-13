#!/usr/bin/env bash
# Read-only, counts only: was the quicktricks student list (GET /api/users, POST /api/users/search) pulled in
# bulk? Scans the backend pm2 out log on webserver2-2 (~108 GB, IST timestamps) in one niced background pass and
# keeps only aggregates: per day, per route, per status, per query shape (param NAMES + page/limit buckets).
# No query value, body, phone, email, id or token is printed or saved; page/limit are bucketed on the box.
# `search` values stay in awk memory only: printed as a type (oid / 10-digit / email / text) and a distinct count.
# POST /search: the request line carries `| body: <first 500 chars>`; only "page"/"limit" (bucketed) and the
# body KEY names are read from it on the box. Response time is bucketed as a second size proxy.
# Counts only `GET http…/api/users[/]` and `POST http…/api/users/search` request lines; the `🔍` duplicate
# lines are tallied as format checks, never parsed.
# The pass pauses itself (SIGSTOP) while load > 8 and resumes below 6.
#
#   reference/scripts/qt_user_list_log_count.sh start    # upload the runner to /tmp on the box, start the pass
#   reference/scripts/qt_user_list_log_count.sh status   # load + progress (bytes read so far)
#   reference/scripts/qt_user_list_log_count.sh read     # print the aggregate once done
#   reference/scripts/qt_user_list_log_count.sh clean    # delete /tmp/qt_ulc.* on the box
#   LOG=<path> overrides the log file.
set -euo pipefail
KEY=${KEY:-$HOME/.ssh/hranker-webserver2-2}
LOG=${LOG:-/home/hranker/.pm2/logs/quicktricks-backend-out.log}
MODE=${1:-start}
box() { ssh -i "$KEY" -o ConnectTimeout=15 hranker@148.113.49.18 "$@"; }

case "$MODE" in
start)
  box "cat > /tmp/qt_ulc.sh && chmod 700 /tmp/qt_ulc.sh && uptime && \
       if awk -v l=\$(cut -d' ' -f1 /proc/loadavg) 'BEGIN{exit !(l>8)}'; then echo 'load > 8, not starting'; exit 1; fi; \
       LOG='$LOG' nohup bash /tmp/qt_ulc.sh run </dev/null >/dev/null 2>&1 & echo started" <<'REMOTE'
#!/usr/bin/env bash
# Runner placed in /tmp by qt_user_list_log_count.sh (system-brain). Read-only; writes aggregates to /tmp/qt_ulc.out.
set -uo pipefail
OUT=/tmp/qt_ulc.out; ST=/tmp/qt_ulc.status
if [ "${1:-}" = run ]; then
  echo "start $(date '+%F %T') size=$(stat -c %s "$LOG") load=$(cut -d' ' -f1-3 /proc/loadavg)" > "$ST"
  setsid bash "$0" scan > "$OUT.part" 2> /tmp/qt_ulc.err &
  PG=$!; echo "$PG" > /tmp/qt_ulc.pid; paused=
  while kill -0 "$PG" 2>/dev/null; do
    l=$(cut -d' ' -f1 /proc/loadavg)
    if [ -z "$paused" ] && awk -v l="$l" 'BEGIN{exit !(l>8)}'; then
      kill -STOP -- "-$PG"; paused=1; echo "pause $(date '+%F %T') load=$l" >> "$ST"
    elif [ -n "$paused" ] && awk -v l="$l" 'BEGIN{exit !(l<6)}'; then
      kill -CONT -- "-$PG"; paused=; echo "resume $(date '+%F %T') load=$l" >> "$ST"
    fi
    sleep 30
  done
  wait "$PG"; rc=$?
  mv "$OUT.part" "$OUT"; echo "done $(date '+%F %T') rc=$rc load=$(cut -d' ' -f1-3 /proc/loadavg)" >> "$ST"
  exit 0
fi
[ "${1:-}" = scan ] || exit 2
TS='^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}'
printf '1-range\tlog_bytes\t%s\n' "$(stat -c %s "$LOG")"
printf '1-range\tlog_first_ts\t%s\n' "$(head -c 4000000 "$LOG" | LC_ALL=C grep -a -m1 -oE "$TS")"
printf '1-range\tlog_last_ts\t%s\n' "$(tail -c 4000000 "$LOG" | LC_ALL=C grep -a -oE "$TS" | tail -1)"
LC_ALL=C nice -n 19 ionice -c3 grep -aF '/api/users' "$LOG" | LC_ALL=C nice -n 19 awk -v OFS='\t' '
function pb(v) { if (v == "") return "none"; if (v !~ /^[0-9]+$/) return "odd"; v += 0
  if (v < 1) return "odd"; if (v == 1) return "1"; if (v <= 3) return "2-3"; if (v <= 10) return "4-10"; return ">10" }
function lb(v) { if (v == "") return "none"; if (v !~ /^[0-9]+$/) return "odd"; v += 0
  if (v < 1) return "odd"; if (v == 1) return "1"; if (v < 50) return "2-49"; return ">=50" }
function msb(x) { if (x == "") return "nost"; x += 0; if (x < 100) return "<100"; if (x < 500) return "100-499"; if (x < 2000) return "500-1999"; return ">=2000" }
function vclass(v) { gsub(/%40/, "@", v); sub(/^(%2B|\+)/, "", v)
  if (v == "") return "empty"; if (length(v) == 24 && v ~ /^[0-9a-fA-F]+$/) return "oid"
  if (v ~ /^[0-9]+$/) { if (length(v) == 10) return "mob10"; if (length(v) == 12 && v ~ /^91/) return "mob12"; return "num" }
  if (index(v, "@")) return "email"; return "text" }
function safe(k) { if (length(k) > 30 || k !~ /^[A-Za-z_][A-Za-z0-9_.-]*$/ || k ~ /[0-9][0-9][0-9][0-9]/) return "?odd"; return k }
{
  if ($0 ~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:/) { day = substr($0, 1, 10); hr = substr($0, 12, 2) }
  else { day = "nodate"; hr = "??" }
  days[day] = 1; router[day]++
  isGet = match($0, /(^|[: ])GET https?:\/\/[^\/ ]+\/api\/users\/?([? ]|$)/)
  gRS = RSTART
  isPost = 0
  if (!isGet) isPost = match($0, /(^|[: ])POST https?:\/\/[^\/ ]+\/api\/users\/search\/?([? ]|$)/)
  if (!isGet && !isPost) {
    if ($0 ~ /GET [^ ]*\/api\/users\/?([? ]|$)/ || $0 ~ /POST [^ ]*\/api\/users\/search\/?([? ]|$)/) {
      if (index($0, "\360\237\224\215")) dup[day]++
      else { other[day]++; fmt[($0 ~ /(GET|POST) https?:/ ? "abs" : "rel") ($0 ~ / [0-9][0-9][0-9] \(/ ? "+status" : "-status")]++ }
    }
    next
  }
  st = "nost"; ms = ""
  if (match($0, / [0-9][0-9][0-9] \([0-9.]+ ?m?s\)/)) { st = substr($0, RSTART + 1, 3); ms = substr($0, RSTART + 6) + 0 }
  sts[st] = 1
  if (isPost) {
    pc[day]++; ph[day " " hr]++; hrs[day " " hr] = 1; ps[day, st]++; pms[day, msb(ms)]++
    bp = ""; bl = ""; bk = 0; bi = index($0, " | body: ")
    if (!bi) { pnob[day]++; P = "none"; L = "none"; bnames = "(nobody)" }
    else {
      b = substr($0, bi + 9); if (length(b) >= 500) pcut[day]++
      if (match(b, /"page": ?"?[0-9]+/)) { bp = substr(b, RSTART, RLENGTH); gsub(/[^0-9]/, "", bp) }
      if (match(b, /"limit": ?"?[0-9]+/)) { bl = substr(b, RSTART, RLENGTH); gsub(/[^0-9]/, "", bl) }
      while (bk < 40 && match(b, /"[A-Za-z_][A-Za-z0-9_]*":/)) {
        k = safe(substr(b, RSTART + 1, RLENGTH - 3)); b = substr(b, RSTART + RLENGTH)
        dupk = 0; for (a = 1; a <= bk; a++) if (bn[a] == k) dupk = 1
        if (!dupk) bn[++bk] = k
      }
      for (a = 2; a <= bk; a++) { t = bn[a]; for (c = a - 1; c >= 1 && bn[c] > t; c--) bn[c + 1] = bn[c]; bn[c + 1] = t }
      bnames = ""; for (a = 1; a <= bk; a++) bnames = bnames (a > 1 ? "," : "") bn[a]
      P = pb(bp); L = lb(bl)
    }
    ppb[day, P]++; plb[day, L]++
    if (P == "4-10" || P == ">10") { fpp[day]++; fph[day " " hr]++ }
    if (L == ">=50") { fpl[day]++; flh[day " " hr]++ }
    pshape = bnames " page=" P " limit=" L
    psh[pshape]++; if (!(pshape in pshf) || day < pshf[pshape]) pshf[pshape] = day; if (day > pshl[pshape]) pshl[pshape] = day
    if (P != "1" && P != "none" || L == ">=50") {
      pshd[day "\t" pshape]++
      bsv = "absent"; if (bi && match(substr($0, bi), /"search": ?"[^"]*"/)) { bsv = substr($0, bi + RSTART - 1, RLENGTH); sub(/^"search": ?"/, "", bsv); sub(/"$/, "", bsv); bsv = vclass(bsv) }
      pfl[day "\t" substr($0, 12, 5) "\tpage=" P "\tlimit=" L (bl == "200" ? "(=200 export size)" : "") "\tsearch=" bsv "\t" st "\t" msb(ms)]++
    }
    next
  }
  s = substr($0, gRS); u = substr(s, index(s, "/api/users")); sp = index(u, " "); if (sp) u = substr(u, 1, sp - 1)
  q = ""; qi = index(u, "?"); if (qi) q = substr(u, qi + 1)
  n = split(q, kv, "&"); page = ""; limit = ""; sv = ""; hasS = 0; c = 0
  for (j = 1; j <= n; j++) {
    if (kv[j] == "") continue
    e = index(kv[j], "="); k = e ? substr(kv[j], 1, e - 1) : kv[j]; v = e ? substr(kv[j], e + 1) : ""
    if (k == "page") page = v; else if (k == "limit") limit = v; else if (k == "search") { sv = v; hasS = 1 }
    nm[++c] = safe(k)
  }
  for (a = 2; a <= c; a++) { t = nm[a]; for (b = a - 1; b >= 1 && nm[b] > t; b--) nm[b + 1] = nm[b]; nm[b + 1] = t }
  names = ""; for (a = 1; a <= c; a++) names = names (a > 1 ? "," : "") nm[a]
  if (names == "") names = "(none)"
  P = pb(page); L = lb(limit)
  gc[day]++; gh[day " " hr]++; hrs[day " " hr] = 1; gp[day, P]++; gl[day, L]++; gs[day, st]++
  if (P == "4-10" || P == ">10") { fp[day]++; fph[day " " hr]++ }
  if (L == ">=50") { fl[day]++; flh[day " " hr]++ }
  if (L == "none") dl[day "\t" substr($0, 12, 5) "\t" st "\t" msb(ms)]++
  if (hasS) {
    lk[day]++; lc[day, vclass(sv)]++
    if (!((day SUBSEP sv) in seen)) { seen[day SUBSEP sv] = 1; du[day]++ }
    if (!(sv in seenall)) { seenall[sv] = 1; dall++ }
  }
  shape = names " page=" P " limit=" L
  sh[shape]++; if (!(shape in shf) || day < shf[shape]) shf[shape] = day; if (day > shl[shape]) shl[shape] = day
  if (shape != "limit,page,search page=1 limit=1") shd[day "\t" shape]++
}
END {
  for (k in hrs) {
    split(k, dh, " "); t = gh[k] + ph[k]
    if (gh[k] > mg[dh[1]]) mg[dh[1]] = gh[k]; if (ph[k] > mp[dh[1]]) mp[dh[1]] = ph[k]; if (t > mt[dh[1]]) mt[dh[1]] = t
    if (t > 200 || fph[k] || flh[k]) print "4-hourflag", dh[1], dh[2] ":00", "calls=" t, "GET=" gh[k] + 0, "POST=" ph[k] + 0, "page>3=" fph[k] + 0, "limit>=50=" flh[k] + 0
  }
  for (d in days) {
    gst = ""; pst = ""
    for (s in sts) { if (gs[d, s]) gst = gst " " s ":" gs[d, s]; if (ps[d, s]) pst = pst " " s ":" ps[d, s] }
    print "2-day", d, "router_lines=" router[d], "GET=" gc[d] + 0, \
      "page[1=" gp[d, "1"] + 0 " 2-3=" gp[d, "2-3"] + 0 " 4-10=" gp[d, "4-10"] + 0 " >10=" gp[d, ">10"] + 0 " none=" gp[d, "none"] + 0 " odd=" gp[d, "odd"] + 0 "]", \
      "limit[1=" gl[d, "1"] + 0 " 2-49=" gl[d, "2-49"] + 0 " >=50=" gl[d, ">=50"] + 0 " none=" gl[d, "none"] + 0 " odd=" gl[d, "odd"] + 0 "]", \
      "GETst[" substr(gst, 2) "]", "maxHrGET=" mg[d] + 0, "POST=" pc[d] + 0, "POSTst[" substr(pst, 2) "]", "maxHrPOST=" mp[d] + 0, \
      "maxHrAll=" mt[d] + 0, "page>3=" fp[d] + 0, "limit>=50=" fl[d] + 0, "dup=" dup[d] + 0, "otherfmt=" other[d] + 0
  }
  for (s in sh) print "3-shape", s, "n=" sh[s], "first=" shf[s], "last=" shl[s]
  for (s in shd) print "5-dayshape", s, "n=" shd[s]
  for (f in fmt) print "6-otherfmt", f, "n=" fmt[f]
  for (d in lk) print "7-lookup", d, "n=" lk[d], "distinct=" du[d], "oid=" lc[d, "oid"] + 0, "mob10=" lc[d, "mob10"] + 0, "mob12=" lc[d, "mob12"] + 0, \
    "num=" lc[d, "num"] + 0, "email=" lc[d, "email"] + 0, "text=" lc[d, "text"] + 0, "empty=" lc[d, "empty"] + 0
  for (d in pc) print "2-post", d, "POST=" pc[d], \
    "page[1=" ppb[d, "1"] + 0 " 2-3=" ppb[d, "2-3"] + 0 " 4-10=" ppb[d, "4-10"] + 0 " >10=" ppb[d, ">10"] + 0 " none=" ppb[d, "none"] + 0 " odd=" ppb[d, "odd"] + 0 "]", \
    "limit[1=" plb[d, "1"] + 0 " 2-49=" plb[d, "2-49"] + 0 " >=50=" plb[d, ">=50"] + 0 " none=" plb[d, "none"] + 0 " odd=" plb[d, "odd"] + 0 "]", \
    "page>3=" fpp[d] + 0, "limit>=50=" fpl[d] + 0, "nobody=" pnob[d] + 0, "cut500=" pcut[d] + 0
  for (s in psh) print "3-pshape", s, "n=" psh[s], "first=" pshf[s], "last=" pshl[s]
  for (s in pshd) print "5-dpshape", s, "n=" pshd[s]
  for (s in pfl) print "8-postflag", s, "n=" pfl[s]
  for (d in pc) print "7-postms", d, "<100=" pms[d, "<100"] + 0, "100-499=" pms[d, "100-499"] + 0, "500-1999=" pms[d, "500-1999"] + 0, ">=2000=" pms[d, ">=2000"] + 0, "nost=" pms[d, "nost"] + 0
  for (k in dl) print "8-defaultlimit", k, "n=" dl[k]
  print "9-total", "distinct_search_values_all_days=" dall + 0
}' | LC_ALL=C sort -t "$(printf '\t')" -k1,1 -k2,2 -k3,3
REMOTE
  ;;
status)
  box 'uptime; cat /tmp/qt_ulc.status 2>/dev/null; pid=$(cat /tmp/qt_ulc.pid 2>/dev/null); \
       [ -n "$pid" ] && for p in $(pgrep -g "$pid" grep); do grep -h "^pos:" /proc/$p/fdinfo/3 2>/dev/null; done; \
       [ -s /tmp/qt_ulc.err ] && { echo "stderr lines: $(wc -l < /tmp/qt_ulc.err)"; head -c 300 /tmp/qt_ulc.err; }; true'
  ;;
read)
  box 'cat /tmp/qt_ulc.status; [ -f /tmp/qt_ulc.out ] && cat /tmp/qt_ulc.out || echo "not done yet"'
  ;;
clean)
  box 'rm -f /tmp/qt_ulc.sh /tmp/qt_ulc.out /tmp/qt_ulc.out.part /tmp/qt_ulc.status /tmp/qt_ulc.err /tmp/qt_ulc.pid && echo cleaned'
  ;;
*) echo "usage: $0 start|status|read|clean" >&2; exit 2 ;;
esac
