// Pure source-managed placement reconciliation seam. No I/O or production mutation.
// Intended integration: run after capture/import under nightly lock, with explicit adoption baseline.
const {isDeepStrictEqual:equal}=require('node:util');
const allowed=new Set(['apxTitle','isFree','priority','section','topic','subTopic','sectionName','topicName','subTopicName','isActive','status']);
function planManagedPatch({row,source,managed,completeCapture,identityVerified}) {
  if(!completeCapture||!identityVerified)return {patch:{},held:[{reason:'incomplete source or asset/course identity not verified'}]};
  if(!managed||String(managed.placementId)!==String(row._id))return {patch:{},held:[{reason:'no reviewed adoption baseline'}]};
  const patch={},held=[],nextBaseline={...managed.lastApplied};
  for(const [field,value]of Object.entries(source.fields||{})) {
    if(!allowed.has(field)) {held.push({field,reason:'outside placement source field allowlist'});continue;}
    if(!Object.hasOwn(managed.lastApplied,field)) {held.push({field,reason:'field not adopted as source managed'});continue;}
    if(!equal(row[field],managed.lastApplied[field])) {held.push({field,reason:'operator divergence; preserve current value'});continue;}
    // Re-enabling is limited to rows deactivated by this reconciler, never arbitrary operator off rows.
    if((field==='isActive'&&value===true||field==='status'&&value===1)&&row.isActive===false&&!managed.syncDeactivated) {held.push({field,reason:'operator deactivation; no source-owned deactivation stamp'});continue;}
    if(!equal(row[field],value))patch[field]=value;
    nextBaseline[field]=value;
  }
  if((patch.isActive===false||patch.status===0)&&source.disableProven!==true){delete patch.isActive;delete patch.status;nextBaseline.isActive=managed.lastApplied.isActive;nextBaseline.status=managed.lastApplied.status;held.push({reason:'absence alone does not prove source disable'});}
  if(held.some(h=>h.field==='isActive'||h.field==='status')){delete patch.isActive;delete patch.status;nextBaseline.isActive=managed.lastApplied.isActive;nextBaseline.status=managed.lastApplied.status;}
  return {patch,held,nextBaseline,syncDeactivated:patch.isActive===false?true:patch.isActive===true?false:managed.syncDeactivated,cas:{_id:row._id,updatedAt:row.updatedAt,...Object.fromEntries(Object.keys(patch).map(k=>[k,row[k]]))}};
}
module.exports={planManagedPatch};
