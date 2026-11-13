// Read-only. Watch SelectionWay (561) classes until each one finishes cleanly or gets stuck.
// Prints one line per state change plus a verdict per class, and exits once every class has one.
//   MONGO_URI=... NODE_PATH=<a checkout>/node_modules node watch561.cjs <classId> [...]
// Verdicts:
//   OK     room ended + vodPath, LMS ended, class_link on the VOD
//   STUCK  room processing 20+ min after End, or reconnecting with no new segment for 15+ min
// Fix STUCK ones with finish561.js (see README).
const { MongoClient, ObjectId } = require("mongodb");

const ids = process.argv.slice(2);
const host = "https://selectionwaylive.hranker.com/561";
const hhmm = () => new Date().toISOString().slice(11, 16);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Age in minutes of the newest segment, read from the live playlist's PROGRAM-DATE-TIME
// (the timestamp carries its own offset, +0000 on GCP, +0200 on the Hetzner box).
async function lastSegmentAgeMin(id) {
  const text = await (await fetch(`${host}/${id}/0/playlist.m3u8`)).text();
  const all = [...text.matchAll(/PROGRAM-DATE-TIME:(\S+)/g)];
  if (!all.length) return null;
  const iso = all[all.length - 1][1].replace(/([+-]\d\d)(\d\d)$/, "$1:$2");
  return Math.round((Date.now() - Date.parse(iso)) / 60000);
}

(async () => {
  if (!ids.length) throw new Error("usage: node watch561.cjs <classId> [...]");
  const client = await MongoClient.connect(process.env.MONGO_URI);
  const rooms = client.db("livestream").collection("rooms");
  const classes = client.db("selectionwaydb").collection("classes");
  const last = {}, verdict = {};

  while (ids.some((id) => !verdict[id])) {
    for (const id of ids) {
      if (verdict[id]) continue;
      try {
        const r = await rooms.findOne({ classId: id }, { projection: { status: 1, vodPath: 1, endTimestamp: 1 } });
        const c = await classes.findOne({ _id: new ObjectId(id) }, { projection: { streamStatus: 1, class_link: 1, teacherName: 1 } });
        const status = r ? r.status : "none";
        const vodLink = /mpl-vod/.test((c && c.class_link) || "");
        const endMin = r && r.endTimestamp ? Math.round((Date.now() - new Date(r.endTimestamp).getTime()) / 60000) : null;
        const who = `${id.slice(0, 8)} ${(c && c.teacherName) || ""}`;
        const state = `room=${status}${r && r.vodPath ? "+vod" : ""} lms=${c ? c.streamStatus : "none"} link=${vodLink ? "vod" : "live"}`;
        if (last[id] !== state) {
          console.log(`${hhmm()} ${who}: ${state}${endMin !== null ? ` (End ${endMin}m ago)` : ""}`);
          last[id] = state;
        }
        if (status === "ended" && r.vodPath && c && c.streamStatus === "ended" && vodLink) {
          verdict[id] = "OK";
          console.log(`${hhmm()} ${who}: OK, finished cleanly`);
        } else if (status === "processing" && endMin !== null && endMin >= 20) {
          verdict[id] = "STUCK";
          console.log(`${hhmm()} ${who}: STUCK, still processing ${endMin}m after End`);
        } else if (status === "reconnecting") {
          const age = await lastSegmentAgeMin(id);
          if (age !== null && age >= 15) {
            verdict[id] = "STUCK";
            console.log(`${hhmm()} ${who}: STUCK, reconnecting with no new segment for ${age}m`);
          }
        }
      } catch (e) {
        console.error(`${hhmm()} ${id.slice(0, 8)} poll error: ${e.message}`);
      }
    }
    if (ids.some((id) => !verdict[id])) await sleep(60000);
  }
  console.log(`${hhmm()} done: ${ids.map((id) => `${id.slice(0, 8)}=${verdict[id]}`).join(" ")}`);
  await client.close();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
