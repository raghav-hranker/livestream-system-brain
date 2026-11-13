// Read-only VG inventory. Run via SSH stdin from the VG backend with dotenv loaded.
// Outputs aggregate counts only; never outputs contacts, tokens or source payloads.
'use strict';
const {MongoClient} = require('mongoose').mongo;
const fs = require('fs');
const uri = process.env.MONGO_URI;
if (!uri || !/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri)) throw Error('VG URI required');
const client = new MongoClient(uri, {maxPoolSize: 2, minPoolSize:0, serverSelectionTimeoutMS: 15000});
const arr = v => v == null ? [] : Array.isArray(v) ? v : [v];
const sid = v => String(v ?? '');
async function main() {
  await client.connect();
  const db = client.db('vidyagramdb');
  const out = {at: new Date().toISOString(), tenant:'vidyagram', database:db.databaseName, productionWrites:0};
  const names = (await db.listCollections({}, {nameOnly:true}).toArray()).map(x=>x.name);
  out.collections = {};
  for (const n of ['users','orders','apx_user','apx_user_analytics','apx_user_course_test_detail','apxtestusertokens','classprogresses',...names.filter(n=>/completion/i.test(n))]) {
    if (names.includes(n)) out.collections[n] = await db.collection(n).estimatedDocumentCount();
  }
  console.log(JSON.stringify({event:'collection-counts',...out}));
  const courses = await db.collection('courses').find({}, {projection:{apxCourseId:1}}).toArray();
  const courseMap = new Map(courses.filter(c=>c.apxCourseId).map(c=>[sid(c._id),sid(c.apxCourseId)]));
  const plans = await db.collection('plans').find({}, {projection:{course:1}}).toArray();
  const planMap = new Map(plans.map(p=>[sid(p._id),arr(p.course).map(sid)]));
  const placements = await db.collection('courseclasses').distinct('course');
  const videoCourses = new Set(placements.map(sid).filter(id=>courseMap.has(id)));
  const users = await db.collection('users').find({}, {projection:{usersApxId:1}}).toArray();
  const userMap = new Map(users.map(u=>[sid(u._id),sid(u.usersApxId)]));
  const tokenRows = await db.collection('apxtestusertokens').find({orgId:'2177599'}, {projection:{apxUserId:1,mintedAt:1}}).toArray();
  const tokens = new Set(tokenRows.map(t=>sid(t.apxUserId)));
  const allPairs = new Map(), activePairs = new Map();
  const add = (m,u,c) => {if(!m.has(u))m.set(u,new Set());m.get(u).add(c);};
  let orders=0, activeOrders=0, buildOrders=0;
  for await (const o of db.collection('orders').find({orderStatus:'success',status:{$ne:0}}, {projection:{userId:1,courseId:1,latestCourseId:1,planId:1,expireDate:1,build:1}})) {
    orders++;
    const active = !o.expireDate || new Date(o.expireDate)>=new Date();
    if(active)activeOrders++;
    if(o.build)buildOrders++;
    const ids = new Set([...arr(o.courseId),...arr(o.latestCourseId),...arr(o.planId).flatMap(p=>planMap.get(sid(p))||[]),...(o.build?.courseId?[o.build.courseId]:[])].map(sid));
    for (const c of ids) if(videoCourses.has(c)){add(allPairs,sid(o.userId),courseMap.get(c));if(active)add(activePairs,sid(o.userId),courseMap.get(c));}
  }
  const detail = new Map();
  const history = {rows:0,stamped:0,courseItems:0,successfulCourseItems:0,failedCourseItems:0,mergedEntries:0,positiveDurationEntries:0};
  for await (const d of db.collection('apx_user_course_test_detail').find({}, {projection:{apxId:1,classProgressSyncedAt:1,'courses.courseId':1,'courses.error':1,'courses.data':1}})) {
    history.rows++; if(d.classProgressSyncedAt)history.stamped++;
    const good = new Set();
    for (const c of arr(d.courses)) {
      history.courseItems++;
      const merged = c.data?.merged_courses;
      if(c.error || !Array.isArray(merged)){history.failedCourseItems++;continue;}
      history.successfulCourseItems++;good.add(sid(c.courseId));
      history.mergedEntries+=merged.length;
      history.positiveDurationEntries+=merged.filter(e=>Number(e.video_duration_total)>0).length;
    }
    detail.set(sid(d.apxId),good);
  }
  function coverage(pairs){
    const r={users:pairs.size,userCoursePairs:0,usersWithApxIdentity:0,usersWithCachedToken:0,pairsWithCachedToken:0,pairsWithSavedWatchDetail:0,usersMissingApxIdentity:0};
    for(const[u,cs]of pairs){const a=userMap.get(u);r.userCoursePairs+=cs.size;if(a)r.usersWithApxIdentity++;else r.usersMissingApxIdentity++;if(tokens.has(a)){r.usersWithCachedToken++;r.pairsWithCachedToken+=cs.size;}for(const c of cs)if(detail.get(a)?.has(c))r.pairsWithSavedWatchDetail++;}
    r.pairsMissingSavedWatchDetail=r.userCoursePairs-r.pairsWithSavedWatchDetail;
    return r;
  }
  out.scope={successfulNonDisabledOrders:orders,activeOrders,buildOrders,localVideoCourses:videoCourses.size,allHistory:coverage(allPairs),activeAccess:coverage(activePairs)};
  out.savedWatchHistory=history;
  out.progress=await db.collection('classprogresses').aggregate([{$group:{_id:{apxMigrated:{$eq:['$apxMigrated',true]},manualCompleted:{$eq:['$manualCompleted',true]}},rows:{$sum:1}}}],{maxTimeMS:60000}).toArray();
  out.tokenCache={vgTokens:tokens.size,otherOrgRows:await db.collection('apxtestusertokens').countDocuments({orgId:{$ne:'2177599'}},{maxTimeMS:60000})};
  out.completionFiles=fs.readdirSync('src/scripts').filter(x=>/Completion/i.test(x));
  out.notes=['Eligibility uses successful non-disabled orders, direct/latest/plan courses plus build.courseId; video course means at least one CourseClass.','Active access uses expiry only; successful does not necessarily imply a nonzero payment.','Saved detail is usable shape, not proof of freshness or class mapping.','Cached token validity requires a separate source GET.'];
  console.log(JSON.stringify({event:'inventory',...out}));
}
main().catch(e=>{console.error(JSON.stringify({event:'inventory-failed',name:e.name,code:e.code||null,message:String(e.message).replace(/mongodb(?:\+srv)?:\/\/\S+/g,'[redacted-uri]')}));process.exitCode=1;}).finally(()=>client.close());
