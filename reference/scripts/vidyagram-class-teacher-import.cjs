// Vidyagram: class → real teacher, DRY RUN ONLY (no write path yet; the commit comes after the user reviews this).
// Reads live vidyagramdb (classes, apxcatalogimports ledger, apxcatalogcourses, facultydetails) and proposes one
// FacultyDetails profile per class. Rules, first match wins (report vidyagram/reports/vidyagram-appx-teacher-source-2026-10-22.md):
//   title        high    the class's own AppX title names one teacher ("… | Deepak Sir", "(By Aditya Sir)")
//   folder       high    a folder on a placement path names one teacher ("Complete GS By Deepak Sir")
//   course       medium  the AppX course title names exactly one teacher and no "Team"
//   description  medium  the AppX course description's subject list ("Hindi: Mohit Sir", "Riya Mam – Computer"),
//                        matched to the deepest path folder naming that subject; a subject with two teachers is skipped
//   sibling      medium  ≥3 named classes in the same folder, all one teacher
//   subject      low     ≥3 stated classes under the same top subject folder of the course, all one teacher
// "Stated" = decided by title, folder, course or description. (A whole-course rule was tried and dropped:
// it put Chemistry classes in course 7 on the Maths teacher.) A class gets a teacher only when its placements agree; otherwise "review".
// Writable = teacherName "Vidyagram Team" and no facultyId (a manual Change faculty is never overwritten).
// Run from the Vidyagram backend checkout on webserver2-2; prints one JSON document:
//   ssh … 'export PATH=…nvm…/bin:$PATH; cd /var/www/backend.vidyagramar.com/vidyagram-backend && node -' \
//     < vidyagram-class-teacher-import.cjs > dryrun.json
require('dotenv').config({ path: '.env.development' });
const mongoose = require('mongoose');

const PLACEHOLDER = 'Vidyagram Team';

// --- names ---------------------------------------------------------------------------------------------
const ALIASES = { // spelling → canonical key; Aditya confirmed 10-22, Jay/Akash supported by course descriptions
  'shubham mam': 'shubham grover maam', 'shubham maam': 'shubham grover maam', 'arti mam': 'arti maam',
  'riya mam': 'riya maam', 'anshi mam': 'anshi maam', 'jay sir': 'jai sir', 'akash sir': 'akash chaturvedi sir',
  'aditya sir': 'aditya ranjan sir', 'rashika mam': 'rashika maam',
};
const NOT_TEACHERS = new Set(['team', 'expert team', 'gs expert team', 'team vidyagram', 'vidyagram team', 'gs experts', 'gs expert']);
const HON = String.raw`(sir|ma['’]?am|mam|madam|maam)`;
const BY_RE = new RegExp(String.raw`\bby\s+((?:[A-Za-z.]+\s*){1,3}?)\s*${HON}\b`, 'gi');
const BARE_RE = new RegExp(String.raw`(?:^|[|(\[\-–:,&]\s*|\s)((?:[A-Z][A-Za-z.]*)(?:\s+[A-Z][A-Za-z.]*)?)\s+${HON}\b`, 'gi');
const STOP = new Set(['by', 'for', 'and', 'the', 'class', 'series', 'batch', 'special', 'complete', 'with', 'of', 'experts', 'expert']);
const canon = (words, hon) => {
  const w = words.toLowerCase().replace(/\s+/g, ' ').trim().split(' ').filter((x) => x && !STOP.has(x));
  if (!w.length || NOT_TEACHERS.has(w.join(' '))) return null;
  const key = `${w.join(' ')} ${/^s/i.test(hon) ? 'sir' : 'maam'}`;
  return ALIASES[key] || key;
};
const namesIn = (s) => {
  const found = new Set();
  if (!s) return found;
  const t = String(s).replace(/[️​-‍]/g, '');
  for (const re of [BY_RE, BARE_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t))) { const k = canon(m[1], m[2]); if (k) found.add(k); }
  }
  return found;
};
const profileKey = (name) => { const s = namesIn(`By ${name}`); return s.size === 1 ? [...s][0] : name.toLowerCase().trim(); };

// --- subjects (description lists → path folders) -------------------------------------------------------
const SUBJECTS = [ // [subject, regex for a description label, regex for a path folder]; specific before broad
  ['Bihar GK', /bihar\s*gk/i, /bihar/i],
  ['UP GK', /up\s*gk/i, /up\s*gk|upgk|^up\b|उत्तर प्रदेश/i],
  ['Computer', /computer/i, /computer|कंप्यूटर|संगणना/i],
  ['Science', /science/i, /science|विज्ञान|biology|physics|chemistry/i],
  ['Maths', /math/i, /math|गणित/i],
  ['Reasoning', /reasoning/i, /reasoning|रीजनिंग|तर्क/i],
  ['English', /english/i, /english|अंग्रेज/i],
  ['Hindi', /hindi|हिंदी|हिन्दी/i, /hindi|हिंदी|हिन्दी/i],
  ['GS', /\bgs\b|gk\/gs|general/i, /\bgs\b|gk\/gs|gk|polity|history|geograph|econom|current affairs|static/i],
];
const ENTITIES = { nbsp: ' ', amp: '&', ndash: '–', mdash: '–', rsquo: "'", lsquo: "'", apos: "'", quot: '"', zwj: '', zwnj: '' };
const htmlText = (h) => String(h || '').replace(/<br\s*\/?>|<\/p>|<\/li>|<\/div>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
const descriptionTable = (desc) => { // subject → Set(teacher)
  const table = new Map();
  for (const raw of htmlText(desc).split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line || line.length > 120) continue;
    const parts = line.split(/\s*[:–]\s*|\s+-\s+/);
    if (parts.length < 2) continue;
    for (let i = 0; i < parts.length; i++) {
      const names = namesIn(parts[i]);
      if (!names.size) continue;
      const label = parts.filter((_, j) => j !== i).join(' ');
      const subj = SUBJECTS.find(([, labelRe]) => labelRe.test(label));
      if (!subj) continue;
      if (!table.has(subj[0])) table.set(subj[0], new Set());
      for (const n of names) table.get(subj[0]).add(n);
      break;
    }
  }
  return table;
};
const MEDIA = /^(video|videos|vidoes|pdf|pdfs|notes|content)$/i;
const folders = (p) => (p.path || []).slice(1).filter((s) => !MEDIA.test(String(s).trim()));

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'primary' });
  const db = mongoose.connection.db;
  if (db.databaseName !== 'vidyagramdb') throw new Error(`wrong db ${db.databaseName}`);

  const profiles = await db.collection('facultydetails').find({}, { projection: { name: 1, status: 1 } }).toArray();
  const profileByKey = new Map(profiles.filter((f) => f.status === 1).map((f) => [profileKey(f.name), f]));

  const apxCourses = await db.collection('apxcatalogcourses').find({}, {
    projection: { apxCourseId: 1, 'listRow.title': 1, 'detail.title': 1, 'detail.description': 1 },
  }).toArray();
  const courseInfo = new Map(apxCourses.map((c) => {
    const title = c.listRow?.title || c.detail?.title || '';
    const n = namesIn(title);
    return [String(c.apxCourseId), {
      title,
      courseTeacher: n.size === 1 && !/\bteam\b/i.test(title) ? [...n][0] : null,
      table: descriptionTable(c.detail?.description),
    }];
  }));

  const classes = await db.collection('classes').find({ apxAssetKey: { $exists: true } }, {
    projection: { title: 1, status: 1, teacherName: 1, facultyId: 1 },
  }).toArray();
  const ledger = new Map((await db.collection('apxcatalogimports').find({}, {
    projection: { classId: 1, placements: 1 },
  }).toArray()).map((r) => [String(r.classId), r.placements || []]));

  // pass 1: own names (title, folder)
  const rows = classes.map((c) => {
    const placements = ledger.get(String(c._id)) || [];
    const title = new Set(namesIn(c.title));
    const folder = new Set();
    for (const p of placements) {
      for (const n of namesIn(p.apxTitle || p.title)) title.add(n);
      for (const seg of p.path || []) for (const n of namesIn(seg)) folder.add(n);
    }
    return { c, placements, title, folder };
  });

  // the stated rules; their single-teacher answers anchor the inferred rules below
  const STATED = [
    ['title', 'high', (r) => r.title],
    ['folder', 'high', (r) => r.folder],
    ['title', 'high', (r) => r.title],
    ['folder', 'high', (r) => r.folder],
    ['course', 'medium', (r) => new Set(r.placements.map((p) => courseInfo.get(String(p.apxCourseId))?.courseTeacher).filter(Boolean))],
    ['description', 'medium', (r) => {
      const out = new Set();
      for (const p of r.placements) {
        const table = courseInfo.get(String(p.apxCourseId))?.table;
        if (!table?.size) continue;
        const segs = folders(p).reverse();
        let hit = null;
        for (const seg of segs) {
          const subj = SUBJECTS.find(([s, , pathRe]) => table.has(s) && pathRe.test(seg));
          if (subj) { hit = table.get(subj[0]); break; }
        }
        if (hit && hit.size === 1) out.add([...hit][0]);
        if (hit && hit.size > 1) out.add('__several__');
      }
      return out;
    }],
  ];

  // tallies of stated teachers per folder, top subject folder and course: a mixed course is never "one teacher"
  const tally = { sibling: new Map(), subject: new Map() };
  const bump = (m, k, n) => { if (!m.has(k)) m.set(k, new Map()); const t = m.get(k); t.set(n, (t.get(n) || 0) + 1); };
  for (const r of rows) {
    const s = STATED.map(([, , fn]) => fn(r)).find((x) => x.size);
    if (!s || s.size !== 1 || s.has('__several__')) continue;
    const [stated] = [...s];
    for (const p of r.placements) {
      const f = folders(p);
      bump(tally.sibling, `${p.apxCourseId}|${f.join(' > ')}`, stated);
      bump(tally.subject, `${p.apxCourseId}|${f[0] || ''}`, stated);
    }
  }
  const unanimous = (m, k, min) => { const t = m.get(k); if (!t || t.size !== 1) return null; const [[n, cnt]] = [...t]; return cnt >= min ? n : null; };

  // pass 2: rules
  const RULES = [
    ...STATED,
    ['sibling', 'medium', (r) => new Set(r.placements.map((p) => unanimous(tally.sibling, `${p.apxCourseId}|${folders(p).join(' > ')}`, 3)).filter(Boolean))],
    ['subject', 'low', (r) => new Set(r.placements.map((p) => unanimous(tally.subject, `${p.apxCourseId}|${folders(p)[0] || ''}`, 3)).filter(Boolean))],
  ];

  const out = [];
  for (const r of rows) {
    // the first rule naming exactly one teacher wins; a rule naming several only marks the class for review
    let teacher = null; let rule = 'none'; let confidence = 'none'; const seen = {};
    for (const [name, conf, fn] of RULES) {
      const s = fn(r);
      if (!s.size) continue;
      seen[name] = [...s];
      if (teacher) continue;
      if (s.size === 1 && !s.has('__several__')) { [teacher] = [...s]; rule = name; confidence = conf; } else if (rule === 'none') { rule = name; confidence = 'review'; }
    }
    const conflicts = teacher ? [...new Set(Object.values(seen).flat())].filter((n) => n !== teacher && n !== '__several__') : [];
    const profile = teacher ? profileByKey.get(teacher) : null;
    const currentName = String(r.c.teacherName || '').trim();
    const writable = currentName === PLACEHOLDER && !r.c.facultyId;
    out.push({
      classId: String(r.c._id), status: r.c.status, title: r.c.title, currentName,
      currentFacultyId: r.c.facultyId ? String(r.c.facultyId) : null,
      teacher: profile ? profile.name : teacher, facultyId: profile ? String(profile._id) : null,
      rule, confidence: teacher && conflicts.length ? `${confidence}-conflict` : confidence, conflicts,
      noProfile: Boolean(teacher && !profile), writable,
      apxCourses: [...new Set(r.placements.map((p) => String(p.apxCourseId)))],
      path: r.placements[0] ? (r.placements[0].path || []).join(' > ') : '',
    });
  }

  const count = (f) => out.filter(f).length;
  const group = (key, f = () => true) => out.filter(f).reduce((a, x) => { a[x[key]] = (a[x[key]] || 0) + 1; return a; }, {});
  const tables = Object.fromEntries([...courseInfo].filter(([, v]) => v.table.size)
    .map(([id, v]) => [id, Object.fromEntries([...v.table].map(([s, n]) => [s, [...n]]))]));
  const summary = {
    at: new Date().toISOString(), classes: out.length, active: count((x) => x.status === 1),
    byRule: group('rule'), byConfidence: group('confidence'),
    proposed: count((x) => x.facultyId), proposedWritable: count((x) => x.facultyId && x.writable),
    notWritable: count((x) => !x.writable), noProfile: group('teacher', (x) => x.noProfile),
    byTeacher: group('teacher', (x) => x.facultyId), descriptionTables: tables,
    // how often a folder with ≥3 stated classes has more than one teacher: the risk the inferred rules take
    mixedFolders: Object.fromEntries(Object.entries(tally).map(([k, m]) => {
      const big = [...m.values()].filter((t) => [...t.values()].reduce((a, b) => a + b, 0) >= 3);
      return [k, { folders: big.length, mixed: big.filter((t) => t.size > 1).length }];
    })),
  };
  process.stdout.write(JSON.stringify({ summary, classes: out }));
  console.error(JSON.stringify(summary, null, 1));
})()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
