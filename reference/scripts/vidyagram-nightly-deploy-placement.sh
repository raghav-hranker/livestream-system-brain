#!/usr/bin/env bash
# **Writes** GCP test-uday: puts the nightly placement step (feat/vg-nightly-placement) into the
# running Vidyagram nightly checkout. Copies only the src files changed since f79842940, so the
# deployed 250 ms pacing patch (apxCatalogHttpSource.ts) and the student tree stay as they are.
# Backs the old files up first; rollback = copy the backup dir back over the checkout.
#
#   reference/scripts/vidyagram-nightly-deploy-placement.sh [worktree] [commit]
set -euo pipefail
WT=${1:-$HOME/Projects/worktrees/vg-nightly-placement}
REF=${2:-7f9cfc649}
BASE=f79842940
APP=/home/raghav/vidyagram-nightly-20261019
GC=(--zone asia-south1-a --project genial-analogy-477417-r7)
STAMP=$(date -u +%Y%m%d-%H%M%S)

cd "$WT"
FILES=$(git diff --name-only "$BASE..$REF" -- src | grep -v '^src/tests/' | tr '\n' ' ')
TMP=$(mktemp -d)
for f in $FILES; do mkdir -p "$TMP/$(dirname "$f")"; git show "$REF:$f" > "$TMP/$f"; done
COPYFILE_DISABLE=1 tar -C "$TMP" -czf "$TMP.tgz" src
echo "files: $FILES"

gcloud compute scp "${GC[@]}" "$TMP.tgz" test-uday:/tmp/vg-placement-$STAMP.tgz
gcloud compute ssh "${GC[@]}" test-uday --command "set -e
cd $APP
if systemctl is-active --quiet vidyagram-nightly-gcp.service; then echo 'nightly is running; retry later'; exit 1; fi
B=/home/raghav/vidyagram-nightly-backup-$STAMP
mkdir -p \$B
for f in $FILES; do if [ -f \$f ]; then install -D \$f \$B/\$f; fi; done
cp REVISION \$B/REVISION
tar -xzf /tmp/vg-placement-$STAMP.tgz
echo '$BASE + serial-api-pacing-250ms-2026-10-19 + placement-$REF' > REVISION
export PATH=/home/raghav/.nvm/versions/node/v24.14.0/bin:\$PATH
node --require ts-node/register/transpile-only -e 'require(\"./src/services/apx/vidyagramNightlySteps\"); console.log(\"steps load ok\")'
echo deployed; cat REVISION; echo backup \$B"
rm -rf "$TMP" "$TMP.tgz"
