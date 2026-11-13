// VG completion captures -> ClassProgress manual-completion markers. Previews unless --commit; --undo removes one batch.
// Insert-only: a learner's existing rows are never changed, so undo cannot damage anything it did not add.
// Markers use a fixed old date so date-windowed readers (profile activity, engagement, course analytics) skip them.
// Run on an Azure migrator: VG_APP_ROOT=$dir/runtime VG_ENV_PATH=$dir/.env.development node - [--learners a,b | --all]
//   [--exact-only] [--new-only] [--commit --batch <id>] | [--undo --batch <id>]
// --new-only reads only captures fetched since the last finished batch, so a class a student un-marked stays un-marked,
// and writes no batch when nothing is new. Scheduled by vidyagram-completion-progress-auto.sh.
'use strict';
const fs=require('fs'),path=require('path');
const ORG='2177599',CUSTOMER='781',RUNS=/^vg-completion-\d{8}-/,BATCHES='apx_vg_progress_import_batches';
const MARKER_TIME=new Date('2000-01-01T00:00:00.000Z');
// Readers on other hosts stamp fetchedAt with their own clocks before writing the capture.
const OVERLAP_MS=10*60*1000;
const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
const bump=(o,k,n=1)=>{o[k]=(o[k]||0)+n;};
const sameLength=(a,b)=>a>0&&b>0&&Math.abs(a-b)<=Math.max(60,b*.05);
const chunks=(a,n)=>{const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out;};

// Deleted or disabled source rows whose course holds exactly one class of the same title and about the same length.
async function sameTitleMatches(db,ObjectId,caps){
 const wanted=new Map();
 for(const c of caps)for(const v of c.unmatched||[])wanted.set(`${c.apxCourseId}|${v}`,{video:String(v),apxCourseId:String(c.apxCourseId),courseId:String(c.courseId)});
 const rows=new Map();
 for(const ids of chunks([...new Set([...wanted.values()].map(w=>w.video))],500))
  for(const r of await db.collection('apxcatalogrows').find({customerId:CUSTOMER,rowId:{$in:ids},hiddenReason:{$nin:[null,'']}},{projection:{rowId:1,apxCourseId:1,'raw.title':1,'raw.duration':1,'raw.video_duration':1}}).toArray())rows.set(`${r.apxCourseId}|${r.rowId}`,r);
 const courseIndex=new Map(),matches=new Map();
 for(const [k,w] of wanted){
  const r=rows.get(k);if(!r)continue;
  if(!courseIndex.has(w.courseId)){
   const ps=await db.collection('courseclasses').find({course:new ObjectId(w.courseId)},{projection:{class:1,title:1,apxTitle:1}}).toArray();
   const docs=await db.collection('classes').find({_id:{$in:ps.map(p=>p.class)}},{projection:{title:1,duration:1,apxDurationSeconds:1}}).toArray();
   const byId=new Map(docs.map(d=>[String(d._id),d])),byTitle=new Map();
   for(const p of ps)for(const t of new Set([p.apxTitle,p.title,byId.get(String(p.class))?.title].map(norm).filter(Boolean)))(byTitle.get(t)||byTitle.set(t,new Set()).get(t)).add(String(p.class));
   courseIndex.set(w.courseId,{byId,byTitle});
  }
  const {byId,byTitle}=courseIndex.get(w.courseId),hit=byTitle.get(norm(r.raw?.title));
  if(!hit||hit.size!==1)continue;
  const classId=[...hit][0],cls=byId.get(classId);
  const source=Number(r.raw?.duration)||Number(r.raw?.video_duration)||0,length=Number(cls?.duration)||Number(cls?.apxDurationSeconds)||0;
  if(sameLength(source,length))matches.set(k,classId);
 }
 return matches;
}

async function newCapturesSince(db){
 const last=await db.collection(BATCHES).find({state:'done'}).sort({at:-1}).limit(1).next();
 return last?new Date((last.capturedUpTo||last.at).getTime()-OVERLAP_MS):null;
}

async function plan(db,ObjectId,{learners=null,exactOnly=false,since=null}={}){
 const capturedUpTo=new Date();
 const q={orgId:ORG,runId:RUNS,...(learners?{apxUserId:{$in:learners}}:{}),...(since?{fetchedAt:{$gt:since}}:{})};
 const caps=await db.collection('apx_vg_completion_captures').find(q,{projection:{runId:1,userId:1,apxUserId:1,courseId:1,apxCourseId:1,mapped:1,unmatched:1}}).toArray();
 const wanted=new Map();const stats={captures:caps.length,learners:new Set(caps.map(c=>String(c.userId))).size,exact:0,sameTitle:0,leftOut:0,insert:0,insertBesideSession:0,skipAlreadyManual:0,skipExistingApxRow:0,rejectedInvalid:0};
 for(const c of caps)for(const m of c.mapped||[]){
  const k=`${c.userId}|${m.classId}|${c.courseId}`;
  if(!wanted.has(k))wanted.set(k,{userId:String(c.userId),classId:String(m.classId),courseId:String(c.courseId),runId:c.runId,sourceVideoId:String(m.sourceVideoId),match:'exact_id'});
 }
 const titles=exactOnly?new Map():await sameTitleMatches(db,ObjectId,caps);
 for(const c of caps)for(const v of c.unmatched||[]){
  const classId=titles.get(`${c.apxCourseId}|${v}`);
  if(!classId){stats.leftOut++;continue;}
  const k=`${c.userId}|${classId}|${c.courseId}`;
  if(!wanted.has(k))wanted.set(k,{userId:String(c.userId),classId,courseId:String(c.courseId),runId:c.runId,sourceVideoId:String(v),match:'same_title_and_length'});
 }
 for(const w of wanted.values())bump(stats,w.match==='exact_id'?'exact':'sameTitle');
 const list=[...wanted.values()];
 const known=async(col,ids)=>{const out=new Set();for(const c of chunks([...new Set(ids)],500))for(const d of await db.collection(col).find({_id:{$in:c.map(x=>new ObjectId(x))}},{projection:{_id:1}}).toArray())out.add(String(d._id));return out;};
 const users=await known('users',list.map(l=>l.userId)),classes=await known('classes',list.map(l=>l.classId)),courses=await known('courses',list.map(l=>l.courseId));
 const placed=new Set();
 for(const c of chunks([...new Set(list.map(l=>l.courseId))],200))for(const p of await db.collection('courseclasses').find({course:{$in:c.map(x=>new ObjectId(x))}},{projection:{course:1,class:1}}).toArray())placed.add(`${p.course}|${p.class}`);
 const existing=new Map();
 for(const c of chunks([...new Set(list.map(l=>l.userId))],200))for(const r of await db.collection('classprogresses').find({userId:{$in:c}},{projection:{userId:1,classId:1,courseId:1,manualCompleted:1,apxMigrated:1},readPreference:'primary'}).toArray()){
  const k=`${r.userId}|${r.classId}|${r.courseId}`;(existing.get(k)||existing.set(k,[]).get(k)).push(r);
 }
 const inserts=[];
 for(const [k,w] of wanted){
  if(!users.has(w.userId)||!classes.has(w.classId)||!courses.has(w.courseId)||!placed.has(`${w.courseId}|${w.classId}`)){stats.rejectedInvalid++;continue;}
  const rows=existing.get(k)||[];
  if(rows.some(r=>r.manualCompleted===true)){stats.skipAlreadyManual++;continue;}
  if(rows.some(r=>r.apxMigrated===true)){stats.skipExistingApxRow++;continue;}
  bump(stats,rows.length?'insertBesideSession':'insert');inserts.push(w);
 }
 return {stats,inserts,capturedUpTo};
}

async function commit(db,ObjectId,batch,inserts,stats,scope,capturedUpTo=null){
 if(await db.collection(BATCHES).findOne({_id:batch}))throw new Error('batch id already used');
 const now=new Date();
 await db.collection(BATCHES).insertOne({_id:batch,tenant:'vidyagram',at:now,capturedUpTo:capturedUpTo||now,scope,planned:stats,state:'writing'},{writeConcern:{w:'majority'}});
 let inserted=0;
 for(const c of chunks(inserts,500)){
  const r=await db.collection('classprogresses').bulkWrite(c.map(w=>{
   const key={userId:w.userId,classId:w.classId,courseId:new ObjectId(w.courseId)};
   return {updateOne:{filter:{...key,apxMigrated:true},update:{$setOnInsert:{...key,apxMigrated:true,manualCompleted:true,duration:0,userStartTime:MARKER_TIME,userEndTime:MARKER_TIME,createdAt:now,updatedAt:now,apxCompletionImport:{batch,runId:w.runId,sourceVideoId:w.sourceVideoId,match:w.match,importedAt:now}}},upsert:true}};
  }),{ordered:false,writeConcern:{w:'majority'}});
  inserted+=r.upsertedCount;
  await new Promise(res=>setTimeout(res,200));
 }
 await db.collection(BATCHES).updateOne({_id:batch},{$set:{state:'done',inserted,finishedAt:new Date()}},{writeConcern:{w:'majority'}});
 return inserted;
}

async function undo(db,batch){
 const r=await db.collection('classprogresses').deleteMany({'apxCompletionImport.batch':batch,apxMigrated:true},{writeConcern:{w:'majority'}});
 await db.collection(BATCHES).updateOne({_id:batch},{$set:{state:'undone',undoneAt:new Date(),removed:r.deletedCount}});
 return r.deletedCount;
}

async function main(){
 const root=process.env.VG_APP_ROOT;const req=n=>require(require.resolve(n,{paths:[root]}));
 const env=req('dotenv').parse(fs.readFileSync(process.env.VG_ENV_PATH||path.join(root,'.env.development')));
 if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('VG database guard');
 const {MongoClient,ObjectId}=req('mongodb');
 const args=process.argv.slice(2),has=f=>args.includes(f),val=f=>{const i=args.indexOf(f);return i>=0?args[i+1]:null;};
 const client=new MongoClient(env.MONGO_URI,{minPoolSize:0,maxPoolSize:3,serverSelectionTimeoutMS:15000});
 await client.connect();
 try{
  const db=client.db('vidyagramdb'),batch=val('--batch');
  if(has('--undo')){if(!batch)throw Error('--undo needs --batch');console.log(JSON.stringify({event:'undone',batch,removed:await undo(db,batch)}));return;}
  const learners=val('--learners')?.split(',')||null;
  if(!learners&&!has('--all'))throw Error('pass --learners a,b or --all');
  const newOnly=has('--new-only'),since=newOnly?await newCapturesSince(db):null;
  const {stats,inserts,capturedUpTo}=await plan(db,ObjectId,{learners,exactOnly:has('--exact-only'),since});
  if(!has('--commit')){console.log(JSON.stringify({event:'preview',since,stats,writes:0}));return;}
  if(!batch)throw Error('--commit needs --batch');
  if(newOnly&&!inserts.length){console.log(JSON.stringify({event:'nothing_new',since,stats}));return;}
  const inserted=await commit(db,ObjectId,batch,inserts,stats,{learners:learners?.length??'all',exactOnly:has('--exact-only'),newOnly},capturedUpTo);
  console.log(JSON.stringify({event:'committed',batch,stats,inserted}));
 }finally{await client.close();}
}
module.exports={plan,commit,undo,newCapturesSince,MARKER_TIME,OVERLAP_MS,sameLength};
if(process.env.VG_APP_ROOT)main().catch(e=>{console.error(String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g,'<uri>'));process.exit(1);});
