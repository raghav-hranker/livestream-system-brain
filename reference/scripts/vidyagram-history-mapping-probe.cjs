// Read-only VG title-mapping pilot and positive-value order scope. No user data output.
'use strict';
const {MongoClient}=require('mongoose').mongo;
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(process.env.MONGO_URI||''))throw Error('VG URI required');
const client=new MongoClient(process.env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,serverSelectionTimeoutMS:15000});
const arr=x=>x==null?[]:Array.isArray(x)?x:[x];const norm=x=>String(x||'').trim().replace(/\s+/g,' ').toLowerCase();
async function main(){
 await client.connect();const db=client.db('vidyagramdb');
 const courses=await db.collection('courses').find({}, {projection:{apxCourseId:1}}).toArray();
 const courseMap=new Map(courses.filter(c=>c.apxCourseId).map(c=>[String(c._id),String(c.apxCourseId)]));
 const cls=await db.collection('classes').find({}, {projection:{title:1}}).toArray();const ct=new Map(cls.map(c=>[String(c._id),c.title]));
 const index=new Map(), original=new Map(), videoCourses=new Set();
 function add(m,k,id){if(!m.has(k))m.set(k,new Set());m.get(k).add(String(id));}
 for await(const cc of db.collection('courseclasses').find({}, {projection:{course:1,class:1,title:1,apxTitle:1}})){
  const c=courseMap.get(String(cc.course));if(!c)continue;videoCourses.add(String(cc.course));
  add(index,c+'::'+norm(cc.title||cc.apxTitle||ct.get(String(cc.class))),cc.class);
  if(cc.apxTitle)add(original,c+'::'+norm(cc.apxTitle),cc.class);
 }
 const sample={method:'first 200 raw rows with at least one merged-course entry, ascending _id; convenience sample, not population estimate',rows:0,courseItems:0,entries:0,positiveDuration:0,uniqueEffectiveTitle:0,ambiguousEffectiveTitle:0,unmatchedEffectiveTitle:0,rescuedByUniqueOriginalTitle:0,oldestFetch:null,newestFetch:null};
 for await(const d of db.collection('apx_user_course_test_detail').find({'courses.data.merged_courses.0':{$exists:true}},{projection:{courses:1}}).sort({_id:1}).limit(200)){
  sample.rows++;
  for(const c of arr(d.courses)){
   if(c.fetchedAt){const dt=new Date(c.fetchedAt).toISOString();if(!sample.oldestFetch||dt<sample.oldestFetch)sample.oldestFetch=dt;if(!sample.newestFetch||dt>sample.newestFetch)sample.newestFetch=dt;}
   sample.courseItems++;
   for(const e of arr(c.data?.merged_courses)){
    sample.entries++;if(Number(e.video_duration_total)>0)sample.positiveDuration++;
    const k=String(c.courseId)+'::'+norm(e.title);const hits=index.get(k);
    if(hits?.size===1)sample.uniqueEffectiveTitle++;
    else if(hits?.size>1)sample.ambiguousEffectiveTitle++;
    else {sample.unmatchedEffectiveTitle++;if(original.get(k)?.size===1)sample.rescuedByUniqueOriginalTitle++;}
   }
  }
 }
 console.log(JSON.stringify({event:'mapping-sample',at:new Date().toISOString(),productionWrites:0,sample,ambiguousEffectiveTitleKeys:[...index.values()].filter(s=>s.size>1).length}));
 const plans=await db.collection('plans').find({}, {projection:{course:1}}).toArray();const pm=new Map(plans.map(p=>[String(p._id),arr(p.course).map(String)]));
 const all=new Map(), active=new Map();let valueOrders=0;
 for await(const o of db.collection('orders').find({orderStatus:'success',status:{$ne:0},grandTotal:{$gt:0}},{projection:{userId:1,courseId:1,latestCourseId:1,planId:1,build:1,expireDate:1}})){
  valueOrders++;const ids=new Set([...arr(o.courseId),...arr(o.latestCourseId),...arr(o.planId).flatMap(p=>pm.get(String(p))||[]),...(o.build?.courseId?[o.build.courseId]:[])].map(String).filter(c=>videoCourses.has(c)));
  for(const [m,include]of [[all,true],[active,!o.expireDate||new Date(o.expireDate)>=new Date()]])if(include&&ids.size){const u=String(o.userId);if(!m.has(u))m.set(u,new Set());for(const c of ids)m.get(u).add(c);}
 }
 const count=m=>({users:m.size,pairs:[...m.values()].reduce((a,s)=>a+s.size,0)});
 console.log(JSON.stringify({event:'positive-value-order-scope',at:new Date().toISOString(),productionWrites:0,orders:valueOrders,allHistory:count(all),activeAccess:count(active),definition:'successful non-disabled orders with numeric grandTotal > 0; course access from direct/latest/plan/build course; not a revenue audit'}));
}
main().catch(e=>{console.error(JSON.stringify({event:'mapping-probe-failed',name:e.name,code:e.code||null}));process.exitCode=1;}).finally(()=>client.close());
