// Runs the 1A/1B container's HLS pass and MP4 step on a LOCAL file, inside the job
// image, with the image's own modules (hls-ladder, hls-pass, hls-command, ffmpeg,
// source-probe, validate-outputs). No download, no upload, no LMS report, no Redis:
// index.js runs init() on load, so this re-does only its glue, the same way.
//
//   docker run --rm --gpus all -e NVIDIA_DRIVER_CAPABILITIES=compute,utility,video \
//     -v <dir>:/w -v <this file>:/h/harness.js -w /app \
//     -e GPU_ACCELERATION=true -e GPU_DECODE=true -e MP4_FROM_HLS=true ... \
//     <image> node /h/harness.js /w/src.mp4
//
// Env read here (the rest is read by the image's modules): GPU_DECODE, MP4_FROM_HLS,
// HLS_MAX_HEIGHT, USE_DYNAMIC_SCALE, NVENC_PRESET, CRF, GPU_ACCELERATION.
// FORCE_GPU_DECODE=true skips eligibility and fallback and runs the GPU argv once
// (the 5-output probe). Prints one JSON line: paths, timings, per-rung files.
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

const { hlsVariants, displayedHeight } = require('/app/hls-ladder.js');
const { buildHlsArgs } = require('/app/hls-command.js');
const { runHlsPass, gpuDecodeEligibility } = require('/app/hls-pass.js');
const { processMp4ToMp4Formats } = require('/app/ffmpeg.js');
const { parseProbe } = require('/app/source-probe.js');
const { validateHlsOutputs, validateMp4Outputs } = require('/app/validate-outputs.js');

const src = process.argv[2];
const env = process.env;
const workDir = path.dirname(src);
const hlsDir = path.join(workDir, 'hls');
const logFile = path.join(workDir, 'ffmpeg.log');

function probeJson(file, extra = []) {
  const r = spawnSync('ffprobe', ['-v', 'error', ...extra, '-show_streams', '-show_format', '-print_format', 'json', file]);
  if (r.status !== 0) throw new Error(`ffprobe ${file}: ${r.stderr}`);
  return JSON.parse(r.stdout.toString());
}

function runFfmpeg(argv) {
  return new Promise((resolve, reject) => {
    fs.appendFileSync(logFile, `\n=== ffmpeg ${argv.join(' ')}\n`);
    const p = spawn('ffmpeg', argv);
    p.stderr.on('data', (d) => fs.appendFileSync(logFile, d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
  });
}

function fileFacts(file) {
  if (!fs.existsSync(file)) return { missing: true };
  const j = probeJson(file);
  const v = (j.streams || []).find((s) => s.codec_type === 'video');
  return {
    mb: Math.round(fs.statSync(file).size / 1048576 * 10) / 10,
    duration: Number(j.format && j.format.duration),
    video: v ? `${v.width}x${v.height}${displayedHeight(v) !== v.height ? ` (shows ${displayedHeight(v)} tall)` : ''} ${v.codec_name} ${v.r_frame_rate}` : null,
    audio: (j.streams || []).some((s) => s.codec_type === 'audio'),
  };
}

(async () => {
  const out = { src: path.basename(workDir) };
  const sourceJson = probeJson(src);
  const probe = parseProbe(sourceJson);
  const vstream = (sourceJson.streams || []).find((s) => s.codec_type === 'video');
  const sourceHeight = Number(env.HLS_MAX_HEIGHT) > 720 ? displayedHeight(vstream) : undefined;
  const variants = hlsVariants({ maxHeight: env.HLS_MAX_HEIGHT, sourceHeight });
  out.source = { codec: probe.videoCodec, pixfmt: probe.pixelFormat, hasAudio: probe.hasAudio, duration: probe.durationSec, shows: `${vstream.width}x${vstream.height}, ${displayedHeight(vstream)} tall` };
  out.rungs = variants.map((v) => v.name).join(',');
  out.eligibility = gpuDecodeEligibility(probe, variants.length);

  fs.mkdirSync(hlsDir, { recursive: true });
  const hlsArgs = {
    variants, inputPath: src, outputDir: hlsDir,
    gpu: env.GPU_ACCELERATION === 'true', preset: env.NVENC_PRESET || 'medium', crf: env.CRF || '23',
    dynamicScale: env.USE_DYNAMIC_SCALE === 'true',
    hasAudio: probe ? probe.hasAudio : true, // as index.js processVideoToHls
  };

  let t = Date.now();
  if (env.FORCE_GPU_DECODE === 'true') {
    try { await runFfmpeg(buildHlsArgs({ ...hlsArgs, gpuDecode: true })); out.hlsPath = 'gpu (forced)'; }
    catch (e) { out.hlsPath = 'gpu (forced) FAILED'; out.hlsError = e.message; }
    const log = fs.readFileSync(logFile, 'utf8');
    out.surfacesLeft = /No decoder surfaces left/.test(log);
    out.hlsSec = (Date.now() - t) / 1000;
    console.log(JSON.stringify(out));
    return;
  }
  const hls = await runHlsPass({ hlsArgs, gpuDecode: env.GPU_DECODE === 'true', probe, runFfmpeg, log: () => {} });
  out.hlsPath = hls.path;
  out.hlsReason = hls.reason;
  out.hlsSec = (Date.now() - t) / 1000;
  await validateHlsOutputs(hlsDir);
  out.hlsValid = true;

  t = Date.now();
  const mp4 = await processMp4ToMp4Formats(src, { fromHls: env.MP4_FROM_HLS === 'true', hlsDir, sourceProbe: probe });
  out.mp4Path = mp4.path;
  out.mp4Sec = (Date.now() - t) / 1000;
  await validateMp4Outputs(mp4.body);
  out.mp4Valid = true;
  out.mp4 = Object.fromEntries(mp4.body.map((o) => [o.quality, fileFacts(o.url)]));
  out.mp4DurationOk = mp4.body.every((o) => Math.abs(out.mp4[o.quality].duration - probe.durationSec) <= 1);
  out.mp4AudioOk = mp4.body.every((o) => out.mp4[o.quality].audio === probe.hasAudio);
  out.hlsMb = Math.round(fs.readdirSync(hlsDir).reduce((n, f) => n + fs.statSync(path.join(hlsDir, f)).size, 0) / 1048576);
  console.log(JSON.stringify(out));
})().catch((e) => {
  console.log(JSON.stringify({ src: path.basename(workDir), error: e.message }));
  process.exit(1);
});
