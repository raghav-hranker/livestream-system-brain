#!/usr/bin/env bash
# Read-only: 5xx and >30 s responses on the test-taking routes of the quicktricks prod API,
# per route and per day, plus test-handler error counts from the error logs of the API
# (pm2 27), the user-test service (29) and the DLQ consumer (30).
# Run from the Mac:  bash reference/scripts/test_flow_5xx_probe.sh [OUT_BYTES] [HOURS] [EXCL_FROM] [EXCL_TO] > out.txt 2>&1
# Only lines from the last HOURS (default 24) count; EXCL_FROM..EXCL_TO (box-local, e.g. 2026-10-11T14:00)
# is a known incident window reported separately instead of in the totals.
# Prints counts, normalised routes and redacted message shapes only, never raw lines.
set -euo pipefail
OUT_BYTES="${1:-16G}"; HOURS="${2:-24}"; EXCL_FROM="${3:-x}"; EXCL_TO="${4:-x}"
ssh -i ~/.ssh/hranker-webserver2-2 -o ConnectTimeout=15 hranker@148.113.49.18 "OUT_BYTES=$OUT_BYTES HOURS=$HOURS EXCL_FROM=$EXCL_FROM EXCL_TO=$EXCL_TO bash -s" <<'REMOTE'
set -uo pipefail
export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH
L=~/.pm2/logs
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export SINCE=$(date -d "$HOURS hours ago" '+%FT%T') EXCL_FROM EXCL_TO
echo "=== now $(date '+%F %T %Z')  since $SINCE  incident window $EXCL_FROM .. $EXCL_TO (reported separately)"
pm2 jlist 2>/dev/null | node -e '
const raw=require("fs").readFileSync(0,"utf8");const a=JSON.parse(raw.slice(raw.indexOf("[")));
for(const p of a){if(!/quicktricks-(user-test|dlq)/.test(p.name))continue;const e=p.pm2_env;
console.log(p.pm_id,p.name,"script="+e.pm_exec_path,"out="+e.pm_out_log_path,"err="+e.pm_err_log_path,"PORT="+(e.env&&e.env.PORT||"-"))}'

cat > $T/t.js <<'JS'
const rl=require("readline").createInterface({input:process.stdin,crlfDelay:Infinity});
const TEST=/^\/api\/(user-test|series|test-results|series-question-maps|questions|user-question-answer|saved-question|report-question|ai-test|packages|package-series|rank|scores|user-test-dlq|room|leaderboard|user-test-leaderboard|course-tests|courses\/[^/]+\/tests|typing)/;
const FIN=/(GET|POST|PUT|PATCH|DELETE) (\S+) → (\d{3}) \((\d+)ms\)/;const TS=/^(\d{4}-\d\d-\d\d)[T ](\d\d)(:\d\d:\d\d)/;
const {SINCE,EXCL_FROM,EXCL_TO}=process.env;const INC={};
const norm=u=>u.replace(/\/[0-9a-f]{24}(?=\/|$)/gi,"/:id").replace(/\/\d+(?=\/|$)/g,"/:n").replace(/\/[A-Za-z0-9_\-.%]{40,}(?=\/|$)/g,"/:tok");
const R={},day={},hr={};let n=0,first=null,last=null;
rl.on("line",l=>{const f=l.match(FIN);if(!f)return;const p=f[2].replace(/^https?:\/\/[^/]+/,"").split("?")[0];if(!TEST.test(p))return;
 const t=l.match(TS);if(!t)return;const key=t[1]+"T"+t[2]+t[3];if(key<SINCE)return;
 if(key>=EXCL_FROM&&key<EXCL_TO){const st=+f[3],ms=+f[4];const k=f[1]+" "+norm(p);const r=INC[k]||(INC[k]={n:0,e5:0,s30:0});r.n++;if(st>=500)r.e5++;if(ms>30000)r.s30++;return}const d=t?t[1]:"?";if(t){first=first||t[1]+" "+t[2];last=t[1]+" "+t[2]}n++;
 const st=+f[3],ms=+f[4];const k=f[1]+" "+norm(p);const r=R[k]||(R[k]={n:0,e5:0,s30:0,codes:{},days:{}});r.n++;
 if(ms>30000)r.s30++;if(st>=500){r.e5++;r.codes[st]=(r.codes[st]||0)+1;r.days[d]=(r.days[d]||0)+1;
  const dd=day[d]||(day[d]={});dd[k]=(dd[k]||0)+1;if(t){const hk=t[1]+" "+t[2];hr[hk]=(hr[hk]||0)+1}}});
rl.on("close",()=>{console.log(`test-route requests=${n} window ${first} .. ${last}`);
 console.log("\n--- test routes with any 5xx (5xx count, then n, >30s, codes, 5xx per day)");
 for(const[k,r]of Object.entries(R).filter(([,r])=>r.e5).sort((a,b)=>b[1].e5-a[1].e5))console.log(String(r.e5).padStart(6),k,`n=${r.n} >30s=${r.s30}`,JSON.stringify(r.codes),JSON.stringify(r.days));
 console.log("\n--- test routes by >30s (no 5xx, but the app likely times out)");
 for(const[k,r]of Object.entries(R).filter(([,r])=>r.s30).sort((a,b)=>b[1].s30-a[1].s30).slice(0,20))console.log(String(r.s30).padStart(6),k,`n=${r.n} 5xx=${r.e5}`);
 console.log("\n--- INSIDE incident window (excluded above): test routes with 5xx or >30s");
 for(const[k,r]of Object.entries(INC).filter(([,r])=>r.e5||r.s30).sort((a,b)=>(b[1].e5+b[1].s30)-(a[1].e5+a[1].s30)).slice(0,20))console.log(String(r.e5).padStart(6),k,`n=${r.n} >30s=${r.s30}`);
 console.log("\n--- 5xx on test routes per hour (outside incident window)");for(const h of Object.keys(hr).sort())console.log(h,hr[h])});
JS
echo; echo "=== API out log, test routes (tail -c $OUT_BYTES)"
tail -c "$OUT_BYTES" $L/quicktricks-backend-out.log | node --max-old-space-size=2048 $T/t.js

cat > $T/e.js <<'JS'
const rl=require("readline").createInterface({input:process.stdin,crlfDelay:Infinity});
const TS=/^(\d{4}-\d\d-\d\d)[T ](\d\d)(:\d\d:\d\d)/;const {SINCE,EXCL_FROM,EXCL_TO}=process.env;const P=[["questionsmob (load test)",/Error fetching series with questions mob/],["solution-questionsmob",/Error fetching solution questions mob/],
["solution-questions",/Error fetching solution questions:/],["series-with-questions",/Error fetching series with questions:/],
["resumeTest",/\[resumeTest\] error/],["savePauseTest",/\[savePauseTest\] error/],["deletePauseTest",/\[deletePauseTest\] error/],
["submit (createOrUpdateUserPackageTestResult)",/createOrUpdateUserPackageTestResult/],["global-error-handler",/Global Error Handler:/]];
const c={};let n=0,ts=0;const shapes={};
rl.on("line",l=>{n++;const t=l.match(TS);if(t)ts++;const key=t?t[1]+"T"+t[2]+t[3]:"";if(t&&key<SINCE)return;
 const d=!t?"no-ts":(key>=EXCL_FROM&&key<EXCL_TO)?"INCIDENT":t[1]+" "+t[2]+"h";
 for(const[name,re]of P)if(re.test(l)){const k=name+" | "+d;c[k]=(c[k]||0)+1;
  const s=l.replace(/^\S*\d{4}-\d\d-\d\d\S*:?\s*/,"").replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,"<jwt>").replace(/[0-9a-f]{24}/gi,":id").replace(/\b\d[\d.:-]*\b/g,"N").slice(0,150);shapes[s]=(shapes[s]||0)+1}});
rl.on("close",()=>{console.log("lines="+n+" timestamped="+ts);for(const k of Object.keys(c).sort())console.log(String(c[k]).padStart(7),k);
 console.log("-- message shapes");for(const[k,v]of Object.entries(shapes).sort((a,b)=>b[1]-a[1]).slice(0,20))console.log(String(v).padStart(7),k)});
JS
echo; echo "=== API error log: test-handler errors per day (tail -c 900M)"
tail -c 900M $L/quicktricks-backend-error.log | node $T/e.js

cat > $T/g.js <<'JS'
const rl=require("readline").createInterface({input:process.stdin,crlfDelay:Infinity});const c={};const TS=/^(\d{4}-\d\d-\d\d)/;let n=0;const days={};
rl.on("line",l=>{if(!/error|fail|timeout|exception|refused|reset|fatal|dlq|retry/i.test(l))return;n++;const t=l.match(TS);if(t)days[t[1]]=(days[t[1]]||0)+1;
 const k=l.replace(/^\S*\d{4}-\d\d-\d\d\S*:?\s*/,"").replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,"<jwt>").replace(/"[^"]{20,}"/g,'"…"').replace(/[0-9a-f]{24}/gi,":id").replace(/\b\d[\d.:-]*\b/g,"N").slice(0,150);c[k]=(c[k]||0)+1});
rl.on("close",()=>{console.log("matching lines="+n,"per day",JSON.stringify(days));for(const[k,v]of Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,25))console.log(String(v).padStart(7),k)});
JS
for f in quicktricks-user-test-error quicktricks-user-test-out quicktricks-dlq-consumer-error quicktricks-dlq-consumer-out; do
  echo; echo "=== $f: error-ish lines (tail -c 200M)"; for g in $L/$f*.log; do ls -la $g && tail -c 200M $g | node $T/g.js; done; true
done
echo; echo "=== done $(date '+%T')"
REMOTE
