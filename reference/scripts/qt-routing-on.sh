#!/usr/bin/env bash
# Writes: turns Vi routing to Bunny on for quicktricks recorded classes, after a Bunny token key rotation.
# Runs on webserver2-2, on a real terminal, because it asks for the key without showing it. From the Mac:
#   ssh -t -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 "$(cat reference/scripts/qt-routing-on.sh)"
# Safe to run again. To turn routing off, empty CDN_ROUTE_BUNNY_ASNS in .env.development and restart pm2 27.
cd /var/www/backend.quicktricksbysahilsir.com/quicktricks-backend || exit 1
export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH

for attempt in 1 2 3; do
  read -rsp 'Paste the NEW Bunny token key, then press Enter (nothing will show): ' NEW_KEY
  echo
  [[ $NEW_KEY =~ ^[0-9a-fA-F-]{36}$ ]] && break
  NEW_KEY=''
  echo 'That does not look like a Bunny token key. Try again.'
done
if [ -z "$NEW_KEY" ]; then
  echo 'Nothing changed.'
  exit 1
fi

cp .env.development ".env.development.bak-routing-$(date +%Y%m%d-%H%M%S)"
sed -i -E '/^(CDN_ROUTE_BUNNY_ASNS|ASN_MMDB_PATH|BUNNY_ROUTED_RECORDED_CDN_BASE|BUNNY_ROUTED_RECORDED_SECURITY_KEY)=/d' .env.development
sed -i "s|^BUNNY_RECORDED_SECURITY_KEY=.*|BUNNY_RECORDED_SECURITY_KEY=$NEW_KEY|" .env.development
printf 'CDN_ROUTE_BUNNY_ASNS=38266,45271,55410,55644\nASN_MMDB_PATH=/home/hranker/asn/ipinfo-asn.mmdb\nBUNNY_ROUTED_RECORDED_CDN_BASE=https://recordedvideos-hranker-v2.b-cdn.net\nBUNNY_ROUTED_RECORDED_SECURITY_KEY=%s\n' "$NEW_KEY" >> .env.development
unset NEW_KEY

count=$(grep -cE '^(BUNNY_RECORDED_SECURITY_KEY|CDN_ROUTE_BUNNY_ASNS|ASN_MMDB_PATH|BUNNY_ROUTED_RECORDED_CDN_BASE|BUNNY_ROUTED_RECORDED_SECURITY_KEY)=.' .env.development)
if [ "$count" != 5 ]; then
  echo "Expected 5 settings, found $count. Not restarting."
  exit 1
fi
pm2 restart 27 2>&1 | grep -E '✓|rror'
echo 'DONE: routing is on. Tell Claude.'
