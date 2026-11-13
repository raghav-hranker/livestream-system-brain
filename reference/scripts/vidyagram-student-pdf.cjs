// Run from ~/vidyagram/pdf with node -r ts-node/register <this file>.
// Reuses the shipped planner, byte validation, storage, ledger and attachment rules.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

function decodeLink(value) {
  if (/^https?:\/\//.test(value || '')) return value;
  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from('638udh3829162018'), Buffer.from('fedcba9876543210'));
    return Buffer.concat([decipher.update(Buffer.from(String(value).split(':')[0], 'base64')), decipher.final()]).toString();
  } catch { throw new Error('Student PDF link could not be decoded'); }
}

function matchingLink(raw, candidates) {
  const expected = new URL(raw);
  for (const candidate of candidates) {
    if (!candidate) continue;
    let decoded, actual;
    try { decoded = decodeLink(candidate); actual = new URL(decoded); } catch { continue; }
    // Require the entire original object path, not just its basename. Signed hosts
    // differ from the mirrored origin. No placeholder or arbitrary host is accepted.
    const hostAllowed = /^(?:static-[a-z0-9-]+\.appx\.co\.in|appx-content-v2\.classx\.co\.in|appxcontent(?:-mcdn)?\.(?:akamai\.net\.in|kaxa\.in|securevideo\.in)|appx-wsb-gcp(?:-mcdn)?\.akamai\.net\.in|migration-contents-v2\.classx\.co\.in)$/.test(actual.hostname);
    if (actual.protocol === 'https:' && hostAllowed && actual.pathname === expected.pathname) return decoded;
  }
  throw new Error('Student PDF link does not match the mirrored file');
}

function studentHeaders(token) {
  return { Authorization: token.token, 'User-ID': token.apxUserId, 'Auth-Key': 'appxapi',
    'Client-Service': 'Appx', source: 'website', Origin: 'https://vidyagram.online', Referer: 'https://vidyagram.online/' };
}

async function resolveStudentLink({ raw, source, token, row, request, SessionLost, SignerThrottled, PdfFetchError }) {
  const response = await request({
    params: { course_id: source.apxCourseId, video_id: source.rowId, ytflag: String(row.ytFlag ?? row.ytFlagWeb ?? '0'), folder_wise_course: '1' },
    headers: studentHeaders(token),
  });
  const body = response.data || {};
  const status = Number(body.status || response.status);
  if ([401, 403].includes(response.status) || status === 401) throw new SessionLost('Student session rejected; no automatic OTP refresh');
  if (response.status === 429 || status === 429) throw new SignerThrottled('Student API rate limited');
  if (response.status >= 500) throw Object.assign(new Error('Student API unavailable'), { response: { status: response.status } });
  if (response.status !== 200 || status !== 200) throw new PdfFetchError('Student API did not return PDF metadata');
  const data = Array.isArray(body.data) ? body.data[0] : body.data;
  if (!data || String(data.is_purchased) !== '1') throw new PdfFetchError('Student does not have access to this course');
  if (String(data.id) !== String(source.rowId)) throw new PdfFetchError('Student metadata returned a different row');
  const candidates = source.field === 'link' ? [data.file_link, data.pdf_link, data.link] : [data[source.field]];
  try { return matchingLink(raw, candidates); } catch (e) { throw new PdfFetchError(e.message); }
}

async function main() {
  const localRequire = createRequire(path.join(process.cwd(), 'package.json'));
  const mod = (file) => localRequire(path.join(process.cwd(), 'src', file));
  localRequire('dotenv').config({ path: '.env.development', quiet: true });
  const mongoose = localRequire('mongoose');
  const axios = localRequire('axios');
  const { APX_ORG_ID } = mod('config/apxConstants');
  const { CUSTOMER_ID, DB_NAME } = mod('config/baseConstants');
  if (DB_NAME !== 'vidyagramdb' || String(CUSTOMER_ID) !== '781' || APX_ORG_ID !== '2177599') throw new Error('Wrong tenant checkout');
  const value = (flag) => { const i = process.argv.indexOf(flag); return i < 0 ? null : process.argv[i + 1]; };
  const commit = process.argv.includes('--commit');
  const admin = process.argv.includes('--admin');
  const signerFile = admin ? process.env.APX_SIGNER_SESSION_FILE : null;
  const signerSession = signerFile ? fs.readFileSync(signerFile, 'utf8').trim() : undefined;
  if (signerFile && !/^[a-z0-9]{20,64}$/i.test(signerSession || '')) throw new Error('Alternate signer file does not contain a valid session id');
  const attachOnly = process.argv.includes('--attach-only');
  const courses = value('--courses')?.split(',');
  const excludedCourses = value('--exclude-courses')?.split(',');
  const limit = Number(value('--limit') || 0);
  const checkN = Number(value('--check') || 0);
  if (commit && checkN) throw new Error('Choose --check or --commit');
  const outDir = value('--out-dir') || path.join(process.env.HOME, 'vidyagram/logs/pdf-student');
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  const say = (message) => console.log(`[student-pdf] ${message}`);
  const runId = 'full-2026-10-13', customerId = '781';
  const { loadMirrorCourses } = mod('services/apx/apxCatalogMirrorReader');
  const { planCatalogue } = mod('services/apx/apxCatalogPlanner');
  const { planClassImport } = mod('services/apx/apxCatalogClassImport');
  const { planPdfImport, fileRef } = mod('services/apx/apxCatalogPdfImport');
  const run = mod('services/apx/apxCatalogPdfImportRun');
  const { createHttpDownloader, createHttpSigner } = mod('services/apx/apxCatalogPdfImportHttp');
  const { uploadApxPdf } = mod('services/apx/apxPdfUploadService');
  const { SessionLost } = mod('services/apx/apxCatalogCapture');
  const { createCsvFile, RUN_COLUMNS, MULTI_VERSION_COLUMNS } = mod('services/apx/apxCatalogPdfImportCsv');
  let sheet;
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME, readPreference: 'primary', autoIndex: false, autoCreate: false });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== 'vidyagramdb') throw new Error('Wrong connected database');
    const tokens = await db.collection('apxtestusertokens').find({ orgId: APX_ORG_ID, token: { $type: 'string' } }).toArray();
    const byCourse = new Map();
    for (const token of tokens) {
      const detail = await db.collection('apx_user_course_test_detail').findOne({ apxId: token.apxUserId });
      for (const course of detail?.courses || []) if (!byCourse.has(String(course.courseId))) byCourse.set(String(course.courseId), token);
    }
    const { inputs } = await loadMirrorCourses(db, { customerId, runId });
    const { plans } = planCatalogue(inputs);
    const units = planClassImport(plans).units;
    const plan = planPdfImport(units, await run.loadRowPdfFields(db, customerId, units, plans));
    const ledger = await db.collection(run.PDF_IMPORT_LEDGER).find({ customerId }, { projection: { fileKey: 1, pdfId: 1, status: 1 } }).toArray();
    const imported = new Set(ledger.filter((r) => r.pdfId).map((r) => r.fileKey));
    const remaining = plan.files.filter((f) => !imported.has(f.fileKey));
    let files = attachOnly ? plan.files.filter((f) => imported.has(f.fileKey))
      : admin ? remaining : remaining.filter((f) => f.sources.some((s) => byCourse.has(s.apxCourseId)));
    if (courses) files = files.filter((f) => f.sources.some((s) => courses.includes(s.apxCourseId)));
    if (excludedCourses) files = files.filter((f) => !f.sources.some((s) => excludedCourses.includes(s.apxCourseId)));
    if (process.argv.includes('--unencrypted')) files = files.filter((f) => !f.encrypted);
    if (process.argv.includes('--encrypted-only')) files = files.filter((f) => f.encrypted);
    const coveredTotal = files.length;
    if (checkN) {
      const sample = [];
      for (const predicate of [(f) => f.encrypted, (f) => f.kind === 'standalone', (f) => f.kind === 'note', (f) => f.sources.some((s) => s.field === 'pdf_link2')]) {
        const candidate = files.find((f) => predicate(f) && !sample.includes(f));
        if (candidate && sample.length < checkN) sample.push(candidate);
      }
      for (const f of files) if (!sample.includes(f) && sample.length < checkN) sample.push(f);
      files = sample;
    } else if (limit) files = files.slice(0, limit);
    const coverage = { mode: attachOnly ? 'attachment' : admin ? 'admin' : 'student', signingSession: admin ? (signerSession ? 'alternate file' : 'tenant database') : 'student tokens', planned: plan.files.length, previouslyImported: imported.size, remaining: remaining.length, cachedStudents: tokens.length,
      coveredCourses: [...byCourse.keys()], coveredRemaining: coveredTotal, selected: files.length,
      kinds: files.reduce((out, f) => (out[f.kind] = (out[f.kind] || 0) + 1, out), {}), encrypted: files.filter((f) => f.encrypted).length };
    say(JSON.stringify(coverage));
    fs.writeFileSync(path.join(outDir, 'coverage.json'), JSON.stringify(coverage, null, 2));
    if (!commit && !checkN) return;
    const byKey = new Map(files.map((f) => [f.fileKey, f]));
    const signer = async (raw) => {
      const { deriveApxAssetKey } = mod('services/apx/apxAssetKey');
      const file = byKey.get(deriveApxAssetKey(raw));
      if (!file) throw new run.PdfFetchError('File is outside the selected student scope');
      const source = file.sources.find((s) => byCourse.has(s.apxCourseId));
      const tree = await db.collection('apxcatalogtree').findOne({ customerId, apxCourseId: source.apxCourseId, 'rows.id': source.rowId }, { projection: { rows: { $elemMatch: { id: source.rowId } } } });
      if (!tree?.rows?.[0]) throw new run.PdfFetchError('Student source row not found in mirrored tree');
      return resolveStudentLink({ raw, source, token: byCourse.get(source.apxCourseId), row: tree.rows[0],
        request: (options) => axios.get('https://armathsapi.akamai.net.in/get/fetchVideoDetailsById', { ...options, timeout: 30000, maxRedirects: 0, family: 4, validateStatus: () => true }),
        SessionLost, SignerThrottled: run.SignerThrottled, PdfFetchError: run.PdfFetchError });
    };
    const options = { db, customerId, files, signer: admin ? createHttpSigner({ db, customerId, orgId: APX_ORG_ID, sessionId: signerSession }) : signer, downloader: createHttpDownloader(), signGapMs: admin ? 2500 : 1500,
      throttleBaseMs: 60000, maxThrottleWaits: 2, log: say };
    if (checkN) {
      const check = await run.fetchCheck(options);
      const safe = { ...check, results: check.results.map(({ fileKey, ...r }) => r) };
      fs.writeFileSync(path.join(outDir, 'fetch-check.json'), JSON.stringify(safe, null, 2));
      say(JSON.stringify(safe));
      if (check.results.some((r) => !r.ok) || check.sessionLost || check.stoppedThrottled) process.exitCode = 1;
      return;
    }
    const sheetPath = path.join(process.env.HOME, 'vidyagram/sheets-sa.json');
    if (fs.existsSync(sheetPath)) {
      const sheets = mod('services/apx/apxCatalogPdfImportSheet');
      let nextSheetCall = 0;
      const transport = async (req) => {
        const wait = nextSheetCall - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        nextSheetCall = Date.now() + (admin ? 3500 : 1800);
        const response = await sheets.fetchTransport(req);
        if (response.status === 429) await new Promise((resolve) => setTimeout(resolve, 30000));
        return response;
      };
      sheet = sheets.createLiveSheet({ spreadsheetId: '1S8WDIGKnt0gwQB_dVhasseUOgmAtLQbjS3iH5wyglGY', key: sheets.loadServiceAccountKey(sheetPath), runId, mode: 'commit', log: say,
        summaryTab: value('--sheet-summary') || undefined,
        transport, flushEveryMs: 15000, batchRows: 1000, maxRowsPerTab: 100000, retries: 6 });
    }
    const { teeCsv } = mod('services/apx/apxCatalogPdfImportCsv');
    const summary = await run.commitPdfImport({ ...options, runId, plan, concurrency: 1, uploader: uploadApxPdf,
      csv: { courseTitles: new Map(plans.map((p) => [p.course.apxCourseId, p.course.title])),
        run: teeCsv(createCsvFile(path.join(outDir, 'import.csv'), RUN_COLUMNS), sheet?.run),
        multiVersion: teeCsv(createCsvFile(path.join(outDir, 'multi-version.csv'), MULTI_VERSION_COLUMNS), sheet?.multiVersion) },
      onProgress: (p) => { sheet?.progress(p); if (p.done % 10 === 0 || p.done === p.planned) say(`progress ${p.done}/${p.planned}`); },
    });
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    say(JSON.stringify(summary));
    const persisted = await db.collection(run.PDF_IMPORT_LEDGER).countDocuments({ customerId, fileKey: { $in: files.map((f) => f.fileKey) }, pdfId: { $ne: null } });
    say(`read-back: ${persisted}/${files.length} selected files have PDF records`);
    if (summary.failures.length || summary.sessionLost || summary.stoppedThrottled) process.exitCode = 1;
  } finally { if (sheet) await sheet.close(); await mongoose.disconnect(); }
}

module.exports = { decodeLink, matchingLink, resolveStudentLink };
if (require.main === module) main().catch((e) => { console.error(`[student-pdf] ${e.name}: ${String(e.message).replace(/https?:\/\/\S+/g, '<url>')}`); process.exitCode = 1; });
