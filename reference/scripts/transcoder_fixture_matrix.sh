#!/usr/bin/env bash
# Task 06 of gpu-decode-mp4-remux: run the new 1A/1B image against a fixture matrix on
# the GPU box (178.63.88.34), using the image's own code via transcoder_fixture_harness.js.
# Writes only under BENCH_DIR; touches no job, queue, bucket or LMS.
#
#   transcoder_fixture_matrix.sh [clip-seconds]     # default 300; 20 = smoke test
#
# BENCH_DIR (default /root/transcode-bench) holds src.mp4 (a real 168 upload, 720p30
# H.264) and transcoder_fixture_harness.js. Fixtures are cut/derived from src.mp4.
# Each case waits (up to 20 min) for at most MAX_OTHER (default 1) other job containers.
set -uo pipefail

B=${BENCH_DIR:-/root/transcode-bench}
NEW=${NEW_IMAGE:-video-processor:cf-20261029-gpudecode}
CLIP=${1:-300}
RUN=$B/fixtures-$(date +%Y%m%d-%H%M)$([ "$CLIP" -lt 60 ] && echo "-smoke")
OUT=$RUN/results.txt
mkdir -p "$RUN/src"
log() { echo "$*" | tee -a "$OUT"; }
GPU=(--gpus all -e NVIDIA_DRIVER_CAPABILITIES=compute,utility,video)
other_jobs() { docker ps --format '{{.Names}} {{.Image}}' | grep -v ' apx-ingest\| bluenviron/' | grep -vc '^fixture-'; }
ff() { docker run --rm -v "$RUN/src":/f -v "$B":/b --entrypoint ffmpeg "$NEW" -v error -y "$@"; }

# --- fixtures, derived from the real 168 upload -------------------------------------------
log "fixture matrix $(date -Is)  image=$NEW  clip=${CLIP}s"
ff -i /b/src.mp4 -t "$CLIP" -c copy /f/f720.mp4
ff -i /f/f720.mp4 -vf scale=1920:1080 -c:v libx264 -preset veryfast -crf 20 -c:a copy /f/f1080.mp4
# phone: a landscape 1080p frame tagged rotate=90, so it plays as a 1080x1920 portrait clip
ff -i /f/f1080.mp4 -c copy -metadata:s:v:0 rotate=90 /f/fphone.mp4
ff -i /f/f720.mp4 -r 25 -c:v libx264 -preset veryfast -crf 20 -c:a copy /f/f25.mp4
ff -i /f/f720.mp4 -an -c:v copy /f/fnoaudio.mp4
ff -i /f/f720.mp4 -c:v libx265 -preset ultrafast -pix_fmt yuv420p10le -c:a copy /f/f10bit.mp4 \
  || log "note: libx265 10-bit fixture could not be made"
ff -i /f/f720.mp4 -c:v libx264 -preset veryfast -pix_fmt yuv422p -c:a copy /f/f422.mp4
# the whole real upload, for one full-length run of the new path (FULL=0 skips it)
[ "${FULL:-1}" = 1 ] && [ "$CLIP" -ge 60 ] && cp "$B/src.mp4" "$RUN/src/ffull.mp4" \
  && ff -i /b/src.mp4 -vf scale=1920:1080 -c:v libx264 -preset veryfast -crf 20 -c:a copy /f/ffull1080.mp4
log "$(ls -la "$RUN/src" | awk 'NR>1 {printf "%s %.1fMB  ", $9, $5/1048576}')"

# --- cases ----------------------------------------------------------------------------------
# name | fixture | expected hls path | env (168-like unless set)
BASE168="-e GPU_ACCELERATION=true -e NVENC_PRESET=medium -e CRF=20 -e USE_DYNAMIC_SCALE=true"
ON="-e GPU_DECODE=true -e MP4_FROM_HLS=true"
CASES=(
  "baseline-720|f720|cpu (switches off: today)|$BASE168"
  "new-720|f720|gpu|$BASE168 $ON"
  "new-full-50min|ffull|gpu|$BASE168 $ON"
  "new-1080|f1080|gpu|$BASE168 $ON"
  "new-phone|fphone|cpu (ineligible: rotated)|$BASE168 $ON"
  "new-25fps|f25|gpu|$BASE168 $ON"
  "new-noaudio|fnoaudio|gpu (video-only HLS, task 11)|$BASE168 $ON"
  "new-10bit|f10bit|cpu (ineligible)|$BASE168 $ON"
  "new-422|f422|cpu (ineligible)|$BASE168 $ON"
  "new-fixedWxH|f720|gpu|-e GPU_ACCELERATION=true -e NVENC_PRESET=fast -e CRF=23 $ON"
  "new-1080-5rungs|f1080|cpu (ineligible: 5 outputs)|$BASE168 $ON -e HLS_MAX_HEIGHT=1080"
  "probe-5rungs-forced|f1080|record only|$BASE168 -e HLS_MAX_HEIGHT=1080 -e FORCE_GPU_DECODE=true"
  "probe-5rungs-forced-full|ffull1080|record only|$BASE168 -e HLS_MAX_HEIGHT=1080 -e FORCE_GPU_DECODE=true"
)

log ""
for c in "${CASES[@]}"; do
  IFS='|' read -r name fix expect envs <<<"$c"
  [ -f "$RUN/src/$fix.mp4" ] || { log "$name: SKIPPED (no fixture $fix)"; continue; }
  for _ in $(seq 40); do [ "$(other_jobs)" -le "${MAX_OTHER:-1}" ] && break; sleep 30; done
  d=$RUN/$name; mkdir -p "$d"; cp "$RUN/src/$fix.mp4" "$d/src.mp4"
  # `time` inside the container: node reaps its ffmpeg children, so their CPU counts too.
  docker run --rm --name "fixture-$name" "${GPU[@]}" $envs \
    -v "$d":/w -v "$B/transcoder_fixture_harness.js":/h/harness.js -w /app --entrypoint bash "$NEW" \
    -c "TIMEFORMAT='%R %U %S'; { time node /h/harness.js /w/src.mp4 > /w/result.json 2> /w/stderr.log; } 2> /w/time.txt"
  read -r wall user sys < "$d/time.txt"
  log "--- $name  (fixture $fix, expected: $expect)  wall ${wall}s  cpu $(awk "BEGIN{print $user+$sys}")s  other-jobs=$(other_jobs)"
  log "$(cat "$d/result.json")"
done

# --- quality: SSIM vs source, first 5 min, for today vs new -----------------------------
ssim() { # label dist src
  v=$(docker run --rm -v "$RUN":/r --entrypoint ffmpeg "$NEW" -v info -t 300 -i "$2" -t 300 -i "$3" \
      -lavfi "[0:v]setpts=PTS-STARTPTS[d0];[1:v]setpts=PTS-STARTPTS[r];[d0][r]scale2ref=flags=bicubic[d][r2];[d][r2]ssim" -f null - 2>&1 | grep -o 'All:[0-9.]*' | tail -1)
  log "$(printf '  %-34s %s' "$1" "${v:-FAILED}")"
}
log ""
log "SSIM vs source, first 5 min (1.0 = identical):"
for r in 360p 720p; do
  ssim "today HLS $r (baseline-720)" "/r/baseline-720/hls/$r.m3u8" /r/baseline-720/src.mp4
  ssim "new   HLS $r (new-720)" "/r/new-720/hls/$r.m3u8" /r/new-720/src.mp4
done
ssim "today MP4 240p (baseline-720)" /r/baseline-720/temp-video-mp4/src_240p.mp4 /r/baseline-720/src.mp4
ssim "new   MP4 240p (new-720, remux)" /r/new-720/temp-video-mp4/src_240p.mp4 /r/new-720/src.mp4
ssim "new   HLS 720p (new-1080)" /r/new-1080/hls/720p.m3u8 /r/new-1080/src.mp4

# --- keep the listen-check files, drop the rest of the media -----------------------------
mkdir -p "$RUN/listen"
for q in 240p 360p; do
  cp "$RUN/baseline-720/temp-video-mp4/src_$q.mp4" "$RUN/listen/today_$q.mp4" 2>/dev/null
  cp "$RUN/new-720/temp-video-mp4/src_$q.mp4" "$RUN/listen/new_$q.mp4" 2>/dev/null
done
rm -rf "$RUN"/*/hls "$RUN"/*/temp-video-mp4 "$RUN"/*/src.mp4 "$RUN/src"
log ""
log "listen check: $RUN/listen/{today,new}_{240p,360p}.mp4 (today 128 kbps audio vs new 64/96 kbps)"
log "done $(date -Is)"
