// Shared tenant-guarded local DB handle, via the explicit SSH tunnel.
const fs=require('fs');const root='/Users/raghav/Projects/worktrees/vg-backend';const {MongoClient,ObjectId,BSON}=require(root+'/node_modules/mongoose').mongo;
const env=require(root+'/node_modules/dotenv').parse(fs.readFileSync('/Users/raghav/Projects/worktrees/vg-class-import/.env.development'));
const m=env.MONGO_URI.match(/^(mongodb:\/\/)([^/]+)(\/[^?]*)?(?:\?(.*))?$/);if(!m||m[3]!=='/vidyagramdb')throw Error('TenantUriGuard');const p=new URLSearchParams(m[4]||'');p.set('directConnection','true');p.set('readPreference','primary');const uri=m[1]+m[2].slice(0,m[2].lastIndexOf('@')+1)+'127.0.0.1:27019/vidyagramdb?'+p;
module.exports={MongoClient,ObjectId,BSON,uri};
