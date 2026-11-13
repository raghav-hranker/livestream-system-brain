#!/usr/bin/env bash
# Runs ON the GPU box (178.63.88.34) from a temp dir holding R1080_W1.mp4 / R1080_W2.mp4.
# Read-only for production: no deploy, no Redis, no job state. One NVENC encode at a time, inside the
# production container image so ffmpeg and its NVENC build match a real 1A job. Quicktricks' (472)
# job env: GPU_ACCELERATION=true, NVENC_PRESET=fast, HLS_SEGMENT_TIME=3.
set -euo pipefail
cd "$(dirname "$0")"
IMAGE=${IMAGE:-video-processor:latest}
# The RTX 4000 SFF Ada has unrestricted NVENC sessions (long-lived apx-ingest containers hold ~14), so the
# guard is how busy the encoder engines are, not how many sessions exist.
MAX_ENC_UTIL=${MAX_ENC_UTIL:-70}

echo "== GPU"
nvidia-smi --query-gpu=name,driver_version,memory.used,memory.total,utilization.gpu,encoder.stats.sessionCount --format=csv
nvidia-smi -q | grep -iE "Product (Name|Brand|Architecture)" || true
echo "== running containers"
docker ps --format '{{.Image}}  {{.Status}}' | sort | uniq -c
echo "== image ffmpeg"
docker run --rm --gpus all --entrypoint ffmpeg "$IMAGE" -hide_banner -version | head -1

wait_for_room() {
  while true; do
    util=$(nvidia-smi --query-gpu=utilization.encoder --format=csv,noheader,nounits | head -1 | tr -d ' ')
    [ "${util:-0}" -lt "$MAX_ENC_UTIL" ] && return
    echo "  encoder ${util}% busy (production jobs) — waiting 30 s"
    sleep 30
  done
}

encode() { # id window rate-args...
  local id=$1 w=$2; shift 2
  [ -s "enc/$id.mp4" ] && { echo "  skip $id (exists)"; return; }
  wait_for_room
  local t0=$SECONDS
  docker run --rm --gpus '"all","capabilities=compute,video,utility"' -v "$PWD:/w" -w /w --entrypoint ffmpeg "$IMAGE" -v error -y \
    -i "R1080_$w.mp4" -an -c:v h264_nvenc -preset fast -rc:v vbr "$@" -gpu 0 -level:v 4.2 -pix_fmt yuv420p \
    -sc_threshold 0 -g 90 -keyint_min 25 -force_key_frames 'expr:gte(t,n_forced*3)' "enc/$id.mp4"
  echo "  $id $((SECONDS - t0))s"
}

mkdir -p enc
echo "== encodes (round ${ROUND:-1})"
# The 1080p rung's own encoder options; the base rungs are never touched by these.
HQ=(-preset p6 -tune hq -bf 3 -b_ref_mode middle -rc-lookahead 32 -spatial_aq 1 -temporal_aq 1)
for w in W1 W2; do
  if [ "${ROUND:-1}" = 1 ]; then
    encode "${w}_N_1080p_abr2500" "$w" -b:v 2500k -maxrate 3250k -bufsize 5000k
    for cq in 27 29 31; do
      encode "${w}_N_1080p_cq${cq}" "$w" -cq:v "$cq" -b:v 0 -maxrate 2500k -bufsize 5000k
    done
  else
    for cq in 35 39; do
      encode "${w}_N_1080p_cq${cq}" "$w" -cq:v "$cq" -b:v 0 -maxrate 2500k -bufsize 5000k
    done
    encode "${w}_N_1080p_constqp29_nocap" "$w" -rc:v constqp -qp 29
    for cq in 29 33 37; do
      encode "${w}_N_1080p_hq_cq${cq}" "$w" "${HQ[@]}" -cq:v "$cq" -b:v 0 -maxrate 2500k -bufsize 5000k
    done
  fi
done
echo "== done"; ls -la enc
