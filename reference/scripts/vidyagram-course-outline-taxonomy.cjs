#!/usr/bin/env node
// Read-only, refuses any DB but vidyagramdb: one course's outline taxonomy against the AppX folders it came from.
// Groups the course's CourseClass placements by Section › Topic › Subtopic (the live ids, resolved to names, and the
// name snapshots when they differ) and lists, per group, the AppX folder paths (`apxDisplayPlacements[].sourcePath`)
// its classes were filed from. Also: classes placed twice, and per AppX path which of our groups it landed in.
//
// Run on webserver2-2 from the VG checkout (arg = Course _id or AppX course id):
//   ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 'export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH; \
//     cd /var/www/backend.vidyagramar.com/vidyagram-backend && DOTENV_CONFIG_PATH=.env.development \
//     NODE_PATH=$PWD/node_modules/mongoose/node_modules:$PWD/node_modules node -r dotenv/config - 6af50ea418e98c6518eebd67' \
//     < reference/scripts/vidyagram-course-outline-taxonomy.cjs
const { MongoClient, ObjectId } = require('mongodb');

const DB_NAME = 'vidyagramdb';
const arg = process.argv.slice(2).find((a) => !a.startsWith('dotenv_config'));
if (!arg) {
  console.error('usage: vidyagram-course-outline-taxonomy.cjs <courseId|apxCourseId>');
  process.exit(2);
}

(async () => {
  const client = new MongoClient(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  await client.connect();
  const db = client.db(DB_NAME);
  if (db.databaseName !== DB_NAME) throw new Error('wrong db');

  const q = ObjectId.isValid(arg) && String(arg).length === 24 ? { _id: new ObjectId(arg) } : { apxCourseId: { $in: [arg, Number(arg)] } };
  const course = await db.collection('courses').findOne(q, { projection: { title: 1, apxCourseId: 1, status: 1 } });
  if (!course) throw new Error(`no Course for ${arg}`);
  console.log('course', String(course._id), 'apx', course.apxCourseId, JSON.stringify(course.title), 'status', course.status);

  const rows = await db.collection('courseclasses').find({ course: course._id }).toArray();
  const classes = await db
    .collection('classes')
    .find({ _id: { $in: rows.map((r) => r.class) } }, { projection: { title: 1, status: 1, createdAt: 1 } })
    .toArray();
  const cls = new Map(classes.map((c) => [String(c._id), c]));
  const ids = (k) => [...new Set(rows.map((r) => r[k]).filter(Boolean).map(String))].map((s) => new ObjectId(s));
  const nameMap = async (coll, field, list) =>
    new Map((await db.collection(coll).find({ _id: { $in: list } }).toArray()).map((d) => [String(d._id), d[field] ?? d.name ?? d.title]));
  const secN = await nameMap('sections', 'sectionName', ids('section'));
  const topN = await nameMap('topics', 'topicName', ids('topic'));
  const subN = await nameMap('subtopics', 'subTopicName', ids('subTopic'));

  const label = (live, snap) => (live === undefined ? `<${snap ?? 'none'}>` : snap && snap !== live ? `${live} [snap ${snap}]` : live);
  const groups = new Map();
  const byPath = new Map();
  for (const r of rows) {
    const s = label(r.section ? secN.get(String(r.section)) ?? '?dead' : undefined, r.sectionName);
    const t = label(r.topic ? topN.get(String(r.topic)) ?? '?dead' : undefined, r.topicName);
    const st = label(r.subTopic ? subN.get(String(r.subTopic)) ?? '?dead' : undefined, r.subTopicName);
    const key = `${s} (${r.section ?? '-'}) › ${t} › ${st}`;
    const g = groups.get(key) ?? { active: 0, inactive: 0, paths: new Map(), titles: [] };
    r.isActive === false || r.status === 0 ? g.inactive++ : g.active++;
    const paths = (r.apxDisplayPlacements || []).map((p) => p.sourcePath);
    if (!paths.length) paths.push('(no AppX path: added here)');
    for (const p of paths) {
      g.paths.set(p, (g.paths.get(p) || 0) + 1);
      const b = byPath.get(p) ?? new Map();
      b.set(`${s} › ${t}`, (b.get(`${s} › ${t}`) || 0) + 1);
      byPath.set(p, b);
    }
    if (g.titles.length < 3) g.titles.push((r.apxTitle || cls.get(String(r.class))?.title || '?').slice(0, 70));
    groups.set(key, g);
  }

  console.log(`\nplacements ${rows.length}, distinct classes ${new Set(rows.map((r) => String(r.class))).size}`);
  console.log('\n== groups (section › topic › subtopic): active/inactive, AppX source paths');
  for (const [k, g] of [...groups].sort()) {
    console.log(`\n${k}  ${g.active}/${g.inactive}`);
    for (const [p, n] of [...g.paths].sort()) console.log(`    ${n}× ${p}`);
    console.log(`    e.g. ${g.titles.join(' | ')}`);
  }

  console.log('\n== AppX path → our section › topic (paths split across groups only)');
  for (const [p, b] of [...byPath].sort()) if (b.size > 1) console.log(`${p}\n    ${[...b].map(([k, n]) => `${n}× ${k}`).join('\n    ')}`);

  const dup = new Map();
  for (const r of rows) dup.set(String(r.class), (dup.get(String(r.class)) || 0) + 1);
  const twice = [...dup].filter(([, n]) => n > 1);
  console.log(`\n== classes with 2+ placements in this course: ${twice.length}`);
  for (const [id, n] of twice.slice(0, 20)) console.log(`  ${n}× ${id} ${cls.get(id)?.title}`);

  console.log('\n== placements by section: created / updated (UTC day-hour)');
  const when = new Map();
  for (const r of rows) {
    const k = `${r.sectionName ?? r.section ?? '<none>'}  created ${r.createdAt?.toISOString().slice(0, 13)}  updated ${r.updatedAt?.toISOString().slice(0, 13)}`;
    when.set(k, (when.get(k) || 0) + 1);
  }
  for (const [k, n] of [...when].sort()) console.log(`  ${n}× ${k}`);

  const loose = rows.filter((r) => !r.section);
  for (const r of loose) {
    const c = await db.collection('classes').findOne({ _id: r.class });
    const [s, t] = await Promise.all([
      c.section ? db.collection('sections').findOne({ _id: c.section }) : null,
      c.topic ? db.collection('topics').findOne({ _id: c.topic }) : null,
    ]);
    console.log('\n== placement with no section', String(r._id), 'status', r.status, 'isActive', r.isActive, 'created', r.createdAt);
    console.log('   class', String(c._id), JSON.stringify(c.title), 'status', c.status, 'created', c.createdAt, 'apxAssetKey', c.apxAssetKey ?? '-',
      'hlsAsset', c.hlsAsset ? 'yes' : 'no', 'streamStatus', c.streamStatus ?? '-', 'createdBy', String(c.createdBy ?? c.addedBy ?? '-'));
    console.log('   class section', s ? `${s.sectionName ?? s.name} (${s._id}, created ${s._id.getTimestamp().toISOString()})` : '-',
      '› topic', t ? `${t.topicName ?? t.name} (${t._id})` : '-');
    const others = await db.collection('courseclasses').countDocuments({ class: r.class, course: { $ne: course._id } });
    console.log('   placements in other courses', others);
  }

  // AppX side: the latest mirrored student tree of this course (folders with direct video/pdf counts).
  if (course.apxCourseId != null) {
    const cid = [course.apxCourseId, String(course.apxCourseId), Number(course.apxCourseId)];
    const latest = await db.collection('apxcatalogtree').find({ apxCourseId: { $in: cid } }).sort({ _id: -1 }).limit(1).toArray();
    const runId = latest[0] && (latest[0].runId ?? latest[0].captureId);
    const pages = latest.length
      ? await db.collection('apxcatalogtree').find({ apxCourseId: { $in: cid }, ...(runId ? { runId } : {}) }).toArray()
      : [];
    console.log(`\n== AppX mirror tree, run ${runId ?? '?'}: ${pages.length} pages; page keys ${latest[0] ? Object.keys(latest[0]).join(',') : '-'}`);
    const kids = new Map();
    const seen = new Set();
    for (const p of pages)
      for (const r of p.rows || []) {
        if (seen.has(String(r.id))) continue;
        seen.add(String(r.id));
        const par = String(p.parentId ?? r.parent_id ?? '-1');
        (kids.get(par) ?? kids.set(par, []).get(par)).push(r);
      }
    const walk = (id, depth) => {
      const list = kids.get(id) || [];
      const n = (t) => list.filter((r) => String(r.material_type).toUpperCase() === t).length;
      for (const r of list.filter((r) => String(r.material_type).toUpperCase() === 'FOLDER')) {
        const sub = kids.get(String(r.id)) || [];
        const v = sub.filter((x) => String(x.material_type).toUpperCase() === 'VIDEO').length;
        const f = sub.filter((x) => String(x.material_type).toUpperCase() === 'PDF').length;
        console.log(`${'  '.repeat(depth)}${r.Title ?? r.title} [${r.id}] videos ${v} pdfs ${f}`);
        if (depth < 4) walk(String(r.id), depth + 1);
      }
      if (depth === 0) console.log(`root: videos ${n('VIDEO')} pdfs ${n('PDF')}`);
    };
    walk('-1', 0);
  }

  await client.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
