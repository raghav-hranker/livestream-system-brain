// WRITES. Re-queue the HLS->MP4 GPU job for Toppers (client 695) classes whose VOD exists but
// whose MP4 job was never queued or was orphaned (transcoder.videos stuck "processing", the
// job missing from Redis processing:jobs, dedupe lock gone).
//
// Run on the toppers box (see ../hosts.md) from ~/livestream/backend, so lib/ecs.js gets that
// app's OUTPUT_BUCKET / R2 creds / shared GPU Redis:
//   node repush695.js <classId> [<classId> ...]
// Loads backend/.env BEFORE requiring lib/ecs.js: ecs.js reads ../../.env, which does not exist
// on the VM, and would otherwise push to the VM's local Redis where nothing consumes the queue.
require("dotenv").config({ path: __dirname + "/.env" });
const { runEcsTask, closeRedisConnection } = require("./lib/ecs");

const base = "https://livestream.hranker.com/695";

(async () => {
  const ids = process.argv.slice(2);
  if (!ids.length || ids.some((id) => !/^[0-9a-f]{24}$/.test(id))) throw new Error("usage: node repush695.js <classId> [...]");
  if (!process.env.REDIS_HOST || /^(localhost|127\.0\.0\.1)$/.test(process.env.REDIS_HOST)) throw new Error("REDIS_HOST not shared: " + process.env.REDIS_HOST);
  if (!process.env.OUTPUT_BUCKET) throw new Error("OUTPUT_BUCKET missing");
  console.log("redis", process.env.REDIS_HOST, "bucket", process.env.OUTPUT_BUCKET);

  const failed = [];
  for (const id of ids) {
    const vodUrl = `${base}/${id}/playlist-mpl-vod.m3u8`;
    try {
      const r = await fetch(vodUrl);
      if (!r.ok) throw new Error(`VOD playlist ${r.status}`);
      const job = await runEcsTask(vodUrl);
      console.log(`== ${id} MP4 job PUSHED ${job.name}`);
    } catch (e) {
      console.error(`== ${id} ERR ${e.message}`);
      failed.push(id);
    }
  }
  await closeRedisConnection();
  console.log(failed.length ? `DONE with failures: ${failed.join(" ")}` : "DONE, all ok");
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
