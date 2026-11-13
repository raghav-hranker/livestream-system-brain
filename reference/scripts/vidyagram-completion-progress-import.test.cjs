'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
delete process.env.VG_APP_ROOT;
const p=require('./vidyagram-completion-progress-import.cjs');
const root='/Users/raghav/Projects/worktrees/vg-backend';
const {MongoMemoryReplSet}=require(root+'/node_modules/mongodb-memory-server');
const {MongoClient,ObjectId}=require(root+'/node_modules/mongoose').mongo;
const {resolveWatchStatus}=require(root+'/dist/src/services/classTabs/watchStatus');
let rs,client,db,user,other,course,classA,classB,classC;
const ids=()=>new ObjectId();
const capture=(userId,apxUserId,extra)=>({_id:ids().toString(),orgId:'2177599',runId:'vg-completion-20261103-azure50',userId:String(userId),apxUserId,courseId:String(course),apxCourseId:'74',mapped:[],unmatched:[],...extra});
test.before(async()=>{rs=await MongoMemoryReplSet.create({binary:{version:'7.0.14'},replSet:{count:1},instanceOpts:[{port:0}]});client=new MongoClient(rs.getUri());await client.connect();db=client.db('vidyagramdb');});
test.after(async()=>{await client?.close();await rs?.stop();});
test.beforeEach(async()=>{
 await db.dropDatabase();
 [user,other,course,classA,classB,classC]=[ids(),ids(),ids(),ids(),ids(),ids()];
 await db.collection('users').insertMany([{_id:user},{_id:other}]);
 await db.collection('courses').insertOne({_id:course});
 await db.collection('classes').insertMany([{_id:classA,title:'Cell Part 01',duration:3600},{_id:classB,title:'Cell Part 02',duration:1800},{_id:classC,title:'Cell Part 02',duration:1800}]);
 await db.collection('courseclasses').insertMany([classA,classB].map(c=>({course,class:c})));
});
const run=async(opts={},batch='b1')=>{const {stats,inserts}=await p.plan(db,ObjectId,opts);const inserted=await p.commit(db,ObjectId,batch,inserts,stats,{});return {stats,inserted};};
const rows=()=>db.collection('classprogresses').find({}).toArray();
const row=(userId,classId,extra)=>({userId:String(userId),classId:String(classId),courseId:course,userStartTime:new Date('2026-10-01'),userEndTime:new Date('2026-10-01T01:00:00Z'),duration:3600,...extra});

test('an exact flag inserts a tagged marker that reads as Watched with no watch time',async()=>{
 await db.collection('apx_vg_completion_captures').insertOne(capture(user,'1',{mapped:[{sourceVideoId:'9',classId:String(classA)}]}));
 const {inserted}=await run();
 assert.equal(inserted,1);
 const [r]=await rows();
 assert.equal(r.userId,String(user));assert.equal(r.classId,String(classA));assert.ok(r.courseId.equals(course));
 assert.equal(r.apxMigrated,true);assert.equal(r.manualCompleted,true);assert.equal(r.duration,0);
 assert.deepEqual(r.userStartTime,p.MARKER_TIME);assert.deepEqual(r.userEndTime,p.MARKER_TIME);
 assert.equal(r.apxCompletionImport.batch,'b1');assert.equal(r.apxCompletionImport.match,'exact_id');
 assert.deepEqual(resolveWatchStatus([r],{duration:3600}),{watchStatus:'watched',watchTime:0});
});

test('a hidden row with one same-title, same-length class imports with its own tag',async()=>{
 await db.collection('apxcatalogrows').insertOne({customerId:'781',rowId:'55',apxCourseId:'74',hiddenReason:'Home > Science (Deleted)',raw:{title:' cell  part 01 ',duration:'3590'}});
 await db.collection('apx_vg_completion_captures').insertOne(capture(user,'1',{unmatched:['55']}));
 const {stats,inserted}=await run();
 assert.equal(inserted,1);assert.equal(stats.sameTitle,1);
 const [r]=await rows();assert.equal(r.classId,String(classA));assert.equal(r.apxCompletionImport.match,'same_title_and_length');
});

test('same-title rows are refused when length differs, the title is ambiguous, or the row is not hidden',async()=>{
 await db.collection('courseclasses').insertOne({course,class:classC});
 await db.collection('apxcatalogrows').insertMany([
  {customerId:'781',rowId:'60',apxCourseId:'74',hiddenReason:'Home > X (Deleted)',raw:{title:'Cell Part 01',duration:'900'}},
  {customerId:'781',rowId:'61',apxCourseId:'74',hiddenReason:'Home > X (Deleted)',raw:{title:'Cell Part 02',duration:'1800'}},
  {customerId:'781',rowId:'62',apxCourseId:'74',hiddenReason:null,raw:{title:'Cell Part 01',duration:'3600'}},
 ]);
 await db.collection('apx_vg_completion_captures').insertOne(capture(user,'1',{unmatched:['60','61','62','63']}));
 const {stats,inserted}=await run();
 assert.equal(inserted,0);assert.equal(stats.leftOut,4);assert.equal((await rows()).length,0);
});

test('--exact-only leaves same-title matches out',async()=>{
 await db.collection('apxcatalogrows').insertOne({customerId:'781',rowId:'55',apxCourseId:'74',hiddenReason:'Home > X (Deleted)',raw:{title:'Cell Part 01',duration:'3600'}});
 await db.collection('apx_vg_completion_captures').insertOne(capture(user,'1',{unmatched:['55']}));
 const {inserted}=await run({exactOnly:true});
 assert.equal(inserted,0);
});

test('existing rows are never changed, and a real session keeps its resume position',async()=>{
 await db.collection('classprogresses').insertMany([row(user,classA),row(user,classB,{manualCompleted:true})]);
 const before=await rows();
 await db.collection('apx_vg_completion_captures').insertOne(capture(user,'1',{mapped:[{sourceVideoId:'1',classId:String(classA)},{sourceVideoId:'2',classId:String(classB)}]}));
 const {stats,inserted}=await run();
 assert.equal(inserted,1);assert.equal(stats.insertBesideSession,1);assert.equal(stats.skipAlreadyManual,1);
 const after=await rows();assert.equal(after.length,3);
 for(const b of before)assert.deepEqual(after.find(a=>a._id.equals(b._id)),b);
});

test('an existing seconds-only APX row is left alone rather than overwritten',async()=>{
 await db.collection('classprogresses').insertOne(row(user,classA,{apxMigrated:true}));
 await db.collection('apx_vg_completion_captures').insertOne(capture(user,'1',{mapped:[{sourceVideoId:'1',classId:String(classA)}]}));
 const {stats,inserted}=await run();
 assert.equal(inserted,0);assert.equal(stats.skipExistingApxRow,1);
 const [r]=await rows();assert.equal(r.manualCompleted,undefined);assert.equal(r.duration,3600);
});

test('classes no longer placed in the course, and unknown users, are rejected',async()=>{
 await db.collection('apx_vg_completion_captures').insertMany([capture(user,'1',{mapped:[{sourceVideoId:'1',classId:String(classC)}]}),capture(ids(),'2',{mapped:[{sourceVideoId:'1',classId:String(classA)}]})]);
 const {stats,inserted}=await run();
 assert.equal(inserted,0);assert.equal(stats.rejectedInvalid,2);
});

test('scoping to learners imports only those learners',async()=>{
 await db.collection('apx_vg_completion_captures').insertMany([capture(user,'1',{mapped:[{sourceVideoId:'1',classId:String(classA)}]}),capture(other,'2',{mapped:[{sourceVideoId:'1',classId:String(classA)}]})]);
 await run({learners:['1']});
 const all=await rows();assert.equal(all.length,1);assert.equal(all[0].userId,String(user));
});

test('a rerun adds nothing, and a batch id cannot be reused',async()=>{
 await db.collection('apx_vg_completion_captures').insertOne(capture(user,'1',{mapped:[{sourceVideoId:'1',classId:String(classA)}]}));
 await run();
 const {stats}=await p.plan(db,ObjectId);assert.equal(stats.skipAlreadyManual,1);assert.equal(stats.insert,0);
 await assert.rejects(p.commit(db,ObjectId,'b1',[],stats,{}),/already used/);
 assert.equal((await rows()).length,1);
});

test('new-only imports later captures and does not bring back a class the student un-marked',async()=>{
 await db.collection('apx_vg_completion_captures').insertOne(capture(user,'1',{fetchedAt:new Date(Date.now()-2*3600e3),mapped:[{sourceVideoId:'1',classId:String(classA)}]}));
 const first=await p.plan(db,ObjectId);
 await p.commit(db,ObjectId,'b1',first.inserts,first.stats,{},first.capturedUpTo);
 await db.collection('classprogresses').deleteMany({});
 await db.collection('apx_vg_completion_captures').insertOne(capture(other,'2',{fetchedAt:new Date(),mapped:[{sourceVideoId:'1',classId:String(classA)}]}));
 const {stats,inserts}=await p.plan(db,ObjectId,{since:await p.newCapturesSince(db)});
 assert.equal(stats.captures,1);assert.deepEqual(inserts.map(i=>i.userId),[String(other)]);
});

test('the new-only start comes from the last finished batch, less the overlap',async()=>{
 const t=m=>new Date(Date.UTC(2026,10,4,1,m));
 const batches=db.collection('apx_vg_progress_import_batches');
 assert.equal(await p.newCapturesSince(db),null);
 await batches.insertOne({_id:'old',state:'done',at:t(0)});
 assert.deepEqual(await p.newCapturesSince(db),new Date(t(0).getTime()-p.OVERLAP_MS));
 await batches.insertMany([{_id:'a',state:'done',at:t(20),capturedUpTo:t(19)},{_id:'b',state:'undone',at:t(30),capturedUpTo:t(29)},{_id:'c',state:'writing',at:t(40),capturedUpTo:t(39)}]);
 assert.deepEqual(await p.newCapturesSince(db),new Date(t(19).getTime()-p.OVERLAP_MS));
});

test('undo removes only that batch and leaves other batches and real rows',async()=>{
 await db.collection('classprogresses').insertOne(row(user,classB));
 await db.collection('apx_vg_completion_captures').insertOne(capture(user,'1',{mapped:[{sourceVideoId:'1',classId:String(classA)}]}));
 await run({},'b1');
 await db.collection('apx_vg_completion_captures').insertOne(capture(other,'2',{mapped:[{sourceVideoId:'1',classId:String(classA)}]}));
 await run({learners:['2']},'b2');
 assert.equal(await p.undo(db,'b1'),1);
 const left=await rows();assert.equal(left.length,2);
 assert.ok(left.some(r=>r.classId===String(classB)&&r.duration===3600));assert.ok(left.some(r=>r.apxCompletionImport?.batch==='b2'));
 assert.equal((await db.collection('apx_vg_progress_import_batches').findOne({_id:'b1'})).state,'undone');
});
