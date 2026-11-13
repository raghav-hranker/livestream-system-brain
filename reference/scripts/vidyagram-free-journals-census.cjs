// Read-only: toppers' FREE editorial journals (adminPanelDB) — what a copy to vidyagramdb would bring.
// Counts by type/active, date range, linked tests, tag values, media hosts, content size. Names/counts only.
// Run on webserver2-2 from the VG checkout:
//   URI=$(grep -E '^MONGO_URI=' .env.development | cut -d= -f2- | tr -d '"') nice -n 10 node - < script
const mongoose = require('mongoose');
(async () => {
  const conn = await mongoose.createConnection(process.env.URI, { readPreference: 'secondaryPreferred' }).asPromise();
  const tw = conn.useDb('adminPanelDB'), vg = conn.useDb('vidyagramdb');
  const J = tw.collection('editorialjournals');
  const all = await J.countDocuments({});
  const free = await J.find({ isFree: true }, { projection: { journal: 0 } }).toArray();
  console.log('journals total', all, 'free', free.length);
  const by = {};
  for (const j of free) { const k = `${j.type} active=${j.isActive}`; by[k] = (by[k] || 0) + 1; }
  console.log('free by type/active', by);
  const act = free.filter(j => j.isActive);
  const dates = act.map(j => j.date).filter(Boolean).sort((a, b) => a - b);
  console.log('active free date range', dates[0], '→', dates[dates.length - 1]);
  console.log('active free with tests', act.filter(j => (j.seriesIds || []).length).length,
    'series total', new Set(act.flatMap(j => (j.seriesIds || []).map(String))).size);
  const tags = {}; for (const j of act) tags[j.tag] = (tags[j.tag] || 0) + 1;
  console.log('tag values', tags);
  const tagDocs = await tw.collection('editorialtags').find({}).project({ name: 1, type: 1, status: 1 }).toArray();
  console.log('toppers tags', tagDocs.map(t => `${t._id} ${t.name} ${t.type} s${t.status}`));
  console.log('vg tags', await vg.collection('editorialtags').countDocuments({}), 'vg journals', await vg.collection('editorialjournals').countDocuments({}));
  const hosts = {}; for (const j of act) for (const u of [j.imageUrl, j.audioUrl]) if (u) { const h = String(u).split('/')[2]; hosts[h] = (hosts[h] || 0) + 1; }
  console.log('media hosts', hosts);
  const ids = act.map(j => j._id);
  const sizes = await J.aggregate([{ $match: { _id: { $in: ids } } }, { $project: { n: { $strLenCP: { $ifNull: ['$journal', ''] } } } }]).toArray();
  const inlineImgHosts = {};
  for (const d of await J.find({ _id: { $in: ids } }, { projection: { journal: 1 } }).toArray())
    for (const m of String(d.journal || '').matchAll(/src="https?:\/\/([^/"]+)/g)) inlineImgHosts[m[1]] = (inlineImgHosts[m[1]] || 0) + 1;
  console.log('content chars min/max', Math.min(...sizes.map(s => s.n)), Math.max(...sizes.map(s => s.n)), 'inline img hosts', inlineImgHosts);
  for (const j of act.slice(-8)) console.log(' -', j.type, j.date && j.date.toISOString().slice(0, 10), JSON.stringify(j.title || '').slice(0, 70), 'tests', (j.seriesIds || []).length);
  await conn.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
