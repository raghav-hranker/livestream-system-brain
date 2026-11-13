#!/usr/bin/env bash
# APX manual-completion OTP fleet (2026-09-29). Run from the Mac, repo root:
#   reference/scripts/apx-completion-fleet.sh webserver      # webserver2-2: update, clear pilot 429 rows, prewarm + importer
#   reference/scripts/apx-completion-fleet.sh oci <ip>       # an OCI box (bastion 92.4.88.60, clones once started)
#   reference/scripts/apx-completion-fleet.sh status         # progress across boxes
# Every prewarm sends REAL APX login OTPs (~60/h per outbound IP). Boxes share one
# queue through the unique apx_paid_completion_token_attempts ledger, so adding or
# stopping a box never needs re-sharding. Each box gets its own OTP cooldown key.
# Commits come from /private/tmp/qt-apx-completion-backfill (c1d0661ef).
set -euo pipefail

WORKTREE=/private/tmp/qt-apx-completion-backfill
BASE=829154444            # on origin/quicktricks-admin
WS="ssh -i $HOME/.ssh/hranker-webserver2-2 hranker@148.113.49.18"
OCI_OPTS="-o UserKnownHostsFile=$HOME/.ssh/known_hosts_oci_clone -i $HOME/.ssh/raghav"
PILOT_TOKEN_ID=6abb9a8cc27ac1b3e94a024e   # earliest token minted by the pilot
BUNDLE=$(mktemp -d)/apx-completion-fleet.bundle

case "${1:-}" in
webserver)
  git -C "$WORKTREE" bundle create "$BUNDLE" f5e571445..HEAD
  scp -i "$HOME/.ssh/hranker-webserver2-2" "$BUNDLE" hranker@148.113.49.18:/home/hranker/apx-manual-completion-paid/fleet.bundle
  $WS 'bash -s' <<'REMOTE'
set -euo pipefail
base=/home/hranker/apx-manual-completion-paid
export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:/usr/bin:/bin
export ENV_PATH=/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend/.env.development
cd "$base/paid-backend"
git pull -q --ff-only "$base/fleet.bundle" HEAD
git log --oneline -1
# The pilot's five "failed" rows were APX 429s; release them so they are retried.
DOTENV_CONFIG_PATH="$ENV_PATH" node -r dotenv/config -e '
  const m = require("mongoose");
  m.connect(process.env.MONGO_URI).then(async () => {
    const r = await m.connection.db.collection("apx_paid_completion_token_attempts")
      .deleteMany({ orgId: "8680775", status: "failed", apxUserId: { $in: ["682065","682044","682038","682036","682025"] } });
    console.log("released pilot 429 rows:", r.deletedCount); await m.disconnect();
  });'
logs=(--auth-failure-log="$base/cached-token-import.jsonl" --auth-failure-log="$base/local-full-import.jsonl"
      --auth-failure-log="$base/local-resumed-import.jsonl")
npm run --silent prewarm:apx-completion-paid -- "${logs[@]}" | grep '"event"'   # dry run, no OTP
screen -dmS apx-completion-prewarm bash -c "APX_OTP_RATE_LIMIT_KEY=apx-otp-rate-limit-cooldown-completion-webserver2-2 \
  npm run --silent prewarm:apx-completion-paid -- --send-real-otp --all --pause-ms=60000 ${logs[*]} >> $base/fleet-prewarm.jsonl 2>&1"
screen -dmS apx-completion-import bash -c "while true; do npm run --silent migrate:apx-manual-completion -- --all --commit \
  --delay-ms=500 --from-token-id=6abb9a8cc27ac1b3e94a024e >> $base/fleet-import.jsonl 2>&1; sleep 1200; done"
screen -ls
REMOTE
  ;;
oci)
  host=${2:?usage: oci <ip>}
  git -C "$WORKTREE" bundle create "$BUNDLE" "$BASE..HEAD"
  scp $OCI_OPTS "$BUNDLE" "opc@$host:/home/opc/apx-completion-fleet.bundle"
  ssh $OCI_OPTS "opc@$host" "HOST_TAG=${host//./-} bash -s" <<'REMOTE'
set -euo pipefail
repo=$HOME/quicktricks-backend
wt=$HOME/apx-completion-paid
export ENV_PATH=$repo/.env.local                     # used in place, never copied
export PATH=$(ls -d $HOME/.nvm/versions/node/*/bin 2>/dev/null | tail -1):$PATH
cd "$repo"
git fetch -q origin quicktricks-admin
if [[ ! -d $wt ]]; then
  git fetch -q "$HOME/apx-completion-fleet.bundle" HEAD:refs/heads/apx-completion-fleet
  git worktree add -q "$wt" apx-completion-fleet
  ln -s "$repo/node_modules" "$wt/node_modules"
else
  git -C "$wt" pull -q --ff-only "$HOME/apx-completion-fleet.bundle" HEAD
fi
cd "$wt"
git log --oneline -1
npx cross-env NODE_ENV=development ts-node src/scripts/apxPaidCompletionTokenPrewarm.ts --check-session | grep '"event"'   # no OTP
setsid nohup env APX_OTP_RATE_LIMIT_KEY="apx-otp-rate-limit-cooldown-completion-$HOST_TAG" \
  npx cross-env NODE_ENV=development ts-node src/scripts/apxPaidCompletionTokenPrewarm.ts \
  --send-real-otp --all --pause-ms=60000 >> "$HOME/apx-completion-prewarm.jsonl" 2>&1 < /dev/null &
echo "started prewarm pid $!  log ~/apx-completion-prewarm.jsonl"
REMOTE
  ;;
status)
  $WS 'hostname; ps -eo pid,ppid,etime,args | grep -E "apxPaidCompletionTokenPrewarm|apxManualCompletionMigration|apx-completion-supervisor" | grep -v grep || true'
  for host in 92.4.88.60 92.4.82.27; do
    ssh $OCI_OPTS "opc@$host" 'hostname; ps -eo pid,ppid,etime,args | grep -E "apxPaidCompletionTokenPrewarm|apxManualCompletionMigration|apx-completion-supervisor" | grep -v grep || true; tail -n 2 ~/apx-completion-prewarm.jsonl'
  done
  gcloud compute ssh test-uday --project genial-analogy-477417-r7 --zone asia-south1-a --quiet \
    --command='systemctl show apx-completion-prewarm-test-uday.service apx-completion-import-test-uday.service --property=Id,ActiveState,SubState,MainPID,NRestarts,UnitFileState; tail -n 3 /home/raghav/apx-completion-prewarm.jsonl; tail -n 3 /home/raghav/apx-completion-import.jsonl'
  ;;
*) sed -n 2,9p "$0"; exit 2 ;;
esac
