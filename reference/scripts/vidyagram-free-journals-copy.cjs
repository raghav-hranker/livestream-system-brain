// Copies toppers' FREE, active editorial journals (adminPanelDB) into vidyagramdb, with the editorial tags they use.
// Dry run by default. COMMIT=1 inserts only; never updates or deletes an existing Vidyagram row.
//
// Journals keep their _id and content. Changed on the copy:
//   - seriesIds / seriesAssignments emptied: their tests live in adminPanelDB and are not copied.
//   - likeCount 0 (toppers students' likes are not Vidyagram's).
//   - daily_journal dates re-dated to recent days (user 2026-11-12: "give recent dates"): the oldest original
//     date gets the earliest new day, the newest gets END_DATE, one per day, UTC midnight like the originals.
//     The original date is kept in `copiedFrom.date`.
//   - copiedFrom: { db, date, at } marks the row as a copy.
// Tags: the active toppers tags whose name+type the copied journals use, same _id, customer_id = Vidyagram (781).
// Media URLs (toppers-wisdom.hranker.org) are left as they are.
//
// Ledger of inserted ids → LEDGER (default ./vg-free-journals-copy-<UTC date>.ids.json). Undo:
//   UNDO=<ledger> COMMIT=1 … deletes exactly those journal and tag ids (journals only while likeCount is still 0).
// Run on webserver2-2 from the Vidyagram checkout (needs its mongoose):
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend
//   URI=$(grep -E '^MONGO_URI=' .env.development | cut -d= -f2- | tr -d '"') [END_DATE=YYYY-MM-DD] nice -n 10 node - < script
const fs = require('fs');
const mongoose = require('mongoose');

const COMMIT = process.env.COMMIT === '1';
const VG_CUSTOMER_ID = 781;
const today = new Date().toISOString().slice(0, 10);
const END_DATE = process.env.END_DATE || today;
const LEDGER = process.env.LEDGER || `vg-free-journals-copy-${today}.ids.json`;
const DAY = 86400000;

async function undo(vg, file) {
  const led = JSON.parse(fs.readFileSync(file, 'utf8'));
  const jIds = led.journals.map((x) => new mongoose.Types.ObjectId(x));
  const tIds = led.tags.map((x) => new mongoose.Types.ObjectId(x));
  const jFilter = { _id: { $in: jIds }, likeCount: { $in: [0, null] } };
  console.log(JSON.stringify({ mode: COMMIT ? 'undo' : 'undo-dry-run',
    journals: await vg.collection('editorialjournals').countDocuments(jFilter),
    tags: await vg.collection('editorialtags').countDocuments({ _id: { $in: tIds } }) }));
  if (!COMMIT) return;
  console.log(JSON.stringify({
    journalsDeleted: (await vg.collection('editorialjournals').deleteMany(jFilter)).deletedCount,
    tagsDeleted: (await vg.collection('editorialtags').deleteMany({ _id: { $in: tIds } })).deletedCount,
  }));
}

(async () => {
  const conn = await mongoose.createConnection(process.env.URI, { readPreference: 'primary' }).asPromise();
  const tw = conn.useDb('adminPanelDB');
  const vg = conn.useDb('vidyagramdb');
  try {
    if (process.env.UNDO) return await undo(vg, process.env.UNDO);

    const src = await tw.collection('editorialjournals').find({ isFree: true, isActive: true }).toArray();
    const existing = new Set((await vg.collection('editorialjournals')
      .find({ _id: { $in: src.map((j) => j._id) } }, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id)));
    const todo = src.filter((j) => !existing.has(String(j._id)));

    const daily = todo.filter((j) => j.type === 'daily_journal').sort((a, b) => (a.date || 0) - (b.date || 0));
    const end = new Date(`${END_DATE}T00:00:00.000Z`).getTime();
    const newDate = new Map(daily.map((j, i) => [String(j._id), new Date(end - (daily.length - 1 - i) * DAY)]));

    const at = new Date();
    const journals = todo.map((j) => ({
      ...j,
      seriesIds: [],
      seriesAssignments: [],
      likeCount: 0,
      ...(newDate.has(String(j._id)) ? { date: newDate.get(String(j._id)) } : {}),
      copiedFrom: { db: 'adminPanelDB', date: j.date ?? null, at },
      updatedAt: at,
    }));

    const wanted = [...new Set(journals.map((j) => `${j.tag}\u0000${j.type}`))];
    const srcTags = await tw.collection('editorialtags').find({ status: 1 }).toArray();
    const tagRows = srcTags.filter((t) => wanted.includes(`${t.name}\u0000${t.type}`));
    const vgTags = await vg.collection('editorialtags').find({}).toArray();
    const tagTodo = tagRows.filter((t) => !vgTags.some((v) => String(v._id) === String(t._id)
      || (v.name === t.name && v.type === t.type && Number(v.customer_id) === VG_CUSTOMER_ID)))
      .map((t) => ({ ...t, customer_id: VG_CUSTOMER_ID, updatedAt: at }));
    const missingTags = wanted.filter((k) => !tagRows.some((t) => `${t.name}\u0000${t.type}` === k));

    console.log(JSON.stringify({ mode: COMMIT ? 'commit' : 'dry-run', sourceFreeActive: src.length,
      alreadyInVg: existing.size, journalsToInsert: journals.length, tagsToInsert: tagTodo.length,
      tagsWithoutActiveSource: missingTags.map((k) => k.replace('\u0000', '/')) }));
    for (const j of journals) {
      console.log(' -', j.type, j.date ? j.date.toISOString().slice(0, 10) : '(no date)',
        '<-', j.copiedFrom.date ? new Date(j.copiedFrom.date).toISOString().slice(0, 10) : '-',
        JSON.stringify(j.title || '').slice(0, 60), `tag=${j.tag}`);
    }
    for (const t of tagTodo) console.log(' tag', String(t._id), t.name, t.type);
    if (!COMMIT) return;

    const ledger = { journals: [], tags: [] };
    if (tagTodo.length) {
      await vg.collection('editorialtags').insertMany(tagTodo, { ordered: false }).catch((e) => console.error('tag insert:', e.message));
      ledger.tags = (await vg.collection('editorialtags').find({ _id: { $in: tagTodo.map((t) => t._id) } }, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id));
    }
    if (journals.length) {
      await vg.collection('editorialjournals').insertMany(journals, { ordered: false }).catch((e) => console.error('journal insert:', e.message));
      ledger.journals = (await vg.collection('editorialjournals').find({ _id: { $in: journals.map((j) => j._id) } }, { projection: { _id: 1 } }).toArray()).map((d) => String(d._id));
    }
    fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
    console.log(JSON.stringify({ inserted: { journals: ledger.journals.length, tags: ledger.tags.length }, ledger: LEDGER }));
  } finally {
    await conn.close();
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
