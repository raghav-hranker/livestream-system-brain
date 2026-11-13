#!/usr/bin/env bash
# Point the demo backend (test-uday pm2 9 `quicktricks-backend`, serves quicktricks.multistreaming.site, demo-only)
# at the demo R2 buckets: images → hranker-server-demo, PDFs → hranker-private-assets-demo.
# Edits /home/raghav/quicktricks-backend/.env.development (the file pm2 9 loads first: pm2 sets no NODE_ENV),
# after a timestamped backup, then restarts pm2 9 and prints the boot lines (env file, DB, storage config).
# The key pair is read hidden here and sent over ssh stdin; it is never echoed, logged or passed as an argument.
#
# Before running: Cloudflare dashboard (Deepak account) → R2 → Manage API tokens → Create Account API token:
#   "Object Read & Write", specific buckets: hranker-server-demo, hranker-private-assets-demo; TTL forever.
# Rollback: cp the printed .bak file back over .env.development, then `pm2 restart quicktricks-backend`.
set -euo pipefail

SSH=(gcloud compute ssh --zone asia-south1-a test-uday --project genial-analogy-477417-r7)
R2_ENDPOINT="https://1ff6f2000c9aa34ca2ec88c066af092a.r2.cloudflarestorage.com"
PUBLIC_BASE="https://demo-assets.hranker.org"

read -r -s -p "R2 Access Key ID (backend demo token): " KEY_ID; echo
read -r -s -p "R2 Secret Access Key (backend demo token): " KEY_SECRET; echo
[ ${#KEY_ID} -ge 20 ] && [ ${#KEY_SECRET} -ge 40 ] || { echo "key lengths look wrong, nothing written"; exit 1; }

PAYLOAD=$(KEY_ID="$KEY_ID" KEY_SECRET="$KEY_SECRET" R2_ENDPOINT="$R2_ENDPOINT" PUBLIC_BASE="$PUBLIC_BASE" python3 -c '
import json, os
e = os.environ
print(json.dumps({
  # general uploads (config/s3Upload.ts): R2_BUCKET_NAME is read before B2_BUCKET_NAME
  "B2_ENDPOINT": e["R2_ENDPOINT"], "B2_REGION": "auto",
  "R2_BUCKET_NAME": "hranker-server-demo", "B2_BUCKET_NAME": "hranker-server-demo",
  "B2_PUBLIC_BASE_URL": e["PUBLIC_BASE"], "R2_PUBLIC_BASE_URL": e["PUBLIC_BASE"],
  "B2_ACCESS_KEY_ID": e["KEY_ID"], "B2_SECRET_ACCESS_KEY": e["KEY_SECRET"],
  # documents zone (config/documentStorage.ts): B2_S3_ENDPOINT is read before B2_ENDPOINT
  "B2_S3_ENDPOINT": e["R2_ENDPOINT"], "B2_DOCUMENTS_BUCKET": "hranker-private-assets-demo",
  # practice-batch public files + class thumbnails: otherwise default to hranker-server-v2 with the thumbnail key
  "THUMBNAIL_BUCKET_NAME": "hranker-server-demo", "THUMBNAIL_PUBLIC_BASE_URL": e["PUBLIC_BASE"],
  "THUMBNAIL_B2_ACCESS_KEY_ID": e["KEY_ID"], "THUMBNAIL_B2_SECRET_ACCESS_KEY": e["KEY_SECRET"],
}))')
unset KEY_ID KEY_SECRET

printf '%s' "$PAYLOAD" | "${SSH[@]}" --command '
set -e
cd /home/raghav/quicktricks-backend
BAK=.env.development.bak-demo-storage-$(date +%Y%m%d-%H%M%S)
cp -p .env.development "$BAK"
python3 -c "
import json, sys, re
vals = json.load(sys.stdin)
lines = open(\".env.development\").read().splitlines()
seen = set(); out = []
for ln in lines:
    m = re.match(r\"^([A-Z0-9_]+)=\", ln)
    if m and m.group(1) in vals:
        if m.group(1) in seen: continue
        out.append(m.group(1) + \"=\" + vals[m.group(1)]); seen.add(m.group(1))
    else:
        out.append(ln)
for k, v in vals.items():
    if k not in seen: out.append(k + \"=\" + v)
open(\".env.development\", \"w\").write(\"\\n\".join(out) + \"\\n\")
print(\"updated:\", \" \".join(sorted(seen)))
print(\"added:  \", \" \".join(sorted(set(vals) - seen)) or \"-\")
"
echo "backup: /home/raghav/quicktricks-backend/$BAK"
export PATH=$(ls -d ~/.nvm/versions/node/*/bin | tail -1):$PATH
pm2 restart quicktricks-backend >/dev/null && echo "pm2 quicktricks-backend restarted"
sleep 20
L=$(ls ~/.pm2/logs/quicktricks-backend-out.log)
tail -n 400 "$L" | grep -a -E "Loading environment variables from|MongoDB Connected|PracticeBatchUpload\] Storage config|Backblaze B2 env vars missing" | tail -5 | cut -c1-240
' 2>&1 | grep -v -i "^warning\|updating project ssh\|^$"
