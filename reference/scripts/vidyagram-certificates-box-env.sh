#!/usr/bin/env bash
# Adds the Vidyagram certificates settings to the Vidyagram backend env on webserver2-2 (certificates task 06).
# Asks for the R2 Access Key ID and Secret Access Key with hidden input and sends them to the box over ssh stdin,
# so they never appear in chat, on screen, in shell history or in a process list. Backs the env file up first,
# refuses if any CERTIFICATE_* line already exists, and restarts nothing. All three switches are written as false.
#
#   bash reference/scripts/vidyagram-certificates-box-env.sh
set -euo pipefail

HOST=hranker@148.113.49.18
SSH_KEY="$HOME/.ssh/hranker-webserver2-2"
DIR=/var/www/backend.vidyagramar.com/vidyagram-backend

read -r -s -p "R2 Access Key ID (hidden): " AKID; echo
read -r -s -p "R2 Secret Access Key (hidden): " SECRET; echo

# R2 S3 credentials are 32 and 64 lowercase hex characters; this catches a bad paste without showing it.
[[ "$AKID" =~ ^[0-9a-f]{32}$ ]] || { echo "Access Key ID doesn't look right (expected 32 hex characters). Nothing written."; exit 1; }
[[ "$SECRET" =~ ^[0-9a-f]{64}$ ]] || { echo "Secret Access Key doesn't look right (expected 64 hex characters). Nothing written."; exit 1; }

printf '%s\n' \
  "CERTIFICATE_R2_ENDPOINT=https://1ff6f2000c9aa34ca2ec88c066af092a.r2.cloudflarestorage.com" \
  "CERTIFICATE_R2_BUCKET=vidyagram-certificates" \
  "CERTIFICATE_R2_ACCESS_KEY_ID=$AKID" \
  "CERTIFICATE_R2_SECRET_ACCESS_KEY=$SECRET" \
  "CERTIFICATE_BASE_URL=https://vidyagram-certificates.hranker.org" \
  "CERTIFICATES_ENABLED=false" \
  "CERTIFICATE_CLAIMS_OPEN=false" \
  "CERTIFICATE_PUSH_ENABLED=false" |
ssh -i "$SSH_KEY" -o ConnectTimeout=15 "$HOST" "set -e; cd $DIR
  if grep -q '^CERTIFICATE' .env.development; then echo 'CERTIFICATE lines already present; nothing written.' >&2; exit 3; fi
  backup=.env.development.bak-\$(date +%Y%m%d-%H%M%S); cp -p .env.development \"\$backup\"
  [ -z \"\$(tail -c1 .env.development)\" ] || echo >> .env.development
  cat >> .env.development
  echo \"backup: $DIR/\$backup\"
  echo \"CERTIFICATE lines now: \$(grep -c '^CERTIFICATE' .env.development) (want 8)\"
  echo \"secret line filled: \$(grep -c '^CERTIFICATE_R2_SECRET_ACCESS_KEY=.' .env.development) (want 1)\""

unset AKID SECRET
echo "Done. Nothing was restarted."
