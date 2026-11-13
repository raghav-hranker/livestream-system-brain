// Read-only: does AppX get_pc4_contents honour a DataTables sort? Appends each ORDERS variant
// (a form querystring) to the nightly source's own request, reads two pages per variant and
// reports ids, sortedness and recordsTotal. With FULL=<variant index>, pages the whole course
// with that variant and reports repeats. Cookie handling stays inside the nightly source.
// Run on test-uday from the nightly checkout: COURSE=96 PAGE=250 node - < vidyagram-pc4-order-probe.cjs
(async()=>{try{require('dotenv').config({path:'.env.development',quiet:true});require('ts-node/register/transpile-only');
const axios=require('axios');const post=axios.post.bind(axios);let extra='',total=null;
axios.post=async(url,body,cfg)=>{const r=await post(url,extra&&String(url).includes('get_pc4_contents')?`${body}&${extra}`:body,cfg);
try{const j=JSON.parse(String(r.data).replace(/[\u0000-\u001f]/g,' '));total={recordsTotal:j.recordsTotal??null,recordsFiltered:j.recordsFiltered??null,iTotalRecords:j.iTotalRecords??null};}catch{}return r;};
const m=require('mongoose');await m.connect(process.env.MONGO_URI,{dbName:'vidyagramdb',readPreference:'primary',autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:12000});
try{const{createHttpCatalogSource}=require('./src/services/apx/apxCatalogHttpSource');
const source=createHttpCatalogSource({db:m.connection.db,customerId:'781',orgId:'2177599',tenantApiBase:'https://armathsapi.akamai.net.in',gapMs:1000,studentGapMs:1000,timeoutMs:30000,listingTimeoutMs:60000});
const course=process.env.COURSE||'96',size=Number(process.env.PAGE||250);
const enc=(s)=>s.replace(/\[/g,'%5B').replace(/\]/g,'%5D');
const variants=(process.env.ORDERS||['','order[0][column]=0&order[0][dir]=asc','order[0][column]=0&order[0][dir]=asc&columns[0][data]=id&columns[0][orderable]=true','columns[0][data]=id&order[0][column]=0&order[0][dir]=desc'].join('|')).split('|');
const sorted=(ids)=>{let a=0,d=0;for(let i=1;i<ids.length;i++){if(+ids[i]>+ids[i-1])a++;else if(+ids[i]<+ids[i-1])d++;}return{a,d};};
const out={at:new Date().toISOString(),course,size,variants:[]};
if(process.env.COMPARE){const live=new Set(),per=[];
for(const dir of (process.env.COMPARE==='both'?['asc','desc']:['asc'])){extra=enc(`columns[0][data]=id&order[0][column]=0&order[0][dir]=${dir}`);const s=new Set();
for(let start=0;start<40000;start+=size){const rows=await source.contentPage(course,start,size);for(const r of rows){live.add(String(r.id));s.add(String(r.id));}if(rows.length<size)break;}
per.push({dir,unique:s.size,total});}
out.passes=per;
const c=await m.connection.db.collection('apxcatalogcourses').findOne({customerId:'781',apxCourseId:course},{projection:{'capture.runId':1}});
const runId=c?.capture?.runId;const mirror=new Set((await m.connection.db.collection('apxcatalogrows').find({customerId:'781',apxCourseId:course,lastSeenRunId:runId},{projection:{rowId:1}}).toArray()).map(d=>String(d.rowId)));
const onlyMirror=[...mirror].filter(x=>!live.has(x)),onlyLive=[...live].filter(x=>!mirror.has(x));
out.compare={captureRunId:runId,live:live.size,mirror:mirror.size,onlyMirror:onlyMirror.length,onlyLive:onlyLive.length,onlyMirrorSample:onlyMirror.slice(0,5),onlyLiveSample:onlyLive.slice(0,5)};}
else if(process.env.DUPS){const byId=new Map(),dups=[];let samePage=0;
for(let start=0;start<40000;start+=size){const rows=await source.contentPage(course,start,size);
for(const r of rows){const id=String(r.id),prev=byId.get(id);if(prev){if(prev.start===start)samePage++;
const diff=Object.keys({...prev.r,...r}).filter(k=>JSON.stringify(prev.r[k])!==JSON.stringify(r[k]));dups.push({id,diff});}else byId.set(id,{r,start});}
if(rows.length<size)break;}
const fields={};for(const d of dups)for(const k of d.diff)fields[k]=(fields[k]||0)+1;
const flags=(k)=>{const c={};for(const d of dups){const v=String(byId.get(d.id).r[k]);c[v]=(c[v]||0)+1;}return c;};
out.dups={count:dups.length,distinctIds:new Set(dups.map(d=>d.id)).size,identical:dups.filter(d=>!d.diff.length).length,samePage,differingFields:fields,enable:flags('enable'),deleted:flags('deleted'),type:flags('material_type'),sample:dups.slice(0,3).map(d=>d.id)};}
else if(process.env.FULL==null){for(const v of variants){extra=enc(v);const pages=[];
for(const start of [0,size]){const t=Date.now();try{const ids=(await source.contentPage(course,start,size)).map(r=>String(r.id));pages.push({start,ms:Date.now()-t,n:ids.length,first:ids[0],last:ids[ids.length-1],min:Math.min(...ids.map(Number)),max:Math.max(...ids.map(Number)),...sorted(ids)});}
catch(e){pages.push({start,error:e.name,http:e.status||null,ms:Date.now()-t});}}
out.variants.push({order:v,total,pages});}}
else{const v=variants[Number(process.env.FULL)];extra=enc(v);const seen=new Set(),bounds=[];let read=0,rep=0,fail=null;
for(let start=0;start<40000;start+=size){let ids;try{ids=(await source.contentPage(course,start,size)).map(r=>String(r.id));}catch(e){fail={start,error:e.name,http:e.status||null};break;}
for(const id of ids){read++;if(seen.has(id))rep++;else seen.add(id);}bounds.push([ids[0],ids[ids.length-1]]);if(ids.length<size)break;}
out.variants.push({order:v,total,read,unique:seen.size,repeats:rep,pages:bounds.length,fail,boundsSample:bounds.slice(0,4)});}
console.log(JSON.stringify(out));}finally{await m.disconnect();}}catch(e){console.error('probe_failed',e.name,e.code||'',String(e.message).replace(/https?:\/\/\S+/g,'[url]'));process.exitCode=1;}})();
