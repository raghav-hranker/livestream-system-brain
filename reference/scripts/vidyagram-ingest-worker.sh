#!/usr/bin/env bash
# Vidyagram (customer 781) AppX video mirror worker on the OCI bastion.
# Runs from the Mac; ssh's to webserver2-2 (reads the Vidyagram backend env) and to the bastion (builds + runs docker).
# The 472 ingest container on the bastion is never touched.
#
#   vidyagram-ingest-worker.sh check        # backend env prerequisites + bastion docker state (prints presence only)
#   vidyagram-ingest-worker.sh build        # clone feat/client-781 on the bastion, build apx-ingest-781 image
#   [ADD_LEVELS=1080p] vidyagram-ingest-worker.sh start [N]    # wave 2 adds AppX's 1080p; (re)create container apx-ingest-781 with CONCURRENCY=N (default 1)
#   vidyagram-ingest-worker.sh start-on <host> [N]  # copy image+env from the bastion to another OCI box, run there (default N=10)
#   vidyagram-ingest-worker.sh status [M]   # queue totals + per-machine throughput over the last M minutes (default 30)
#   vidyagram-ingest-worker.sh logs         # last 80 log lines
#   vidyagram-ingest-worker.sh stop         # stop + remove apx-ingest-781 (jobs it held go back via /fail or stay claimed)
set -euo pipefail

WEB="ssh -i $HOME/.ssh/hranker-webserver2-2 hranker@148.113.49.18"
BASTION="ssh -i $HOME/.ssh/raghav opc@92.4.88.60"
VG_ENV=/var/www/backend.vidyagramar.com/vidyagram-backend/.env.development
REF=a75c030
IMAGE=apx-ingest-781:$REF
NAME=apx-ingest-781
DIR=/home/opc/vidyagram/video-transcoder
ENVFILE=/home/opc/vidyagram/apx-ingest-781.env

cmd=${1:-check}

case "$cmd" in
check)
  echo "== Vidyagram backend env (webserver2-2): which keys are set"
  $WEB "for k in TRANSCODER_WEBHOOK_SECRET BUNNY_RECORDED_CDN_BASE BUNNY_RECORDED_SECURITY_KEY RECORDED_CDN_PROVIDER; do if grep -q \"^\$k=.\" $VG_ENV; then echo \"  \$k: set\"; else echo \"  \$k: MISSING\"; fi; done"
  echo "== Backend reachable over HTTPS"
  curl -s --max-time 10 https://backend.vidyagramar.com/api/ ; echo
  echo "== Bastion docker"
  $BASTION "sudo docker ps --format '  {{.Names}}  {{.Image}}  {{.Status}}'; test -f /home/opc/apx-ingest-b2.env && echo '  472 B2 env present' || echo '  472 B2 env MISSING'"
  echo "== Storage keys: does the running 472 container use the same values as /home/opc/apx-ingest-b2.env? (hashes only)"
  $BASTION "for k in STORAGE_PROVIDER B2_KEY_ID B2_APPLICATION_KEY ACCESS_KEY_ID SECRET_ACCESS_KEY B2_REGION B2_S3_ENDPOINT STORAGE_ENDPOINT B2_BUCKET; do
      run=\$(sudo docker inspect apx-ingest --format '{{range .Config.Env}}{{println .}}{{end}}' | grep \"^\$k=\" | cut -d= -f2- | sha256sum | cut -c1-8)
      fil=\$(grep \"^\$k=\" /home/opc/apx-ingest-b2.env | cut -d= -f2- | sha256sum | cut -c1-8)
      empty=\$(printf '' | sha256sum | cut -c1-8)
      [ \"\$run\" = \"\$empty\" ] && [ \"\$fil\" = \"\$empty\" ] && continue
      if [ \"\$run\" = \"\$fil\" ]; then echo \"  \$k: same\"; else echo \"  \$k: DIFFERENT (container vs file)\"; fi
    done"
  ;;
build)
  # The bastion cannot clone the private repo, so the source ships from the Mac's worktree.
  git -C "$HOME/Projects/worktrees/vt-client-781" archive --format=tar $REF apx-ingest-container \
    | $BASTION "set -e; D=/home/opc/vidyagram/src-$REF; rm -rf \$D; mkdir -p \$D; tar -x -C \$D; cd \$D/apx-ingest-container && sudo docker build -q -t $IMAGE . && echo built $IMAGE"
  ;;
start)
  n=${2:-1}
  secret=$($WEB "grep '^TRANSCODER_WEBHOOK_SECRET=' $VG_ENV | head -1 | cut -d= -f2-")
  [ -n "$secret" ] || { echo "TRANSCODER_WEBHOOK_SECRET missing on the Vidyagram backend; run 'check'"; exit 1; }
  # Output goes to Vidyagram's own R2 bucket; its credentials live in system-brain/.env.development (never printed).
  VG_SECRETS="$(cd "$(dirname "$0")/../.." && pwd)/.env.development"
  r2=$(grep -E '^VIDYAGRAM_(R2_ENDPOINT|R2_ACCESS_KEY_ID|R2_SECRET_ACCESS_KEY|R2_BUCKET|RECORDED_CDN_HOST)=' "$VG_SECRETS" \
    | sed -e 's/^VIDYAGRAM_R2_ENDPOINT=/CF_BACKUP_ENDPOINT=/' -e 's/^VIDYAGRAM_R2_ACCESS_KEY_ID=/CF_BACKUP_ACCESS_KEY_ID=/' \
          -e 's/^VIDYAGRAM_R2_SECRET_ACCESS_KEY=/CF_BACKUP_SECRET_ACCESS_KEY=/' -e 's/^VIDYAGRAM_R2_BUCKET=/CF_BACKUP_BUCKET=/' \
          -e 's#^VIDYAGRAM_RECORDED_CDN_HOST=\(https://\)\{0,1\}#OUTPUT_PUBLIC_BASE=https://#')
  [ "$(printf '%s\n' "$r2" | grep -c .)" = 5 ] || { echo "Vidyagram R2 settings incomplete in $VG_SECRETS"; exit 1; }
  { printf '%s\n' "$secret"; printf '%s\n' "$r2"; } | $BASTION "set -e; read -r S; umask 077; mkdir -p /home/opc/vidyagram
    {
      echo STORAGE_PROVIDER=r2
      echo LMS_BASE=https://backend.vidyagramar.com
      echo API_URL=https://backend.vidyagramar.com/api
      echo CLIENT_ID=781
      echo MIRROR_CLIENTS=781
      echo MIRROR_REPORTING=secured
      echo MIRROR_MP4=off
      ${ADD_LEVELS:+echo MIRROR_ADD_LEVELS=$ADD_LEVELS}
      echo TRANSCODER_SECRET=\$S
      echo CONCURRENCY=$n
      cat
    } > $ENVFILE
    sudo docker rm -f $NAME >/dev/null 2>&1 || true
    sudo docker run -d --name $NAME --restart unless-stopped --env-file $ENVFILE $IMAGE >/dev/null
    echo started $NAME with CONCURRENCY=$n"
  ;;
status)
  m=${2:-30}
  echo "== Queue (vidyagramdb.apxingestjobs)"
  $WEB 'export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH; cd /var/www/backend.vidyagramar.com/vidyagram-backend && node -r dotenv/config -e "
    const m=require(\"mongoose\");(async()=>{await m.connect(process.env.MONGO_URI,{dbName:\"vidyagramdb\",readPreference:\"primary\"});const c=m.connection.db.collection(\"apxingestjobs\");
    const r=Object.fromEntries((await c.aggregate([{\$group:{_id:\"\$status\",n:{\$sum:1}}}]).toArray()).map(x=>[x._id,x.n]));const total=Object.values(r).reduce((a,b)=>a+b,0);
    const stuck=await c.countDocuments({status:{\$in:[\"claimed\",\"downloading\"]},updatedAt:{\$lt:new Date(Date.now()-3600000)}});
    console.log(\"  done\",r.done||0,\"of\",total,\"(\"+Math.round(100*(r.done||0)/total)+\"%)  waiting\",(r.pending||0)+(r.failed||0),\" in progress\",(r.claimed||0)+(r.downloading||0),\" gone from AppX\",r.dead||0,\" stuck >1h\",stuck);
    await m.disconnect()})()" dotenv_config_path=.env.development'
  echo "== Machines, last $m min"
  ssh -A -i "$HOME/.ssh/raghav" -o ConnectTimeout=10 opc@92.4.88.60 "for h in local 140.245.9.165 92.4.82.27; do
      if [ \$h = local ]; then L=\$(sudo docker logs --since ${m}m $NAME 2>&1); U=\$(sudo docker ps --format '{{.Status}}' --filter name=$NAME);
      else L=\$(ssh -o BatchMode=yes opc@\$h 'sudo docker logs --since ${m}m $NAME 2>&1'); U=\$(ssh -o BatchMode=yes opc@\$h \"sudo docker ps --format '{{.Status}}' --filter name=$NAME\"); fi
      echo \"\$L\" | awk -v h=\$h -v u=\"\$U\" -v m=$m '/mirror .* complete:/ {n++; for(i=1;i<=NF;i++) if(\$(i+1)==\"MB\") mb+=\$i} /mirror failed/ {f++} END {printf \"  %-14s %-12s %4d classes  %6.1f GB  %5.1f MB/s  %3d failed\n\", h, (u==\"\"?\"NOT RUNNING\":u), n, mb/1000, mb/(m*60), f}'
    done"
  ;;
start-on)
  # Copy the built image + env from the bastion to another OCI box (e.g. 10.0.0.34 / 140.245.9.165, 92.4.82.27)
  # and run apx-ingest-781 there. Needs `start` to have run once on the bastion (it writes the env file) and the
  # key in the local agent: `ssh-add ~/.ssh/raghav`. The copy goes bastion -> host, not through the Mac.
  host=${2:?usage: start-on <host> [N]}
  n=${3:-10}
  ssh -A -i "$HOME/.ssh/raghav" opc@92.4.88.60 "set -e
    H=opc@$host; O='-o StrictHostKeyChecking=accept-new'
    ssh \$O \$H 'sudo systemctl is-active --quiet docker || sudo systemctl enable --now docker; mkdir -p /home/opc/vidyagram'
    if ! ssh \$O \$H 'sudo docker image inspect $IMAGE >/dev/null 2>&1'; then
      sudo docker save $IMAGE | gzip -1 | ssh \$O \$H 'gunzip | sudo docker load'
    fi
    sed 's/^CONCURRENCY=.*/CONCURRENCY=$n/' $ENVFILE | ssh \$O \$H 'umask 077; cat > $ENVFILE'
    ssh \$O \$H 'sudo docker rm -f $NAME >/dev/null 2>&1 || true; sudo docker run -d --name $NAME --restart unless-stopped --env-file $ENVFILE $IMAGE >/dev/null; echo started $NAME on \$(hostname) with CONCURRENCY=$n'"
  ;;
logs)
  $BASTION "sudo docker logs --tail 80 $NAME 2>&1"
  ;;
stop)
  $BASTION "sudo docker rm -f $NAME && echo removed $NAME"
  ;;
*)
  echo "usage: $0 check|build|start [N]|start-on <host> [N]|logs|stop"; exit 2;;
esac
