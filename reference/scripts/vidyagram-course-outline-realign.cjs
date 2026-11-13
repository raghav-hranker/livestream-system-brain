#!/usr/bin/env node
// Preview by default (writes nothing); **writes only with --apply and EXPECT=<mapped>/<to switch off>**. Refuses any DB but vidyagramdb.
// Apply: EJSON backup of every placement + emptied sections to ~/vg-course<id>-realign-backup-<stamp>.json on the box, creates
// missing topics like apxTaxonomyResolver, then one transaction of guarded placement writes (filter on the priority/section/topic
// the preview read), switch-offs (status 0, isActive false) and status 0 on sections the course left empty and nothing else uses.
// Undo: restore the placements from the backup (replaceOne by _id) and set the section back to status 1.
// realign one course's outline to its AppX folder tree.
// Walks the latest mirrored AppX tree in AppX's own order, maps each VIDEO row to our placement through the import
// ledger (apxcatalogimports placements[].rowId → classId; when two of our classes claim a row, the one whose asset
// id is in the row's current link wins), and works out per placement: Section › Topic › Subtopic from the AppX
// folders (Home and Videos/PDF wrappers dropped), and priority = position in AppX order (1..N).
// Placements no AppX row maps to are listed for switching off. Also: taxonomy to create, sections left empty,
// and the course topic order (coursetopics) in AppX order.
//
// Run on webserver2-2 from the VG checkout:
//   ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 'export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH; \
//     cd /var/www/backend.vidyagramar.com/vidyagram-backend && DOTENV_CONFIG_PATH=.env.development \
//     NODE_PATH=$PWD/node_modules/mongoose/node_modules:$PWD/node_modules node -r dotenv/config - 175' \
//     < reference/scripts/vidyagram-course-outline-realign.cjs
// Add VERBOSE=1 for every placement's change. Apply: prefix EXPECT=278/2 and pass `- 175 --apply`.
const { MongoClient } = require('mongodb');

const DB_NAME = 'vidyagramdb';
const apxCourseId = process.argv.slice(2).find((a) => !a.startsWith('dotenv_config') && !a.startsWith('--'));
const APPLY = process.argv.includes('--apply');
if (!apxCourseId) {
  console.error('usage: vidyagram-course-outline-realign.cjs <apxCourseId>');
  process.exit(2);
}
const WRAPPER = /^(videos?|vidoes|pdfs?|classes|dpps? ?& ?workbooks|additional notes)$/i;
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

(async () => {
  const client = new MongoClient(process.env.MONGO_URI, { readPreference: 'secondaryPreferred' });
  await client.connect();
  const db = client.db(DB_NAME);
  if (db.databaseName !== DB_NAME) throw new Error('wrong db');
  const cid = [String(apxCourseId), Number(apxCourseId)];

  const course = await db.collection('courses').findOne({ apxCourseId: { $in: cid } }, { projection: { title: 1 } });
  if (!course) throw new Error(`no Course for AppX ${apxCourseId}`);
  console.log('course', String(course._id), JSON.stringify(course.title));

  // --- AppX tree, in AppX order
  const pages = await db.collection('apxcatalogtree').find({ apxCourseId: { $in: cid } }).toArray();
  const kids = new Map();
  for (const p of pages) {
    const par = String(p.parentId);
    const list = kids.get(par) ?? [];
    for (const r of p.rows || []) if (!list.some((x) => String(x.id) === String(r.id))) list.push(r);
    kids.set(par, list);
  }
  const runs = [...new Set(pages.map((p) => p.lastSeenRunId))];
  const appx = []; // { rowId, title, folders, link }
  const walk = (id, folders) => {
    for (const r of kids.get(id) || []) {
      const type = String(r.material_type).toUpperCase();
      if (type === 'FOLDER') walk(String(r.id), [...folders, norm(r.Title)]);
      else if (type === 'VIDEO') appx.push({ rowId: String(r.id), title: norm(r.Title), folders, link: JSON.stringify([r.file_link, r.video_player_url, r.download_link, r.links]) });
    }
  };
  walk('-1', []);
  console.log(`AppX tree: ${pages.length} pages (lastSeenRunId ${runs.join(', ')}), ${appx.length} videos`);

  const target = (folders) => {
    const kept = folders.filter((f, i) => !(i === 0 && /^home$/i.test(f)) && !WRAPPER.test(f));
    const [section, topic, ...rest] = kept;
    return { section, topic, subTopic: rest.length ? rest.join(' – ') : null };
  };

  // --- our placements + ledger
  const rows = await db.collection('courseclasses').find({ course: course._id }).toArray();
  const byClass = new Map(rows.map((r) => [String(r.class), r]));
  const classes = await db.collection('classes').find({ _id: { $in: rows.map((r) => r.class) } }, { projection: { title: 1, apxAssetKey: 1 } }).toArray();
  const cls = new Map(classes.map((c) => [String(c._id), c]));
  const ledger = await db.collection('apxcatalogimports').find({ 'placements.apxCourseId': { $in: cid } }, { projection: { classId: 1, placements: 1 } }).toArray();
  const claim = new Map(); // rowId -> Set(classId placed in this course)
  for (const d of ledger)
    for (const p of d.placements || [])
      if (String(p.apxCourseId) === String(apxCourseId) && d.classId && byClass.has(String(d.classId)))
        (claim.get(String(p.rowId)) ?? claim.set(String(p.rowId), new Set()).get(String(p.rowId))).add(String(d.classId));

  const plan = [];
  const unmappedAppx = [];
  const used = new Set();
  appx.forEach((a, i) => {
    let ids = [...(claim.get(a.rowId) || [])].filter((id) => !used.has(id));
    if (ids.length > 1) {
      const live = ids.filter((id) => {
        const key = String(cls.get(id)?.apxAssetKey || '').split(':').pop();
        return key && a.link.includes(key);
      });
      if (live.length === 1) ids = live;
    }
    if (ids.length !== 1) return unmappedAppx.push({ ...a, candidates: ids });
    used.add(ids[0]);
    plan.push({ appx: a, row: byClass.get(ids[0]), want: { ...target(a.folders), priority: i + 1 } });
  });
  // keep priorities contiguous over mapped rows only
  plan.forEach((p, i) => (p.want.priority = i + 1));
  const leftover = rows.filter((r) => !used.has(String(r.class)));
  const alreadyOff = leftover.filter((r) => r.isActive === false && r.status === 0).length;

  // --- taxonomy lookups (names → ids), what is missing
  const sections = await db.collection('sections').find({ sectionName: { $in: [...new Set(plan.map((p) => p.want.section))] } }).toArray();
  const pickSection = (name) => {
    const hits = sections.filter((s) => s.sectionName === name);
    // prefer the one this course already uses
    return hits.find((s) => rows.some((r) => String(r.section) === String(s._id))) ?? hits.find((s) => s.status === 1) ?? hits[0];
  };
  const topicCache = new Map();
  const subCache = new Map();
  const toCreate = { sections: new Set(), topics: new Set(), subTopics: new Set() };
  for (const p of plan) {
    const s = pickSection(p.want.section);
    if (!s) toCreate.sections.add(p.want.section);
    p.want.sectionId = s?._id ?? null;
    const tk = `${s?._id}|${p.want.topic}`;
    if (!topicCache.has(tk)) topicCache.set(tk, s ? await db.collection('topics').findOne({ section: s._id, topicName: p.want.topic }) : null);
    const t = topicCache.get(tk);
    if (!t) toCreate.topics.add(`${p.want.section} › ${p.want.topic}`);
    p.want.topicId = t?._id ?? null;
    if (p.want.subTopic) {
      const sk = `${t?._id}|${p.want.subTopic}`;
      if (!subCache.has(sk)) subCache.set(sk, t ? await db.collection('subtopics').findOne({ topic: t._id, subTopicName: p.want.subTopic }) : null);
      const st = subCache.get(sk);
      if (!st) toCreate.subTopics.add(`${p.want.section} › ${p.want.topic} › ${p.want.subTopic}`);
      p.want.subTopicId = st?._id ?? null;
    } else p.want.subTopicId = null;
  }

  // --- diff
  const same = (a, b) => String(a ?? '') === String(b ?? '');
  const counts = { section: 0, topic: 0, subTopic: 0, priority: 0, names: 0, untouched: 0 };
  const moves = new Map();
  for (const p of plan) {
    const r = p.row;
    const ch = [];
    if (r.sectionName !== p.want.section || (p.want.sectionId && !same(r.section, p.want.sectionId))) (counts.section++, ch.push('section'));
    if (r.topicName !== p.want.topic || (p.want.topicId && !same(r.topic, p.want.topicId))) (counts.topic++, ch.push('topic'));
    if ((r.subTopicName ?? null) !== p.want.subTopic) (counts.subTopic++, ch.push('subTopic'));
    if (r.priority !== p.want.priority) (counts.priority++, ch.push('priority'));
    if (!ch.length) counts.untouched++;
    p.changes = ch;
    if (ch.includes('section') || ch.includes('topic') || ch.includes('subTopic')) {
      const k = `${r.sectionName} › ${r.topicName}${r.subTopicName ? ' › ' + r.subTopicName : ''}  →  ${p.want.section} › ${p.want.topic}${p.want.subTopic ? ' › ' + p.want.subTopic : ''}`;
      moves.set(k, (moves.get(k) || 0) + 1);
    }
  }

  console.log(`\nmapped ${plan.length} of ${rows.length} placements to ${appx.length} AppX videos`);
  console.log('field changes:', JSON.stringify(counts));
  console.log('\n== moves (rows)');
  for (const [k, n] of moves) console.log(`  ${n}× ${k}`);
  console.log('\n== taxonomy to create');
  for (const [k, v] of Object.entries(toCreate)) console.log(`  ${k}: ${[...v].join(' | ') || '-'}`);

  // order: per target topic, old order vs AppX order (only where it differs)
  console.log('\n== order changes inside a topic (AppX order shown; * = moved)');
  const groups = new Map();
  for (const p of plan) {
    const k = `${p.want.section} › ${p.want.topic}${p.want.subTopic ? ' › ' + p.want.subTopic : ''}`;
    (groups.get(k) ?? groups.set(k, []).get(k)).push(p);
  }
  let reordered = 0;
  for (const [k, list] of groups) {
    const oldOrder = [...list].sort((a, b) => a.row.priority - b.row.priority).map((p) => String(p.row._id));
    const diff = list.some((p, i) => String(p.row._id) !== oldOrder[i]);
    if (!diff) continue;
    reordered++;
    console.log(`  ${k}:`);
    list.forEach((p, i) => {
      const was = oldOrder.indexOf(String(p.row._id)) + 1;
      console.log(`    ${String(i + 1).padStart(2)}. ${p.appx.title}${was !== i + 1 ? `   * was ${was}` : ''}`);
    });
  }
  console.log(`  topics reordered: ${reordered} of ${groups.size}`);

  console.log('\n== group order (AppX): sections, then topics');
  const topicOrder = [];
  for (const p of plan) {
    const k = `${p.want.section} › ${p.want.topic}`;
    if (!topicOrder.includes(k)) topicOrder.push(k);
  }
  topicOrder.forEach((k, i) => console.log(`  ${i + 1}. ${k}`));
  const ct = await db.collection('coursetopics').find({ course: course._id }).toArray();
  console.log(`  coursetopics rows now: ${ct.length} (${ct.filter((x) => x.isActive).length} active) → would write ${topicOrder.length} active rows in this order`);

  console.log(`\n== placements with no AppX row (to switch off: status 0, isActive false); already off: ${alreadyOff}`);
  for (const r of leftover.filter((x) => !(x.isActive === false && x.status === 0))) {
    const c = cls.get(String(r.class));
    console.log(`  ${r._id} class ${r.class} ${JSON.stringify(r.apxTitle || c?.title)} asset ${c?.apxAssetKey ?? '-'} at ${r.sectionName ?? '<no section>'} › ${r.topicName ?? '-'} priority ${r.priority}`);
  }
  console.log('\n== AppX videos with no single placement');
  for (const a of unmappedAppx) console.log(`  row ${a.rowId} ${JSON.stringify(a.title)} ${a.folders.join(' > ')} candidates ${a.candidates.join(',') || 'none'}`);

  // sections this course would stop using
  const usedNow = new Set(rows.filter((r) => r.section).map((r) => String(r.section)));
  const usedAfter = new Set(plan.map((p) => String(p.want.sectionId)));
  console.log('\n== sections this course stops using');
  for (const id of usedNow) {
    if (usedAfter.has(id)) continue;
    const s = await db.collection('sections').findOne({ _id: rows.find((r) => String(r.section) === id).section });
    const refs = {
      otherCourseRows: await db.collection('courseclasses').countDocuments({ section: s._id, course: { $ne: course._id } }),
      classes: await db.collection('classes').countDocuments({ section: s._id }),
      pdfs: await db.collection('pdfs').countDocuments({ section: s._id }),
      coursepdfs: await db.collection('coursepdfs').countDocuments({ section: s._id }),
      topics: await db.collection('topics').countDocuments({ section: s._id }),
    };
    console.log(`  ${s.sectionName} ${s._id} status ${s.status} refs ${JSON.stringify(refs)}`);
  }

  if (process.env.VERBOSE)
    for (const p of plan) if (p.changes.length) console.log(`  ${p.row._id} ${p.appx.title}: ${p.changes.join(',')} → ${p.want.section} › ${p.want.topic} › ${p.want.subTopic ?? '-'} #${p.want.priority}`);

  await client.close();
  if (!APPLY) return;

  // ================= APPLY (only with --apply and EXPECT=<mapped>/<off>) =================
  const toOff = leftover.filter((r) => !(r.isActive === false && r.status === 0));
  const expect = `${plan.length}/${toOff.length}`;
  if (process.env.EXPECT !== expect) throw new Error(`refusing: EXPECT=${process.env.EXPECT} but plan is ${expect}`);
  if (unmappedAppx.length || toCreate.sections.size || toCreate.subTopics.size) throw new Error('refusing: unmapped AppX rows or missing section/subtopic');

  const w = new MongoClient(process.env.MONGO_URI, { readPreference: 'primary' });
  await w.connect();
  const wdb = w.db(DB_NAME);
  if (wdb.databaseName !== DB_NAME) throw new Error('wrong db');

  // 1. backup every placement of the course + the sections it stops using
  const { BSON } = require('mongodb');
  const fs = require('fs');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const backupPath = `${require('os').homedir()}/vg-course${apxCourseId}-realign-backup-${stamp}.json`;
  const dropSections = [...usedNow].filter((id) => !usedAfter.has(id));
  const backup = {
    course: course._id,
    courseclasses: await wdb.collection('courseclasses').find({ course: course._id }).toArray(),
    coursetopics: await wdb.collection('coursetopics').find({ course: course._id }).toArray(),
    sections: await wdb.collection('sections').find({ _id: { $in: rows.filter((r) => dropSections.includes(String(r.section))).map((r) => r.section) } }).toArray(),
  };
  fs.writeFileSync(backupPath, BSON.EJSON.stringify(backup, { relaxed: false }), { mode: 0o600 });
  console.log(`\nbackup ${backupPath}: ${backup.courseclasses.length} placements, ${backup.sections.length} sections`);

  // 2. topics to create (same shape as apxTaxonomyResolver.findOrCreateTopic)
  const createdTopics = [];
  for (const p of plan) {
    if (p.want.topicId) continue;
    let t = await wdb.collection('topics').findOne({ section: p.want.sectionId, topicName: p.want.topic });
    if (!t) {
      const top = await wdb.collection('topics').find({}).sort({ legacy_id: -1 }).limit(1).project({ legacy_id: 1 }).toArray();
      const now = new Date();
      const doc = { topicName: p.want.topic, section: p.want.sectionId, status: 1, customer_id: 781, legacy_id: (top[0]?.legacy_id ?? 0) + 1, createdAt: now, updatedAt: now, __v: 0 };
      const res = await wdb.collection('topics').insertOne(doc);
      t = { _id: res.insertedId };
      createdTopics.push(`${p.want.section} › ${p.want.topic} ${res.insertedId} legacy ${doc.legacy_id}`);
    }
    for (const q of plan) if (!q.want.topicId && String(q.want.sectionId) === String(p.want.sectionId) && q.want.topic === p.want.topic) q.want.topicId = t._id;
  }
  console.log('topics created:', createdTopics.length ? `\n  ${createdTopics.join('\n  ')}` : '-');

  // 3. one transaction: guarded placement writes, switch-offs, empty sections off
  const session = w.startSession();
  let summary;
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const ops = plan.filter((p) => p.changes.length).map((p) => ({
        updateOne: {
          filter: { _id: p.row._id, course: course._id, priority: p.row.priority, section: p.row.section ?? null, topic: p.row.topic ?? null },
          update: {
            $set: {
              section: p.want.sectionId, topic: p.want.topicId, subTopic: p.want.subTopicId,
              sectionName: p.want.section, topicName: p.want.topic, priority: p.want.priority, updatedAt: now,
              ...(p.want.subTopic ? { subTopicName: p.want.subTopic } : {}),
            },
            ...(p.want.subTopic ? {} : { $unset: { subTopicName: '' } }),
          },
        },
      }));
      const offOps = toOff.map((r) => ({ updateOne: { filter: { _id: r._id, course: course._id, isActive: r.isActive ?? true }, update: { $set: { status: 0, isActive: false, updatedAt: now } } } }));
      const res = await wdb.collection('courseclasses').bulkWrite([...ops, ...offOps], { ordered: true, session });
      if (res.matchedCount !== ops.length + offOps.length) throw new Error(`guard: matched ${res.matchedCount} of ${ops.length + offOps.length}; aborting`);
      const offSections = [];
      for (const id of dropSections) {
        const sid = rows.find((r) => String(r.section) === id).section;
        const still = await wdb.collection('courseclasses').countDocuments({ section: sid }, { session });
        const other = (await wdb.collection('classes').countDocuments({ section: sid }, { session })) + (await wdb.collection('pdfs').countDocuments({ section: sid }, { session }));
        if (still || other) { console.log(`  section ${id} still used (${still} rows, ${other} classes/pdfs); left on`); continue; }
        await wdb.collection('sections').updateOne({ _id: sid, status: 1 }, { $set: { status: 0, updatedAt: now } }, { session });
        offSections.push(id);
      }
      summary = { placementsUpdated: res.modifiedCount, matched: res.matchedCount, switchedOff: offOps.length, sectionsOff: offSections };
    });
  } finally {
    await session.endSession();
    await w.close();
  }
  console.log('APPLIED', JSON.stringify(summary));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
