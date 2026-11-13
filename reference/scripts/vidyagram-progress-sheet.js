#!/usr/bin/env node
// Vidyagram video migration progress → Google Sheet, refreshed every few minutes.
// Runs on webserver2-2 from the vidyagram-backend checkout (its node_modules and .env.development):
//
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend
//   SHEET_ID=<id> GOOGLE_KEY=/home/hranker/secrets/vidyagram-progress-key.json \
//     node /home/hranker/vidyagram-progress-sheet/vidyagram-progress-sheet.js [--once] [--print]
//
// --print writes nothing and prints the summary; --once refreshes the sheet once and exits.
// Reads vidyagramdb only (apxingestjobs, classes, apxcatalogimports, apxcatalogcourses).
'use strict';

const path = require('path');
const APP = process.cwd();
require(path.join(APP, 'node_modules/dotenv')).config({ path: path.join(APP, '.env.development') });
const mongoose = require(path.join(APP, 'node_modules/mongoose'));
const { GoogleAuth } = require(path.join(APP, 'node_modules/google-auth-library'));

const SHEET_ID = process.env.SHEET_ID;
const KEY = process.env.GOOGLE_KEY;
const EVERY_MS = Number(process.env.REFRESH_MINUTES || 5) * 60_000;
const once = process.argv.includes('--once');
const printOnly = process.argv.includes('--print');

const STATUS = { done: 'Copied', pending: 'Waiting', failed: 'Waiting', claimed: 'Copying', downloading: 'Copying', uploading: 'Copying', dead: 'Gone from AppX' };
const ORDER = { Copying: 0, Waiting: 1, 'Gone from AppX': 2, Copied: 3 };
const ist = (d) => (d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) : '');
const bytesOf = (job) => Object.values(job.progress?.rungs || {}).reduce((s, r) => s + (r.bytes || 0), 0);

async function collect() {
  const db = mongoose.connection.db;
  const jobs = await db.collection('apxingestjobs')
    .find({}, { projection: { classId: 1, status: 1, updatedAt: 1, attempts: 1, error: 1, wave2Note: 1, 'progress.rungs': 1 } }).toArray();
  const classIds = jobs.map((j) => j.classId);
  const classes = new Map((await db.collection('classes')
    .find({ _id: { $in: classIds } }, { projection: { title: 1 } }).toArray()).map((c) => [String(c._id), c.title]));
  const ledger = new Map((await db.collection('apxcatalogimports')
    .find({ classId: { $in: classIds } }, { projection: { classId: 1, placements: 1 } }).toArray())
    .map((l) => [String(l.classId), l.placements || []]));
  const courses = new Map((await db.collection('apxcatalogcourses')
    .find({}, { projection: { apxCourseId: 1, 'listRow.title': 1, 'detail.title': 1 } }).toArray())
    .map((c) => [String(c.apxCourseId), c.listRow?.title || c.detail?.title || `Course ${c.apxCourseId}`]));

  const rows = jobs.map((j) => {
    const id = String(j.classId);
    const placements = ledger.get(id) || [];
    return {
      id,
      title: classes.get(id) || '(missing class)',
      status: STATUS[j.status] || j.status,
      courses: [...new Set(placements.map((p) => courses.get(String(p.apxCourseId)) || p.apxCourseId))].join('; '),
      appxRows: placements.map((p) => `${p.apxCourseId}/${p.rowId}`).join(' '),
      mb: j.status === 'done' ? Math.round(bytesOf(j) / 1e6) : '',
      copiedAt: j.status === 'done' ? j.updatedAt : null,
      attempts: j.attempts || 0,
      error: j.status === 'dead' ? String(j.error || '').replace(/https?:\/\/\S+/g, '<link>') : '',
    };
  });

  const count = (s) => rows.filter((r) => r.status === s).length;
  const since = Date.now() - 30 * 60_000;
  const recent = jobs.filter((j) => j.status === 'done' && new Date(j.updatedAt).getTime() >= since);
  const recentGB = recent.reduce((s, j) => s + bytesOf(j), 0) / 1e9;
  const perHour = recent.length * 2;
  const remaining = count('Waiting') + count('Copying');
  const etaHours = perHour ? remaining / perHour : null;
  const summary = {
    total: rows.length,
    copied: count('Copied'),
    waiting: count('Waiting'),
    copying: count('Copying'),
    gone: count('Gone from AppX'),
    copiedGB: rows.reduce((s, r) => s + (r.mb || 0), 0) / 1000,
    last30: recent.length,
    last30GB: recentGB,
    mbps: (recentGB * 1000) / 1800,
    eta: etaHours === null ? 'unknown' : ist(Date.now() + etaHours * 3600_000),
  };
  rows.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.title.localeCompare(b.title));
  return { summary, rows, wave2: WAVE2_START ? wave2View(jobs, rows) : null };
}

// Wave 2 adds AppX's "1080p" to classes wave 1 copied. A job dead before the pass started
// was never part of it; one finished without a 1080p rung had no 1080p on AppX.
const WAVE2_START = process.env.WAVE2_START ? new Date(process.env.WAVE2_START) : null;
const W2_ORDER = { Copying: 0, Waiting: 1, Failed: 2, '1080p added': 3, 'No 1080p on AppX': 4, 'No URLs on AppX now (wave 1 copy kept)': 5 };
function wave2View(jobs, rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = [];
  for (const j of jobs) {
    if (j.status === 'dead' && new Date(j.updatedAt) < WAVE2_START) continue;
    const r = byId.get(String(j.classId));
    const hd = j.progress?.rungs?.['1080p'];
    const status = j.status === 'done'
      ? (hd ? '1080p added' : j.wave2Note ? 'No URLs on AppX now (wave 1 copy kept)' : 'No 1080p on AppX')
      : j.status === 'dead' ? 'Failed'
      : ['claimed', 'downloading', 'uploading'].includes(j.status) ? 'Copying' : 'Waiting';
    out.push({ ...r, status, hdMB: hd ? Math.round((hd.bytes || 0) / 1e6) : '', doneAt: j.status === 'done' ? j.updatedAt : null,
      error: j.status === 'dead' ? String(j.error || '').replace(/https?:\/\/\S+/g, '<link>') : '' });
  }
  out.sort((a, b) => W2_ORDER[a.status] - W2_ORDER[b.status] || a.title.localeCompare(b.title));
  const n = (st) => out.filter((r) => r.status === st).length;
  const since = Date.now() - 30 * 60_000;
  const recent = out.filter((r) => r.doneAt && new Date(r.doneAt).getTime() >= since);
  const recentGB = recent.reduce((t, r) => t + (r.hdMB || 0), 0) / 1000;
  const remaining = n('Waiting') + n('Copying');
  const perHour = recent.length * 2;
  return {
    rows: out,
    total: out.length, added: n('1080p added'), none: n('No 1080p on AppX'), noUrls: n('No URLs on AppX now (wave 1 copy kept)'),
    copying: n('Copying'), waiting: n('Waiting'), failed: n('Failed'),
    addedGB: out.reduce((t, r) => t + (r.hdMB || 0), 0) / 1000,
    last30: recent.length, last30GB: recentGB, mbps: (recentGB * 1000) / 1800,
    eta: perHour ? ist(Date.now() + (remaining / perHour) * 3600_000) : 'unknown',
  };
}

function tables({ summary: s, rows, wave2: w }) {
  if (w) return wave2Tables(rows, w);
  const pct = s.total ? `${((100 * s.copied) / s.total).toFixed(1)}%` : '0%';
  const summary = [
    ['Vidyagram video migration (AppX → Vidyagram R2)', ''],
    ['Current pass', process.env.WAVE_LABEL || 'Wave 1: 240p, 360p, 480p'],
    ['Last refreshed (IST)', ist(new Date())],
    ['', ''],
    ['Videos to copy', s.total],
    ['Copied', s.copied],
    ['Copied (%)', pct],
    ['Copying now', s.copying],
    ['Waiting', s.waiting],
    ['Gone from AppX (cannot copy)', s.gone],
    ['Copied so far (GB)', Number(s.copiedGB.toFixed(1))],
    ['', ''],
    ['Copied in the last 30 min', s.last30],
    ['GB in the last 30 min', Number(s.last30GB.toFixed(1))],
    ['Speed (MB/s, last 30 min)', Number(s.mbps.toFixed(1))],
    ['Estimated finish (IST)', s.eta],
  ];
  const classes = [['Class', 'Status', 'AppX courses', 'Size (MB)', 'Copied at (IST)', 'Attempts', 'Class ID']]
    .concat(rows.map((r) => [r.title, r.status, r.courses, r.mb, ist(r.copiedAt), r.attempts, r.id]));
  const gone = [['Class', 'AppX courses', 'AppX course/row', 'Error', 'Class ID']]
    .concat(rows.filter((r) => r.status === 'Gone from AppX').map((r) => [r.title, r.courses, r.appxRows, r.error, r.id]));
  return { Summary: summary, Classes: classes, 'Gone from AppX': gone };
}

function wave2Tables(rows, w) {
  const inPass = new Set(w.rows.map((r) => r.id));
  const done = w.added + w.none + w.noUrls;
  const summary = [
    ['Vidyagram video migration (AppX → Vidyagram R2)', ''],
    ['Last refreshed (IST)', ist(new Date())],
    ['', ''],
    ['Wave 1: 240p, 360p, 480p', process.env.WAVE1_SUMMARY || 'done'],
    ['', ''],
    ['Wave 2: adding AppX "1080p"', process.env.WAVE_LABEL || ''],
    ['Videos in this pass', w.total],
    ['Checked so far', done],
    ['Checked (%)', w.total ? `${((100 * done) / w.total).toFixed(1)}%` : '0%'],
    ['1080p added', w.added],
    ['No 1080p on AppX', w.none],
    ['No URLs on AppX now (wave 1 copy kept)', w.noUrls],
    ['Copying now', w.copying],
    ['Waiting', w.waiting],
    ['Failed', w.failed],
    ['1080p copied so far (GB)', Number(w.addedGB.toFixed(1))],
    ['', ''],
    ['Checked in the last 30 min', w.last30],
    ['1080p GB in the last 30 min', Number(w.last30GB.toFixed(1))],
    ['Speed (MB/s, last 30 min)', Number(w.mbps.toFixed(1))],
    ['Estimated finish (IST)', w.eta],
  ];
  const pass = [['Class', '1080p status', 'AppX courses', '1080p size (MB)', 'Done at (IST)', 'Attempts', 'Error', 'Class ID']]
    .concat(w.rows.map((r) => [r.title, r.status, r.courses, r.hdMB, ist(r.doneAt), r.attempts, r.error, r.id]));
  const classes = [['Class', 'Wave 1 (240p–480p)', 'AppX courses', 'Class ID']]
    .concat(rows.map((r) => [r.title, r.status === 'Gone from AppX' ? 'Gone from AppX' : 'Copied', r.courses, r.id]));
  const gone = [['Class', 'AppX courses', 'AppX course/row', 'Error', 'Class ID']]
    .concat(rows.filter((r) => r.status === 'Gone from AppX' && !inPass.has(r.id)).map((r) => [r.title, r.courses, r.appxRows, r.error, r.id]));
  return { Summary: summary, '1080p pass': pass, Classes: classes, 'Gone from AppX': gone };
}

async function writeSheet(client, data) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
  const meta = await client.request({ url: `${base}?fields=sheets.properties.title` });
  const have = new Set(meta.data.sheets.map((s) => s.properties.title));
  const add = Object.keys(data).filter((t) => !have.has(t)).map((title) => ({ addSheet: { properties: { title } } }));
  if (add.length) await client.request({ url: `${base}:batchUpdate`, method: 'POST', data: { requests: add } });
  await client.request({ url: `${base}/values:batchClear`, method: 'POST', data: { ranges: Object.keys(data).map((t) => `'${t}'`) } });
  await client.request({
    url: `${base}/values:batchUpdate`,
    method: 'POST',
    data: { valueInputOption: 'RAW', data: Object.entries(data).map(([t, values]) => ({ range: `'${t}'!A1`, values })) },
  });
}

async function main() {
  if (!printOnly && (!SHEET_ID || !KEY)) throw new Error('SHEET_ID and GOOGLE_KEY are required');
  await mongoose.connect(process.env.MONGO_URI, { dbName: 'vidyagramdb', readPreference: 'primary' });
  const client = printOnly ? null : await new GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/spreadsheets'] }).getClient();
  for (;;) {
    try {
      const data = await collect();
      if (printOnly) console.log(JSON.stringify(data.summary), `rows=${data.rows.length}`);
      else {
        await writeSheet(client, tables(data));
        console.log(`[progress-sheet] ${ist(new Date())} copied ${data.summary.copied}/${data.summary.total}`);
      }
    } catch (err) {
      console.error('[progress-sheet] refresh failed:', err.message);
    }
    if (once || printOnly) break;
    await new Promise((r) => setTimeout(r, EVERY_MS));
  }
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
