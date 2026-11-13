// read-only: a Class and every course placement of it, with the dates live-schedule reads.
//   Explains an odd "Ends:" on the Live Classes schedule card: the card shows the LATEST end among placements.
//   run on webserver2-2 from either tenant's backend checkout, over ssh stdin:
//   TITLE='<regex>' (or CLASS_IDS=<id>,<id>) DOTENV_CONFIG_PATH=.env.development NODE_PATH=$PWD/node_modules node -r dotenv/config - < class_placement_dates.cjs
const mongoose = require('mongoose');
const ist = d => (d ? new Date(new Date(d).getTime() + 330 * 60000).toISOString().replace('T', ' ').slice(0, 19) + ' IST' : null);
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log('db:', db.databaseName);
  const ids = (process.env.CLASS_IDS || '').split(',').filter(Boolean).map(id => new mongoose.Types.ObjectId(id));
  const filter = ids.length ? { _id: { $in: ids } } : { title: { $regex: process.env.TITLE, $options: 'i' } };
  const classes = await db.collection('classes').find(filter).sort({ createdAt: -1 }).limit(5).toArray();
  for (const c of classes) {
    console.log(JSON.stringify({
      classId: String(c._id), title: c.title, status: c.status, isLive: c.isLive, streamStatus: c.streamStatus,
      startDate: ist(c.startDate), endDate: ist(c.endDate), actualStartedAt: ist(c.actualStartedAt),
      actualEndedAt: ist(c.actualEndedAt), createdAt: ist(c.createdAt), updatedAt: ist(c.updatedAt),
    }));
    const placements = await db.collection('courseclasses').find({ class: c._id }).toArray();
    const courses = await db.collection('courses').find({ _id: { $in: placements.map(p => p.course) } }).project({ title: 1 }).toArray();
    const titleOf = Object.fromEntries(courses.map(x => [String(x._id), x.title]));
    for (const p of placements) {
      console.log('  ' + JSON.stringify({
        placementId: String(p._id), course: titleOf[String(p.course)], status: p.status, isActive: p.isActive,
        startDate: ist(p.startDate), endDate: ist(p.endDate), actualStartAppliedAt: ist(p.actualStartAppliedAt),
        actualEndAppliedAt: ist(p.actualEndAppliedAt), createdAt: ist(p.createdAt), updatedAt: ist(p.updatedAt),
      }));
    }
  }
  await mongoose.disconnect();
})();
