#!/usr/bin/env bash
# read-only, from the Mac: same recorded segment through Bunny and Cloudflare, timed from this Mac and from webserver2-2.
# Mints on the box (admin preview, no view recorded) and prints no links or tokens. Shows speed from those two networks
# only, so it says nothing about a Vi phone. Run twice: the first fetch of a file can be a cache miss.
# usage: qt_cdn_speed_compare.sh [classId] [rung]   (default Day 13, rung 1), env RUNS (default 6)
set -euo pipefail
CLASS=${1:-6a4558cfebb42f585d9a8c85}; RUNG=${2:-1}; RUNS=${RUNS:-6}
BOX=(ssh -n -o BatchMode=yes -o ConnectTimeout=10 -i "$HOME/.ssh/hranker-webserver2-2" hranker@148.113.49.18)
read -r -d '' NODE <<'JS' || true
const path=require('path');require(path.resolve('node_modules/dotenv')).config({path:'.env.development'});
const m=require(path.resolve('node_modules/mongoose'));
const {getPlaybackUrl}=require(path.resolve('dist/src/controllers/playbackController.js'));
const [CLASS,RUNG]=process.argv.slice(2);
const mint=(cdn)=>new Promise((ok)=>{const res={status(){return this},json(b){ok(b.data.url);return this}};getPlaybackUrl({user:{admin_id:'speed-compare'},params:{classId:CLASS},query:{cdn},headers:{},ip:'127.0.0.1',socket:{}},res,()=>ok(null))});
const text=async(u)=>(await fetch(u)).text();
const first=(t,re)=>t.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')&&(!re||re.test(l)));
const hop=(base,rel)=>{const u=new URL(rel,base);if(!u.search)u.search=new URL(base).search;return u.toString()};
(async()=>{await m.connect(process.env.MONGO_URI,{autoIndex:false});
for(const cdn of ['bunny','cloudflare']){const url=await mint(cdn);const rungs=first(await text(url));const rung=hop(url,rungs[Math.min(Number(RUNG),rungs.length-1)]);const segs=first(await text(rung));console.log(cdn+' '+hop(rung,segs[Math.floor(segs.length/2)]));}
await m.disconnect();})().catch(e=>{console.error(e.message);process.exit(1)});
JS
SEGS=$("${BOX[@]}" "export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:\$PATH; cd /var/www/backend.quicktricksbysahilsir.com/quicktricks-backend && node -e $(printf %q "$NODE") x $CLASS $RUNG 2>/dev/null")
summary() { sort -n | awk '{a[NR]=$1; s=$2} END {printf "median %.2f s, best %.2f s, worst %.2f s, %.0f KB\n", a[int((NR+1)/2)], a[1], a[NR], s/1024}'; }
timed='%{time_total} %{size_download}\n'
while read -r cdn url; do
  printf '%-11s Mac   ' "$cdn"
  for _ in $(seq "$RUNS"); do curl -s -o /dev/null -m 30 -w "$timed" "$url"; done | summary
  printf '%-11s box   ' "$cdn"
  "${BOX[@]}" "for i in \$(seq $RUNS); do curl -s -o /dev/null -m 30 -w '$timed' $(printf %q "$url"); done" | summary
done <<< "$SEGS"
