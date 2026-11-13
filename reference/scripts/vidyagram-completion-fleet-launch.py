# Vidyagram completion fleet launcher (from the 11-10 Codex kit /tmp/vg-nov10-pause-fleet.py).
# Modes: preflight | stage (copies the local pilot, request client and standby to every host's stage folder) | locks | verify | launch.
# Cohort from VG_COMPLETION_RUN (COHORTS below): 20261109 -> fleet800-cohort-20261109-standby (pilot b13320f8...),
# 20261112 -> fleet800-cohort-20261112 (pilot a4457ec3..., loops queue behind the 20261109 loops);
# 20261113 -> fleet800-cohort-20261113 (loops queue behind the 20261112 loops).
# launch starts, per host role, a STANDBY LOOP that queues behind <dir>/<role>.lock (held by any running worker):
#   g=600000; while standby.cjs <role> $g; do pilot worker <role>; g=0; sleep 5; done   (log <stage>/<role>-standby.log)
# standby.cjs waits for the run to be reopened (resume-next.cjs commit, by hand or by autoresume.cjs) and then runs the
# real OTP worker; when the worker exits at a stop it goes back to standby. Kill switch: pilot `stop` (operator_stopped).
# locks: the stage's own loop locks are free (no loop queued yet). verify: remote files match the local copies.
import concurrent.futures, json, pathlib, shlex, subprocess, sys
root=pathlib.Path('/Users/raghav/Projects/system-brain/reference/scripts')
azure='20.193.151.140 20.193.132.31 20.193.139.89 20.193.253.251 4.240.100.64 40.81.225.65 20.193.138.160 20.40.44.181 4.240.96.214 4.240.103.74 20.193.154.220 57.159.31.41'.split()
ssh=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ConnectTimeout=8']
hosts={}
for i,ip in enumerate(azure,1):
 name='migrator'+(str(i) if i>1 else '')
 d='/home/azureuser/vidyagram-completion-azure-20261103'
 hosts[name]=(ssh+['-i',str(pathlib.Path.home()/'.ssh/raghav'),'azureuser@'+ip],d,d+'/runtime',d+'/runtime/node/bin/node',ip)
for name, app, node in [('phonetics','nodejs-server','/usr/bin/node'),('testing-server-selectionway','arvidyagram-backend','/home/raghav/.nvm/versions/node/v24.12.0/bin/node')]:
 hosts[name]=(['gcloud','compute','ssh','--zone','asia-south2-c',name,'--project','genial-analogy-477417-r7','--quiet'],'/home/raghav/vidyagram-completion-horizontal-20261103','/home/raghav/'+app,node,'')
hosts['gpu']=(ssh+['-i',str(pathlib.Path.home()/'Documents/keys/mridulm'),'root@178.63.88.34'],'/root/vidyagram-completion-pilot-20261103','/root/video-transcoder/gpu-server/job-manager','/root/.nvm/versions/node/v24.20.0/bin/node','178.63.88.34')
# Cohort: VG_COMPLETION_RUN (default the 20261109 run). `after` = an earlier cohort's stage whose loop must end for good
# (run finished, operator_stopped, 36 h) before this cohort's loop takes the role lock; flock waiters are not FIFO.
import os
COHORTS={'vg-completion-20261109-next10000':{'stage':'fleet800-cohort-20261109-standby','after':None},
 'vg-completion-20261112-next10000':{'stage':'fleet800-cohort-20261112','after':'fleet800-cohort-20261109-standby'},
 'vg-completion-20261113-next10000':{'stage':'fleet800-cohort-20261113','after':'fleet800-cohort-20261112'}}
run=os.environ.get('VG_COMPLETION_RUN','vg-completion-20261109-next10000')
stage=COHORTS[run]['stage']
after=COHORTS[run]['after']
files={'vidyagram-completion-pilot.cjs':'vidyagram-completion-pilot.cjs','vidyagram-apx-request-client.cjs':'vidyagram-apx-request-client.cjs','vidyagram-completion-standby.cjs':'standby.cjs'}
import hashlib
fingerprints={remote:hashlib.sha256((root/local).read_bytes()).hexdigest() for local,remote in files.items()}
probe=r"""
const fs=require('node:fs'),os=require('node:os'),net=require('node:net');
const [root,egress,run]=process.argv.slice(2);
const dep=name=>require(require.resolve(name,{paths:[root]}));
const uri=dep('dotenv').parse(fs.readFileSync('.env.development')).MONGO_URI;
if(!/^mongodb(?:\+srv)?:\/\/[^/]+\/vidyagramdb(?:\?|$)/.test(uri)||!net.isIP(egress))process.exit(2);
const {MongoClient}=dep('mongodb'),c=new MongoClient(uri,{serverSelectionTimeoutMS:6500,readPreference:'primary'});
(async()=>{try{
 const db=c.db('vidyagramdb');
 const row=await db.collection('apx_vg_completion_pilots').findOne({_id:run},{projection:{stopped:1}});
 const gate=await db.collection('apx_vg_request_limits').findOne({_id:'ip:'+egress},{projection:{blocked:1,rateLimitedHold:1,cooldownUntil:1,penalty:1}});
 if(!row?.stopped||gate?.blocked||gate?.rateLimitedHold||gate?.cooldownUntil>new Date())process.exitCode=3;
 else console.log(JSON.stringify({hostname:os.hostname(),egress,penalty:gate?.penalty??1}));
}finally{await c.close()}})().catch(()=>{process.exitCode=4});
"""
mode=sys.argv[1]
targets=sys.argv[2:] or [name for name in hosts if name!='gpu']
def invoke(name,cmd,body=None):
 sshcmd=hosts[name][0]
 args=sshcmd+(['--command='+cmd] if sshcmd[0]=='gcloud' else [cmd])
 return subprocess.run(args,input=body,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30,text=True)
def run_host(name):
 _,d,app,node,ip=hosts[name]
 q=shlex.quote
 find_ip='ip='+q(ip) if ip else '''ip=$(curl -fsS --connect-timeout 3 --max-time 5 -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)'''
 prefix='set -eu; cd '+q(d)+'; umask 077; '+find_ip+'; '
 expected='Ubuntu-2404-noble-amd64-base' if name=='gpu' else name
 prefix+='test "$(hostname)" = '+q(expected)+'; '
 try:
  if mode=='preflight':
   cmd=prefix+'test -x '+q(node)+'; command -v flock >/dev/null; command -v timeout >/dev/null; '+q(node)+' - '+q(app)+' "$ip" '+q(run)
   result=invoke(name,cmd,probe)
   return {'host':name,'exit':result.returncode,**(json.loads(result.stdout.strip().splitlines()[-1]) if result.returncode==0 else {})}
  if mode=='stage':
   for local,remote in files.items():
    # node --check requires a recognized file extension, so the temp name keeps .cjs.
    cmd=prefix+'mkdir -p '+stage+'; cat > '+stage+'/new-'+remote+'; '+q(node)+' --check '+stage+'/new-'+remote+'; mv '+stage+'/new-'+remote+' '+stage+'/'+remote
    result=invoke(name,cmd,(root/local).read_text())
    if result.returncode:return {'host':name,'exit':result.returncode,'file':remote}
   result=invoke(name,prefix+'sha256sum '+stage+'/*.cjs')
   got={l.split()[1].split('/')[-1]:l.split()[0] for l in result.stdout.splitlines() if len(l.split())==2}
   return {'host':name,'exit':result.returncode,'match':all(got.get(f)==h for f,h in fingerprints.items())}
  if mode in ['launch','verify','locks']:
   roles=['acquire']+(['read'] if name in list(hosts)[:8] else [])
   verify='printf "%s\\n" '+' '.join(q(h+'  '+stage+'/'+f) for f,h in fingerprints.items())+' | sha256sum --status -c; '
   prefix+=verify
   if mode in ['verify','locks']:
    cmd=prefix+'test -x '+q(node)
    if mode=='locks':
     cmd+='; '+'; '.join('flock -n '+q(stage+'/worker-'+role+'.lock')+' true' for role in roles)
    result=invoke(name,cmd)
    return {'host':name,'exit':result.returncode}
   env='VG_APP_ROOT='+q(app)+' VG_ENV_PATH='+q(d+'/.env.development')+' VG_COMPLETION_RUN='+q(run)+' VG_EGRESS_ID="$ip" VG_LEARNER_GAP_MS=30000 VG_ADMIN_GAP_MS=1000 VG_REQUEST_GAP_MS=1500 VG_REQUEST_JITTER_MS=250'
   cmds=[]
   for role in roles:
    loop='g=600000; while '+q(node)+' '+stage+'/standby.cjs '+role+' $g; do '+q(node)+' '+stage+'/vidyagram-completion-pilot.cjs worker '+role+'; g=0; sleep 5; done'
    wait_after=('flock '+q(after+'/worker-'+role+'.lock')+' ') if after else ''
    cmds.append('nohup env '+env+' flock -n '+q(stage+'/worker-'+role+'.lock')+' '+wait_after+'flock '+q(d+'/'+role+'.lock')+' sh -c '+q(loop)+' >> '+stage+'/'+role+'-standby.log 2>&1 < /dev/null &')
   checks='; '.join('if ! flock -n '+q(stage+'/worker-'+role+'.lock')+' true; then n=$((n+1)); fi' for role in roles)
   cmd=prefix+' '.join(cmds)+' sleep 1; n=0; '+checks+'; printf "%s\\n" "$n"'
   result=invoke(name,cmd)
   return {'host':name,'exit':result.returncode,'expected':len(roles),'processes':int(result.stdout.strip().splitlines()[-1]) if result.returncode==0 else 0}
 except (subprocess.TimeoutExpired, OSError, ValueError, IndexError) as e:
  return {'host':name,'error':type(e).__name__}
with concurrent.futures.ThreadPoolExecutor(max_workers=15) as pool:
 results=list(pool.map(run_host,targets))
for result in results: print(json.dumps(result),flush=True)
