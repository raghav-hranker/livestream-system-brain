// Single-file Vidyagram nightly overlay deploy. Default --check is read-only.
// --apply writes only the isolated nightly source + backup + REVISION; no restart or run.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const file=path.resolve(__dirname,'../../.worktrees/vg-media-video-repair/src/services/apx/apxCatalogClassCommit.ts');
const source=fs.readFileSync(file),sha=crypto.createHash('sha256').update(source).digest('hex');
const apply=process.argv[2]==='--apply';
if(process.argv[2]&&!['--check','--apply'].includes(process.argv[2]))throw Error('mode');
const code=`import pathlib,hashlib,subprocess,datetime,base64,json,os,fcntl
root=pathlib.Path('/home/raghav/vidyagram-nightly-20261019')
p=root/'src/services/apx/apxCatalogClassCommit.ts'
expected='8308086db7ff8b82632ac03e931804a0c8c1ef9099033745dd14d0bfa037dfbb'
new=base64.b64decode('${source.toString('base64')}')
current=hashlib.sha256(p.read_bytes()).hexdigest()
lock=open('/home/raghav/vidyagram-nightly/run.lock','r')
fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
status=subprocess.check_output(['systemctl','show','vidyagram-nightly-gcp.service','--property=ActiveState','--value'],text=True).strip()
assert status not in ('active','activating','reloading'),'nightly running'
assert current in (expected,'${sha}'),'source version changed'
result={'apply':${apply?'True':'False'},'oldSha256':current,'newSha256':'${sha}','service':status,'target':str(p)}
if ${apply?'True':'False'} and current!='${sha}':
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 backup=root/('video-repair-backup-'+stamp)
 backup.mkdir(mode=0o700)
 (backup/'apxCatalogClassCommit.ts').write_bytes(p.read_bytes())
 revision=root/'REVISION'
 (backup/'REVISION').write_bytes(revision.read_bytes())
 tmp=p.with_suffix('.ts.video-repair-tmp')
 tmp.write_bytes(new)
 os.replace(tmp,p)
 revision.write_text(revision.read_text().strip()+' + video-source-fallback-${sha.slice(0,12)}\\n')
 result['backup']=str(backup)
print(json.dumps(result))
`;
const remote="python3 - <<'PY'\n"+code+"\nPY";
const r=cp.spawnSync('gcloud',['compute','ssh','--zone','asia-south1-a','test-uday','--project','genial-analogy-477417-r7','--command',remote],{encoding:'utf8'});
if(r.status!==0){console.error('video_deploy_failed',r.status);process.exitCode=1;}else{
 const result=JSON.parse(r.stdout.trim());
 const out=path.resolve(__dirname,'../../vidyagram/reports/appx-sync-repair-2026-10-26/media-video');
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,apply?'deploy-result.json':'deploy-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
