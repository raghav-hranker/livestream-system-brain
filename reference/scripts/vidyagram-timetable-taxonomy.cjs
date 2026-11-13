#!/usr/bin/env node
// Read-only, aggregate, refuses any DB but vidyagramdb: for IST days around today, the rows /api/timetable can return
// (before the per-student access filter), with the section the API sends (Class) against the section the course
// files them under (CourseClass). Takes no token and calls no API.
//
// Run on webserver2-2 from the VG checkout (optional arg: number of days back, default 3):
//   ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 'export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH; \
//     cd /var/www/backend.vidyagramar.com/vidyagram-backend && DOTENV_CONFIG_PATH=.env.development \
//     NODE_PATH=$PWD/node_modules node -r dotenv/config - 3' < reference/scripts/vidyagram-timetable-taxonomy.cjs
const { mongo } = require('mongoose');

const DB_NAME = 'vidyagramdb';
const DAY_MS = 86400000;
const IST_MS = 5.5 * 3600000;
const daysBack = Number(process.argv[2] ?? 3);

(async () => {
  const client = new mongo.MongoClient(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  await client.connect();
  const db = client.db(DB_NAME);
  const todayStart = Math.floor((Date.now() + IST_MS) / DAY_MS) * DAY_MS - IST_MS;

  for (let back = daysBack; back >= -1; back--) {
    const start = new Date(todayStart - back * DAY_MS);
    const end = new Date(start.getTime() + DAY_MS - 1);
    const rows = await db
      .collection('courseclasses')
      .aggregate([
        { $match: { isActive: true, status: 1, startDate: { $gte: start, $lte: end } } },
        { $lookup: { from: 'classes', localField: 'class', foreignField: '_id', as: 'cls', pipeline: [{ $project: { section: 1, status: 1, isYoutubeRedirect: 1 } }] } },
        { $unwind: '$cls' },
        { $match: { 'cls.status': 1 } },
        { $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'crs', pipeline: [{ $project: { status: 1 } }] } },
        { $unwind: '$crs' },
        { $match: { 'crs.status': 1 } },
        { $lookup: { from: 'sections', localField: 'cls.section', foreignField: '_id', as: 'classSection', pipeline: [{ $project: { sectionName: 1 } }] } },
        {
          $group: {
            _id: { apiSection: { $first: '$classSection.sectionName' }, courseSection: '$sectionName' },
            rows: { $sum: 1 },
            youtube: { $sum: { $cond: ['$cls.isYoutubeRedirect', 1, 0] } },
          },
        },
      ])
      .toArray();
    const classIdsStarting = await db.collection('classes').find({ status: 1, startDate: { $gte: start, $lte: end } }).project({ _id: 1 }).toArray();
    const inherited = await db.collection('courseclasses').countDocuments({ isActive: true, status: 1, startDate: null, class: { $in: classIdsStarting.map((c) => c._id) } });
    console.log(`\nclasses starting that day ${classIdsStarting.length}, placements inheriting that start ${inherited}`);
    const total = rows.reduce((sum, row) => sum + row.rows, 0);
    const youtube = rows.reduce((sum, row) => sum + row.youtube, 0);
    const placeholder = rows.filter((row) => row._id.apiSection === 'Vidyagram import (unplaced)').reduce((sum, row) => sum + row.rows, 0);
    const istDay = new Date(start.getTime() + IST_MS).toISOString().slice(0, 10);
    console.log(`\n${istDay}: rows ${total}, youtube ${youtube}, API section is the placeholder on ${placeholder}`);
    rows
      .sort((a, b) => b.rows - a.rows)
      .slice(0, 8)
      .forEach((row) => console.log(`  ${row.rows}  API: ${row._id.apiSection ?? '<none>'}  |  course: ${row._id.courseSection ?? '<none>'}`));
  }
  await client.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
