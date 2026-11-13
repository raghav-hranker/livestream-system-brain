// Vidyagram only. Read-only: what is behind AppX CMS Products > PDFs > "Notes" (cms.appx.co.in/products/pdfs?tab=4),
// the batch time tables (SSC CGL Mains Batch Time Table, UPSI Batch, ...).
//   1. GETs the page with the stored VG session and lists the ajax endpoints and DataTables columns in its HTML.
//   2. POSTs a listing body to each endpoint whose path has `get_` (listings only; never enable/delete/edit routes).
//   3. Saves the page and every response to OUT_DIR; prints row count, row keys and the first rows.
// Refuses any DB but vidyagramdb, which it reads only for the AppX session. No DB writes.
// Run on webserver2-2 from the Vidyagram checkout:
//   cd /var/www/backend.vidyagramar.com/vidyagram-backend && node - < vidyagram-appx-notes-tab-probe.cjs
const path = require('path');
const fs = require('fs');
const https = require('https');
const { createRequire } = require('module');

const cwdRequire = createRequire(path.join(process.cwd(), 'noop.js'));
cwdRequire('dotenv').config({ path: path.join(process.cwd(), '.env.development') });
const mongoose = cwdRequire('mongoose');
const axios = cwdRequire('axios');

const CMS = 'https://cms.appx.co.in';
const PAGE = `${CMS}/products/pdfs?tab=4`;
const OUT_DIR = process.env.OUT_DIR || path.join(process.env.HOME, `vg-appx-notes-tab-${new Date().toISOString().slice(0, 10)}`);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
const agent = new https.Agent({ family: 4 });
const HTML_COLS = /_btn$|Btn$|_a$|^action_button$|^enable_button/;

const strip = (v) => (typeof v === 'string' ? v.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) : v);
const hrefs = (v) => (typeof v === 'string' ? [...v.matchAll(/(?:href|data-url|data-link)=["']([^"']+)["']/g)].map((m) => m[1]) : []);

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const conn = await mongoose.createConnection(process.env.MONGO_URI, { dbName: 'vidyagramdb' }).asPromise();
  if (conn.db.databaseName !== 'vidyagramdb') throw new Error(`refusing db ${conn.db.databaseName}`);
  const session = await conn.db.collection('apxsessions').findOne({ orgId: '2177599', customerId: '781', isActive: true }, { projection: { session_id: 1 } });
  await conn.close();
  if (!session?.session_id) throw new Error('no active VG AppX session');
  const headers = { Cookie: `apx-aside-collapse=1; ci_session=${session.session_id}`, 'User-Agent': UA, Referer: PAGE };

  const page = await axios.get(PAGE, { headers, httpsAgent: agent, maxRedirects: 0, validateStatus: () => true });
  const html = String(page.data);
  fs.writeFileSync(path.join(OUT_DIR, 'page.html'), html);
  console.log(`page ${page.status} ${html.length} bytes ${page.headers.location || ''}`);
  if (page.status !== 200 || /name=["']password["']/.test(html)) throw new Error('session not accepted (login page)');

  const urls = new Set();
  for (const m of html.matchAll(/["'`]((?:https:\/\/cms\.appx\.co\.in)?\/?[a-z0-9_-]+\/[a-z0-9_\-/]+)["'`]/gi)) {
    if (!/\.(js|css|png|svg|jpe?g|ico|woff2?)$/i.test(m[1])) urls.add(m[1].replace(CMS, '').replace(/^\//, ''));
  }
  console.log('\nendpoints in page:\n  ' + [...urls].sort().join('\n  '));
  const cols = [...new Set([...html.matchAll(/["']?data["']?\s*:\s*["']([a-z0-9_]+)["']/gi)].map((m) => m[1]))];
  console.log('\ncolumns in page: ' + cols.join(', '));

  for (const url of [...urls].filter((u) => /(^|\/)get_/i.test(u))) {
    const body = new URLSearchParams({ draw: '1', start: '0', length: '500', 'search[value]': '', 'order[0][column]': '0', 'order[0][dir]': 'asc' });
    cols.forEach((c, i) => body.append(`columns[${i}][data]`, c));
    const res = await axios.post(`${CMS}/${url}`, body.toString(), {
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
      httpsAgent: agent, maxRedirects: 0, validateStatus: () => true,
    });
    const file = path.join(OUT_DIR, `${url.replace(/\//g, '__')}.json`);
    fs.writeFileSync(file, typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 1));
    const rows = Array.isArray(res.data?.data) ? res.data.data : null;
    console.log(`\n== POST ${url} -> ${res.status}, ${rows ? `${rows.length} rows (recordsTotal ${res.data.recordsTotal})` : 'not a DataTables reply'}`);
    if (!rows?.length) continue;
    console.log('keys: ' + Object.keys(rows[0]).join(', '));
    for (const row of rows.slice(0, 4)) {
      const plain = Object.fromEntries(Object.entries(row).filter(([k]) => !HTML_COLS.test(k)).map(([k, v]) => [k, strip(v)]));
      const links = Object.values(row).flatMap(hrefs);
      console.log(JSON.stringify(plain), links.length ? `links: ${links.join(' ')}` : '');
    }
  }
  console.log(`\nsaved to ${OUT_DIR}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
