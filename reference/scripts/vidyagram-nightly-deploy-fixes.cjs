// Vidyagram nightly source overlay for the 10-27 failure fixes. Default --check is read-only.
// --apply, under the nightly's host lock and only while the service is idle, backs up each file
// and REVISION, then replaces exactly these files in the isolated nightly checkout on test-uday.
// No restart, no run. Every file must still match the deployed base (7f9cfc649) or its fix.
//   f80515ab5 apxCatalogClassCommit.ts  — duplicate-key Class failures (replaced Geometry videos)
//   c3c574f77 apxCatalogPdfImportRun.ts — clear PDFs still flagged encrypted
//   8aa7c4373 apxCatalogCapture.ts      — course 96 listing read in 250-row pages
// Restore: copy the files from the printed backup dir over src/services/apx/ and its REVISION.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const wt=path.resolve(__dirname,'../../.worktrees/vg-media-video-repair');
const BASE='7f9cfc649',TAG='nightly-fixes-8aa7c4373';
const names=['apxCatalogClassCommit.ts','apxCatalogPdfImportRun.ts','apxCatalogCapture.ts'];
const sha=(b)=>crypto.createHash('sha256').update(b).digest('hex');
const files=names.map((n)=>{const rel=`src/services/apx/${n}`;const now=fs.readFileSync(path.join(wt,rel));
const base=cp.execFileSync('git',['-C',wt,'show',`${BASE}:${rel}`]);return{n,rel,b64:now.toString('base64'),newSha:sha(now),baseSha:sha(base)};});
const mode=process.argv[2]||'--check';if(!['--check','--apply'].includes(mode))throw Error('mode');const apply=mode==='--apply';
const code=`import pathlib,hashlib,subprocess,datetime,base64,json,os,fcntl
root=pathlib.Path('/home/raghav/vidyagram-nightly-20261019')
files=json.loads(${JSON.stringify(JSON.stringify(files))})
lock=open('/home/raghav/vidyagram-nightly/run.lock','r')
fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
status=subprocess.check_output(['systemctl','show','vidyagram-nightly-gcp.service','--property=ActiveState','--value'],text=True).strip()
assert status not in ('active','activating','reloading'),'nightly running'
out={'apply':${apply?'True':'False'},'service':status,'revision':(root/'REVISION').read_text().strip(),'files':[]}
for f in files:
  cur=hashlib.sha256((root/f['rel']).read_bytes()).hexdigest()
  out['files'].append({'file':f['n'],'current':cur,'state':'base' if cur==f['baseSha'] else 'fixed' if cur==f['newSha'] else 'UNEXPECTED'})
assert all(x['state']!='UNEXPECTED' for x in out['files']),json.dumps(out)
if ${apply?'True':'False'} and any(x['state']=='base' for x in out['files']):
  stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
  backup=root/('nightly-fixes-backup-'+stamp); backup.mkdir(mode=0o700)
  rev=root/'REVISION'; (backup/'REVISION').write_bytes(rev.read_bytes())
  for f in files:
    p=root/f['rel']; (backup/f['n']).write_bytes(p.read_bytes())
    tmp=p.with_suffix('.ts.fixes-tmp'); tmp.write_bytes(base64.b64decode(f['b64'])); os.replace(tmp,p)
  if '${TAG}' not in rev.read_text(): rev.write_text(rev.read_text().strip()+' + ${TAG}\\n')
  out['backup']=str(backup)
  out['after']=[{'file':f['n'],'ok':hashlib.sha256((root/f['rel']).read_bytes()).hexdigest()==f['newSha']} for f in files]
  out['revisionAfter']=rev.read_text().strip()
print(json.dumps(out))
`;
const r=cp.spawnSync('gcloud',['compute','ssh','--zone','asia-south1-a','test-uday','--project','genial-analogy-477417-r7','--command','python3 -'],{input:code,encoding:'utf8',maxBuffer:64<<20});
if(r.status!==0){console.error('deploy_failed',r.status,(r.stderr||'').split('\n').filter((l)=>/Error|assert|UNEXPECTED|running/.test(l)).join('\n'));process.exitCode=1;}
else console.log(r.stdout.trim().split('\n').pop());
