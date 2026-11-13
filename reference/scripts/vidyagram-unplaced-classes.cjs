#!/usr/bin/env node
// Read-only. Vidyagram classes still in the holding taxonomy ("Vidyagram import (unplaced)") and
// whether each has a CourseClass placement. Splits by import night (ledger apxcatalogimports.firstRunId
// / createdAt) so nightly-created classes show separately from the 10-14 bulk import.
//
//   NODE_PATH=~/Projects/quicktricks-backend/node_modules \
//     node reference/scripts/vidyagram-unplaced-classes.cjs ~/Projects/worktrees/vg-backend/.env.development [OUT.json]
//
// Needs MONGO_URI in the env file; refuses any db other than vidyagramdb.
const fs = require('fs');
const path = require('path');

const envFile = process.argv[2];
const out = process.argv[3];
if (!envFile) { console.error('usage: <env file> [out.json]'); process.exit(2); }
for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const { mongo } = require('mongoose');

(async () => {
  const client = new mongo.MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000, readPreference: 'primary' });
  await client.connect();
  const db = client.db('vidyagramdb');
  const holding = await db.collection('sections').findOne({ sectionName: 'Vidyagram import (unplaced)' }, { projection: { _id: 1 } })
    ?? await db.collection('sections').findOne({ name: 'Vidyagram import (unplaced)' }, { projection: { _id: 1 } });
  if (!holding) throw new Error('holding section not found');

  const classes = await db.collection('classes').find({}, {
    projection: { _id: 1, title: 1, section: 1, topic: 1, subTopic: 1, createdAt: 1, apxAssetKey: 1, status: 1 },
  }).toArray();
  const placed = new Set((await db.collection('courseclasses').distinct('class')).map(String));
  const ledger = new Map((await db.collection('apxcatalogimports').find({}, {
    projection: { assetKey: 1, runId: 1, firstRunId: 1, createdAt: 1, placements: 1 },
  }).toArray()).map((r) => [r.assetKey, r]));

  const byDay = {};
  const rows = [];
  let inHolding = 0; let elsewhere = 0;
  for (const c of classes) {
    const holdingClass = String(c.section) === String(holding._id);
    if (holdingClass) inHolding++; else elsewhere++;
    const day = c.createdAt ? new Date(c.createdAt.getTime() + 5.5 * 3600e3).toISOString().slice(0, 10) : 'unknown';
    const d = (byDay[day] ??= { total: 0, holding: 0, holdingNoTopic: 0, noCourseClass: 0, holdingAndNoCourseClass: 0 });
    d.total++;
    if (holdingClass) d.holding++;
    if (holdingClass && !c.topic) d.holdingNoTopic++;
    const hasCC = placed.has(String(c._id));
    if (!hasCC) d.noCourseClass++;
    if (holdingClass && !hasCC) d.holdingAndNoCourseClass++;
    if (day >= '2026-10-19' && holdingClass) {
      const l = ledger.get(c.apxAssetKey);
      rows.push({ id: String(c._id), title: c.title, day, hasCourseClass: hasCC, ledgerRun: l?.firstRunId ?? l?.runId ?? null,
        placements: (l?.placements ?? []).map((p) => ({ course: p.course, section: p.section, topic: p.topic, subTopic: p.subTopic })) });
    }
  }
  const summary = { holdingSectionId: String(holding._id), classes: classes.length, inHolding, elsewhere, courseClassDistinctClasses: placed.size, byDay };
  console.log(JSON.stringify(summary, null, 1));
  console.log('since 10-19 in holding:', rows.length, 'with CourseClass:', rows.filter((r) => r.hasCourseClass).length,
    'with ledger placements:', rows.filter((r) => r.placements.length).length);
  if (out) fs.writeFileSync(path.resolve(out), JSON.stringify({ summary, rows }, null, 1));
  await client.close();
})().catch((e) => { console.error('ERR', String(e.message).replace(/mongodb(\+srv)?:\/\/\S+/g, '<uri>')); process.exit(1); });
