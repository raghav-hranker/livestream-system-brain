#!/usr/bin/env bash
# read-only: for each new live segment, fetch it (1) normally via the CDN, like a viewer, and (2) with a cache-busting
# query so Cloudflare must fetch it from R2. Prints TTFB/total and cache status for both. usage: origin_probe.sh <base/> <rung> <seconds>
B=$1; q=$2; end=$(( $(date +%s) + $3 )); seen=""
while [ $(date +%s) -lt $end ]; do
  s=$(curl -s --compressed "$B$q/playlist.m3u8" | grep '\.ts$' | tail -1)
  if [ -n "$s" ] && [ "$s" != "$seen" ]; then seen=$s
    n=$(curl -s -o /dev/null -D /tmp/h1.$$ -w '%{http_code} %{time_starttransfer} %{time_total}' "$B$q/$s"); c1=$(grep -i '^cf-cache-status' /tmp/h1.$$ | awk '{print $2}' | tr -d '\r')
    m=$(curl -s -o /dev/null -D /tmp/h2.$$ -w '%{http_code} %{time_starttransfer} %{time_total}' "$B$q/$s?cb=$RANDOM$RANDOM"); c2=$(grep -i '^cf-cache-status' /tmp/h2.$$ | awk '{print $2}' | tr -d '\r')
    echo "$(date +%T) $s viewer: $n $c1 | forced-origin: $m $c2"
  fi; sleep 0.5
done; rm -f /tmp/h1.$$ /tmp/h2.$$
