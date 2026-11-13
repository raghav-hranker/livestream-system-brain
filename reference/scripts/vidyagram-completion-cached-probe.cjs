// Read-only, at most five cached VG tokens, one course per token; no OTP or DB writes.
'use strict';
const {MongoClient} = require('mongoose').mongo;
const uri=process.env.MONGO_URI;
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri||''))throw Error('VG URI required');
const client=new MongoClient(uri,{maxPoolSize:2,minPoolSize:0,serverSelectionTimeoutMS:15000});
async function main(){
  await client.connect();const db=client.db('vidyagramdb');
  const tokens=await db.collection('apxtestusertokens').find({orgId:'2177599'},{projection:{apxUserId:1,token:1,mintedAt:1}}).sort({_id:-1}).limit(5).toArray();
  const courses=await db.collection('courses').find({apxCourseId:{$exists:true}},{projection:{apxCourseId:1}}).toArray();
  const known=new Set(courses.map(c=>String(c.apxCourseId)));
  let denied=0;const rows=[];
  for(const t of tokens){
    const ids=[String(t.apxUserId)];if(Number.isFinite(Number(t.apxUserId)))ids.push(Number(t.apxUserId));
    const d=await db.collection('apx_user_course_test_detail').findOne({apxId:{$in:ids}},{projection:{'courses.courseId':1}});
    const cid=d?.courses?.map(c=>String(c.courseId)).find(c=>known.has(c));
    if(!cid){rows.push({sample:rows.length+1,skipped:'no mapped course in saved history',mintedAt:t.mintedAt});continue;}
    const u=new URL('https://armathsapi.akamai.net.in/get/getVideoCompletion');u.searchParams.set('item_id',cid);u.searchParams.set('item_type','10');
    const start=Date.now();let row;
    try{
      const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{Accept:'*/*','Auth-Key':'appxapi','Client-Service':'Appx',Authorization:t.token,'User-ID':String(t.apxUserId),Origin:'https://vidyagram.online',Referer:'https://vidyagram.online/',source:'website','User-Agent':'Mozilla/5.0'}});
      const b=await r.json().catch(()=>null);
      const ok=r.status===200&&b?.status===200&&(b.data===null||(typeof b.data==='object'&&!Array.isArray(b.data)));
      row={sample:rows.length+1,mintedAt:t.mintedAt,courseId:cid,http:r.status,api:typeof b?.status==='number'?b.status:null,validCompletionResponse:ok,elapsedMs:Date.now()-start};
      if(ok){row.sourceFlags=Object.keys(b.data||{}).length;row.completedFlags=Object.values(b.data||{}).filter(x=>x===1||x==='1').length;}
      if(r.status===401||r.status===403)denied++;
    }catch(e){row={sample:rows.length+1,error:e.name,elapsedMs:Date.now()-start};}
    rows.push(row);console.log(JSON.stringify({event:'completion-sample',...row}));
    if(denied>=3||row.http===429)break;
    await new Promise(r=>setTimeout(r,1000));
  }
  console.log(JSON.stringify({event:'completion-probe',at:new Date().toISOString(),tenant:'vidyagram',productionWrites:0,otpSent:0,cachedTokens:tokens.length,rows}));
}
main().catch(e=>{console.error(JSON.stringify({event:'probe-failed',name:e.name,code:e.code||null}));process.exitCode=1;}).finally(()=>client.close());
