#!/bin/zsh
# vg-backend-deploy.sh — deploy the Vidyagram backend (pm2 92) from the vg-backend worktree.
#
#   vg-backend-deploy.sh <label> [expected box commit]
#
# Pushes vidyagram-admin from ~/Projects/worktrees/vg-backend (tenant push guard runs), then on webserver2-2:
# refuses if the box checkout has tracked changes or is not on [expected box commit], tars dist to
# ~/vg-dist-backup-<stamp>-<label>.tar.gz, fast-forwards, restarts pm2 92 and prints its status.
# Undo: on the box, `tar xzf ~/vg-dist-backup-<stamp>-<label>.tar.gz` in the checkout, then `pm2 restart 92`.
set -euo pipefail

LABEL=${1:?usage: vg-backend-deploy.sh <label> [expected box commit]}
EXPECT=${2:-}
WT=~/Projects/worktrees/vg-backend
BOX=hranker@148.113.49.18
KEY=~/.ssh/hranker-webserver2-2
DIR=/var/www/backend.vidyagramar.com/vidyagram-backend

[[ $(git -C $WT branch --show-current) == vidyagram-admin ]] || { echo "worktree not on vidyagram-admin"; exit 1; }
git -C $WT push origin vidyagram-admin
TIP=$(git -C $WT rev-parse --short=8 HEAD)

ssh -i $KEY $BOX "LABEL='$LABEL' EXPECT='$EXPECT' TIP='$TIP' bash -s" <<'REMOTE'
set -euo pipefail
export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH
cd /var/www/backend.vidyagramar.com/vidyagram-backend
echo "box before: $(git log -1 --oneline)"
if [ -n "$(git status --short | grep -v '^??' || true)" ]; then echo "box has tracked changes; stopping"; exit 1; fi
if [ -n "$EXPECT" ] && [ "$(git rev-parse --short=8 HEAD)" != "${EXPECT:0:8}" ]; then echo "box is not on $EXPECT; stopping"; exit 1; fi
STAMP=$(date +%Y%m%d-%H%M)
tar czf ~/vg-dist-backup-$STAMP-$LABEL.tar.gz dist
echo "backup: ~/vg-dist-backup-$STAMP-$LABEL.tar.gz"
git pull --ff-only -q origin vidyagram-admin
echo "box after: $(git log -1 --oneline) (pushed tip $TIP)"
pm2 restart 92 --update-env >/dev/null
sleep 8
pm2 describe 92 | grep -E "status|restarts|uptime" | head -3
REMOTE
