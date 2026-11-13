#!/usr/bin/env bash
# Wire the demoadmin.hranker.com admin (Vercel quicktricks-admin, branch 26-Support-Chat) to the demo R2 buckets.
# Branch-scoped Preview variables only: Production and every other Preview branch keep their values.
# The keys are read hidden from the terminal and piped to Vercel; they are never echoed or written to disk.
#
# Before running: Cloudflare dashboard (Deepak account) → R2 → Manage API tokens → Create Account API token:
#   permission "Object Read & Write", "Apply to specific buckets only": hranker-server-demo, tempvideos-demo; TTL forever.
# After running: redeploy the 26-Support-Chat branch so the new values take effect.
#
# Usage: demo-connect-vercel-storage.sh [public-assets-base-url]
#   public-assets-base-url  read host for hranker-server-demo; defaults to its custom domain https://demo-assets.hranker.org.
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$HOME/Projects/quicktricks-admin}"
BRANCH="26-Support-Chat"
R2_ENDPOINT="https://1ff6f2000c9aa34ca2ec88c066af092a.r2.cloudflarestorage.com/"
PUBLIC_BASE="${1:-https://demo-assets.hranker.org}" # R2 custom domain on hranker-server-demo (public read, demo content only)

cd "$PROJECT_DIR"
grep -q '"projectName":"quicktricks-admin"' .vercel/project.json || { echo "not linked to quicktricks-admin"; exit 1; }

read -r -s -p "R2 Access Key ID (demo token): " KEY_ID; echo
read -r -s -p "R2 Secret Access Key (demo token): " KEY_SECRET; echo
[ ${#KEY_ID} -ge 20 ] && [ ${#KEY_SECRET} -ge 40 ] || { echo "key lengths look wrong, nothing written"; exit 1; }

put() { # name value type
  printf '%s' "$2" | vercel env add "$1" preview --git-branch "$BRANCH" --type "$3" --force --non-interactive >/dev/null
  echo "set $1 (preview, $BRANCH, $3)"
}

# Class video intake (lib/video-storage.ts)
put R2_VIDEO_UPLOAD_ENDPOINT   "$R2_ENDPOINT"     config
put R2_VIDEO_UPLOAD_BUCKET     tempvideos-demo    config
put R2_VIDEO_UPLOAD_KEY_ID     "$KEY_ID"          secret
put R2_VIDEO_UPLOAD_KEY_SECRET "$KEY_SECRET"      secret

# Editor/feed/notice/avatar media and /api/uploads (lib/s3.ts chains)
put B2_ENDPOINT          "${R2_ENDPOINT%/}"   config
put B2_REGION            auto                 config
put B2_ACCESS_KEY_ID     "$KEY_ID"            secret
put B2_SECRET_ACCESS_KEY "$KEY_SECRET"        secret
put UPLOAD_BUCKET        tempvideos-demo      config # the "Processing videos" list; must differ from B2_BUCKET_NAME (lib/s3 PDF_BUCKET_REGION bug)
put B2_BUCKET_NAME       hranker-server-demo  config
put R2_BUCKET_NAME       hranker-server-demo  config
if [ -n "$PUBLIC_BASE" ]; then
  put B2_PUBLIC_BASE_URL "$PUBLIC_BASE" config
else
  echo "B2_PUBLIC_BASE_URL not set for $BRANCH: it inherits the production CDN host, so editor images upload but won't display"
fi

unset KEY_ID KEY_SECRET
echo; vercel env ls preview "$BRANCH" 2>/dev/null | grep -E "R2_|B2_|UPLOAD_BUCKET" || true
