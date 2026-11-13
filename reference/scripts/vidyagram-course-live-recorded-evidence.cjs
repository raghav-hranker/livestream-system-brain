// Read-only, vidyagramdb only: for every active Course with neither isLive nor isRecorded set, the evidence for which it is:
// classes in the course, the newest AppX class date, classes dated in the last 14 / 30 days and in the future, AppX's own
// "show live & upcoming tab" switch and content counters. Prints JSON lines, titles only.
// Run from the nightly checkout on test-uday: node - < script
require('dotenv').config({ path: '.env.development', quiet: true });
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'secondaryPreferred', autoIndex: false, autoCreate: false });
  const db = mongoose.connection.db; if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
  const now = new Date(); const d = (n) => new Date(now.getTime() - n * 86400000);
  const courses = await db.collection('courses').find({ status: 1 }, { projection: { title: 1, apxCourseId: 1, isLive: 1, isRecorded: 1, isFree: 1, isOld: 1, isCombo: 1, showInBatchFilter: 1, 'selling.combo': 1, createdAt: 1 } }).toArray();
  const mirror = new Map((await db.collection('apxcatalogcourses').find({ customerId: '781' }, { projection: { apxCourseId: 1, 'detail.show_live_upcoming_tab': 1, 'detail.start_date': 1, 'detail.end_date': 1, 'detail.created_at': 1, 'detail.content_stats': 1 } }).toArray()).map((m) => [String(m.apxCourseId), m.detail || {}]));
  for (const c of courses) {
    const rows = await db.collection('courseclasses').aggregate([{ $match: { course: c._id, isActive: { $ne: false } } }, { $group: { _id: null, n: { $sum: 1 }, last: { $max: '$startDate' }, first: { $min: '$startDate' }, d14: { $sum: { $cond: [{ $gte: ['$startDate', d(14)] }, 1, 0] } }, d30: { $sum: { $cond: [{ $gte: ['$startDate', d(30)] }, 1, 0] } }, future: { $sum: { $cond: [{ $gt: ['$startDate', now] }, 1, 0] } }, added14: { $sum: { $cond: [{ $gte: ['$createdAt', d(14)] }, 1, 0] } } } }]).toArray();
    const r = rows[0] || {}; const m = mirror.get(String(c.apxCourseId)) || {};
    const subs = c.selling?.combo?.on ? (c.selling.combo.subCourses || []).length : 0;
    console.log(JSON.stringify({ id: String(c._id), apx: c.apxCourseId || '', title: c.title, isLive: c.isLive === true, isRecorded: c.isRecorded === true, isFree: c.isFree === true, isOld: c.isOld === true, isCombo: c.isCombo === true, comboSubs: subs, inNew: c.showInBatchFilter === true,
      classes: r.n || 0, first: r.first?.toISOString?.().slice(0, 10) || '', last: r.last?.toISOString?.().slice(0, 10) || '', last14: r.d14 || 0, last30: r.d30 || 0, future: r.future || 0, added14: r.added14 || 0,
      appxLiveTab: String(m.show_live_upcoming_tab ?? ''), appxStart: String(m.start_date || '').slice(0, 10), appxEnd: String(m.end_date || '').slice(0, 10), appxCreated: String(m.created_at || '').slice(0, 10) }));
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
