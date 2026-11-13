# usage: sim.sh <base-url-with-trailing-slash> <rung> <seconds>; follows the live playlist like a player
B=$1; q=$2; end=$(( $(date +%s) + $3 )); seen=""
while [ $(date +%s) -lt $end ]; do
  pl=$(curl -s --compressed -w '\n%{time_total}' "$B$q/playlist.m3u8"); pt=$(echo "$pl" | tail -1)
  s=$(echo "$pl" | grep '\.ts$' | tail -1); d=$(echo "$pl" | grep EXTINF | tail -1 | tr -d '#EXTINF:,')
  if [ "$s" != "$seen" ]; then seen=$s
    r=$(curl -s -o /dev/null -w '%{http_code} %{time_total} %{size_download}' "$B$q/$s")
    echo "$(date +%T) r$q $s dur=$d playlist=${pt}s seg: $r"
  fi; sleep 1
done
