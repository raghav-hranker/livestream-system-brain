require('dotenv').config({path:'.env.development',quiet:true});
require('ts-node/register/transpile-only');
const mongoose=require('mongoose');
const {createHttpCatalogSource}=require('./src/services/apx/apxCatalogHttpSource');
const {sessionIsLive}=require('./src/services/apx/vidyagramNightlySync');
(async()=>{await mongoose.connect(process.env.MONGO_URI,{dbName:'vidyagramdb',readPreference:'primary',autoIndex:false,autoCreate:false});try{
const db=mongoose.connection.db;
if(db.databaseName!=='vidyagramdb')throw new Error('Wrong database');
const live=await sessionIsLive(db);if(!live)throw new Error('Maintained APX session is not live');
const source=createHttpCatalogSource({db,customerId:'781',orgId:'2177599',tenantApiBase:'https://armathsapi.akamai.net.in',gapMs:1000,studentGapMs:1000});
const page=await source.courseListPage(0,1);if(!page.rows.length)throw new Error('CMS course list empty');
const tree=await source.folderContents('85','-1');
console.log(JSON.stringify({db:db.databaseName,sessionLive:live,cmsRows:page.rows.length,studentRows:tree.data.length,classes:await db.collection('classes').countDocuments({}),pdfs:await db.collection('pdfs').countDocuments({})}));
}finally{await mongoose.disconnect()}})().catch(e=>{console.error(e.name+': '+String(e.message).replace(/https?:\/\/\S+/g,'[url]'));process.exitCode=1});
