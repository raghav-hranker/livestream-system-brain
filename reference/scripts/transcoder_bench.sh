#!/usr/bin/env bash
# Benchmark the VOD 1A/1B pipeline on the GPU box (178.63.88.34): today's pipeline vs
# MP4-by-remux vs GPU decode+scale. Writes only under BENCH_DIR; touches no job, queue or bucket.
#
# BENCH_DIR must hold:
#   src.mp4          a real source (docker cp'd out of a running job container)
#   today-hls.args   that job's exact ffmpeg argv, one arg per line (/proc/<pid>/cmdline)
#
#   transcoder_bench.sh [cut-seconds]     # cut-seconds > 0 = smoke test on the first N seconds
#
# Phases (each timed: wall, user CPU, sys CPU — CPU seconds are what the box is short of):
#   A1  today's HLS pass (exact argv; CPU decode + CPU scale, NVENC)
#   A2  today's MP4 pass (container/ffmpeg.js: 4 parallel ffmpegs, each decodes the source)
#   B   MP4s by remuxing A1's HLS rungs (-c copy)
#   C1  HLS pass with NVDEC decode + scale_cuda (same argv otherwise; -pix_fmt dropped, NVENC takes nv12)
#   C2  MP4s by remuxing C1's rungs
# Then SSIM on the first 10 minutes, so a speed-up is not paid for in picture quality.
set -uo pipefail

B=${BENCH_DIR:-/root/transcode-bench}
IMAGE=${IMAGE:-video-processor:cf-20261021-hls1080}
CUT=${1:-0}
CRF=${CRF:-20}            # client 168's env
PRESET=${PRESET:-medium}  # client 168's env
RUN=$B/run-$(date +%Y%m%d-%H%M)$([ "$CUT" -gt 0 ] && echo "-smoke")
OUT=$RUN/results.txt
mkdir -p "$RUN"/{A/hls,A/mp4,B,C/hls,C/mp4,logs}

log() { echo "$*" | tee -a "$OUT"; }

# Run argv inside the job image with the GPU, bench dir mounted at /b. Prints "wall user sys".
# NVENC/NVDEC need the `video` driver capability (the manager asks for gpu+compute+video too).
dock() { docker run --rm --gpus all -e NVIDIA_DRIVER_CAPABILITIES=compute,utility,video -v "$B":/b --entrypoint bash "$IMAGE" -c "$1"; }
timed() {
  local name=$1 cmd=$2
  log "--- $name  load=$(cut -d' ' -f1-3 /proc/loadavg)  job-containers=$(docker ps --format '{{.Image}}' | grep -cvE 'apx-ingest|mediamtx')  nvenc=$(nvidia-smi --query-gpu=utilization.encoder --format=csv,noheader)"
  local t
  t=$(dock "TIMEFORMAT='%R %U %S'; time { ( $cmd ) 2>>/b/${RUN#$B/}/logs/$name.log; }" 2>&1 | tail -1)
  read -r wall user sys <<<"$t"
  log "$(printf '%-4s wall %8.1fs   cpu %8.1fs (user %.1f + sys %.1f)' "$name" "$wall" "$(awk "BEGIN{print $user+$sys}")" "$user" "$sys")"
}

SRC=/b/src.mp4
if [ "$CUT" -gt 0 ]; then
  dock "ffmpeg -v error -y -i /b/src.mp4 -t $CUT -c copy /b/${RUN#$B/}/src-cut.mp4"
  SRC=/b/${RUN#$B/}/src-cut.mp4
fi
R=/b/${RUN#$B/}   # run dir as seen inside the container

log "bench $(date -Is)  image=$IMAGE  crf=$CRF preset=$PRESET  cut=${CUT}s"
log "$(dock "ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact $SRC")"
log "host: $(nproc) threads, $(nvidia-smi --query-gpu=name --format=csv,noheader)"

# --- argv for A1 and C1, built from the captured job argv --------------------------------------
mapfile -t ARGS < <(tail -n +2 "$B/today-hls.args")   # drop argv[0]
q() { printf '%q ' "$@"; }
a1=(); c1=(); skip=0
for a in "${ARGS[@]}"; do
  case "$a" in
    /app/public/hls_output/*) a1+=("$R/A/hls/${a##*/}"); c=("$R/C/hls/${a##*/}") ;;
    /app/public/*)            a1+=("$SRC");              c=("$SRC") ;;
    *)                        a1+=("$a");                c=("${a//scale=/scale_cuda=}") ;;
  esac
  # C1: same argv, GPU decode in front of -i, scale -> scale_cuda, no -pix_fmt (frames stay on the GPU)
  if [ "$skip" = 1 ]; then skip=0; continue; fi
  if [ "$a" = "-pix_fmt" ]; then skip=1; continue; fi
  # One NVDEC decoder feeds 4 NVENC encoders that each hold frames; without spare surfaces it dies
  # with "No decoder surfaces left"; NVDEC caps the pool at 32 and h264 takes 25, so 7 is the most.
  if [ "$a" = "-i" ]; then c1+=(-hwaccel cuda -hwaccel_output_format cuda -extra_hw_frames "${EXTRA_HW_FRAMES:-7}"); fi
  c1+=("${c[@]}")
done

timed A1 "ffmpeg -y $(q "${a1[@]}") > /dev/null"

# A2: container/ffmpeg.js processMp4ToMp4Formats, four ffmpegs in parallel
mp4cmd() { # height bitrate maxrate bufsize
  echo "ffmpeg -y -i $SRC -vf scale=-2:$1,setsar=1 -r 30 -c:v h264_nvenc -preset $PRESET -rc:v vbr -cq:v $CRF -b:v $2 -maxrate:v $3 -bufsize:v $4 -gpu 0 -level:v auto -c:a aac -b:a 128k -movflags faststart -pix_fmt yuv420p -metadata compatible_brands=mp42 -f mp4 $R/A/mp4/$1p.mp4"
}
timed A2 "$(mp4cmd 240 400k 500k 800k) & $(mp4cmd 360 550k 600k 1100k) & $(mp4cmd 480 650k 850k 1300k) & $(mp4cmd 720 1100k 1300k 2200k) & wait"

remux() { # hls-dir mp4-dir
  local s=""
  for r in 240p 360p 480p 720p; do
    s+="ffmpeg -y -v error -i $1/$r.m3u8 -c copy -bsf:a aac_adtstoasc -movflags +faststart $2/$r.mp4 && "
  done
  echo "${s}true"
}
timed B "$(remux "$R/A/hls" "$R/B")"
timed C1 "ffmpeg -y $(q "${c1[@]}") > /dev/null"
timed C2 "$(remux "$R/C/hls" "$R/C/mp4")"

# --- outputs: sizes and durations ----------------------------------------------------------------
log ""
log "outputs (size MB, duration s):"
for f in A/mp4/240p.mp4 A/mp4/720p.mp4 B/240p.mp4 B/720p.mp4 C/mp4/360p.mp4 C/mp4/720p.mp4; do
  d=$(dock "ffprobe -v error -show_entries format=duration -of csv=p=0 $R/$f" 2>/dev/null)
  log "$(printf '  %-18s %8.1f MB  %s s' "$f" "$(du -m "$RUN/$f" 2>/dev/null | cut -f1)" "${d:-MISSING}")"
done
for d in A/hls C/hls; do log "  $d total $(du -sm "$RUN/$d" | cut -f1) MB, $(ls "$RUN/$d" | grep -c '\.ts$') segments"; done

# --- quality: SSIM vs the source (first 10 min) ----------------------------------------------
# dist is scaled back up to the source size so every row is judged against the same reference.
ssim() { # label dist
  local v
  v=$(dock "ffmpeg -v info -t 600 -i $2 -t 600 -i $SRC -lavfi \"[0:v]setpts=PTS-STARTPTS[d0];[1:v]setpts=PTS-STARTPTS[r];[d0][r]scale2ref=flags=bicubic[d][r2];[d][r2]ssim\" -f null - 2>&1" | grep -o 'All:[0-9.]*' | tail -1)
  log "$(printf '  %-34s %s' "$1" "${v:-FAILED}")"
}
log ""
log "SSIM vs source, first 10 min (1.0 = identical):"
ssim "today HLS 360p (CPU scale)" "$R/A/hls/360p.m3u8"
ssim "GPU   HLS 360p (scale_cuda)" "$R/C/hls/360p.m3u8"
ssim "today HLS 720p" "$R/A/hls/720p.m3u8"
ssim "GPU   HLS 720p" "$R/C/hls/720p.m3u8"
ssim "today MP4 720p (re-encode)" "$R/A/mp4/720p.mp4"
ssim "remux MP4 720p (= HLS 720p)" "$R/B/720p.mp4"
ssim "today MP4 240p (re-encode)" "$R/A/mp4/240p.mp4"
ssim "remux MP4 240p (= HLS 240p)" "$R/B/240p.mp4"

log ""
log "done $(date -Is)  logs: $RUN/logs"
