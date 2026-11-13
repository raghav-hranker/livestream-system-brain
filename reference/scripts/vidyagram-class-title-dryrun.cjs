#!/usr/bin/env node
// Read-only. Replays the Vidyagram class import's title rule (apxCatalogClassImport.ts
// assignImportTitles over the planner's in-course counter) on the catalogue preview plans and
// compares it with two counter-free rules from task appx-tenant-onboarding/07. Touches no database.
//
// node vidyagram-class-title-dryrun.cjs <preview-dir> <out-dir>
// writes <out-dir>/class-titles.csv (one row per Class) and <out-dir>/batch-labels.csv
// (suggested short batch labels, for the team to correct).
const fs = require('fs');
const path = require('path');

const [dir, outDir] = process.argv.slice(2);
if (!dir || !outDir) {
  console.error('usage: vidyagram-class-title-dryrun.cjs <preview-dir> <out-dir>');
  process.exit(2);
}

const SEP = ' · ';
const key = (t) => t.trim().replace(/\s+/g, ' ').toLowerCase();
const plans = fs.readdirSync(dir)
  .filter((f) => /^plan-\d+\.json$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

// Shortest word prefix (2+ words) no other course title starts with; long ones need a human.
const courseTitles = plans.map((p) => ({ id: p.course.apxCourseId, title: p.course.title.trim().replace(/\s+/g, ' ') }));
const batchLabel = new Map(courseTitles.map(({ id, title }) => {
  const words = title.split(' ');
  for (let n = 2; n <= Math.min(words.length, 4); n++) {
    const pre = key(words.slice(0, n).join(' '));
    if (courseTitles.every((c) => c.id === id || (key(c.title) !== pre && !key(c.title).startsWith(`${pre} `)))) {
      return [id, words.slice(0, n).join(' ')];
    }
  }
  return [id, `AppX course ${id}`];
}));

const plannedTitle = (it) =>
  it.title?.trim() || (it.placement?.topic ? `${it.placement.topic} (untitled)` : `Untitled class ${it.rowId}`);

const units = new Map();
for (const plan of plans) {
  for (const it of [...plan.items].sort((a, b) => a.priority - b.priority)) {
    const ref = {
      course: plan.course.apxCourseId,
      courseTitle: plan.course.title,
      rowId: it.rowId,
      topic: it.placement?.topic ?? null,
      planned: plannedTitle(it),
      apxTitle: it.apxTitle?.trim() || plannedTitle(it),
    };
    const u = units.get(it.assetKey);
    if (u) { u.placements.push(ref); u.noLink = u.noLink && it.noUsableLink; continue; }
    units.set(it.assetKey, { assetKey: it.assetKey, kind: it.kind, noLink: it.noUsableLink, placements: [ref] });
  }
}
const classes = [...units.values()].filter((u) => u.kind !== 'PDF' && (u.kind === 'VIDEO_MP4' || !u.noLink));

const current = (() => {
  const planned = new Map();
  for (const u of classes) planned.set(u.placements[0].planned, (planned.get(u.placements[0].planned) ?? 0) + 1);
  const used = new Set();
  return classes.map((u) => {
    const { planned: t, topic } = u.placements[0];
    let title = t; let rule = 'unchanged';
    if (planned.get(t) > 1 && topic) { title = `${t}${SEP}${topic}`; rule = 'topic'; }
    if (used.has(title)) { let n = 2; while (used.has(`${title} (${n})`)) n++; title = `${title} (${n})`; rule = 'counter'; }
    used.add(title);
    return { title, rule };
  });
})();

// The asset key's trailing unix time is AppX's upload time, the only date the plan carries.
const uploadDay = (assetKey) => {
  const m = assetKey.match(/-(\d{10})$/);
  if (!m) return null;
  return new Date(Number(m[1]) * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};

// Every entry of a clashing group climbs one tier until all titles are distinct.
const resolve = (tierLists, startTier) => {
  const level = tierLists.map(() => startTier);
  for (let moved = true; moved;) {
    moved = false;
    const groups = new Map();
    tierLists.forEach((t, i) => {
      const k = key(t[Math.min(level[i], t.length - 1)][1]);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(i);
    });
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      for (const i of ids) if (level[i] < tierLists[i].length - 1) { level[i]++; moved = true; }
    }
  }
  return tierLists.map((t, i) => {
    const [rule, title] = t[Math.min(level[i], t.length - 1)];
    return { rule, title };
  });
};

// Chosen 2026-10-19 (task 07): "<Topic> · <AppX title>" always, then the batch label, then the upload day.
const topicFirst = resolve(classes.map((u) => {
  const { apxTitle, topic, course, rowId } = u.placements[0];
  const base = topic ? `${topic}${SEP}${apxTitle}` : apxTitle;
  const withBatch = `${base}${SEP}${batchLabel.get(course)}`;
  const day = uploadDay(u.assetKey);
  return [
    ['topic', base],
    ['batch', withBatch],
    ...(day ? [['date', `${withBatch}${SEP}${day}`]] : []),
    ['rowId', `${withBatch}${SEP}#${rowId}`],
  ];
}), 0);

// Rejected: AppX's title as is when unique, then topic, then batch label, then upload day,
// then the AppX row id. No digits in parentheses, so splitTitleCounter never misreads a suffix.
const bareFirst = resolve(classes.map((u) => {
  const { apxTitle, topic, course, rowId } = u.placements[0];
  const withTopic = topic ? `${apxTitle}${SEP}${topic}` : apxTitle;
  const withBatch = `${withTopic}${SEP}${batchLabel.get(course)}`;
  const day = uploadDay(u.assetKey);
  return [
    ['bare', apxTitle],
    ['topic', withTopic],
    ['batch', withBatch],
    ...(day ? [['date', `${withBatch}${SEP}${day}`]] : []),
    ['rowId', `${withBatch}${SEP}#${rowId}`],
  ];
}), 0);

const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const writeCsv = (file, header, rows) =>
  fs.writeFileSync(path.join(outDir, file), `${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')}\n`);

fs.mkdirSync(outDir, { recursive: true });
writeCsv('class-titles.csv',
  ['assetKey', 'kind', 'firstCourse', 'batchLabel', 'topic', 'apxTitle', 'courses', 'currentTitle', 'currentRule', 'topicFirstTitle', 'topicFirstRule', 'bareFirstTitle', 'bareFirstRule'],
  classes.map((u, i) => {
    const p = u.placements[0];
    return [u.assetKey, u.kind, p.course, batchLabel.get(p.course), p.topic, p.apxTitle, new Set(u.placements.map((x) => x.course)).size,
      current[i].title, current[i].rule, topicFirst[i].title, topicFirst[i].rule, bareFirst[i].title, bareFirst[i].rule];
  }));
const needLabel = new Set(classes.filter((_, i) => !['bare', 'topic'].includes(bareFirst[i].rule)).map((u) => u.placements[0].course));
writeCsv('batch-labels.csv', ['apxCourseId', 'suggestedLabel', 'usedByClasses', 'courseTitle'],
  courseTitles.map(({ id, title }) => [id, batchLabel.get(id), needLabel.has(id) ? 'yes' : 'no', title]));

const tally = (rows) => rows.reduce((m, r) => ((m[r.rule] = (m[r.rule] ?? 0) + 1), m), {});
const lengths = (rows) => { const l = rows.map((r) => r.title.length).sort((a, b) => a - b); return { p50: l[l.length >> 1], p90: l[Math.floor(l.length * 0.9)], max: l[l.length - 1] }; };
const summary = (rows) => ({
  rules: tally(rows),
  distinctCaseFolded: new Set(rows.map((r) => key(r.title))).size,
  renamedFromCurrent: rows.filter((r, i) => r.title !== current[i].title).length,
  length: lengths(rows),
});
const groupSizes = (keyOf) => { const m = new Map(); classes.forEach((u) => m.set(keyOf(u.placements[0]), (m.get(keyOf(u.placements[0])) ?? 0) + 1)); return [...m.values()].filter((n) => n > 1); };
const sum = (a) => a.reduce((x, y) => x + y, 0);

console.log(JSON.stringify({
  plans: plans.length,
  classes: classes.length,
  inSeveralCourses: classes.filter((u) => new Set(u.placements.map((p) => p.course)).size > 1).length,
  noTopic: classes.filter((u) => !u.placements[0].topic).length,
  plannerCounterTitles: classes.filter((u) => u.placements[0].planned !== u.placements[0].apxTitle).length,
  apxTitlesEndingInDigitsInParens: classes.filter((u) => /\(\d+\)$/.test(u.placements[0].apxTitle)).length,
  sameTopicAndTitleClasses: sum(groupSizes((p) => `${p.topic}\u0000${p.apxTitle}`)),
  sameCourseTopicAndTitleClasses: sum(groupSizes((p) => `${p.course}\u0000${p.topic}\u0000${p.apxTitle}`)),
  datedAssetKeys: classes.filter((u) => uploadDay(u.assetKey)).length,
  coursesNeedingBatchLabel: needLabel.size,
  current: summary(current),
  topicFirst: summary(topicFirst),
  bareFirst: summary(bareFirst),
}, null, 1));
