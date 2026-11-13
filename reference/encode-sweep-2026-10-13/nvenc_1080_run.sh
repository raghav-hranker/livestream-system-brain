#!/usr/bin/env bash
# Run from the Mac: cuts the two 1080p windows, ships them to the GPU box, runs nvenc_1080_box.sh there,
# pulls the encodes back and scores them (score_nvenc_1080.py). Rerunnable; finished encodes are skipped.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BOX=root@178.63.88.34
KEY=~/Documents/keys/mridulm
REMOTE=/tmp/nvenc-1080-sweep
SRC=/Users/raghav/Downloads/Mains_4_1080P_HD_.mp4
OUT="$HERE/1080/nvenc"
mkdir -p "$OUT/enc"

for w in W1:3960 W2:3600; do
  name=${w%%:*}; ss=${w##*:}
  [ -s "$OUT/R1080_$name.mp4" ] || /opt/homebrew/bin/ffmpeg -v error -y -ss "$ss" -t 60 -i "$SRC" -an \
    -c:v libx264 -crf 10 -preset veryfast -pix_fmt yuv420p "$OUT/R1080_$name.mp4"
done

ssh -i "$KEY" "$BOX" "mkdir -p $REMOTE"
scp -i "$KEY" "$OUT/R1080_W1.mp4" "$OUT/R1080_W2.mp4" "$HERE/nvenc_1080_box.sh" "$BOX:$REMOTE/"
ssh -i "$KEY" "$BOX" "ROUND=${ROUND:-1} bash $REMOTE/nvenc_1080_box.sh" | tee "$OUT/box_round${ROUND:-1}.log"
scp -i "$KEY" "$BOX:$REMOTE/enc/*.mp4" "$OUT/enc/"
ssh -i "$KEY" "$BOX" "rm -rf $REMOTE"
python3 -I "$HERE/score_nvenc_1080.py"
