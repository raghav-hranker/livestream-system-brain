// Read-only, no AppX calls: why staged saved questions have no local Question. Every unmatched test is checked against our
// mirrors and Series, with matched (imported) rows as the control that the same lookups find known tests. Prints catalogue titles only.
// Run on webserver2-2: node - < script
'use strict';
const root='/var/www/backend.vidyagramar.com/vidyagram-backend';
const req=n=>require(require.resolve(n,{paths:[root]}));
const env=req('dotenv').parse(require('fs').readFileSync(root+'/.env.development'));
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(env.MONGO_URI||''))throw Error('VG database guard');
const {MongoClient}=req('mongoose').mongo;
const chunks=(a,n)=>{const out=[];for(let i=0;i<a.length;i+=n)out.push(a.slice(i,i+n));return out;};
const inSet=async(db,col,field,values,cast=x=>x)=>{const found=new Set();for(const part of chunks(values,500))for(const d of await db.collection(col).find({[field]:{$in:part.map(cast)}},{projection:{[field]:1}}).toArray())found.add(String(d[field]));return found;};

async function checkGroup(db,tests,packages){
 const num=x=>Number(x);
 const inTests=await inSet(db,'apx_testseries_raw','apxId',tests);
 const inSeries=await inSet(db,'series','legacy_id',tests,num);
 const inQuestionRaw=await inSet(db,'apx_question_raw','testApxId',tests);
 const inPackageRaw=await inSet(db,'apx_package_raw','apxId',packages);
 const inPackages=await inSet(db,'packages','apx_legacy_id',packages,num);
 return {tests:tests.length,testInMirror:inTests.size,testInSeries:inSeries.size,testHasRawQuestions:inQuestionRaw.size,packages:packages.length,packageInMirror:inPackageRaw.size,packageInPackages:inPackages.size,sets:{inTests,inSeries,inPackageRaw,inPackages}};
}

(async()=>{
 const c=new MongoClient(env.MONGO_URI,{serverSelectionTimeoutMS:45000});await c.connect();const db=c.db('vidyagramdb');
 const col=db.collection('apx_vg_saved_question_captures');
 const unmatched=await col.find({importBatch:{$exists:false},goneFromSourceAt:{$exists:false}},{projection:{apxUserId:1,apxQuestionId:1,'raw.test_id':1,'raw.test_series_id':1,'raw.test_title':1,'raw.test_series_title':1,'raw.question':1}}).toArray();
 const matched=await col.find({importOutcome:'inserted'},{projection:{'raw.test_id':1,'raw.test_series_id':1}}).toArray();
 const ids=(rows,k)=>[...new Set(rows.map(r=>String(r.raw?.[k])).filter(x=>x&&x!=='undefined'))];
 const u=await checkGroup(db,ids(unmatched,'test_id'),ids(unmatched,'test_series_id'));
 const m=await checkGroup(db,ids(matched,'test_id'),ids(matched,'test_series_id'));
 const {sets:us,...uOut}=u,{sets:_,...mOut}=m;
 const qids=[...new Set(unmatched.map(r=>r.apxQuestionId))];
 const inRaw=await inSet(db,'apx_question_raw','apxId',qids),inQuestions=await inSet(db,'questions','hranker_id',qids.map(q=>`CM-${q}`));
 console.log(JSON.stringify({event:'totals',unmatchedRows:unmatched.length,students:new Set(unmatched.map(r=>r.apxUserId)).size,distinctQuestions:qids.length,questionInRawMirror:inRaw.size,questionInQuestions:inQuestions.size,unmatched:uOut,matchedControl:mOut,counts:{apxPackageRaw:await db.collection('apx_package_raw').estimatedDocumentCount(),apxTestSeriesRaw:await db.collection('apx_testseries_raw').estimatedDocumentCount(),series:await db.collection('series').estimatedDocumentCount(),questions:await db.collection('questions').estimatedDocumentCount(),questionsWithoutApxId:await db.collection('questions').countDocuments({hranker_id:{$not:/^CM-/}},{maxTimeMS:45000}).catch(()=>null)}}));
 const texts=[...new Set(unmatched.map(r=>r.raw?.question).filter(Boolean))].slice(0,400);
 const sameText=await db.collection('apx_question_raw').find({question:{$in:texts}},{projection:{question:1},maxTimeMS:60000}).toArray().catch(e=>({error:e.codeName||e.name}));
 console.log(JSON.stringify({event:'same-text-sample',sampled:texts.length,foundUnderAnotherId:sameText.error?`error:${sameText.error}`:new Set(sameText.map(x=>x.question)).size}));
 const bySeries=new Map();
 for(const r of unmatched){
  const k=String(r.raw?.test_series_id);
  const s=bySeries.get(k)||bySeries.set(k,{id:k,title:r.raw?.test_series_title,rows:0,tests:new Set(),students:new Set()}).get(k);
  s.rows++;s.tests.add(String(r.raw?.test_id));s.students.add(r.apxUserId);
 }
 const series=[...bySeries.values()].sort((a,b)=>b.rows-a.rows);
 console.log(JSON.stringify({event:'by-series',series:series.length}));
 for(const s of series)console.log(JSON.stringify({id:s.id,title:s.title,rows:s.rows,tests:s.tests.size,students:s.students.size,inPackageMirror:us.inPackageRaw.has(s.id),inPackages:us.inPackages.has(s.id),testsInMirror:[...s.tests].filter(t=>us.inTests.has(t)).length,testsInSeries:[...s.tests].filter(t=>us.inSeries.has(t)).length}));
 const titles=new Map();
 for(const r of unmatched){const t=String(r.raw?.test_title||'');titles.set(t,(titles.get(t)||0)+1);}
 console.log(JSON.stringify({event:'test-title-sample',distinct:titles.size,top:[...titles.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12)}));
 await c.close();
})().catch(e=>{console.error(e.name,String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g,'<uri>'));process.exit(1);});
