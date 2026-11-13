#!/usr/bin/env bash
# read-only: per live segment, seconds of frozen picture and of silence (ffmpeg freezedetect / silencedetect).
# A still picture or silent audio inside a stream that is otherwise delivered on time = the problem is in what the
# teacher's PC sent (camera/mic/capture froze), not in delivery. usage: seg_freeze_silence.sh <dir> <first> <last>
D=$1; for n in $(seq $2 $3); do f=$D/segment_$n.ts; [ -f $f ] || continue
  r=$(ffmpeg -hide_banner -nostats -i $f -vf freezedetect=n=-60dB:d=0.5 -af silencedetect=n=-50dB:d=0.5 -f null - 2>&1 |
      awk '/freeze_duration/{fz+=$NF} /silence_duration/{for(i=1;i<=NF;i++) if($i=="silence_duration:") sl+=$(i+1)}
           /freeze_start/{fs=1} /freeze_end/{fs=0} /silence_start/{ss=1} /silence_end/{ss=0}
           END{printf "%.1f %.1f %d %d", fz, sl, fs, ss}')
  echo "$(date -u -r $f +%H:%M:%S) $n $r"
done
