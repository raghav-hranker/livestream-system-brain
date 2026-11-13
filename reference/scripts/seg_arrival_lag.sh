#!/usr/bin/env bash
# read-only: how late each live segment was finished on the encoder relative to the media inside it.
# lag = file write time - last video PTS (both seconds). The constant part is the stream's clock offset; rises in lag =
# the teacher's stream arriving late (their uplink) or the encoder falling behind. usage: seg_arrival_lag.sh <dir> <first> <last>
D=$1; for n in $(seq $2 $3); do f=$D/segment_$n.ts; [ -f $f ] || continue
  w=$(date -r $f +%s.%N); p=$(ffprobe -v error -select_streams v:0 -show_entries packet=pts_time -of csv=p=0 $f | grep -v '^$' | tail -1)
  awk -v t="$(date -u -r $f +%H:%M:%S)" -v n=$n -v w=$w -v p=$p 'BEGIN{printf "%s %s %.3f\n", t, n, w-p}'
done
