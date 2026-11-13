#!/usr/bin/env bash
# Read-only zoom into one time window of the quicktricks prod API logs (webserver2-2).
# Run from the Mac:  bash reference/scripts/api_stall_probe.sh 2026-10-11T13:30 2026-10-11T15:10 [OUT_BYTES] > out.txt 2>&1
# Times are box-local (IST), compared as strings against the pm2 line prefix.
# Prints counts, normalised routes and redacted message shapes only, never raw lines.
set -euo pipefail
FROM="$1"; TO="$2"; OUT_BYTES="${3:-1500M}"
ssh -i ~/.ssh/hranker-webserver2-2 -o ConnectTimeout=15 hranker@148.113.49.18 "FROM=$FROM TO=$TO OUT_BYTES=$OUT_BYTES bash -s" <<'REMOTE'
set -uo pipefail
export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH
APP=/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend
L=~/.pm2/logs
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
echo "=== window $FROM .. $TO   (now $(date '+%F %T %Z'))"

echo; echo "=== datastore endpoints (hosts and options only)"
cd $APP && node -e '
require("dotenv").config({path:".env.development"});
for(const [k,v] of Object.entries(process.env)){
 if(!/^(MONGO|DB_|DATABASE|REDIS)/i.test(k)||!v||!/:\/\//.test(v))continue;
 const m=v.match(/^(\w[\w+]*):\/\/(?:[^@/]*@)?([^/?]+)(\/[^?]*)?(\?.*)?$/);
 if(!m){console.log(k,"(unparsed)");continue}
 const opts=(m[4]||"").slice(1).split("&").filter(x=>x&&!/pass|secret|key|token/i.test(x));
 console.log(k,m[1],"hosts="+m[2],"db="+(m[3]||""),"opts="+opts.join("&"))}' 2>&1 | head -20
cd - >/dev/null

cat > $T/w.js <<'JS'
const {FROM,TO}=process.env;const rl=require("readline").createInterface({input:process.stdin,crlfDelay:Infinity});
const TS=/^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)/;const M="(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)";
const FIN=new RegExp(M+" (\\S+) → (\\d{3}) \\((\\d+)ms\\)");const START=new RegExp("🔍 "+M+" ");
const norm=u=>{u=u.replace(/^https?:\/\/[^/]+/,"").split("?")[0];return u.replace(/\/[0-9a-f]{24}(?=\/|$)/gi,"/:id").replace(/\/\d+(?=\/|$)/g,"/:n").replace(/\/[A-Za-z0-9_\-.%]{40,}(?=\/|$)/g,"/:tok")};
const red=l=>l.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,"<jwt>").replace(/"[^"]{20,}"/g,'"…"').replace(/'[^']{20,}'/g,"'…'").replace(/[0-9a-f]{24}/gi,":id")
 .replace(/\S+@\S+/g,"<email>").replace(/\b\d[\d.:-]*\b/g,"N").slice(0,140);
const toSec=(d,t)=>Date.parse(d+"T"+t+"+05:30")/1000;const hhmm=s=>new Date((s+19800)*1000).toISOString().slice(11,16);
const min={},routes={},other={},startMin={},finSec={},bucket={"30-35s":0,"35-60s":0,"60-120s":0,">120s":0};
let inW=0,first30=null,last=null;const slowStarts=[];
rl.on("line",l=>{const t=l.match(TS);if(!t)return;const key=t[1]+"T"+t[2];if(key<FROM||key>TO)return;inW++;last=key;
 const mk=t[2].slice(0,5);const b=min[mk]||(min[mk]={n:0,s5:0,s30:0,e5:0,max:0,starts:0,other:0});
 const f=l.match(FIN);
 if(f){const ms=+f[4],st=+f[3];b.n++;if(ms>5000)b.s5++;if(ms>30000)b.s30++;if(st>=500)b.e5++;if(ms>b.max)b.max=ms;
  const rk=f[1]+" "+norm(f[2]);const r=routes[rk]||(routes[rk]={n:0,s30:0,sum:0,e5:0});r.n++;r.sum+=ms;if(ms>30000)r.s30++;if(st>=500)r.e5++;
  if(ms>30000){const fs=toSec(t[1],t[2]);const ss=fs-Math.round(ms/1000);const sm=hhmm(ss);startMin[sm]=(startMin[sm]||0)+1;finSec[t[2]]=(finSec[t[2]]||0)+1;
   bucket[ms<35000?"30-35s":ms<60000?"35-60s":ms<120000?"60-120s":">120s"]++;slowStarts.push([ss,rk,ms])}
  return}
 if(START.test(l)){b.starts++;return}
 b.other++;const k=red(l.replace(TS,"").replace(/^:?\s*/,""));other[k]=(other[k]||0)+1});
rl.on("close",()=>{console.log("lines in window="+inW+" last ts="+last);
 console.log("\n--- per minute: finished / >5s / >30s / 5xx / max ms / starts / non-request lines");
 for(const k of Object.keys(min).sort()){const b=min[k];console.log(k,b.n,b.s5,b.s30,b.e5,b.max,b.starts,b.other)}
 console.log("\n--- >30s requests by duration",JSON.stringify(bucket));
 console.log("\n--- >30s requests by START minute");for(const k of Object.keys(startMin).sort())console.log(k,startMin[k]);
 console.log("\n--- seconds in which the most >30s requests FINISHED (burst = everything released at once)");
 for(const[k,v]of Object.entries(finSec).sort((a,b)=>b[1]-a[1]).slice(0,15))console.log(k,v);
 slowStarts.sort((a,b)=>a[0]-b[0]);console.log("\n--- earliest-starting >30s requests");
 for(const[s,rk,ms]of slowStarts.slice(0,15))console.log(new Date((s+19800)*1000).toISOString().slice(11,19),rk,ms+"ms");
 console.log("\n--- routes in window by >30s");for(const[k,r]of Object.entries(routes).sort((a,b)=>b[1].s30-a[1].s30).slice(0,25))
  console.log(String(r.s30).padStart(6),k,`n=${r.n} avg=${Math.round(r.sum/r.n)}ms 5xx=${r.e5}`);
 console.log("\n--- top non-request out-log lines in window (redacted shapes)");
 for(const[k,v]of Object.entries(other).sort((a,b)=>b[1]-a[1]).slice(0,40))console.log(String(v).padStart(7),k)});
JS
echo; echo "=== out log, window"
tail -c "$OUT_BYTES" $L/quicktricks-backend-out.log | FROM=$FROM TO=$TO node --max-old-space-size=2048 $T/w.js

cat > $T/e.js <<'JS'
const rl=require("readline").createInterface({input:process.stdin,crlfDelay:Infinity});
const TS=/^(\d{4}-\d\d-\d\d)[T ](\d\d):(\d\d)/;const P=[["ECONNREFUSED",/ECONNREFUSED/],["mongo-buffering-10s",/buffering timed out/],["redis-cmd-timeout",/Command timed out/],
["redis-maxretries",/MaxRetriesPerRequest/],["server-selection",/ServerSelectionError/],["global-error-handler",/Global Error Handler/],["sendOtp",/\[sendOtp\] failed/],["heap",/heap out of memory/]];
const hour={},addr={},firstLast={};let ts=0,n=0;
rl.on("line",l=>{n++;const t=l.match(TS);if(t)ts++;const h=t?t[1]+" "+t[2]:"no-ts";
 for(const[name,re]of P)if(re.test(l)){const k=h+" "+name;hour[k]=(hour[k]||0)+1;if(t){const f=firstLast[name]||(firstLast[name]=[t[0],t[0]]);f[1]=t[0]}}
 const a=l.match(/ECONNREFUSED ([\d.]+:\d+)/);if(a)addr[a[1]]=(addr[a[1]]||0)+1});
rl.on("close",()=>{console.log("lines="+n+" timestamped="+ts);console.log("ECONNREFUSED targets",JSON.stringify(addr));
 console.log("first/last per pattern",JSON.stringify(firstLast));for(const k of Object.keys(hour).sort())console.log(k,hour[k])});
JS
echo; echo "=== backend error log: pattern counts per hour (tail -c 400M)"
tail -c 400M $L/quicktricks-backend-error.log | node $T/e.js
echo; echo "=== socket error log: pattern counts per hour (tail -c 100M)"
tail -c 100M $L/quicktricks-socket-error.log | node $T/e.js
echo; echo "=== done $(date '+%T')"
REMOTE
