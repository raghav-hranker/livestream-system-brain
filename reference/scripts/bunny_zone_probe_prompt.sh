#!/usr/bin/env bash
# Read-only, from the Mac, on a real terminal: asks for a zone's token key without showing it, then runs
# bunny_r2_zone_probe.cjs, so the key never reaches a command line or the chat.
# usage: bunny_zone_probe_prompt.sh <live|recorded> https://<zone>.b-cdn.net <classId>...
set -u
zone=$1; host=$2; shift 2
read -rsp "Paste the $zone zone token key, then press Enter (nothing will show): " key
echo
if [ "$zone" = live ]; then
  PROBE_ZONE=live BUNNY_ROUTED_LIVE_CDN_BASE="$host" BUNNY_ROUTED_LIVE_SECURITY_KEY="$key" node "$(dirname "$0")/bunny_r2_zone_probe.cjs" "$@"
else
  BUNNY_ROUTED_RECORDED_CDN_BASE="$host" BUNNY_ROUTED_RECORDED_SECURITY_KEY="$key" node "$(dirname "$0")/bunny_r2_zone_probe.cjs" "$@"
fi
