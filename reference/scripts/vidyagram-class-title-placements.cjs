#!/usr/bin/env node
// Read-only. Every Vidyagram Class whose title matches a regex, with its AppX source (ledger row),
// duration, status, and every course it is placed in (CourseClass). Optional course filter narrows
// the placement list to courses whose title matches.
//
//   NODE_PATH=~/Projects/quicktricks-backend/node_modules \
//     node reference/scripts/vidyagram-class-title-placements.cjs ~/Projects/worktrees/vg-backend/.env.development '^Human Disease 0?5$' ['GS Special 4\.0']
//
// Needs MONGO_URI in the env file; reads vidyagramdb only.
const fs = require('fs');

const [envFile, titleRe, courseRe] = process.argv.slice(2);
if (!envFile || !titleRe) { console.error('usage: <env file> <title regex> [course title regex]'); process.exit(2); }
for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const { mongo } = require('mongoose');

(async () => {
  const client = new mongo.MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000, readPreference: 'primary' });
  await client.connect();
  const db = client.db('vidyagramdb');

  const classes = await db.collection('classes').find({ title: { $regex: titleRe, $options: 'i' } }).toArray();
  const ids = classes.map((c) => c._id);
  const placements = await db.collection('courseclasses').find({ class: { $in: ids } }).toArray();
  const courseIds = [...new Set(placements.map((p) => String(p.course)))].map((id) => new mongo.ObjectId(id));
  const courses = new Map((await db.collection('courses').find({ _id: { $in: courseIds } }, {
    projection: { title: 1, apxCourseId: 1, status: 1 },
  }).toArray()).map((c) => [String(c._id), c]));
  const ledger = await db.collection('apxcatalogimports').find({ classId: { $in: ids } }).toArray();
  const ledgerAll = await db.collection('apxcatalogimports').find({ title: { $regex: titleRe, $options: 'i' } }).toArray().catch(() => []);
  const courseFilter = courseRe ? new RegExp(courseRe, 'i') : null;

  for (const c of classes) {
    const led = ledger.filter((l) => String(l.classId) === String(c._id));
    console.log('\n== Class', String(c._id), JSON.stringify(c.title));
    console.log('   status', c.status, '| duration', c.duration, '| isLive', c.isLive, '| streamStatus', c.streamStatus,
      '| startDate', c.startDate, '| createdAt', c.createdAt);
    console.log('   apxAssetKey', c.apxAssetKey, '| hlsAsset', c.hlsAsset ? JSON.stringify({ status: c.hlsAsset.status, path: c.hlsAsset.storagePath || c.hlsAsset.path }) : null);
    for (const l of led) {
      const { _id, placements: lp, ...rest } = l;
      console.log('   ledger', JSON.stringify(rest).slice(0, 600));
      if (lp) console.log('   ledger placements', lp.length);
    }
    for (const p of placements.filter((x) => String(x.class) === String(c._id))) {
      const co = courses.get(String(p.course));
      if (courseFilter && !courseFilter.test(co?.title ?? '')) continue;
      console.log('   placed in', co?.apxCourseId, JSON.stringify(co?.title), '| cc status', p.status, '| startDate', p.startDate,
        '| section', String(p.section), '| topic', String(p.topic), '| createdAt', p.createdAt);
    }
  }
  console.log('\nledger rows by title:', ledgerAll.length);
  for (const l of ledgerAll) {
    console.log('  ', l.assetKey, '| classId', String(l.classId), '| duration', l.duration, '| replacedBy', l.replacedBy, '| replaces', l.replaces);
  }
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
