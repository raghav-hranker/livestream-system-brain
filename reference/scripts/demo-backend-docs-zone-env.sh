#!/usr/bin/env bash
# Point the demo backend's PDF reads (test-uday pm2 9 `quicktricks-backend`, demo-only) at the demo Bunny documents zone.
# Sets BUNNY_DOCUMENTS_CDN_BASE + BUNNY_DOCUMENTS_SECURITY_KEY in /home/raghav/quicktricks-backend/.env.development
# (backup first), restarts pm2 9, then signs one demo PDF on the box with the backend's own signer and prints only
# HTTP status codes: signed (expect 200 application/pdf) and unsigned (expect 403). No URL or key is printed.
#
# Before running (see reports/demoadmin-storage-isolation-2026-10-22.md, "PDF reads"):
#   - an R2 token with Object Read only on hranker-private-assets-demo, used by the Bunny zone's S3 origin auth
#   - a Bunny pull zone in front of that bucket, with Token Authentication on; its URL Token Authentication Key is asked for here
#
# Usage: demo-backend-docs-zone-env.sh <zone-base-url> [pdf-key-to-test]
#   zone-base-url   e.g. https://hranker-demo-docs.b-cdn.net
#   pdf-key-to-test defaults to the PDF uploaded on 2026-10-22 (Pdf 6ad9d483402a52d31d4e827a)
# Rollback: cp the printed .bak file back over .env.development, then `pm2 restart quicktricks-backend`.
set -euo pipefail

ZONE_BASE="${1:?zone base url, e.g. https://hranker-demo-docs.b-cdn.net}"
TEST_KEY="${2:-pdfs/dd3999863e335b459a9f384314890884760e334bee2dd66b.pdf}"
[[ "$ZONE_BASE" =~ ^https://[a-z0-9.-]+$ ]] || { echo "zone base must be https://host with no path"; exit 1; }
SSH=(gcloud compute ssh --zone asia-south1-a test-uday --project genial-analogy-477417-r7)

read -r -s -p "Bunny URL Token Authentication Key (demo zone): " ZONE_KEY; echo
[ ${#ZONE_KEY} -ge 20 ] || { echo "key looks too short, nothing written"; exit 1; }

PAYLOAD=$(ZONE_KEY="$ZONE_KEY" ZONE_BASE="$ZONE_BASE" python3 -c '
import json, os
print(json.dumps({"BUNNY_DOCUMENTS_CDN_BASE": os.environ["ZONE_BASE"], "BUNNY_DOCUMENTS_SECURITY_KEY": os.environ["ZONE_KEY"]}))')
unset ZONE_KEY

printf '%s' "$PAYLOAD" | "${SSH[@]}" --command "
set -e
cd /home/raghav/quicktricks-backend
BAK=.env.development.bak-demo-docs-zone-\$(date +%Y%m%d-%H%M%S)
cp -p .env.development \"\$BAK\"
python3 -c '
import json, sys, re
vals = json.load(sys.stdin)
out, seen = [], set()
for ln in open(\".env.development\").read().splitlines():
    m = re.match(r\"^([A-Z0-9_]+)=\", ln)
    if m and m.group(1) in vals:
        if m.group(1) in seen: continue
        out.append(m.group(1) + \"=\" + vals[m.group(1)]); seen.add(m.group(1))
    else:
        out.append(ln)
for k, v in vals.items():
    if k not in seen: out.append(k + \"=\" + v)
open(\".env.development\", \"w\").write(\"\\n\".join(out) + \"\\n\")
print(\"updated:\", \" \".join(sorted(seen)), \"| added:\", \" \".join(sorted(set(vals) - seen)) or \"-\")
'
echo \"backup: /home/raghav/quicktricks-backend/\$BAK\"
export PATH=\$(ls -d ~/.nvm/versions/node/*/bin | tail -1):\$PATH
pm2 restart quicktricks-backend >/dev/null && echo 'pm2 quicktricks-backend restarted'
TEST_KEY='$TEST_KEY' node -e '
require(\"dotenv\").config({ path: \".env.development\" });
const { signAssetUrl } = require(\"./dist/src/services/bunnyAssetSigner\");
const { loadVideoProtectionConfig } = require(\"./dist/src/config/videoProtection\");
const cfg = loadVideoProtectionConfig(process.env);
const asset = { bucket: \"documents\", key: process.env.TEST_KEY };
const { url } = signAssetUrl(asset, null, Math.floor(Date.now() / 1000) + 300, cfg, { kind: \"file\" });
const bare = cfg.buckets.documents.cdnBase + \"/\" + process.env.TEST_KEY;
(async () => {
  const s = await fetch(url); const b = Buffer.from(await s.arrayBuffer());
  console.log(\"signed:  \", s.status, s.headers.get(\"content-type\"), b.length, \"bytes, starts\", JSON.stringify(b.subarray(0, 5).toString()));
  const u = await fetch(bare);
  console.log(\"unsigned:\", u.status);
})().catch(e => { console.error(\"check failed:\", e.message); process.exit(1); });
'
" 2>&1 | grep -v -i "^warning\|updating project ssh\|^$"
