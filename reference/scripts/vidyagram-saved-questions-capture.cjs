// VG AppX saved questions -> staging collections only (apx_vg_saved_question_*); savedquestions is never touched. Cached tokens only, no OTP.
// A rerun skips learners whose rows already equal AppX's own count; --refresh rereads everyone and marks rows AppX no longer lists.
// Stops on HTTP 429 or three refused tokens in a row. Prints counts only, never tokens or question text.
// --new-only (the 30-minute timer) takes only students never read, plus earlier failures, so refused tokens cannot stall it; --refresh covers the rest.
// Run on test-uday (AppX refuses the prod box): VG_APP_ROOT=<checkout> node - [--limit n] [--learners a,b] [--refresh | --new-only] < script
'use strict';
const fs=require('fs'),path=require('path');
const ORG='2177599',API='https://armathsapi.akamai.net.in',SITE='https://vidyagram.online';
const LEARNERS='apx_vg_saved_question_learners',CAPTURES='apx_vg_saved_question_captures';
const GAP_MS=1000,MAX_PAGES=500,TRIES=3,REFUSED_IN_A_ROW=3;
const log=(event,o={})=>console.log(JSON.stringify({event,...o}));
const bump=(o,k,n=1)=>{o[k]=(o[k]||0)+n;};
const chunks=(a,n)=>{const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out;};
class StopRun extends Error {}
class LearnerFailed extends Error {constructor(state,reason){super(reason);this.state=state;}}

async function request(deps,url,headers){
 for(let attempt=1;;attempt++){
  let http,body=null;
  try{
   const r=await deps.fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers});
   http=r.status;body=await r.json().catch(()=>null);
  }catch(e){http=e.name;}
  await deps.sleep(GAP_MS);
  if(http===429)throw new StopRun('http_429');
  if(typeof http==='number'&&http<500||attempt>=TRIES)return {http,body};
  await deps.sleep(GAP_MS*attempt*2);
 }
}

const apiHeaders=(token,apx)=>({Accept:'*/*','Auth-Key':'appxapi','Client-Service':'Appx',Authorization:token,'User-ID':apx,Origin:SITE,Referer:`${SITE}/`,'User-Agent':'Mozilla/5.0'});

// Same paging as AppX's own page: start is the number of distinct rows so far, an empty or all-repeat page ends it.
// Anything but status 200 fails the learner, so a refused token can never read as "saved nothing".
async function walkSaved(deps,token,apx){
 const rows=new Map();
 for(let page=0;page<MAX_PAGES;page++){
  const u=new URL(`${API}/Test_Series/getSavedQuestions`);u.searchParams.set('start',String(rows.size));
  const {http,body}=await request(deps,u,apiHeaders(token,apx));
  if(http===401||http===403)throw new LearnerFailed('token_rejected',`http_${http}`);
  if(http!==200)throw new LearnerFailed('failed',`http_${http}`);
  if(body?.status===401||body?.status===403)throw new LearnerFailed('token_rejected',`api_${body.status}`);
  if(body?.status!==200||!(Array.isArray(body.data)||body.data==null))throw new LearnerFailed('failed',`api_${body?.status}`);
  const fresh=(body.data||[]).filter(r=>r?.id!=null&&!rows.has(String(r.id)));
  if(!fresh.length)return [...rows.values()];
  for(const r of fresh)rows.set(String(r.id),r);
 }
 throw new LearnerFailed('failed','page_cap');
}

// One failed page load must not turn the count check off for a whole run.
async function findBuildId(deps){
 for(let attempt=1;attempt<=TRIES;attempt++){
  const html=await deps.fetch(`${SITE}/saved-question?type=question`,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0'}}).then(r=>r.text()).catch(()=>'');
  const id=(html.match(/"buildId":"([^"]+)"/)||[])[1];
  if(id)return id;
  await deps.sleep(GAP_MS*attempt*2);
 }
 return null;
}

// The total AppX's own page shows for this learner, or null when it could not be read.
async function sourceCount(deps,buildId,token,apx){
 if(!buildId)return null;
 const url=`${SITE}/_next/data/${buildId}/saved-question.json?type=question`;
 const {http,body}=await request(deps,url,{Accept:'*/*','x-nextjs-data':'1','User-Agent':'Mozilla/5.0',Cookie:`base_url=${encodeURIComponent(`${API}/`)}; Authorization=${token}; User-ID=${apx}`});
 const sections=body?.pageProps?.sections;
 if(http!==200||!Array.isArray(sections))return null;
 return sections.reduce((n,s)=>n+(Number(s?.question_count)||0),0);
}

async function captureLearner(db,deps,buildId,t){
 const apx=String(t.apxUserId),fetchedAt=deps.now();
 const rows=await walkSaved(deps,t.token,apx);
 for(const part of chunks(rows.map((raw,position)=>({raw,position})),500))
  await db.collection(CAPTURES).bulkWrite(part.map(({raw,position})=>({updateOne:{filter:{_id:`${apx}:${raw.id}`},update:{$set:{orgId:ORG,apxUserId:apx,apxQuestionId:String(raw.id),raw,position,fetchedAt},$unset:{goneFromSourceAt:''},$setOnInsert:{firstSeenAt:fetchedAt}},upsert:true}})),{ordered:false});
 const gone=await db.collection(CAPTURES).updateMany({apxUserId:apx,fetchedAt:{$ne:fetchedAt},goneFromSourceAt:{$exists:false}},{$set:{goneFromSourceAt:fetchedAt}});
 const count=await sourceCount(deps,buildId,t.token,apx);
 const countsAgree=count===null?null:count===rows.length;
 await db.collection(LEARNERS).updateOne({_id:apx},{$set:{orgId:ORG,state:'captured',rowCount:rows.length,sourceCount:count,countsAgree,fetchedAt},$unset:{reason:''}},{upsert:true});
 return {rows:rows.length,gone:gone.modifiedCount,countsAgree};
}

async function run(db,deps,{limit=null,learners=null,refresh=false,newOnly=false}={}){
 const q={orgId:ORG,...(learners?{apxUserId:{$in:learners}}:{})};
 let tokens=await db.collection('apxtestusertokens').find(q,{projection:{apxUserId:1,token:1}}).sort({_id:1}).toArray();
 if(!refresh){
  const done=new Set((await db.collection(LEARNERS).find(newOnly?{state:{$ne:'failed'}}:{countsAgree:true},{projection:{_id:1}}).toArray()).map(d=>d._id));
  tokens=tokens.filter(t=>!done.has(String(t.apxUserId)));
 }
 if(limit)tokens=tokens.slice(0,limit);
 const buildId=tokens.length?await findBuildId(deps):null;
 const stats={planned:tokens.length,buildIdFound:!!buildId,processed:0,captured:0,withRows:0,rows:0,gone:0,countsAgree:0,countsDiffer:0,countsUnread:0,tokenRejected:0,failed:0,stoppedBy:null};
 let refusedInARow=0;
 for(const t of tokens){
  try{
   const r=await captureLearner(db,deps,buildId,t);
   refusedInARow=0;stats.captured++;stats.rows+=r.rows;stats.gone+=r.gone;if(r.rows)stats.withRows++;
   bump(stats,r.countsAgree===null?'countsUnread':r.countsAgree?'countsAgree':'countsDiffer');
  }catch(e){
   if(e instanceof StopRun){stats.stoppedBy=e.message;break;}
   if(!(e instanceof LearnerFailed))throw e;
   await db.collection(LEARNERS).updateOne({_id:String(t.apxUserId)},{$set:{orgId:ORG,state:e.state,reason:e.message,countsAgree:null,fetchedAt:deps.now()}},{upsert:true});
   if(e.state==='token_rejected'){stats.tokenRejected++;refusedInARow++;}else{stats.failed++;refusedInARow=0;}
   if(refusedInARow>=REFUSED_IN_A_ROW){stats.stoppedBy='tokens_refused';break;}
  }
  stats.processed++;
  if(stats.processed%25===0)log('progress',{processed:stats.processed,planned:stats.planned,rows:stats.rows});
 }
 return stats;
}

async function main(){
 const root=process.env.VG_APP_ROOT;const req=n=>require(require.resolve(n,{paths:[root]}));
 const env=req('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
 if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('VG database guard');
 const {MongoClient}=req('mongoose').mongo;
 const args=process.argv.slice(2),val=f=>{const i=args.indexOf(f);return i>=0?args[i+1]:null;};
 const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:3,serverSelectionTimeoutMS:15000});
 await client.connect();
 try{
  const stats=await run(client.db('vidyagramdb'),{fetch,sleep:ms=>new Promise(r=>setTimeout(r,ms)),now:()=>new Date()},{limit:Number(val('--limit'))||null,learners:val('--learners')?.split(',')||null,refresh:args.includes('--refresh'),newOnly:args.includes('--new-only')});
  log('capture-done',{at:new Date().toISOString(),...stats});
 }finally{await client.close();}
}
module.exports={run,LEARNERS,CAPTURES};
if(process.env.VG_APP_ROOT)main().catch(e=>{console.error(String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g,'<uri>'));process.exit(1);});
