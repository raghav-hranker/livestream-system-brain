'use strict';
function followGate(x){
 if(x.now>=x.cutoff)return 'expired';
 if(['halted','expired'].includes(x.nightState))return 'predecessor_failed';
 if(!x.predecessorFinished||x.nightState!=='finished')return 'waiting';
 if(x.badRequests||x.heldRoutes)return 'rate_or_access_review';
 if(x.activeWorkers||x.cooldownUntil>x.now)return 'waiting';
 if(!x.outcomes.length||x.outcomes.some(s=>!['captured','mapping_exception','auth_deferred'].includes(s.state)))return 'predecessor_incomplete';
 return 'ready';
}
module.exports={followGate};
