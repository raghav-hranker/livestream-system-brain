'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {decision,CUTOFF}=require('./vidyagram-completion-overnight.cjs');
const now=CUTOFF-3600000;
const parent={status:'capture_complete_with_exceptions',finishedAt:new Date(now-1000),stopped:false,tokenFailures:3,expiresAt:new Date(CUTOFF)};
const next={status:'queued_overnight',stopped:true,expiresAt:new Date(CUTOFF)};
const healthy={completed:1200,blocks:0};
test('waits for predecessor and starts only a fully captured healthy continuation',()=>{
 assert.equal(decision({...parent,finishedAt:null,status:'running'},next,healthy,now),'wait');
 assert.equal(decision(parent,next,healthy,now),'start');
 assert.equal(decision(parent,{...next,status:'running',stopped:false},healthy,now),'start');
});
test('failure stops and incomplete reads never trigger another cohort',()=>{
 for(const bad of [{stopped:true},{tokenFailures:4},{status:'token_failures_stop'}])assert.equal(decision({...parent,...bad},next,healthy,now),'stop');
 assert.equal(decision(parent,next,{completed:1199,blocks:0},now),'stop');
 assert.equal(decision(parent,next,{completed:1200,blocks:1},now),'stop');
 assert.equal(decision(parent,{...next,status:'experiment_throttled'},healthy,now),'stop');
});
test('cutoff, extended expiry and completed continuation fail closed',()=>{
 assert.equal(decision(parent,next,healthy,CUTOFF),'stop');
 assert.equal(decision(parent,{...next,expiresAt:new Date(CUTOFF+1)},healthy,now),'stop');
 assert.equal(decision(parent,{...next,finishedAt:new Date(now)},healthy,now),'stop');
});

test('cohort preparation can finish in the background without disabling the healthy handoff',()=>{assert.equal(decision({...parent,finishedAt:null,status:'running'},null,healthy,now),'wait');assert.equal(decision({...parent,stopped:true},null,healthy,now),'stop');});
