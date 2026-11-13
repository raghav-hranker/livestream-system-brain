#!/usr/bin/env bash
# Removes the unauthenticated `GET /api/v1/reset` route (Room.deleteMany + rm ./public) from the 5 live livestream servers on the
# GPU box, one at a time, each with a restart. Nothing else in those files changes. Dry run by default; COMMIT=1 applies.
# Refuses to touch anything while a live class is on air. It waits (until UNTIL_EPOCH, default 4 h) for the box to be clear for
# QUIET_MIN minutes, and re-checks before each server. A server that fails its checks gets its file back and the run stops.
# Never calls /reset itself: the route is checked by reading the file and listing the router's own routes.
set -uo pipefail
OUT=/root/gpu-decode-build/reset-route
TS=$(date +%Y%m%d-%H%M%S)
QUIET_MIN=${QUIET_MIN:-30}
UNTIL_EPOCH=${UNTIL_EPOCH:-$(( $(date +%s) + 4*3600 ))}
mkdir -p "$OUT"
# pm2 id : port : checkout
SERVERS="1:3001:/root/livestream/backend 2:3002:/root/livestream-futurekul/backend 3:8081:/root/livestream-gpu/backend 15:3005:/root/livestream-futurekul-obs/backend 16:3006:/root/livestream-futurekul-obs-2/backend"

live_count() { ps -eo args | grep -c "[f]fmpeg .*rtmp://"; }
pm2_status() { pm2 jlist 2>/dev/null | grep '^\[' | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const p=JSON.parse(d).find(p=>p.pm_id==process.argv[1]);console.log(p?p.pm2_env.status:"missing")})' "$1"; }
has_route() { grep -c "router.get('/reset'" "$1/routes/room.js"; }
routes_listing() { (cd "$1" && node -e 'const r=require("./routes/room");const s=(r.stack||[]).filter(l=>l.route).map(l=>Object.keys(l.route.methods)[0].toUpperCase()+" "+l.route.path);console.log(s.length+" routes; /reset present: "+s.some(x=>x==="GET /reset"));process.exit(0)' 2>/dev/null | tail -1); }

patch() { python3 - "$1/routes/room.js" <<'EOF'
import re,sys
p=sys.argv[1]; s=open(p).read()
pat=re.compile(r"router\.get\('/reset', async \(req, res\) => \{\n\s*await Room\.deleteMany\(\{\}\);\n\s*fs\.rmdirSync\('\./public', \{ recursive: true \}\);\n\s*\n\s*res\.status\(200\)\.json\(\{ message: \"Rooms reset\" \}\);\n\}\);\n\n?")
new,n=pat.subn('',s)
if n!=1: sys.exit(f'expected exactly 1 /reset block, found {n}')
open(p,'w').write(new)
EOF
}

echo "start $(date -Is)  COMMIT=${COMMIT:-0}  quiet=${QUIET_MIN}min  until=$(date -d @"$UNTIL_EPOCH" -Is)"
for s in $SERVERS; do IFS=: read -r id port dir <<<"$s"
  echo "server pm2=$id port=$port $dir: status=$(pm2_status "$id") route_lines=$(has_route "$dir") dirty=$(git -C "$dir" status --short routes/room.js | wc -l) | $(routes_listing "$dir")"
done
echo "live sessions on the box now: $(live_count)"
if [ "${COMMIT:-0}" != 1 ]; then
  for s in $SERVERS; do IFS=: read -r id port dir <<<"$s"
    cp "$dir/routes/room.js" "$OUT/dry-room.js"
    python3 - "$dir/routes/room.js" <<'EOF' && echo "dry run pm2=$id: block matches exactly once"
import re,sys
s=open(sys.argv[1]).read()
n=len(re.findall(r"router\.get\('/reset', async \(req, res\) => \{\n\s*await Room\.deleteMany\(\{\}\);\n\s*fs\.rmdirSync\('\./public', \{ recursive: true \}\);\n\s*\n\s*res\.status\(200\)\.json\(\{ message: \"Rooms reset\" \}\);\n\}\);\n\n?",s))
sys.exit(0 if n==1 else f'found {n}')
EOF
  done
  rm -f "$OUT/dry-room.js"
  echo "dry run only: nothing changed"
  exit 0
fi

wait_quiet() {
  local clear_since=""
  while [ "$(date +%s)" -lt "$UNTIL_EPOCH" ]; do
    if [ "$(live_count)" = 0 ]; then
      [ -z "$clear_since" ] && clear_since=$(date +%s)
      [ $(( $(date +%s) - clear_since )) -ge $(( ${1:-$QUIET_MIN} * 60 )) ] && return 0
    else clear_since=""; fi
    sleep 30
  done
  return 1
}
wait_quiet || { echo "ABORT $(date -Is): the box was never quiet for $QUIET_MIN min before the deadline; nothing changed"; exit 3; }
echo "quiet $(date -Is)"
for s in $SERVERS; do IFS=: read -r id port dir <<<"$s"
  [ "$(live_count)" = 0 ] || { echo "STOP $(date -Is): a live session appeared before pm2=$id; servers done so far stay done"; exit 4; }
  [ "$(has_route "$dir")" = 1 ] || { echo "pm2=$id: route lines=$(has_route "$dir"), skipping"; continue; }
  cp "$dir/routes/room.js" "$OUT/room.js.pm2-$id.$TS"
  if ! patch "$dir" || ! node --check "$dir/routes/room.js"; then
    echo "pm2=$id: patch failed, file restored"; cp "$OUT/room.js.pm2-$id.$TS" "$dir/routes/room.js"; exit 5
  fi
  pm2 restart "$id" >/dev/null 2>&1; sleep 15
  st=$(pm2_status "$id"); listening=$(ss -ltn | grep -c ":$port "); code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "http://127.0.0.1:$port/api/v1/recording/145229")
  if [ "$st" != online ] || [ "$listening" = 0 ] || [ "${code:0:1}" = 5 ] || [ "$code" = 000 ]; then
    echo "pm2=$id: UNHEALTHY status=$st listening=$listening http=$code; restoring"; cp "$OUT/room.js.pm2-$id.$TS" "$dir/routes/room.js"; pm2 restart "$id" >/dev/null 2>&1; exit 6
  fi
  echo "pm2=$id port=$port done: status=$st http=$code route_lines=$(has_route "$dir") | $(routes_listing "$dir")"
  sleep 5
done
echo "finished $(date -Is); pm2 restarts this run: only ids 1 2 3 15 16"
