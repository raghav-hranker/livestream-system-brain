// WRITES. Finish stranded SelectionWay (client 561) classes by hand: rebuild the VOD playlists
// from the live playlists already in storage when they are missing, then do what
// routes/stream.js would have done: Room ended+vodPath, class_link PUT, MP4 job.
// Use when a class is stuck processing/reconnecting and the encoder box no longer has the
// local segments (a plain POST /api/v1/stream/ replay then "succeeds" but does nothing).
//
// Run on livestream-cpu-new (see ../hosts.md) from ~/livestream/backend, so it uses that
// box's .env (S3_BUCKET_NAME, R2 creds, shared GPU Redis, OUTPUT_BUCKET):
//   node finish561.js <classId> [<classId> ...]
// Also works for Toppers (695): run it from the toppers checkout on livestream-testing-raghav
// with CLIENT_ID=695; that checkout's config/fileUpload supply the toppers DB, storage domain
// and LMS host (node.topperswisdom.com).
// It does not set LMS streamStatus or rtmp:blocked; do those separately if the class was
// stuck in "reconnecting" (PUT /api/classes/<id> {"streamStatus":"ended"}; SET rtmp:blocked:/561/<id> 1 NX).
require("dotenv").config({ path: __dirname + "/.env" });
require("net").setDefaultAutoSelectFamily(false); // GCP has no IPv6 route; Node happy-eyeballs ETIMEDOUTs the LMS PUT
const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");
const config = require("./config/config");
const { Room } = require("./db/model");
const { uploadVodPlaylistsOnly, updateUrlApi } = require("./lib/fileUpload");
const { runEcsTask, closeRedisConnection } = require("./lib/ecs");

const clientId = process.env.CLIENT_ID || "561";
const VOD_FILES = ["playlist-mpl-vod.m3u8", "0/playlist-vod.m3u8", "1/playlist-vod.m3u8", "2/playlist-vod.m3u8", "3/playlist-vod.m3u8"];

const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};

const retry = async (fn, label) => {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      console.error(`${label} attempt ${i} failed: ${e.message}`);
      if (i === 3) throw e;
      await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
};

async function rebuildVod(classId, base, prefix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `vod-${classId}-`));
  try {
    const master = await get(`${base}/playlist.m3u8`);
    fs.writeFileSync(path.join(tmp, "playlist-mpl-vod.m3u8"), master.replace(/\.m3u8/g, "-vod.m3u8"));
    for (const rung of ["0", "1", "2", "3"]) {
      const live = await get(`${base}/${rung}/playlist.m3u8`);
      // live playlists carry #EXT-X-PROGRAM-DATE-TIME between #EXTINF and the URI
      const entries = [];
      let pending = null;
      for (const raw of live.split("\n")) {
        const line = raw.trim();
        const m = line.match(/^#EXTINF:([0-9.]+)/);
        if (m) pending = parseFloat(m[1]);
        else if (/^segment_\d+\.ts$/.test(line) && pending !== null) { entries.push([pending, line]); pending = null; }
      }
      if (!entries.length) throw new Error(`rung ${rung}: no segments`);
      // TARGETDURATION must be >= the longest segment or AVPlayer rejects the VOD
      const target = Math.max(9, Math.ceil(Math.max(...entries.map(([d]) => d))));
      const body = entries.map(([d, f]) => `#EXTINF:${Number.isInteger(d) ? d : d.toFixed(3)},\n${f}\n`).join("");
      fs.mkdirSync(path.join(tmp, rung));
      fs.writeFileSync(path.join(tmp, rung, "playlist-vod.m3u8"),
        `#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:${target}\n#EXT-X-MEDIA-SEQUENCE:0\n#EXT-X-PLAYLIST-TYPE:VOD\n${body}#EXT-X-ENDLIST`);
      const nums = entries.map(([, f]) => +f.match(/\d+/)[0]);
      const gaps = nums.filter((n, i) => i && n !== nums[i - 1] + 1).length;
      console.log(`  rung ${rung}: ${entries.length} segs, ${Math.round(entries.reduce((s, [d]) => s + d, 0))}s, targetduration ${target}, numbering gaps ${gaps}`);
    }
    await uploadVodPlaylistsOnly(tmp, process.env.S3_BUCKET_NAME, prefix);
    for (const p of VOD_FILES) {
      const r = await fetch(`${base}/${p}`);
      if (!r.ok) throw new Error(`verify ${p}: ${r.status}`);
    }
    console.log("  VOD playlists uploaded and serving 200");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function finish(classId) {
  const prefix = `${clientId}/${classId}`;
  const base = `${config.s3Path}/${prefix}`;
  const vodUrl = `${base}/playlist-mpl-vod.m3u8`;
  console.log(`== ${classId}`);

  // Refuse before any write if this checkout's DB has no room for the class (wrong box or client)
  if (!(await Room.exists({ clientId, classId }))) throw new Error(`no Room for ${clientId}/${classId} in ${mongoose.connection.name}`);

  if ((await fetch(vodUrl)).ok) console.log("  VOD playlist already exists, keeping it");
  else await rebuildVod(classId, base, prefix);

  const room = await Room.findOneAndUpdate({ clientId, classId }, { status: "ended", vodPath: vodUrl }, { new: true });
  console.log("  Room", room && room.status, room && room.vodPath);

  await retry(() => updateUrlApi(vodUrl, false), "class_link PUT");
  console.log("  class_link updated");

  const job = await runEcsTask(vodUrl);
  console.log("  MP4 job PUSHED", job.name);
}

(async () => {
  const ids = process.argv.slice(2);
  if (!ids.length || ids.some((id) => !/^[0-9a-f]{24}$/.test(id))) throw new Error("usage: node finish561.js <classId> [...]");
  if (!process.env.S3_BUCKET_NAME) throw new Error("S3_BUCKET_NAME missing");
  // lib/ecs.js falls back to localhost Redis, where nothing consumes queue:critical
  if (!process.env.REDIS_HOST || /^(localhost|127\.0\.0\.1)$/.test(process.env.REDIS_HOST)) throw new Error("REDIS_HOST not shared: " + process.env.REDIS_HOST);
  console.log("bucket", process.env.S3_BUCKET_NAME, "redis", process.env.REDIS_HOST, "s3Path", config.s3Path);

  await mongoose.connect(config.dbUri);
  console.log("client", clientId, "db", mongoose.connection.name);
  const failed = [];
  for (const id of ids) {
    try { await finish(id); } catch (e) { console.error(`  ERR ${id}: ${e.message}`); failed.push(id); }
  }
  await closeRedisConnection();
  await mongoose.disconnect();
  console.log(failed.length ? `DONE with failures: ${failed.join(" ")}` : "DONE, all ok");
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
