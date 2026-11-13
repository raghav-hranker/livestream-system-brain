#!/usr/bin/env bash
# Vidyagram nightly on test-uday: new placements take the date from their AppX row (edc9fdf66).
# The box's importer differs from the fix branch (course-pdfs exports, no video swap), so this applies only the fix's
# diff to the file on the box. --check (default) reads and patches a local copy. --apply takes the nightly's lock,
# refuses if it is running or the file changed, backs up the file and REVISION, replaces the file, and test-loads it.
# No restart, no run. Undo: copy the file and REVISION back from the printed backup dir.
set -euo pipefail

MODE="${1:---check}"
[[ "$MODE" == "--check" || "$MODE" == "--apply" ]] || { echo "usage: $0 [--check|--apply]"; exit 2; }

WORKTREE="$HOME/Projects/worktrees/vg-apx-placement-dates"
BASE=2010d3365
FIX=edc9fdf66
FILE=src/services/apx/apxCatalogCourseImport.ts
ROOT=/home/raghav/vidyagram-nightly-20261019
INCOMING=/home/raghav/apxCatalogCourseImport.placement-dates.ts
EXPECTED_OLD=125092bb48de54a9
GCP=(--zone asia-south1-a --project genial-analogy-477417-r7 --quiet)

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

gcloud compute ssh "${GCP[@]}" test-uday --command "cat $ROOT/$FILE" 2>/dev/null > "$WORK/import.ts"
OLD_SHA=$(shasum -a 256 "$WORK/import.ts" | cut -c1-16)
[[ "$OLD_SHA" == "$EXPECTED_OLD" ]] || { echo "box file is $OLD_SHA, expected $EXPECTED_OLD: stop and look"; exit 1; }

git -C "$WORKTREE" diff "$BASE" "$FIX" -- "$FILE" > "$WORK/fix.patch"
cp "$WORK/import.ts" "$WORK/old.ts"
patch -s "$WORK/import.ts" < "$WORK/fix.patch"
NEW_SHA=$(shasum -a 256 "$WORK/import.ts" | cut -d' ' -f1)
echo "patched cleanly: $(diff "$WORK/old.ts" "$WORK/import.ts" | grep -c '^>') lines added, $(diff "$WORK/old.ts" "$WORK/import.ts" | grep -c '^<') removed"
echo "new file sha ${NEW_SHA:0:16}"

if [[ "$MODE" == "--check" ]]; then
  echo "check only, nothing changed on the box"
  exit 0
fi

gcloud compute scp "${GCP[@]}" "$WORK/import.ts" "test-uday:$INCOMING" >/dev/null 2>&1
gcloud compute ssh "${GCP[@]}" test-uday --command "set -e
exec 9</home/raghav/vidyagram-nightly/run.lock
flock -n 9
STATE=\$(systemctl show vidyagram-nightly-gcp.service --property=ActiveState --value)
if [ \"\$STATE\" = active ] || [ \"\$STATE\" = activating ]; then echo 'nightly is running: stop'; exit 1; fi
[ \"\$(sha256sum $INCOMING | cut -d' ' -f1)\" = $NEW_SHA ]
[ \"\$(sha256sum $ROOT/$FILE | cut -c1-16)\" = $EXPECTED_OLD ]
BACKUP=/home/raghav/vidyagram-nightly-backup-\$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p \$BACKUP
cp $ROOT/$FILE $ROOT/REVISION \$BACKUP/
cp $INCOMING $ROOT/$FILE
rm $INCOMING
printf '%s + placement-dates-$FIX\n' \"\$(cat \$BACKUP/REVISION)\" > $ROOT/REVISION
echo backup \$BACKUP
cat $ROOT/REVISION
export PATH=\$(ls -d ~/.nvm/versions/node/*/bin 2>/dev/null | tail -1):\$PATH
cd $ROOT
node --require ts-node/register/transpile-only -e \"const m=require('./src/services/apx/apxCatalogCourseImport');console.log('loads, runCourseImport:',typeof m.runCourseImport);process.exit(0)\""
