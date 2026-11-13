// VG staged AppX saved questions -> savedquestions. Previews unless --commit; --undo removes one batch.
// Insert-only: a student's existing saves are never changed, and a row handled once is never planned again, so a question a
// student removes here stays removed. Unmatched rows stay in staging and are reported by test.
// AppX gives no saved-at time: addedAt is the import time. Lists sort newest first by _id or createdAt, so both step back by listing position to keep AppX's order.
// seriesId (the test it was saved from) comes through Series.legacy_id = AppX test id, subjectId is the question's own section.
// Run with the DB in reach: VG_APP_ROOT=<checkout> node - (--all | --learners a,b | --sample n) [--commit --batch <id>] | [--undo --batch <id>] < script
// --auto (cron): imports settled captures as batch vg-saved-auto-<UTC minute>, writes nothing when there is nothing new, and
// refuses more than --max-insert rows (default 5000) so a large staged load waits for a person.
'use strict';
const fs=require('fs'),path=require('path');
const ORG='2177599',LEARNERS='apx_vg_saved_question_learners',CAPTURES='apx_vg_saved_question_captures',BATCHES='apx_vg_saved_question_import_batches';
const bump=(o,k,n=1)=>{o[k]=(o[k]||0)+n;};
const chunks=(a,n)=>{const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out;};
const isMongoId=v=>/^[0-9a-f]{24}$/i.test(String(v));

// Exactly one local document per source id, or the row is refused as ambiguous.
function indexOne(docs,keyOf){
 const m=new Map();
 for(const d of docs){const k=keyOf(d);m.set(k,m.has(k)?'ambiguous':d);}
 return m;
}

function unmatchedByTest(rows){
 const tests=new Map();
 for(const c of rows){
  const k=`${c.raw?.test_series_id}|${c.raw?.test_id}`;
  const t=tests.get(k)||tests.set(k,{seriesId:c.raw?.test_series_id,seriesTitle:c.raw?.test_series_title,testId:c.raw?.test_id,testTitle:c.raw?.test_title,questions:new Set(),learners:new Set()}).get(k);
  t.questions.add(c.apxQuestionId);t.learners.add(c.apxUserId);
 }
 return [...tests.values()].map(t=>({...t,questions:t.questions.size,learners:t.learners.size})).sort((a,b)=>b.learners-a.learners);
}

async function nativeShape(db){
 const rows=await db.collection('savedquestions').find({apxSavedQuestionImport:{$exists:false}},{projection:{userId:1,qid:1}}).limit(1000).toArray();
 return {rows:rows.length,userIdIsMongoId:rows.filter(r=>isMongoId(r.userId)).length,qidIsMongoId:rows.filter(r=>isMongoId(r.qid)).length};
}

async function plan(db,{learners=null,sample=null,settledOnly=false}={}){
 const stats={stagedRows:0,students:0,goneFromSource:0,alreadyHandled:0,unsettled:0,userMissing:0,userAmbiguous:0,questionMissing:0,questionAmbiguous:0,questionNoPlacement:0,questionInactive:0,alreadySaved:0,insert:0,withSeries:0,seriesMissing:0};
 const q={orgId:ORG,...(learners?{apxUserId:{$in:learners}}:{})};
 let caps=await db.collection(CAPTURES).find(q,{projection:{apxUserId:1,apxQuestionId:1,position:1,fetchedAt:1,goneFromSourceAt:1,importBatch:1,'raw.test_id':1,'raw.test_series_id':1,'raw.test_title':1,'raw.test_series_title':1}}).toArray();
 if(sample){
  const chosen=new Set([...new Set(caps.filter(c=>!c.importBatch&&!c.goneFromSourceAt).map(c=>c.apxUserId))].sort().slice(0,sample));
  caps=caps.filter(c=>chosen.has(c.apxUserId));
 }
 stats.stagedRows=caps.length;stats.students=new Set(caps.map(c=>c.apxUserId)).size;
 // A capture run still walking a student has written rows but not yet marked the student captured at that fetch.
 const settled=new Map();
 if(settledOnly)for(const part of chunks([...new Set(caps.filter(c=>!c.importBatch&&!c.goneFromSourceAt).map(c=>c.apxUserId))],500))
  for(const l of await db.collection(LEARNERS).find({_id:{$in:part}},{projection:{state:1,fetchedAt:1}}).toArray())if(l.state==='captured')settled.set(l._id,l.fetchedAt);
 const live=[];
 for(const c of caps){
  if(c.importBatch)stats.alreadyHandled++;
  else if(c.goneFromSourceAt)stats.goneFromSource++;
  else if(settledOnly&&!(settled.get(c.apxUserId)>=c.fetchedAt))stats.unsettled++;
  else live.push(c);
 }
 const users=[],questions=[];
 for(const part of chunks([...new Set(live.map(c=>c.apxUserId))],500))users.push(...await db.collection('users').find({usersApxId:{$in:part}},{projection:{usersApxId:1}}).toArray());
 for(const part of chunks([...new Set(live.map(c=>`CM-${c.apxQuestionId}`))],500))questions.push(...await db.collection('questions').find({hranker_id:{$in:part}},{projection:{hranker_id:1,sectionId:1,topicId:1,status:1}}).toArray());
 const series=[];
 for(const part of chunks([...new Set(live.map(c=>Number(c.raw?.test_id)).filter(n=>n>0))],500))series.push(...await db.collection('series').find({legacy_id:{$in:part}},{projection:{legacy_id:1}}).toArray());
 const userBy=indexOne(users,u=>String(u.usersApxId)),questionBy=indexOne(questions,x=>x.hranker_id),seriesBy=indexOne(series,x=>String(x.legacy_id));
 const existing=new Set();
 for(const part of chunks([...new Set(users.map(u=>String(u._id)))],200))
  for(const r of await db.collection('savedquestions').find({userId:{$in:part}},{projection:{userId:1,qid:1},readPreference:'primary'}).toArray())existing.add(`${r.userId}|${r.qid}`);
 const inserts=[],handledExisting=[],unmatched=[];
 for(const c of live){
  const user=userBy.get(c.apxUserId),question=questionBy.get(`CM-${c.apxQuestionId}`);
  if(!user){stats.userMissing++;continue;}
  if(user==='ambiguous'){stats.userAmbiguous++;continue;}
  if(!question){stats.questionMissing++;unmatched.push(c);continue;}
  if(question==='ambiguous'){stats.questionAmbiguous++;continue;}
  if(!question.sectionId||!question.topicId){stats.questionNoPlacement++;continue;}
  const userId=String(user._id),qid=String(question._id);
  if(existing.has(`${userId}|${qid}`)){stats.alreadySaved++;handledExisting.push(c._id);continue;}
  existing.add(`${userId}|${qid}`);
  if(question.status===0)stats.questionInactive++;
  stats.insert++;
  const test=seriesBy.get(String(c.raw?.test_id)),seriesId=test&&test!=='ambiguous'?String(test._id):null;
  stats[seriesId?'withSeries':'seriesMissing']++;
  inserts.push({seriesId,captureId:c._id,apxUserId:c.apxUserId,apxQuestionId:c.apxQuestionId,position:c.position||0,userId,qid,sectionId:String(question.sectionId),topicId:String(question.topicId),apxTestId:c.raw?.test_id,apxSeriesId:c.raw?.test_series_id});
 }
 const savedIndexes=await db.collection('savedquestions').indexes().catch(()=>[]);
 return {stats,inserts,handledExisting,
  unmatched:unmatchedByTest(unmatched),
  sampleStudents:sample?[...new Map(inserts.map(i=>[i.apxUserId,i.userId])).entries()].map(([apxUserId,userId])=>({apxUserId,userId})):undefined,
  learnerStates:Object.fromEntries((await db.collection(LEARNERS).aggregate([{$group:{_id:{state:'$state',countsAgree:'$countsAgree'},n:{$sum:1}}}]).toArray()).map(x=>[`${x._id.state}/${x._id.countsAgree}`,x.n])),
  nativeRows:await nativeShape(db),
  uniqueIndexPresent:savedIndexes.some(i=>i.unique&&i.key?.userId&&i.key?.qid)};
}

async function commit(db,ObjectId,batch,{inserts,handledExisting,stats},scope,now=new Date()){
 if(await db.collection(BATCHES).findOne({_id:batch}))throw new Error('batch id already used');
 await db.collection(BATCHES).insertOne({_id:batch,tenant:'vidyagram',at:now,scope,planned:stats,state:'writing'},{writeConcern:{w:'majority'}});
 let inserted=0;
 // Ids are made here, last in AppX's list first, so a later row in the list gets the older id.
 const ordered=[...inserts].sort((a,b)=>b.position-a.position).map(w=>({...w,_id:new ObjectId()}));
 for(const part of chunks(ordered,500)){
  const r=await db.collection('savedquestions').bulkWrite(part.map(w=>{
   const key={userId:w.userId,qid:w.qid,sectionId:w.sectionId,topicId:w.topicId};
   return {updateOne:{filter:key,update:{$setOnInsert:{...key,_id:w._id,seriesId:w.seriesId,subjectId:w.sectionId,addedAt:String(now.getTime()),createdAt:new Date(now.getTime()-w.position),updatedAt:now,__v:0,apxSavedQuestionImport:{batch,apxQuestionId:w.apxQuestionId,apxTestId:w.apxTestId,apxSeriesId:w.apxSeriesId,importedAt:now}}},upsert:true}};
  }),{ordered:false,writeConcern:{w:'majority'}});
  inserted+=r.upsertedCount;
  await db.collection(CAPTURES).updateMany({_id:{$in:part.map(w=>w.captureId)}},{$set:{importBatch:batch,importOutcome:'inserted',importedAt:now}});
  await new Promise(res=>setTimeout(res,200));
 }
 for(const part of chunks(handledExisting,500))await db.collection(CAPTURES).updateMany({_id:{$in:part}},{$set:{importBatch:batch,importOutcome:'already_saved',importedAt:now}});
 await db.collection(BATCHES).updateOne({_id:batch},{$set:{state:'done',inserted,finishedAt:new Date()}},{writeConcern:{w:'majority'}});
 return inserted;
}

async function undo(db,batch){
 if(!await db.collection(BATCHES).findOne({_id:batch}))throw new Error('unknown batch');
 const r=await db.collection('savedquestions').deleteMany({'apxSavedQuestionImport.batch':batch},{writeConcern:{w:'majority'}});
 await db.collection(CAPTURES).updateMany({importBatch:batch},{$unset:{importBatch:'',importOutcome:'',importedAt:''}});
 await db.collection(BATCHES).updateOne({_id:batch},{$set:{state:'undone',undoneAt:new Date(),removed:r.deletedCount}});
 return r.deletedCount;
}

async function auto(db,ObjectId,{now=new Date(),maxInsert=5000}={}){
 const p=await plan(db,{settledOnly:true});
 const out={stats:p.stats,unmatchedTests:p.unmatched.length};
 if(!p.inserts.length&&!p.handledExisting.length)return {event:'nothing-new',...out};
 if(p.inserts.length>maxInsert)return {event:'refused-large',maxInsert,...out};
 const batch=`vg-saved-auto-${now.toISOString().slice(0,16).replace(/\D/g,'')}`;
 return {event:'committed',batch,inserted:await commit(db,ObjectId,batch,p,{auto:true},now),...out};
}

async function main(){
 const root=process.env.VG_APP_ROOT;const req=n=>require(require.resolve(n,{paths:[root]}));
 const env=req('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
 if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('VG database guard');
 const {MongoClient,ObjectId}=req('mongoose').mongo;
 const args=process.argv.slice(2),has=f=>args.includes(f),val=f=>{const i=args.indexOf(f);return i>=0?args[i+1]:null;};
 const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:3,serverSelectionTimeoutMS:45000});
 await client.connect();
 try{
  const db=client.db('vidyagramdb'),batch=val('--batch');
  if(has('--undo')){if(!batch)throw Error('--undo needs --batch');console.log(JSON.stringify({event:'undone',batch,removed:await undo(db,batch)}));return;}
  if(has('--auto')){
   const r=await auto(db,ObjectId,{maxInsert:Number(val('--max-insert'))||5000});
   console.log(JSON.stringify({at:new Date().toISOString(),...r}));
   if(r.event==='refused-large')process.exitCode=2;
   return;
  }
  const learners=val('--learners')?.split(',')||null,sample=Number(val('--sample'))||null;
  if(!learners&&!sample&&!has('--all'))throw Error('pass --all, --learners a,b or --sample n');
  const p=await plan(db,{learners,sample});
  const report={stats:p.stats,learnerStates:p.learnerStates,nativeRows:p.nativeRows,uniqueIndexPresent:p.uniqueIndexPresent,unmatched:p.unmatched.slice(0,200),sampleStudents:p.sampleStudents};
  if(!has('--commit')){console.log(JSON.stringify({event:'preview',...report,writes:0}));return;}
  if(!batch)throw Error('--commit needs --batch');
  const inserted=await commit(db,ObjectId,batch,p,{learners:learners?.length??null,sample,all:has('--all')});
  console.log(JSON.stringify({event:'committed',batch,inserted,...report}));
 }finally{await client.close();}
}
module.exports={plan,commit,undo,auto,BATCHES};
if(process.env.VG_APP_ROOT)main().catch(e=>{console.error(String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g,'<uri>'));process.exit(1);});
