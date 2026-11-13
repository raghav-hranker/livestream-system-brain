// mongosh, vidyagramdb. Turns the AppX HTML in Course.fullDescription into plain lines in
// Course.description (what the admin form edits) and removes fullDescription, so admin and
// students see the same text (decided 2026-10-19, option B). Only imported courses
// (apxCourseId set) with a non-empty fullDescription. MODE=dry (default) prints samples and
// writes nothing; MODE=commit first copies every touched course to BACKUP, then updates.
//   MODE=dry OUT=/path/report.json mongosh "$URI" --quiet --file vidyagram-course-description-lines.js
const MODE = process.env.MODE || 'dry';
const BACKUP = 'courses_backup_20261019_description';
const OUT = process.env.OUT || null;

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', bull: '•' };
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

const toLines = (html) => decode(String(html)
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|li|h[1-6]|div|tr|ul|ol|blockquote)>/gi, '\n')
  .replace(/<[^>]+>/g, ''))
  .split(/\r?\n/)
  .map((l) => l.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

const filter = { apxCourseId: { $exists: true }, fullDescription: { $type: 'string', $ne: '' } };
const courses = db.courses.find(filter, { title: 1, apxCourseId: 1, description: 1, fullDescription: 1 }).toArray();
const plan = courses.map((c) => ({ _id: c._id, apxCourseId: c.apxCourseId, title: c.title, before: c.description, lines: toLines(c.fullDescription) }));
const empty = plan.filter((p) => !p.lines.length);
const hadDescription = plan.filter((p) => Array.isArray(p.before) ? p.before.length : p.before);
print(JSON.stringify({ mode: MODE, courses: plan.length, convertedToNoLines: empty.length, alreadyHadDescription: hadDescription.length,
  lines: { min: Math.min(...plan.map((p) => p.lines.length)), max: Math.max(...plan.map((p) => p.lines.length)) } }));
if (OUT) require('fs').writeFileSync(OUT, JSON.stringify(plan.map(({ apxCourseId, title, lines }) => ({ apxCourseId, title, lines })), null, 1));

if (MODE === 'commit') {
  if (empty.length || hadDescription.length) { print('ABORT: some courses convert to nothing or already have a description'); quit(1); }
  if (db.getCollectionNames().includes(BACKUP)) { print('ABORT: backup exists'); quit(1); }
  db.getCollection(BACKUP).insertMany(db.courses.find({ _id: { $in: plan.map((p) => p._id) } }).toArray(), { writeConcern: { w: 'majority' } });
  if (db.getCollection(BACKUP).countDocuments({}) !== plan.length) { print('ABORT: backup count mismatch'); quit(1); }
  let n = 0;
  for (const p of plan) {
    n += db.courses.updateOne({ _id: p._id, fullDescription: { $type: 'string' } },
      { $set: { description: p.lines }, $unset: { fullDescription: '' } }, { writeConcern: { w: 'majority' } }).modifiedCount;
  }
  print(JSON.stringify({ backedUp: plan.length, updated: n, left: db.courses.countDocuments(filter) }));
}
