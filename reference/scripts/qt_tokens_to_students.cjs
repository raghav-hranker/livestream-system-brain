// read-only: joins Cloudflare token seconds to the one student who minted each (views + class/stream match), skipping seconds shared by several viewers.
// Prints names and mobiles, so never save the output. Fed by cf_vi_maa_students.sh, which prepends `const TOK=[{s,id,n,r}...];`.
const path=require('path');require(path.resolve('node_modules/dotenv')).config({path:'.env.development'});
const mongoose=require(path.resolve('node_modules/mongoose'));
(async()=>{await mongoose.connect(process.env.MONGO_URI,{readPreference:'secondaryPreferred'});const db=mongoose.connection.db;
const seen=new Map();
for(const t of TOK){
 const vs=await db.collection('views').find({viewedAt:{$gte:new Date((t.s-3)*1000),$lt:new Date((t.s+3)*1000)}}).project({userId:1,classId:1,viewedAt:1}).toArray();
 const cids=[...new Set(vs.map(v=>String(v.classId)))].filter(x=>/^[0-9a-f]{24}$/.test(x));
 const cls=await db.collection('classes').find({_id:{$in:cids.map(i=>new mongoose.Types.ObjectId(i))}}).project({title:1,hlsAsset:1}).toArray();
 const match=new Set(cls.filter(c=>String(c._id)===t.id||JSON.stringify(c.hlsAsset||{}).includes(t.id)).map(c=>String(c._id)));
 const hits=vs.filter(v=>match.has(String(v.classId)));
 const uids=[...new Set(hits.map(v=>String(v.userId)))];
 if(uids.length!==1)continue; // several viewers shared this second: can't tell who
 const a=seen.get(uids[0])||{n:0,r:0,t:0};a.n+=t.n;a.r+=t.r;a.t++;a.title=(cls.find(c=>match.has(String(c._id)))||{}).title;seen.set(uids[0],a);
}
console.log('single-viewer students',seen.size);
const top=[...seen].sort((a,b)=>b[1].n-a[1].n).slice(0,10);
for(const [u,a] of top){
 const oid=new mongoose.Types.ObjectId(u);
 const usr=await db.collection('users').findOne({_id:oid},{projection:{name:1,last_name:1,mobile:1}});
 const sess=await db.collection('userloginsessions').find({$or:[{userId:{$in:[oid,u]}},{user_id:{$in:[oid,u]}}]}).sort({_id:-1}).limit(1).toArray();
 const ua=String(sess[0]&&(sess[0].device_info||sess[0].deviceInfo)||'');
 console.log([usr&&`${usr.name||''} ${usr.last_name||''}`.trim().slice(0,22),usr&&usr.mobile,`pieces=${a.n}`,`broken=${a.r}`,`opens=${a.t}`,/Windows/.test(ua)?'lastLogin=Windows':/Dart/.test(ua)?'lastLogin=app':'lastLogin=?',String(a.title||'').slice(0,34)].join(' | '));
}
await mongoose.disconnect();})().catch(e=>{console.error(e.message);process.exit(1)});
