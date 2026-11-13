'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
delete process.env.VG_APP_ROOT;
const capture=require('./vidyagram-saved-questions-capture.cjs');
const imp=require('./vidyagram-saved-questions-import.cjs');
// Point VG_BACKEND_ROOT at a checkout of the deployed branch: the read routes below are the deployed code.
const root=process.env.VG_BACKEND_ROOT||'/Users/raghav/Projects/worktrees/vg-backend';
const {MongoMemoryReplSet}=require(root+'/node_modules/mongodb-memory-server');
const mongoose=require(root+'/node_modules/mongoose');
const {MongoClient,ObjectId}=mongoose.mongo;
const {getSectionWiseSavedQuestions,getSavedQuestionPage,getSavedQuestionSections}=require(root+'/dist/src/controllers/savedQuestionController');
const SavedQuestion=require(root+'/dist/src/models/SavedQuestion').default;
let rs,client,db;
const ORG='2177599',TOKEN='secret-token-value';
const json=(status,body)=>({status,json:async()=>body,text:async()=>JSON.stringify(body)});
const row=(id,extra)=>({id:String(id),test_id:'7',test_series_id:'3',test_title:'Mock 1',test_series_title:'Maths Series',question:`<p>q${id}</p>`,...extra});

// Fake AppX: pages of `size` rows per learner, the site's section total, and hooks to fail a learner.
function fakeSource(saved,{size=20,api={},site={}}={}){
 const calls=[];
 const fetch=async url=>{
  const u=new URL(String(url));calls.push(u.pathname+u.search);
  if(u.pathname==='/saved-question')return {status:200,text:async()=>'<script>{"buildId":"B1"}</script>'};
  return fetch.handle(u);
 };
 fetch.current=null;
 fetch.handle=u=>{
  const apx=fetch.current;
  if(u.pathname.includes('/_next/data/')){
   const s=site[apx];if(s)return s();
   return json(200,{pageProps:{sections:[{section_id:'1',question_count:(saved[apx]||[]).length}]}});
  }
  const a=api[apx];if(a){const r=a();if(r)return r;}
  const start=Number(u.searchParams.get('start'));
  return json(200,{status:200,data:(saved[apx]||[]).slice(start,start+size)});
 };
 return {fetch,calls};
}
const deps=source=>{
 const orig=source.fetch;
 return {fetch:(url,opts)=>{source.fetch.current=opts?.headers?.['User-ID']||(/User-ID=(\w+)/.exec(opts?.headers?.Cookie||'')||[])[1]||source.fetch.current;return orig(url,opts);},sleep:async()=>{},now:()=>new Date()};
};
const tokens=(...apx)=>db.collection('apxtestusertokens').insertMany(apx.map(a=>({orgId:ORG,apxUserId:a,token:TOKEN})));
const staged=q=>db.collection(capture.CAPTURES).find(q||{}).toArray();
const learner=apx=>db.collection(capture.LEARNERS).findOne({_id:apx});

test.before(async()=>{
 rs=await MongoMemoryReplSet.create({binary:{version:'7.0.14'},replSet:{count:1},instanceOpts:[{port:0}]});
 client=new MongoClient(rs.getUri());await client.connect();db=client.db('vidyagramdb');
 await mongoose.connect(rs.getUri('vidyagramdb'));
});
test.after(async()=>{await mongoose.disconnect();await client?.close();await rs?.stop();});
test.beforeEach(async()=>{await db.dropDatabase();await SavedQuestion.syncIndexes();});

test('capture walks every page, keeps full rows in listing order, and never stores the token',async()=>{
 await tokens('11');
 const rows=Array.from({length:45},(_,i)=>row(100+i));
 const source=fakeSource({'11':rows});
 const stats=await capture.run(db,deps(source));
 assert.equal(stats.captured,1);assert.equal(stats.rows,45);assert.equal(stats.countsAgree,1);
 assert.ok(source.calls.includes('/Test_Series/getSavedQuestions?start=20'));
 assert.ok(source.calls.includes('/Test_Series/getSavedQuestions?start=40'));
 const docs=await staged();
 assert.equal(docs.length,45);
 assert.equal(docs.find(d=>d.apxQuestionId==='100').position,0);
 assert.equal(docs.find(d=>d.apxQuestionId==='144').position,44);
 assert.equal(docs[0].raw.question,'<p>q100</p>');
 assert.ok(!JSON.stringify([docs,await learner('11')]).includes(TOKEN));
});

test('a student with nothing saved is captured as zero rows',async()=>{
 await tokens('11');
 const stats=await capture.run(db,deps(fakeSource({})));
 assert.equal(stats.captured,1);assert.equal(stats.withRows,0);
 assert.equal((await learner('11')).rowCount,0);assert.equal((await learner('11')).countsAgree,true);
});

test('a rerun skips agreed students; --refresh rereads and marks rows AppX stopped listing',async()=>{
 await tokens('11');
 const saved={'11':[row(1),row(2)]};
 await capture.run(db,deps(fakeSource(saved)));
 assert.equal((await capture.run(db,deps(fakeSource(saved)))).planned,0);
 saved['11']=[row(2)];
 const stats=await capture.run(db,deps(fakeSource(saved)),{refresh:true});
 assert.equal(stats.gone,1);
 assert.ok((await staged({apxQuestionId:'1'}))[0].goneFromSourceAt);
 assert.equal((await staged({apxQuestionId:'2'}))[0].goneFromSourceAt,undefined);
 saved['11']=[row(1),row(2)];
 await capture.run(db,deps(fakeSource(saved)),{refresh:true});
 assert.equal((await staged({apxQuestionId:'1'}))[0].goneFromSourceAt,undefined);
});

test('a refused token is recorded as refused, never as saved nothing, and keeps earlier rows',async()=>{
 await tokens('11');
 const saved={'11':[row(1)]};
 await capture.run(db,deps(fakeSource(saved)));
 const stats=await capture.run(db,deps(fakeSource(saved,{api:{'11':()=>json(403,{})}})),{refresh:true});
 assert.equal(stats.tokenRejected,1);assert.equal(stats.gone,0);
 assert.equal((await learner('11')).state,'token_rejected');
 assert.equal((await staged({apxQuestionId:'1'}))[0].goneFromSourceAt,undefined);
});

test('an API-level refusal inside HTTP 200 also fails the student',async()=>{
 await tokens('11');
 const stats=await capture.run(db,deps(fakeSource({},{api:{'11':()=>json(200,{status:401,data:[]})}})));
 assert.equal(stats.tokenRejected,1);assert.equal((await staged()).length,0);
});

test('three refused tokens in a row stop the run',async()=>{
 await tokens('1','2','3','4');
 const refuse=()=>json(403,{});
 const stats=await capture.run(db,deps(fakeSource({},{api:{'1':refuse,'2':refuse,'3':refuse,'4':refuse}})));
 assert.equal(stats.stoppedBy,'tokens_refused');assert.equal(stats.tokenRejected,3);
 assert.equal(await learner('4'),null);
});

test('HTTP 429 stops the run at once',async()=>{
 await tokens('1','2');
 const stats=await capture.run(db,deps(fakeSource({},{api:{'1':()=>json(429,{})}})));
 assert.equal(stats.stoppedBy,'http_429');assert.equal(await learner('1'),null);assert.equal(await learner('2'),null);
});

test('a 502 is retried and then succeeds',async()=>{
 await tokens('1');
 let n=0;
 const stats=await capture.run(db,deps(fakeSource({'1':[row(1)]},{api:{'1':()=>n++===0?json(502,{}):null}})));
 assert.equal(stats.captured,1);assert.equal(stats.failed,0);assert.equal((await staged()).length,1);
});

test('counts that differ or cannot be read are flagged and tried again on the next run',async()=>{
 await tokens('1','2');
 const saved={'1':[row(1)],'2':[row(2)]};
 const stats=await capture.run(db,deps(fakeSource(saved,{site:{'1':()=>json(200,{pageProps:{sections:[{question_count:9}]}}),'2':()=>json(502,{})}})));
 assert.equal(stats.countsDiffer,1);assert.equal(stats.countsUnread,1);
 assert.equal((await learner('1')).countsAgree,false);assert.equal((await learner('2')).countsAgree,null);
 assert.equal((await capture.run(db,deps(fakeSource(saved)))).planned,2);
});

test('--new-only takes new students and past failures, not refused tokens or differing counts',async()=>{
 await tokens('1','2','3');
 const saved={'1':[row(1)],'3':[row(3)]};
 await capture.run(db,deps(fakeSource(saved,{api:{'2':()=>json(403,{}),'3':()=>json(404,{})},site:{'1':()=>json(200,{pageProps:{sections:[{question_count:9}]}})}})));
 assert.equal((await learner('1')).countsAgree,false);assert.equal((await learner('2')).state,'token_rejected');assert.equal((await learner('3')).state,'failed');
 await tokens('4');
 const source=fakeSource({...saved,'4':[row(4)]});
 const stats=await capture.run(db,deps(source),{newOnly:true});
 assert.equal(stats.planned,2);assert.equal(stats.captured,2);
 assert.equal((await learner('3')).state,'captured');assert.equal((await learner('4')).state,'captured');
 assert.equal((await learner('2')).state,'token_rejected');
});

test('a failed page load at the start is retried, so counts are still checked',async()=>{
 await tokens('1');
 const source=fakeSource({'1':[row(1)]}),d=deps(source),inner=d.fetch;
 let failures=1;
 d.fetch=(url,opts)=>String(url).endsWith('/saved-question?type=question')&&failures-->0?Promise.reject(new Error('reset')):inner(url,opts);
 const stats=await capture.run(db,d);
 assert.equal(stats.buildIdFound,true);assert.equal(stats.countsAgree,1);assert.equal(stats.countsUnread,0);
});

test('with nobody new, a --new-only run makes no AppX calls',async()=>{
 await tokens('1');
 await capture.run(db,deps(fakeSource({})));
 const source=fakeSource({});
 const stats=await capture.run(db,deps(source),{newOnly:true});
 assert.equal(stats.planned,0);assert.deepEqual(source.calls,[]);
});

// ---- import
let user,question,section,topic,series;
async function seedImport(){
 user=new ObjectId();question=new ObjectId();section=new ObjectId();topic=new ObjectId();series=new ObjectId();
 await db.collection('users').insertOne({_id:user,usersApxId:'11'});
 await db.collection('sections').insertOne({_id:section,sectionName:'Algebra'});
 await db.collection('series').insertOne({_id:series,legacy_id:7,series_name:'Mock 1',main_tab:'test-series'});
 await db.collection('questions').insertOne({_id:question,hranker_id:'CM-501',sectionId:section,topicId:topic,status:1,question:{en:'<p>q</p>'}});
}
const stage=(apx,id,extra)=>db.collection(capture.CAPTURES).insertOne({_id:`${apx}:${id}`,orgId:ORG,apxUserId:apx,apxQuestionId:String(id),raw:row(id),position:0,fetchedAt:new Date(),...extra});
const importAll=async(batch='b1',opts={})=>{const p=await imp.plan(db,opts);return {p,inserted:await imp.commit(db,ObjectId,batch,p,{all:true})};};
const savedRows=()=>db.collection('savedquestions').find({}).toArray();

const call=async(handler,req)=>{const res={status(c){this.code=c;return this;},json(b){this.body=b;return this;}};await handler({params:{},query:{},...req},res);return res;};

test('imported saves read back through the app routes with their test and subject',async()=>{
 await seedImport();await stage('11',501);
 await importAll();
 const [r]=await savedRows();
 assert.equal(r.seriesId,String(series));assert.equal(r.subjectId,String(section));
 const page=await call(getSavedQuestionPage,{params:{userId:String(user)}});
 assert.equal(page.code,200);
 const [item]=page.body.data.items;
 assert.equal(item.qid,String(question));assert.equal(item.sourceTitle,'Mock 1');assert.equal(item.seriesId,String(series));assert.equal(item.subject,'Algebra');
 const sections=await call(getSavedQuestionSections,{params:{userId:String(user)}});
 assert.equal(sections.body.data.total,1);assert.equal(sections.body.data.sections[0].name,'Algebra');
 const wise=await call(getSectionWiseSavedQuestions,{params:{userId:String(user)}});
 assert.equal(wise.body.data[0].saved_ques[0].sourceTitle,'Mock 1');
});

test('a test we do not have leaves seriesId empty and is counted',async()=>{
 await seedImport();await stage('11',501,{raw:row(501,{test_id:'4242'})});
 const {p,inserted}=await importAll();
 assert.equal(inserted,1);assert.equal(p.stats.seriesMissing,1);assert.equal(p.stats.withSeries,0);
 assert.equal((await savedRows())[0].seriesId,null);
});

test('an imported save is valid for the model and shows through the real section-wise route',async()=>{
 await seedImport();await stage('11',501);
 const {inserted}=await importAll();
 assert.equal(inserted,1);
 const [r]=await savedRows();
 assert.equal(r.userId,String(user));assert.equal(r.qid,String(question));assert.equal(r.sectionId,String(section));assert.equal(r.topicId,String(topic));
 assert.equal(r.apxSavedQuestionImport.batch,'b1');assert.equal(r.apxSavedQuestionImport.apxQuestionId,'501');
 assert.equal(new SavedQuestion({userId:r.userId,qid:r.qid,sectionId:r.sectionId,topicId:r.topicId,addedAt:r.addedAt}).validateSync(),undefined);
 const res={status(c){this.code=c;return this;},json(b){this.body=b;return this;}};
 await getSectionWiseSavedQuestions({params:{userId:String(user)}},res);
 assert.equal(res.code,200);
 assert.equal(res.body.data.length,1);assert.equal(res.body.data[0].section_name,'Algebra');
 assert.equal(res.body.data[0].saved_ques.length,1);assert.equal(res.body.data[0].saved_ques[0].qid,String(question));
});

test('a question we do not have stays staged and is reported by test',async()=>{
 await seedImport();await stage('11',999);
 const {p,inserted}=await importAll();
 assert.equal(inserted,0);assert.equal(p.stats.questionMissing,1);
 assert.deepEqual(p.unmatched,[{seriesId:'3',seriesTitle:'Maths Series',testId:'7',testTitle:'Mock 1',questions:1,learners:1}]);
 assert.equal((await staged())[0].importBatch,undefined);
 assert.equal((await savedRows()).length,0);
});

test('an existing save is left alone and not imported twice',async()=>{
 await seedImport();await stage('11',501);
 const native={userId:String(user),qid:String(question),sectionId:'old-section',topicId:'old-topic',addedAt:'1'};
 await db.collection('savedquestions').insertOne(native);
 const {p,inserted}=await importAll();
 assert.equal(inserted,0);assert.equal(p.stats.alreadySaved,1);
 const rows=await savedRows();
 assert.equal(rows.length,1);assert.equal(rows[0].sectionId,'old-section');assert.equal(rows[0].apxSavedQuestionImport,undefined);
 assert.equal((await staged())[0].importOutcome,'already_saved');
});

test('a question the student removed here stays removed on the next import',async()=>{
 await seedImport();await stage('11',501);
 await importAll('b1');
 await db.collection('savedquestions').deleteMany({userId:String(user),qid:String(question)});
 const {p,inserted}=await importAll('b2');
 assert.equal(inserted,0);assert.equal(p.stats.alreadyHandled,1);assert.equal((await savedRows()).length,0);
});

test('a preview writes nothing',async()=>{
 await seedImport();await stage('11',501);
 const before=(await staged())[0];
 const p=await imp.plan(db,{});
 assert.equal(p.stats.insert,1);assert.equal((await savedRows()).length,0);
 assert.deepEqual((await staged())[0],before);
 assert.equal(await db.collection(imp.BATCHES).countDocuments(),0);
});

test('rows gone from AppX, unknown students and duplicate student ids are skipped with a count',async()=>{
 await seedImport();
 await stage('11',501,{goneFromSourceAt:new Date()});
 await stage('12',501);
 await db.collection('users').insertMany([{usersApxId:'13'},{usersApxId:'13'}]);
 await stage('13',501);
 const {p,inserted}=await importAll();
 assert.equal(inserted,0);assert.equal(p.stats.goneFromSource,1);assert.equal(p.stats.userMissing,1);assert.equal(p.stats.userAmbiguous,1);
});

test('a question with no section or topic is refused',async()=>{
 await seedImport();
 await db.collection('questions').insertOne({hranker_id:'CM-502',sectionId:section,question:{en:'x'}});
 await stage('11',502);
 const {p,inserted}=await importAll();
 assert.equal(inserted,0);assert.equal(p.stats.questionNoPlacement,1);
});

test('lists keep AppX order when sorted newest first',async()=>{
 await seedImport();
 const q2=new ObjectId();
 await db.collection('questions').insertOne({_id:q2,hranker_id:'CM-502',sectionId:section,topicId:topic,question:{en:'x'}});
 await stage('11',501,{position:1});await stage('11',502,{position:0});
 await importAll();
 const rows=await SavedQuestion.find({userId:String(user)}).sort({createdAt:-1}).lean();
 assert.deepEqual(rows.map(r=>r.qid),[String(q2),String(question)]);
 const page=await call(getSavedQuestionPage,{params:{userId:String(user)}});
 assert.deepEqual(page.body.data.items.map(i=>i.qid),[String(q2),String(question)]);
});

test('undo removes only its batch, keeps native saves, and allows a fresh import',async()=>{
 await seedImport();await stage('11',501);
 const q2=new ObjectId();
 await db.collection('savedquestions').insertOne({userId:String(user),qid:String(q2),sectionId:'s',topicId:'t',addedAt:'1'});
 await importAll('b1');
 assert.equal((await savedRows()).length,2);
 assert.equal(await imp.undo(db,'b1'),1);
 const rows=await savedRows();
 assert.equal(rows.length,1);assert.equal(rows[0].qid,String(q2));
 assert.equal((await staged())[0].importBatch,undefined);
 assert.equal((await importAll('b2')).inserted,1);
});

test('a used batch id and an unknown undo are refused',async()=>{
 await seedImport();await stage('11',501);
 await importAll('b1');
 await assert.rejects(imp.commit(db,ObjectId,'b1',await imp.plan(db,{}),{}),/batch id already used/);
 await assert.rejects(imp.undo(db,'nope'),/unknown batch/);
});

test('--sample takes that many students and names them',async()=>{
 await seedImport();
 for(const a of ['21','22','23'])await db.collection('users').insertOne({usersApxId:a});
 for(const a of ['21','22','23'])await stage(a,501);
 const p=await imp.plan(db,{sample:2});
 assert.equal(p.stats.students,2);assert.equal(p.inserts.length,2);
 assert.deepEqual(p.sampleStudents.map(s=>s.apxUserId),['21','22']);
});

test('the preview reports whether existing saves use Mongo ids',async()=>{
 await seedImport();
 await db.collection('savedquestions').insertMany([{userId:String(user),qid:String(question),sectionId:'s',topicId:'t'},{userId:'12345',qid:'678',sectionId:'s',topicId:'t2'}]);
 const p=await imp.plan(db,{});
 assert.deepEqual(p.nativeRows,{rows:2,userIdIsMongoId:1,qidIsMongoId:1});
 assert.equal(p.uniqueIndexPresent,true);
});

// ---- --auto (cron)
const settle=(apx,fetchedAt=new Date())=>db.collection(capture.LEARNERS).updateOne({_id:apx},{$set:{orgId:ORG,state:'captured',fetchedAt}},{upsert:true});

test('auto imports settled captures under a dated batch, and a rerun writes nothing',async()=>{
 await seedImport();const at=new Date();await stage('11',501,{fetchedAt:at});await settle('11',at);
 const r=await imp.auto(db,ObjectId,{now:new Date('2026-11-07T10:15:00Z')});
 assert.equal(r.event,'committed');assert.equal(r.batch,'vg-saved-auto-202611071015');assert.equal(r.inserted,1);
 assert.equal((await savedRows())[0].apxSavedQuestionImport.batch,'vg-saved-auto-202611071015');
 const again=await imp.auto(db,ObjectId,{now:new Date('2026-11-07T10:45:00Z')});
 assert.equal(again.event,'nothing-new');
 assert.equal(await db.collection(imp.BATCHES).countDocuments(),1);
});

test('auto holds back a student the capture is still walking',async()=>{
 await seedImport();
 const before=new Date(Date.now()-60000),now=new Date();
 await stage('11',501,{fetchedAt:now});await settle('11',before);
 const r=await imp.auto(db,ObjectId);
 assert.equal(r.event,'nothing-new');assert.equal(r.stats.unsettled,1);assert.equal((await savedRows()).length,0);
 await settle('11',now);
 assert.equal((await imp.auto(db,ObjectId)).inserted,1);
});

test('auto skips a student with no captured mark, such as a refused token',async()=>{
 await seedImport();await stage('11',501);
 await db.collection(capture.LEARNERS).insertOne({_id:'11',orgId:ORG,state:'token_rejected',fetchedAt:new Date()});
 const r=await imp.auto(db,ObjectId);
 assert.equal(r.event,'nothing-new');assert.equal(r.stats.unsettled,1);
});

test('auto refuses a load larger than its cap and writes nothing',async()=>{
 await seedImport();const at=new Date();await stage('11',501,{fetchedAt:at});await settle('11',at);
 const r=await imp.auto(db,ObjectId,{maxInsert:0});
 assert.equal(r.event,'refused-large');
 assert.equal((await savedRows()).length,0);assert.equal(await db.collection(imp.BATCHES).countDocuments(),0);
 assert.equal((await staged())[0].importBatch,undefined);
});
