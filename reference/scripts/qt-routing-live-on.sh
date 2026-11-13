#!/usr/bin/env bash
# Writes: routes Vi viewers of ended replays in the live bucket to the Bunny-over-R2 live zone. Running classes stay on
# Cloudflare until CDN_ROUTE_BUNNY_LIVE_STREAMS=true. Touches no other key. Needs a real terminal for the prompt:
#   ssh -t -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 "ZONE_HOST=https://<zone>.b-cdn.net; $(cat reference/scripts/qt-routing-live-on.sh)"
# Safe to run again. To undo, delete the BUNNY_ROUTED_LIVE_ lines from .env.development and restart pm2 27.
cd /var/www/backend.quicktricksbysahilsir.com/quicktricks-backend || exit 1
export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH
[[ ${ZONE_HOST:-} =~ ^https://[a-z0-9.-]+$ ]] || { echo 'ZONE_HOST must be the zone address, https://<zone>.b-cdn.net. Nothing changed.'; exit 1; }

for attempt in 1 2 3; do
  read -rsp 'Paste the NEW LIVE zone token key, then press Enter (nothing will show): ' NEW_KEY
  echo
  [[ $NEW_KEY =~ ^[0-9a-fA-F-]{36}$ ]] && break
  NEW_KEY=''
  echo 'That does not look like a Bunny token key. Try again.'
done
if [ -z "$NEW_KEY" ]; then
  echo 'Nothing changed.'
  exit 1
fi

cp .env.development ".env.development.bak-routing-live-$(date +%Y%m%d-%H%M%S)"
sed -i -E '/^BUNNY_ROUTED_LIVE_(CDN_BASE|SECURITY_KEY)=/d' .env.development
printf 'BUNNY_ROUTED_LIVE_CDN_BASE=%s\nBUNNY_ROUTED_LIVE_SECURITY_KEY=%s\n' "$ZONE_HOST" "$NEW_KEY" >> .env.development
unset NEW_KEY

count=$(grep -cE '^BUNNY_ROUTED_LIVE_(CDN_BASE|SECURITY_KEY)=.' .env.development)
if [ "$count" != 2 ]; then
  echo "Expected 2 settings, found $count. Not restarting."
  exit 1
fi
pm2 restart 27 2>&1 | grep -E '✓|rror'
echo 'DONE: replays are routed. Tell Claude.'
