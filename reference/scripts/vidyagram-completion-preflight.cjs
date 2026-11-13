// Read-only pilot prerequisites. Never emits credentials, contacts, or OTPs.
'use strict';
const fs=require('fs'),path=require('path');
const root=process.env.VG_APP_ROOT||process.cwd();
const req=n=>require(require.resolve(n,{paths:[root]}));
req('dotenv').config({path:path.join(root,'.env.development'),quiet:true});
const {MongoClient}=req('mongoose').mongo;
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(process.env.MONGO_URI||''))throw Error('VG database guard');
const client=new MongoClient(process.env.MONGO_URI,{minPoolSize:0,maxPoolSize:2,readPreference:'primary',serverSelectionTimeoutMS:15000});
async function main(){
 await client.connect();const db=client.db('vidyagramdb');
 const s=await db.collection('apxsessions').findOne({orgId:'2177599'});
 const out={event:'vg-completion-preflight',at:new Date().toISOString(),host:require('os').hostname(),db:db.databaseName,session:s?{active:s.isActive,lastCheckedAt:s.lastCheckedAt,lastHttpStatus:s.lastHttpStatus,hasSession:!!s.session_id}:null};
 const t=await db.collection('apxtestusertokens').findOne({orgId:'2177599'},{projection:{apxUserId:1,token:1}});
 if(s?.session_id&&t){
  const u=new URL('https://cms.appx.co.in/users/get_userdt_by_id');u.searchParams.set('user_id',t.apxUserId);
  const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json','Cookie':`ci_session=${s.session_id}`,'Referer':'https://cms.appx.co.in/reports/users','X-Requested-With':'XMLHttpRequest','User-Agent':'Mozilla/5.0'}});
  const b=await r.json().catch(()=>null);out.adminRead={http:r.status,api:b?.status??null,identityMatches:String(b?.userdt?.id)===String(t.apxUserId),hasContact:!!(b?.userdt?.phone||b?.userdt?.email)};
 }
 try{const rs=await db.admin().command({replSetGetStatus:1});out.replicaSet=rs.members.map(m=>({state:m.stateStr,health:m.health}));}catch(e){out.replicaSetCheck=e.codeName||e.name;}
 const ctrl=path.join(root,'src/controllers/courseProgressController.ts');
 out.uncompleteDeletesRows=fs.existsSync(ctrl)&&fs.readFileSync(ctrl,'utf8').includes('ClassProgress.deleteMany');
 const key=process.env.GOOGLE_KEY;
 if(key&&fs.existsSync(key)){
  const {GoogleAuth}=req('google-auth-library');const auth=await new GoogleAuth({keyFile:key,scopes:['https://www.googleapis.com/auth/spreadsheets']}).getClient();
  const r=await auth.request({url:'https://sheets.googleapis.com/v4/spreadsheets/1S8WDIGKnt0gwQB_dVhasseUOgmAtLQbjS3iH5wyglGY',params:{fields:'spreadsheetId,properties.title,sheets.properties'}});
  out.sheet={id:r.data.spreadsheetId,title:r.data.properties.title,tabs:r.data.sheets.map(s=>s.properties.title)};
 }
 console.log(JSON.stringify(out));
}
main().catch(e=>{console.error(JSON.stringify({event:'preflight-failed',name:e.name,code:e.code||null}));process.exitCode=1;}).finally(()=>client.close());
