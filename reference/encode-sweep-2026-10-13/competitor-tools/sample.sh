#!/bin/sh
# Usage: sh tools/sample.sh [extra yt-dlp args, e.g. --cookies cookies.txt]
# Captures yt-dlp -j per video, then fetches only the 360p/480p HLS media playlists (text).
D=/private/tmp/claude-501/-Users-raghav-Projects-system-brain/484a8a83-68a2-48d0-87e9-b55a5e059fd1/scratchpad/competitors
Y=/opt/homebrew/bin/yt-dlp
cd "$D" || exit 1
while IFS='|' read -r name id; do
  [ -f "$name.json" ] && [ -s "$name.json" ] && continue
  "$Y" --no-update "$@" -j --extractor-args "youtube:player_client=default,web_safari" \
    "https://www.youtube.com/watch?v=$id" > "$name.json" 2> "$name.err" || { echo "FAIL $name"; head -2 "$name.err"; }
  python3 -I tools/hls_urls.py "$name.json" | while read -r h url; do
    curl -s -m 20 "$url" > "${name}_${h}p.m3u8"
  done
  sleep 20
done <<'LIST'
pw|eQhOAHMankc
unacademy|7Gi1N0tCUgQ
adda247|rnKf1ZWgqV8
testbook|GCwyy3fQTms
vedantu|ab1S8q1iYvI
byjus|QaByisLKQY0
khan|_-vZ_g7K6P0
nptel|TcmGYe39XG0
mit_ocw|WRibE2nt8wM
rakesh_yadav_maths|3nGE-MTivr0
LIST
