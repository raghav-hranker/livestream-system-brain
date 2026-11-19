// Read-only, vidyagramdb: every AppX PDF whose title or folder path says "planner", per course, and whether our
// Run on webserver2-2 from the VG checkout: ssh … 'cd /var/www/backend.vidyagramar.com/vidyagram-backend && DOTENV_CONFIG_PATH=.env.development NODE_PATH=$PWD/node_modules/mongoose/node_modules:$PWD/node_modules node -r dotenv/config -' < this file. One JSON line per course with a planner; state per item: topic | folder (new) | HIDDEN | NOT IMPORTED.
// student outline (topic-and-section, folders on) shows a topic holding a CoursePdf of that title.
const { MongoClient } = require('mongodb');
const fold = (n) => String(n ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const isPlanner = (s) => /plann?er|planer|प्लानर/i.test(s);
(async () => {
  const c = new MongoClient(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' }); await c.connect();
  const db = c.db('vidyagramdb');
  if (db.databaseName !== 'vidyagramdb') throw new Error('wrong db');
  const courses = await db.collection('courses').find({ apxCourseId: { $exists: true, $ne: null } }).project({ title: 1, apxCourseId: 1, status: 1 }).toArray();
  const t = (x) => x.Title ?? x.title ?? '', ty = (x) => String(x.material_type ?? '').toUpperCase();
  for (const course of courses) {
    const ids = [String(course.apxCourseId), Number(course.apxCourseId)];
    const pages = await db.collection('apxcatalogtree').find({ apxCourseId: { $in: ids } }).toArray();
    const byParent = new Map(); for (const p of pages) { const k = String(p.parentId); byParent.set(k, [...(byParent.get(k) ?? []), ...(p.rows ?? [])]); }
    const found = [];
    const walk = (id, path, d) => { if (d > 8) return; for (const row of byParent.get(String(id)) ?? []) {
      if (ty(row) === 'FOLDER') walk(row.id, [...path, t(row)], d + 1);
      else if (ty(row) === 'PDF' && (isPlanner(t(row)) || path.some(isPlanner))) found.push({ title: t(row), path: path.join(' › ') });
    } };
    walk('-1', [], 0);
    if (!found.length) continue;
    const cps = await db.collection('coursepdfs').find({ course: course._id, isActive: { $ne: false } }).project({ apxTitle: 1, sectionName: 1, topicName: 1, pdf: 1 }).toArray();
    const pdfTitles = new Map((await db.collection('pdfs').find({ _id: { $in: cps.map(x => x.pdf) } }).project({ title: 1 }).toArray()).map(p => [String(p._id), p.title]));
    const r = await fetch('http://localhost:4100/api/topic-and-section?courseId=' + course._id).then(r => r.json()).catch(() => null);
    const topics = r?.data?.topics ?? [];
    const shown = (cp) => topics.find(tp => fold(tp.topicName) === fold(cp.topicName) && tp.sections.some(s => fold(s.sectionName) === fold(cp.sectionName)));
    const items = found.map(f => {
      const cp = cps.find(x => fold(x.apxTitle) === fold(f.title) || fold(pdfTitles.get(String(x.pdf))) === fold(f.title));
      const topic = cp && shown(cp);
      return { ...f, ours: cp ? `${cp.sectionName} › ${cp.topicName}` : null, state: !cp ? 'NOT IMPORTED' : !topic ? 'HIDDEN' : topic.classCount === 0 ? 'folder (new)' : 'topic' };
    });
    console.log(JSON.stringify({ apx: course.apxCourseId, status: course.status, title: course.title, items }));
  }
  await c.close();
})().catch(e => { console.error(e); process.exit(1); });
