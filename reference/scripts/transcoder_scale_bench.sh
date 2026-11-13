#!/usr/bin/env bash
# Parallel-scaling test for the proposed VOD 1A/1B pipeline on the GPU box (178.63.88.34):
# NVDEC decode + scale_cuda HLS pass, then MP4s by remuxing the HLS rungs (phases C1+C2 of
# transcoder_bench.sh). Runs N copies at once for each N and reports where total throughput
# (video minutes finished per wall minute) stops rising. Writes only under BENCH_DIR.
#
# BENCH_DIR holds src.mp4 + today-hls.args (see transcoder_bench.sh).
#   transcoder_scale_bench.sh [cut-seconds] [levels...]     # default: full source, levels 1 4 6 8 10
# Each level waits (up to 20 min) for the box to have at most MAX_OTHER (default 1) other job containers, so the
# test does not pile onto real jobs, and records what else was running.
set -uo pipefail

B=${BENCH_DIR:-/root/transcode-bench}
IMAGE=${IMAGE:-video-processor:cf-20261021-hls1080}
CUT=${1:-0}; shift || true
LEVELS=${*:-1 4 6 8 10}
RUN=$B/scale-$(date +%Y%m%d-%H%M)$([ "$CUT" -gt 0 ] && echo "-smoke")
OUT=$RUN/results.txt
mkdir -p "$RUN"
R=/b/${RUN#$B/}
log() { echo "$*" | tee -a "$OUT"; }
dock() { docker run --rm --gpus all -e NVIDIA_DRIVER_CAPABILITIES=compute,utility,video -v "$B":/b --entrypoint bash "$IMAGE" -c "$1"; }
other_jobs() { docker ps --format '{{.Names}} {{.Image}}' | grep -v ' apx-ingest\| bluenviron/' | grep -vc '^scalebench-'; }

SRC=/b/src.mp4
if [ "$CUT" -gt 0 ]; then
  dock "ffmpeg -v error -y -i /b/src.mp4 -t $CUT -c copy $R/src-cut.mp4"
  SRC=$R/src-cut.mp4
fi
DUR=$(dock "ffprobe -v error -show_entries format=duration -of csv=p=0 $SRC")

# The C1 argv: the job's exact HLS argv with NVDEC in front of -i, scale -> scale_cuda,
# no -pix_fmt, and the 7 spare decode surfaces NVDEC needs to feed 4 encoders (max pool 32).
mapfile -t ARGS < <(tail -n +2 "$B/today-hls.args")
c1=(); skip=0
for a in "${ARGS[@]}"; do
  if [ "$skip" = 1 ]; then skip=0; continue; fi
  if [ "$a" = "-pix_fmt" ]; then skip=1; continue; fi
  case "$a" in
    /app/public/hls_output/*) c1+=("JOBDIR/hls/${a##*/}") ;;
    /app/public/*)            c1+=(-hwaccel cuda -hwaccel_output_format cuda -extra_hw_frames 7 -i "$SRC") ;;
    -i)                       ;;
    *)                        c1+=("${a//scale=/scale_cuda=}") ;;
  esac
done
C1=$(printf '%q ' ffmpeg -y "${c1[@]}")
REMUX=""
for r in 240p 360p 480p 720p; do
  REMUX+="ffmpeg -y -v error -i JOBDIR/hls/$r.m3u8 -c copy -bsf:a aac_adtstoasc -movflags +faststart JOBDIR/mp4/$r.mp4 && "
done
JOB="mkdir -p JOBDIR/hls JOBDIR/mp4 && $C1 > /dev/null && ${REMUX}true"

log "scale bench $(date -Is)  image=$IMAGE  source=${DUR}s  levels=$LEVELS"
log "host: $(nproc) threads, $(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader)"
log ""
log "  N  wall-s  video-min/wall-min  per-job-wall-s(min/avg/max)  per-job-cpu-s  cpu-idle%  nvenc%  nvdec%  gpu-mem-max-MiB  other-jobs  failed"

for N in $LEVELS; do
  L=$RUN/n$N; mkdir -p "$L"
  for _ in $(seq 40); do [ "$(other_jobs)" -le "${MAX_OTHER:-1}" ] && break; sleep 30; done
  others=$(other_jobs)

  # sample the box every 5 s while this level runs
  ( while [ ! -f "$L/.done" ]; do
      echo "$(mpstat 4 1 | awk '/Average/ {print $NF}') $(nvidia-smi --query-gpu=utilization.encoder,utilization.decoder,memory.used --format=csv,noheader,nounits | tr -d ' ' | tr , ' ')" >> "$L/samples"
      sleep 1
    done ) &
  sampler=$!

  t0=$(date +%s.%N)
  for i in $(seq "$N"); do
    jd=$R/n$N/job$i
    docker run --rm --name "scalebench-$N-$i" --gpus all -e NVIDIA_DRIVER_CAPABILITIES=compute,utility,video \
      -v "$B":/b --entrypoint bash "$IMAGE" \
      -c "TIMEFORMAT='%R %U %S'; time { ( ${JOB//JOBDIR/$jd} ) 2>$jd.log; }" > "$L/job$i.time" 2>&1 &
  done
  wait $(jobs -p | grep -v "^$sampler$")
  t1=$(date +%s.%N)
  touch "$L/.done"; wait "$sampler" 2>/dev/null

  # failed = no 720p MP4, short MP4, a decode error, or the GPU path not taken (silent CPU fallback)
  failed=0
  for i in $(seq "$N"); do
    d=$(dock "ffprobe -v error -show_entries format=duration -of csv=p=0 $R/n$N/job$i/mp4/720p.mp4" 2>/dev/null)
    if ! awk -v d="${d:-0}" -v s="$DUR" 'BEGIN{exit !(d > s - 1)}' \
       || grep -qiE 'surfaces left|conversion failed|error while' "$L/job$i.log" \
       || ! grep -q 'pix_fmt: cuda' "$L/job$i.log"; then failed=$((failed + 1)); fi
  done

  read -r wall tput < <(awk -v a="$t0" -v b="$t1" -v n="$N" -v s="$DUR" 'BEGIN{w=b-a; printf "%.0f %.1f\n", w, n*s/w}')
  jobstat=$(tail -qn1 "$L"/job*.time | awk '{w=$1; c=$2+$3; tw+=w; tc+=c; if(NR==1||w<mn)mn=w; if(w>mx)mx=w} END{printf "%.0f/%.0f/%.0f %.0f", mn, tw/NR, mx, tc/NR}')
  samp=$(awk '{i+=$1; e+=$2; d+=$3; if($4>m)m=$4} END{if(NR) printf "%.0f %.0f %.0f %.0f", i/NR, e/NR, d/NR, m; else print "- - - -"}' "$L/samples")
  read -r jw jc <<<"$jobstat"; read -r si se sd sm <<<"$samp"
  log "$(printf '%3s  %6s  %18s  %27s  %13s  %9s  %6s  %6s  %15s  %10s  %6s' "$N" "$wall" "$tput" "$jw" "$jc" "$si" "$se" "$sd" "$sm" "$others" "$failed")"

  # outputs are ~2.3 GB per job; keep the logs, drop the media
  rm -rf "$L"/job*/
  # a failure here (e.g. GPU memory or decoder limits) would only get worse at higher N and the
  # GPU is shared with live classes: stop rather than push further
  if [ "$failed" -gt 0 ]; then log "stopping: $failed of $N jobs failed at N=$N (see $L/job*.log)"; break; fi
done

log ""
log "video-min/wall-min = N x source length / wall time: the box's throughput at that parallelism."
log "done $(date -Is)"
