// read-only: one JSON line per Class id — title, schedule, duration, faculty (for labelling chat or log exports)
//   run from the backend checkout: DOTENV_CONFIG_PATH=.env.development NODE_PATH=$PWD/node_modules node -r dotenv/config class_meta.cjs <classId>...
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const ids = process.argv.slice(2).map(id => new mongoose.Types.ObjectId(id));
  const docs = await mongoose.connection.db.collection('classes').find({ _id: { $in: ids } }).toArray();
  for (const d of docs) {
    const pick = ['title', 'name', 'startDate', 'endDate', 'startTime', 'endTime', 'duration', 'isLive', 'faculty', 'faculties', 'subject', 'topic'];
    console.log(JSON.stringify({ classId: String(d._id), ...Object.fromEntries(pick.filter(k => d[k] != null).map(k => [k, d[k]])) }));
  }
  await mongoose.disconnect();
})();
