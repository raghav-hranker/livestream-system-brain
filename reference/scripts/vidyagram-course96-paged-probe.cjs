// Read-only: page Vidyagram course 96's get_pc4_contents in fixed pages and report per-page time,
// id order and repeats, to see whether paging can replace the one-request listing that 502s.
// Run on test-uday from the nightly checkout: PAGE=1000 PASSES=2 node - < vidyagram-course96-paged-probe.cjs
(async()=>{try{require('dotenv').config({path:'.env.development',quiet:true});require('ts-node/register/transpile-only');
const m=require('mongoose');await m.connect(process.env.MONGO_URI,{dbName:'vidyagramdb',readPreference:'primary',autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:12000});
try{const{createHttpCatalogSource}=require('./src/services/apx/apxCatalogHttpSource');
const source=createHttpCatalogSource({db:m.connection.db,customerId:'781',orgId:'2177599',tenantApiBase:'https://armathsapi.akamai.net.in',gapMs:1000,studentGapMs:1000,timeoutMs:30000,listingTimeoutMs:120000});
const size=Number(process.env.PAGE||1000),passes=Number(process.env.PASSES||1),course=process.env.COURSE||'96';
const out={at:new Date().toISOString(),course,size,passes:[]};
for(let p=0;p<passes;p++){const seen=new Map(),pages=[],order=[];let repeats=0;
for(let start=0;start<40000;start+=size){const t=Date.now();let rows;
try{rows=await source.contentPage(course,start,size);}catch(e){pages.push({start,ok:false,error:e.name,http:e.status||null,ms:Date.now()-t});break;}
const ids=rows.map(r=>String(r.id));for(const id of ids){if(seen.has(id))repeats++;else seen.set(id,start);order.push(id);}
pages.push({start,ok:true,rows:rows.length,ms:Date.now()-t,first:ids[0],last:ids[ids.length-1]});if(rows.length<size)break;}
const nums=order.map(Number);let asc=0,desc=0;for(let i=1;i<nums.length;i++){if(nums[i]>nums[i-1])asc++;else if(nums[i]<nums[i-1])desc++;}
out.passes.push({unique:seen.size,rowsRead:order.length,repeats,ascSteps:asc,descSteps:desc,pages,orderHash:require('crypto').createHash('sha256').update(order.join(',')).digest('hex').slice(0,16)});}
console.log(JSON.stringify(out));}finally{await m.disconnect();}}catch(e){console.error('probe_failed',e.name,e.code||'',String(e.message).replace(/https?:\/\/\S+/g,'[url]'));process.exitCode=1;}})();
