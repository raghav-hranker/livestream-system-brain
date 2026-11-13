// Q-Hub ghost repair. Copy into the backend checkout on the prod box and run there:
//   node ./.qhub_repair.js                      -> report only (no writes)
//   node ./.qhub_repair.js --commit             -> tombstone + broadcast message_deleted
//   node ./.qhub_repair.js --commit id1,id2     -> same, for an explicit id list
//
// For each id: a MISSING row is re-inserted as a tombstone (isDeleted:true) so
// delta sync can list it in deletedIds; a LIVE row is soft-deleted the proper
// way; an existing tombstone is left alone. Then `message_deleted {id, chatId}`
// is broadcast to the channel room through the same Redis adapter the admin
// DELETE route uses, so any connected app that handles that event drops the
// message now. Nothing renders a tombstone: history, pins, admin all filter it.
require("dotenv").config({ path: ".env.development" });
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");

const CHAT = "6a71d944a7507c01f2c3f578";
const DEFAULT_IDS = [
  "6aabfe93baca7b89a154db5e", // 17 Sep 20:22 IST image  (tombstoned 17 Sep)
  "6aabe4e5d661e89e4b721b57", // 17 Sep 18:32 IST PDF    (tombstoned 17 Sep)
  "6aac089a035db786925ba553", // 17 Sep 21:04 IST         (still 404 on /view -> hand-deleted, no tombstone)
];
const COMMIT = process.argv.includes("--commit");
const IDS = (process.argv.find((a) => /^[0-9a-f]{24}(,|$)/.test(a)) || DEFAULT_IDS.join(",")).split(",");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const Message = require("./dist/src/models/Message").default;
  const now = new Date();
  console.log(COMMIT ? "MODE: commit" : "MODE: report only (add --commit to write)");

  for (const id of IDS) {
    const _id = new mongoose.Types.ObjectId(id);
    const m = await Message.findById(_id).lean();
    if (!m) {
      console.log(id, "MISSING in db ->", COMMIT ? "inserting tombstone" : "would insert tombstone");
      if (COMMIT) {
        await Message.collection.insertOne({
          _id, chatId: new mongoose.Types.ObjectId(CHAT), senderId: "admin", text: "[deleted]", type: "text",
          reactions: [], viewCount: 0, isEdited: false, isPinned: false, pinnedAt: null,
          isDeleted: true, deletedAt: now, timestamp: _id.getTimestamp(), createdAt: _id.getTimestamp(), updatedAt: now,
        });
      }
    } else if (!m.isDeleted) {
      console.log(id, "LIVE in db ->", COMMIT ? "soft-deleting" : "would soft-delete");
      if (COMMIT) await Message.updateOne({ _id }, { $set: { isDeleted: true, deletedAt: now, isPinned: false, pinnedAt: null } });
    } else {
      console.log(id, "already a tombstone (deletedAt " + (m.deletedAt && m.deletedAt.toISOString()) + ") - nothing to write");
    }
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const reported = await Message.find({ chatId: CHAT, isDeleted: true, deletedAt: { $gt: since } }).select("_id").lean();
  console.log("\ndeletedIds a client syncing with since=24h-ago now receives:", reported.map((r) => String(r._id)));

  if (COMMIT) {
    const { getRedis } = require("./dist/src/config/redis");
    const redis = getRedis();
    if (!redis) { console.log("Redis not configured - cannot broadcast message_deleted"); }
    else {
      const sub = redis.duplicate();
      const io = new Server();
      io.adapter(createAdapter(redis, sub));
      for (const id of IDS) io.to(CHAT).emit("message_deleted", { id, chatId: CHAT });
      await new Promise((r) => setTimeout(r, 1500));
      console.log("broadcast message_deleted to room", CHAT, "for", IDS.length, "ids");
      io.close(); try { await sub.quit(); await redis.quit(); } catch (_) {}
    }
  }
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
