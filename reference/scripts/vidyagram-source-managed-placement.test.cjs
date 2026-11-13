const assert=require('node:assert/strict');const {planManagedPatch}=require('./vidyagram-source-managed-placement.cjs');
const initial={_id:'p',apxTitle:'Old',isFree:false,isActive:true,status:1,priority:5,updatedAt:'t'};
const managed={placementId:'p',lastApplied:{apxTitle:'Old',isFree:false,isActive:true,status:1,priority:5},syncDeactivated:false};
const run=(row,source,m=managed)=>planManagedPatch({row,source,managed:m,completeCapture:true,identityVerified:true});
let p=run(initial,{fields:{apxTitle:'New',isFree:true}});assert.deepEqual(p.patch,{apxTitle:'New',isFree:true});
// A second nightly source edit converges, but an operator's independently edited field survives.
let after={...initial,...p.patch};let adopted={...managed,lastApplied:p.nextBaseline};p=run({...after,apxTitle:'Admin custom'},{fields:{apxTitle:'Newest',isFree:false}},adopted);assert.deepEqual(p.patch,{isFree:false});assert.equal(p.held[0].reason,'operator divergence; preserve current value');
p=run(initial,{fields:{isActive:false,status:0}});assert.deepEqual(p.patch,{});assert.ok(p.held.some(h=>h.reason==='absence alone does not prove source disable'));
p=run(initial,{fields:{isActive:false,status:0},disableProven:true});assert.deepEqual(p.patch,{isActive:false,status:0});assert.equal(p.syncDeactivated,true);
let off={...initial,isActive:false,status:0};let offBaseline={...managed,lastApplied:{...managed.lastApplied,isActive:false,status:0},syncDeactivated:false};p=run(off,{fields:{isActive:true,status:1}},offBaseline);assert.deepEqual(p.patch,{});
p=run(off,{fields:{isActive:true,status:1}},{...offBaseline,syncDeactivated:true});assert.deepEqual(p.patch,{isActive:true,status:1});
p=run(initial,{fields:{title:'Forbidden',class:'Other',apxTitle:'New'}});assert.deepEqual(p.patch,{apxTitle:'New'});assert.equal(p.held.length,2);
p=planManagedPatch({row:initial,source:{fields:{apxTitle:'New'}},managed,completeCapture:false,identityVerified:true});assert.deepEqual(p.patch,{});
assert.deepEqual(run(initial,{fields:{apxTitle:'New'}},null).patch,{});console.log('PASS: source convergence, per-field operator preservation, guarded disable/reactivate, identity/capture/adoption gates');
