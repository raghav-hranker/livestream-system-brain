// Read-only check of one saved-question import batch: counts on the primary, duplicates, and a sample of students through the local API.
// Run on webserver2-2: BATCH=<id> node - < script
'use strict';
const root='/var/www/backend.vidyagramar.com/vidyagram-backend';
const req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(require('fs').readFileSync(root+'/.env.development'));
const {MongoClient}=req('mongoose').mongo;
(async()=>{
 const c=new MongoClient(env.MONGO_URI,{readPreference:'primary',serverSelectionTimeoutMS:45000});await c.connect();const d=c.db('vidyagramdb');
 const S=d.collection('savedquestions'),B=process.env.BATCH;
 if(!B)throw Error('BATCH required');
 const dup=await S.aggregate([{$group:{_id:{u:'$userId',q:'$qid'},n:{$sum:1}}},{$match:{n:{$gt:1}}},{$count:'n'}],{allowDiskUse:true}).toArray();
 console.log(JSON.stringify({total:await S.countDocuments(),batch:await S.countDocuments({'apxSavedQuestionImport.batch':B}),allImported:await S.countDocuments({apxSavedQuestionImport:{$exists:true}}),native:await S.countDocuments({apxSavedQuestionImport:{$exists:false}}),batchNoSeries:await S.countDocuments({'apxSavedQuestionImport.batch':B,seriesId:null}),batchNoSubject:await S.countDocuments({'apxSavedQuestionImport.batch':B,subjectId:{$exists:false}}),students:(await S.distinct('userId',{'apxSavedQuestionImport.batch':B})).length,duplicateUserQuestion:dup[0]?.n||0,marked:await d.collection('apx_vg_saved_question_captures').countDocuments({importBatch:B}),batchDoc:await d.collection('apx_vg_saved_question_import_batches').findOne({_id:B},{projection:{state:1,inserted:1}})}));
 const top=await S.aggregate([{$match:{'apxSavedQuestionImport.batch':B}},{$group:{_id:'$userId',n:{$sum:1}}},{$sort:{n:-1}},{$limit:2}]).toArray();
 const rnd=await S.aggregate([{$match:{'apxSavedQuestionImport.batch':B}},{$sample:{size:4}},{$project:{userId:1}}]).toArray();
 const ids=[...new Set([...top.map(t=>t._id),...rnd.map(r=>r.userId)])];
 for(const u of ids){
  const mine=await S.countDocuments({userId:u});
  const s=await fetch(`http://127.0.0.1:4100/api/saved-questions/sections/${u}`).then(r=>r.json());
  const q=await fetch(`http://127.0.0.1:4100/api/saved-questions/questions/${u}?limit=5`).then(r=>r.json());
  const items=q.data?.items||[];
  console.log(JSON.stringify({user:'…'+u.slice(-4),db:mine,apiTotal:s.data?.total,subjects:(s.data?.sections||[]).slice(0,3).map(x=>[x.name,x.count]),page:items.length,withTest:items.filter(i=>i.sourceTitle).length,withText:items.filter(i=>i.question_en||i.question_hi).length,next:!!q.data?.next}));
 }
 const dist=await S.aggregate([{$match:{'apxSavedQuestionImport.batch':B}},{$group:{_id:'$subjectId',n:{$sum:1}}},{$sort:{n:-1}},{$limit:6}]).toArray();
 const names=new Map((await d.collection('sections').find({_id:{$in:dist.map(x=>new (req('mongoose').mongo.ObjectId)(x._id))}},{projection:{sectionName:1}}).toArray()).map(x=>[String(x._id),x.sectionName]));
 console.log(JSON.stringify(dist.map(x=>[names.get(x._id),x.n])));
 await c.close();
})().catch(e=>{console.error(e.name,String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g,'<uri>'));process.exit(1);});
