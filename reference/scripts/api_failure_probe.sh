#!/usr/bin/env bash
# Read-only "APIs are failing" probe for the quicktricks prod API (webserver2-2).
# Run from the Mac:  bash reference/scripts/api_failure_probe.sh [OUT_BYTES] > out.txt 2>&1
# OUT_BYTES = how much of the tail of the pm2 out log to analyse (default 4G).
# Prints counts and normalised route names only, never raw log lines: request bodies
# in that log hold passwords and JWTs (see memory prod-logs-contain-jwts).
set -euo pipefail
OUT_BYTES="${1:-4G}"
ssh -i ~/.ssh/hranker-webserver2-2 -o ConnectTimeout=15 hranker@148.113.49.18 "OUT_BYTES=$OUT_BYTES bash -s" <<'REMOTE'
set -uo pipefail
export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH
APP=/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend
L=~/.pm2/logs
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

echo "=== box  $(date '+%F %T %Z')"
uptime; free -m | head -2; df -h / /home 2>/dev/null | sort -u
echo "HEAD $(git -C $APP log -1 --format='%h %ci %an %s')"
echo "dirty tracked files: $(git -C $APP status --porcelain -uno | wc -l)"

echo; echo "=== pm2 quicktricks processes"
pm2 jlist 2>/dev/null | node -e '
const raw=require("fs").readFileSync(0,"utf8");const a=JSON.parse(raw.slice(raw.indexOf("[")));
for(const p of a){if(!/quicktricks/.test(p.name))continue;const e=p.pm2_env;
console.log(p.pm_id,p.name,e.status,"restarts="+e.restart_time,"unstable="+e.unstable_restarts,
"up="+new Date(e.pm_uptime).toISOString(),"mem="+Math.round(p.monit.memory/1e6)+"MB","cpu="+p.monit.cpu+"%",
"exec="+e.exec_mode,"inst="+(e.instances||1),"max_mem="+(e.max_memory_restart||"-"),"node_args="+JSON.stringify(e.node_args||[]))}'

echo; echo "=== log sizes"; ls -la $L/quicktricks-backend-out.log $L/quicktricks-backend-error.log $L/quicktricks-socket-*.log ~/.pm2/pm2.log 2>/dev/null

echo; echo "=== pm2.log events for quicktricks-* since 2026-10-04 (day app event)"
grep -a 'quicktricks' ~/.pm2/pm2.log | grep -aE '2026-10-(0[4-9]|[1-3][0-9])' | node -e '
const lines=require("fs").readFileSync(0,"utf8").split("\n");const c={};
for(const l of lines){const d=(l.match(/2026-10-\d\d/)||[])[0];const app=(l.match(/\[(quicktricks[\w-]*):\d+\]/)||[])[1];if(!d||!app)continue;
let ev=null;const m=l.match(/exited with code \[(\w+)\] via signal \[(\w+)\]/);if(m)ev="exit code="+m[1]+" sig="+m[2];
else if(/starting in/.test(l))ev="start";else if(/online/.test(l))ev="online";else if(/memory|max_memory/i.test(l))ev="mem-limit";else continue;
const k=d+" "+app+" "+ev;c[k]=(c[k]||0)+1}
for(const k of Object.keys(c).sort())console.log(c[k],k)'
echo "--- last 12 backend exit lines (timestamps)"
grep -a 'quicktricks-backend' ~/.pm2/pm2.log | grep -a 'exited with' | tail -12 | cut -c1-160

echo; echo "=== out-log growth (30 s sample)"
S1=$(stat -c %s $L/quicktricks-backend-out.log); sleep 30; S2=$(stat -c %s $L/quicktricks-backend-out.log)
echo "bytes/s=$(( (S2-S1)/30 ))  (window $OUT_BYTES ~ $(node -e "const b='$OUT_BYTES'.replace(/G$/,'e9').replace(/M$/,'e6');console.log(((+b)/Math.max(1,($S2-$S1)/30)/3600).toFixed(1))") h at the current rate)"

cat > $T/a.js <<'JS'
const rl=require("readline").createInterface({input:process.stdin,crlfDelay:Infinity});
const M="(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)";
const FIN=new RegExp(M+" (\\S+) → (\\d{3}) \\((\\d+)ms\\)");
const START=new RegExp("🔍 "+M+" (\\S+)");
const BOOT=/Server and Socket\.IO running on port/;
const ERRPAT=[["mongo-selection",/ServerSelection|buffering timed out/],["mongo-network",/MongoNetwork|MongoNetworkTimeout|connection .* (closed|timed out)/i],
["mongo-maxtime",/MaxTimeMSExpired|exceeded time limit/],["mongo-other",/Mongo(Server)?Error|MongooseError|CastError|ValidationError/],
["redis",/redis|ReplyError|ECONNREFUSED.*6379/i],["econnreset",/ECONNRESET|socket hang up|EPIPE/],["etimedout",/ETIMEDOUT|ESOCKETTIMEDOUT|timeout of \d+ms/],
["heap",/heap out of memory|Allocation failed/],["unhandled",/Unhandled|uncaught/i],["emfile",/EMFILE|too many open files/i]];
const norm=u=>{u=u.replace(/^https?:\/\/[^/]+/,"").split("?")[0];
 return u.replace(/\/[0-9a-f]{24}(?=\/|$)/gi,"/:id").replace(/\/[0-9a-f-]{36}(?=\/|$)/gi,"/:uuid").replace(/\/\d+(?=\/|$)/g,"/:n")
 .replace(/\/[A-Za-z0-9_\-.%]{25,}(?=\/|$)/g,"/:tok").replace(/\/[^/]*@[^/]*/g,"/:email")};
const R=new Map();const route=k=>{let r=R.get(k);if(!r){if(R.size>6000)k="(other)";r=R.get(k)||{n:0,e5:0,e4:0,s5:0,s30:0,s60:0,max:0,sum:0,codes:{},ab:0,openAtBoot:0};R.set(k,r)}return r};
let ln=0,fins=0,starts=0,ts=0,boots=0;const hours={};const errs={};
let open=new Map();const segs=[];let seg={fins:0,e5:0,s30:0};
const sweep=(cut)=>{for(const[k,arr]of open){while(arr.length&&arr[0]<cut){arr.shift();route(norm(k.slice(k.indexOf(" ")+1))).ab++}if(!arr.length)open.delete(k)}};
rl.on("line",l=>{ln++;if(ln%200000===0)sweep(ln-1500000);
 let m=l.match(FIN);
 if(m){fins++;const k=m[1]+" "+norm(m[2]);const r=route(k);const st=+m[3],ms=+m[4];r.n++;r.sum+=ms;if(ms>r.max)r.max=ms;
  if(st>=500){r.e5++;r.codes[st]=(r.codes[st]||0)+1;seg.e5++}else if(st>=400){r.e4++;r.codes[st]=(r.codes[st]||0)+1}
  if(ms>5000)r.s5++;if(ms>30000){r.s30++;seg.s30++}if(ms>60000)r.s60++;seg.fins++;
  const h=l.match(/^(\d{4}-\d\d-\d\d)[T ](\d\d)/);if(h){ts++;const hk=h[1]+" "+h[2];const b=hours[hk]||(hours[hk]={n:0,e5:0,s30:0});b.n++;if(st>=500)b.e5++;if(ms>30000)b.s30++}
  const raw=m[1]+" "+m[2].replace(/^https?:\/\/[^/]+/,"");const a=open.get(raw);if(a){a.shift();if(!a.length)open.delete(raw)}return}
 m=l.match(START);
 if(m){starts++;if(/^\/(uploads|_next)/.test(m[2]))return;const raw=m[1]+" "+m[2];const a=open.get(raw);if(a)a.push(ln);else open.set(raw,[ln]);return}
 if(BOOT.test(l)){boots++;const o={};let oldest=[];for(const[k,arr]of open){const rk=k.split(" ")[0]+" "+norm(k.slice(k.indexOf(" ")+1));
   for(const s of arr){o[rk]=(o[rk]||0)+1;oldest.push([s,rk]);route(rk).openAtBoot++}}
  oldest.sort((a,b)=>a[0]-b[0]);segs.push({atLine:ln,...seg,open:Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,8),
   oldest:oldest.slice(0,6).map(([s,k])=>k+" ("+(ln-s)+" lines before boot)")});seg={fins:0,e5:0,s30:0};open=new Map();return}
 for(const[name,re]of ERRPAT)if(re.test(l)){errs[name]=(errs[name]||0)+1;break}
});
rl.on("close",()=>{sweep(ln-1500000);
 console.log(`lines=${ln} finished=${fins} started=${starts} boots(restarts in window)=${boots} timestamped=${ts}`);
 const all=[...R.entries()];const tot=all.reduce((a,[,r])=>(a.n+=r.n,a.e5+=r.e5,a.e4+=r.e4,a.s30+=r.s30,a.ab+=r.ab,a),{n:0,e5:0,e4:0,s30:0,ab:0});
 console.log("TOTAL",JSON.stringify(tot));
 const show=(title,key,n=25)=>{console.log("\n--- "+title);for(const[k,r]of all.filter(([,r])=>r[key]>0).sort((a,b)=>b[1][key]-a[1][key]).slice(0,n))
  console.log(String(r[key]).padStart(6),k,`n=${r.n} 5xx=${r.e5} 4xx=${r.e4} >5s=${r.s5} >30s=${r.s30} >60s=${r.s60} avg=${r.n?Math.round(r.sum/r.n):0}ms max=${r.max}ms abandoned=${r.ab} openAtBoot=${r.openAtBoot} codes=${JSON.stringify(r.codes)}`)};
 show("by 5xx count","e5");show("by >30s count","s30");show("by >5s count","s5");show("started, never finished (client gave up / socket closed)","ab");
 show("in flight when the process restarted","openAtBoot",15);
 console.log("\n--- by max ms (top 20)");for(const[k,r]of all.sort((a,b)=>b[1].max-a[1].max).slice(0,20))console.log(String(r.max).padStart(9)+"ms",k,`n=${r.n} >30s=${r.s30}`);
 console.log("\n--- still open at end of window (in flight right now or hung)");const o={};for(const[k,arr]of open){const rk=k.split(" ")[0]+" "+norm(k.slice(k.indexOf(" ")+1));o[rk]=(o[rk]||0)+arr.length}
 for(const[k,c]of Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,15))console.log(String(c).padStart(6),k);
 console.log("\n--- restarts in window (segment ending at each boot)");for(const s of segs)console.log(JSON.stringify(s));
 console.log("\n--- error-pattern line counts in out log",JSON.stringify(errs));
 if(ts){console.log("\n--- per hour (n / 5xx / >30s)");for(const h of Object.keys(hours).sort())console.log(h,hours[h].n,hours[h].e5,hours[h].s30)}
});
JS

echo; echo "=== out log analysis (tail -c $OUT_BYTES)"
tail -c "$OUT_BYTES" $L/quicktricks-backend-out.log | node --max-old-space-size=3072 $T/a.js

cat > $T/e.js <<'JS'
const rl=require("readline").createInterface({input:process.stdin,crlfDelay:Infinity});const c={};let n=0;
rl.on("line",l=>{if(!/error|fail|timeout|exception|refused|reset|fatal|warn/i.test(l))return;n++;
 const k=l.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,"<jwt>").replace(/^\S*\d{4}-\d\d-\d\d\S*:?\s*/,"").replace(/"[^"]{20,}"/g,'"…"').replace(/'[^']{20,}'/g,"'…'")
  .replace(/[0-9a-f]{24}/gi,":id").replace(/\b\d[\d.:-]*\b/g,"N").replace(/\S+@\S+/g,"<email>").slice(0,150);c[k]=(c[k]||0)+1});
rl.on("close",()=>{console.log("matching lines="+n);for(const[k,v]of Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,45))console.log(String(v).padStart(7),k)});
JS
echo; echo "=== error log: top normalised messages (tail -c 400M)"
tail -c 400M $L/quicktricks-backend-error.log | node $T/e.js
echo; echo "=== socket error log: top normalised messages (tail -c 100M)"
tail -c 100M $L/quicktricks-socket-error.log 2>/dev/null | node $T/e.js
echo; echo "=== done $(date '+%T')"
REMOTE
