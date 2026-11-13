// Read-only, refuses any DB but vidyagramdb: how many active CoursePdf rows would appear in `pdfs` on
// GET /api/topics/:topicId/classes? A PDF appears when its effective (section, topic) names equal the names of a class
// placement in the same course; the outline (GET /api/topic-and-section) is built from class placements only.
// Prints: inTopic, sectionDiffers (topic name matches, section does not), allNotes (no topic name, Ebooks only),
// noOutlineTopic (names no class topic, Ebooks only). COURSE=<courseId> also lists that course's rows left out.
// Run on webserver2-2 from the Vidyagram checkout: URI=<MONGO_URI from .env> node - < script
const mongoose = require('mongoose');
const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const pair = (section, topic) => `${clean(section)}\u0000${clean(topic)}`;
(async () => {
  await mongoose.connect(process.env.URI, { serverSelectionTimeoutMS: 8000, readPreference: 'secondaryPreferred' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error('refusing: connected to ' + db.databaseName);

  const nameMap = async (collection, field) => new Map(
    (await db.collection(collection).find({}, { projection: { [field]: 1 } }).toArray()).map((doc) => [String(doc._id), doc[field]]),
  );
  const topics = await nameMap('topics', 'topicName');
  const sections = await nameMap('sections', 'sectionName');

  const outline = new Map();
  const cursor = db.collection('courseclasses').find(
    { isActive: true },
    { projection: { course: 1, section: 1, topic: 1, sectionName: 1, topicName: 1, apxDisplayPlacements: 1 } },
  );
  for await (const row of cursor) {
    const key = String(row.course);
    if (!outline.has(key)) outline.set(key, { pairs: new Set(), topicNames: new Set() });
    const entry = outline.get(key);
    const add = (section, topic) => {
      if (!clean(topic)) return;
      entry.pairs.add(pair(section, topic));
      entry.topicNames.add(clean(topic));
    };
    const displays = row.apxDisplayPlacements || [];
    if (displays.length) {
      for (const display of displays) add(display.sectionName, display.topicName);
    } else {
      add(row.sectionName || sections.get(String(row.section)), row.topicName || topics.get(String(row.topic)));
    }
  }

  const pdfs = new Map((await db.collection('pdfs').find({}, { projection: { section: 1, topic: 1 } }).toArray()).map((doc) => [String(doc._id), doc]));
  const placements = await db.collection('coursepdfs').find(
    { isActive: { $ne: false } },
    { projection: { course: 1, pdf: 1, sectionName: 1, topicName: 1 } },
  ).toArray();

  const totals = { placements: placements.length, inTopic: 0, sectionDiffers: 0, allNotes: 0, noOutlineTopic: 0 };
  const leftOut = new Map();
  for (const row of placements) {
    const key = String(row.course);
    const pdf = pdfs.get(String(row.pdf)) || {};
    const topicName = clean(row.topicName) || clean(topics.get(String(pdf.topic)));
    const sectionName = clean(row.sectionName) || clean(sections.get(String(pdf.section)));
    const entry = outline.get(key);
    let verdict = 'noOutlineTopic';
    if (!topicName) verdict = 'allNotes';
    else if (entry && entry.pairs.has(pair(sectionName, topicName))) verdict = 'inTopic';
    else if (entry && entry.topicNames.has(topicName)) verdict = 'sectionDiffers';
    totals[verdict] += 1;
    if (verdict !== 'inTopic' && verdict !== 'allNotes') {
      const label = `${sectionName} > ${topicName}`;
      leftOut.set(label, (leftOut.get(label) || 0) + 1);
      if (process.env.COURSE === key) console.log(`${verdict}: ${label}`);
    }
  }
  console.log(JSON.stringify(totals));
  console.log('top names left out:', JSON.stringify([...leftOut.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)));
  await mongoose.disconnect();
})().catch((error) => { console.error(error.message); process.exit(1); });
