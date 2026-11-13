#!/usr/bin/env node
// Read-only, no DB, no AppX calls. Where could each Vidyagram class's real teacher come from?
// Reads a saved vidyagramdb snapshot (default outputs/vidyagram-import-verify-2026-10-19: classes,
// apxcatalogimports ledger, apxcatalogcourses, courses, courseclasses, facultydetails) and, per class,
// collects teacher names from four signals, strongest first:
//   title   — the class's own AppX title, any placement ("… | Deepak Sir", "(By Aditya Sir)")
//   folder  — a folder on any placement path ("GS By Deepak Sir", "Shivant Sir Polity")
//   sibling — unnamed class whose folder's named classes all share one teacher (>= 3 of them)
//   course  — the AppX course names one teacher ("ENGLISH SPECIAL BATCH By Jai Sir")
// Writes class-teachers.csv (class → teacher, signal, confidence, conflicts), courses.csv,
// names.csv and summary.json into OUT (default outputs/vidyagram-class-teachers-<today>).
//
//   node reference/scripts/vidyagram-class-teacher-sources.cjs [snapshot-dir] [out-dir]
//
// ALIASES merges spellings into one teacher. Entries marked `assumed` are guesses the user must confirm.
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..');
const snap = path.resolve(process.argv[2] || path.join(repo, 'outputs/vidyagram-import-verify-2026-10-19'));
const out = path.resolve(process.argv[3] || path.join(repo, `outputs/vidyagram-class-teachers-${new Date().toISOString().slice(0, 10)}`));
const load = (n) => JSON.parse(fs.readFileSync(path.join(snap, `${n}.json`), 'utf8'));

// canonical key → { name, assumed }
const ALIASES = {
  'shubham mam': { to: 'shubham grover maam', assumed: false },
  'shubham maam': { to: 'shubham grover maam', assumed: false },
  'arti mam': { to: 'arti maam', assumed: false },
  'jay sir': { to: 'jai sir', assumed: true },
  'akash sir': { to: 'akash chaturvedi sir', assumed: true },
  // confirmed for the Maths batches (user, 2026-10-22); courses 134–136 ("… Mastery … By Aditya Sir") still open
  'aditya sir': { to: 'aditya ranjan sir', assumed: false },
  'riya mam': { to: 'riya maam', assumed: false },
  'anshi mam': { to: 'anshi maam', assumed: false },
};
const NOT_TEACHERS = new Set(['team', 'expert team', 'gs expert team', 'team vidyagram', 'vidyagram team']);

const HONORIFIC = String.raw`(sir|ma'?am|mam|madam|maam)`;
// "By <1-3 words> Sir" first, then "<1-2 words> Sir" with no "by".
const BY_RE = new RegExp(String.raw`\bby\s+((?:[A-Za-z.]+\s*){1,3}?)\s*${HONORIFIC}\b`, 'gi');
const BARE_RE = new RegExp(String.raw`(?:^|[|(\[\-–:,]\s*|\s)((?:[A-Z][A-Za-z.]*)(?:\s+[A-Z][A-Za-z.]*)?)\s+${HONORIFIC}\b`, 'gi');
const STOP = new Set(['by', 'for', 'and', 'the', 'class', 'series', 'batch', 'special', 'complete', 'with', 'of']);

const canon = (words, hon) => {
  const w = words.toLowerCase().replace(/\s+/g, ' ').trim().split(' ').filter((x) => x && !STOP.has(x));
  if (!w.length) return null;
  const h = /^s/i.test(hon) ? 'sir' : 'maam';
  let key = `${w.join(' ')} ${h}`;
  if (ALIASES[key]) key = ALIASES[key].to;
  return NOT_TEACHERS.has(w.join(' ')) ? null : key;
};
const namesIn = (s) => {
  const found = new Set();
  if (!s) return found;
  const t = s.replace(/[️​-‍]/g, '');
  for (const re of [BY_RE, BARE_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t))) { const k = canon(m[1], m[2]); if (k) found.add(k); }
  }
  return found;
};
const display = (key) => key.split(' ').map((w, i, a) => (i === a.length - 1
  ? (w === 'sir' ? 'Sir' : "Ma'am") : w.split('.').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('.'))).join(' ');

const classes = load('classes');
const ledger = new Map(load('apxcatalogimports').map((r) => [String(r.classId), r]));
const apxCourses = load('apxcatalogcourses');
const courses = load('courses');
const courseClasses = load('courseclasses');
const faculty = load('facultydetails');

const courseTitle = new Map(apxCourses.map((c) => [String(c.apxCourseId), c.listRow?.title || c.detail?.title || '']));
const courseTeacherIds = new Map(apxCourses.map((c) => [String(c.apxCourseId), c.detail?.teacher_id ?? '']));
// A course title counts only when it names exactly one teacher and no "Team"
// ("BY Aditya Ranjan sir, Vikramjeet Sir and Rankers' gurukul Team" names nobody for its classes).
const courseNames = new Map([...courseTitle].map(([id, t]) => {
  const n = namesIn(t);
  return [id, n.size === 1 && !/\bteam\b/i.test(t) ? n : new Set()];
}));
const courseMulti = [...courseTitle].filter(([, t]) => namesIn(t).size > 1 || (namesIn(t).size && /\bteam\b/i.test(t)))
  .map(([id, t]) => ({ apxCourseId: id, title: t }));

// pass 1: title + folder signals per class, and per-folder tallies for the sibling pass
const rows = [];
const folderTally = new Map(); // `${apxCourseId}|${path minus media leaf}` → Map(name → n)
const folderKey = (p) => `${p.apxCourseId}|${(p.path || []).filter((s) => !/^(video|videos|vidoes|pdf|pdfs|notes)$/i.test(s.trim())).join(' > ')}`;
for (const c of classes) {
  const led = ledger.get(String(c._id));
  const placements = led?.placements || [];
  const title = new Set(namesIn(c.title));
  const folder = new Set();
  const course = new Set();
  for (const p of placements) {
    for (const n of namesIn(p.apxTitle || p.title)) title.add(n);
    for (const seg of p.path || []) for (const n of namesIn(seg)) folder.add(n);
    for (const n of courseNames.get(String(p.apxCourseId)) || []) course.add(n);
  }
  const row = { id: String(c._id), status: c.status, title: c.title, placements, titleN: title, folderN: folder, courseN: course };
  rows.push(row);
  const own = title.size === 1 ? [...title][0] : (title.size === 0 && folder.size === 1 ? [...folder][0] : null);
  if (own) {
    for (const p of placements) {
      const k = folderKey(p);
      if (!folderTally.has(k)) folderTally.set(k, new Map());
      const m = folderTally.get(k);
      m.set(own, (m.get(own) || 0) + 1);
    }
  }
}

// pass 2: decide
const decided = [];
for (const r of rows) {
  const sibling = new Set();
  for (const p of r.placements) {
    const m = folderTally.get(folderKey(p));
    if (m && m.size === 1) { const [[n, cnt]] = [...m]; if (cnt >= 3) sibling.add(n); }
  }
  const all = new Set([...r.titleN, ...r.folderN, ...sibling, ...r.courseN]);
  let teacher = null; let signal = 'none'; let confidence = 'none';
  const pick = (set, sig, conf) => { if (!teacher && set.size === 1) { [teacher] = [...set]; signal = sig; confidence = conf; } };
  pick(r.titleN, 'title', 'high');
  pick(r.folderN, 'folder', 'high');
  pick(sibling, 'sibling', 'medium');
  pick(r.courseN, 'course', 'medium');
  // a class carrying several names in one signal (cross-listed, two teachers) is left for review
  if (!teacher && [r.titleN, r.folderN, sibling, r.courseN].some((s) => s.size > 1)) { signal = 'multiple'; confidence = 'review'; }
  const conflicts = teacher ? [...all].filter((n) => n !== teacher) : [];
  if (teacher && conflicts.length) confidence = confidence === 'high' ? 'high-conflict' : 'review';
  decided.push({ ...r, sibling, teacher, signal, confidence, conflicts });
}

// courses: our Course docs → teacher(s) of their classes
const classTeacher = new Map(decided.map((d) => [d.id, d.teacher]));
const courseRows = courses.map((co) => {
  const cls = courseClasses.filter((x) => String(x.course) === String(co._id)).map((x) => String(x.class));
  const tally = new Map();
  let named = 0;
  for (const id of cls) { const t = classTeacher.get(id); if (t) { named += 1; tally.set(t, (tally.get(t) || 0) + 1); } }
  const ranked = [...tally].sort((a, b) => b[1] - a[1]);
  const titleNames = [...namesIn(co.title)];
  return { id: String(co._id), title: co.title, status: co.status, classes: cls.length, named, ranked, titleNames };
});

// faculty profiles: which names already exist
const profileKeys = new Map(faculty.map((f) => [(() => { const s = namesIn(`By ${f.name}`); return s.size ? [...s][0] : f.name.toLowerCase(); })(), f]));

// outputs
fs.mkdirSync(out, { recursive: true });
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(out, 'class-teachers.csv'), [
  'classId,status,title,teacher,signal,confidence,conflicts,titleNames,folderNames,siblingNames,courseNames,apxCourses',
  ...decided.map((d) => [d.id, d.status, d.title, d.teacher ? display(d.teacher) : '', d.signal, d.confidence,
    d.conflicts.map(display).join('; '), [...d.titleN].map(display).join('; '), [...d.folderN].map(display).join('; '),
    [...d.sibling].map(display).join('; '), [...d.courseN].map(display).join('; '),
    [...new Set(d.placements.map((p) => p.apxCourseId))].join(' ')].map(csv).join(',')),
].join('\n'));
fs.writeFileSync(path.join(out, 'courses.csv'), [
  'courseId,status,title,classes,classesWithTeacher,teachers,titleNames',
  ...courseRows.map((c) => [c.id, c.status, c.title, c.classes, c.named,
    c.ranked.map(([n, k]) => `${display(n)} ${k}`).join('; '), c.titleNames.map(display).join('; ')].map(csv).join(',')),
].join('\n'));

const byName = new Map();
for (const d of decided) if (d.teacher) byName.set(d.teacher, (byName.get(d.teacher) || 0) + 1);
fs.writeFileSync(path.join(out, 'names.csv'), [
  'teacher,classes,profileExists,aliasAssumed',
  ...[...byName].sort((a, b) => b[1] - a[1]).map(([n, k]) => [display(n), k, profileKeys.has(n) ? 'yes' : 'no',
    Object.entries(ALIASES).filter(([, v]) => v.to === n && v.assumed).map(([f]) => display(f)).join('; ')].map(csv).join(',')),
].join('\n'));

const count = (f) => decided.filter(f).length;
const summary = {
  snapshot: snap,
  classes: decided.length,
  active: count((d) => d.status === 1),
  bySignal: Object.fromEntries(['title', 'folder', 'sibling', 'course', 'multiple', 'none'].map((s) => [s, count((d) => d.signal === s)])),
  byConfidence: Object.fromEntries(['high', 'high-conflict', 'medium', 'review', 'none'].map((s) => [s, count((d) => d.confidence === s)])),
  activeWithTeacher: count((d) => d.status === 1 && d.teacher),
  teachers: byName.size,
  courseLevelTeacherIds: apxCourses.filter((c) => !['-1', '', undefined, null].includes(c.detail?.teacher_id))
    .map((c) => ({ apxCourseId: c.apxCourseId, teacher_id: c.detail.teacher_id, title: courseTitle.get(String(c.apxCourseId)) })),
  courses: { total: courseRows.length, withAnyNamedClass: courseRows.filter((c) => c.named).length,
    singleTeacher: courseRows.filter((c) => c.ranked.length === 1).length, titleNamesTeacher: courseRows.filter((c) => c.titleNames.length).length },
  courseTitlesNamingSeveral: courseMulti,
  profiles: faculty.map((f) => f.name),
  assumedAliases: Object.entries(ALIASES).filter(([, v]) => v.assumed).map(([f, v]) => `${display(f)} → ${display(v.to)}`),
};
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
