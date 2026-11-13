// Run from the bastion PDF checkout with node -r ts-node/register.
// Append only CSV events absent from the PDF tabs; preserve duplicate-event multiplicity.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
async function main() {
  const load = createRequire(path.join(process.cwd(), 'package.json'));
  const axios = load('axios'), csv = load('papaparse');
  const sheets = load(path.join(process.cwd(), 'src/services/apx/apxCatalogPdfImportSheet'));
  const key = sheets.loadServiceAccountKey('/home/opc/vidyagram/sheets-sa.json');
  const auth = await axios.post(sheets.TOKEN_URL, new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: sheets.signJwtAssertion(key, Math.floor(Date.now() / 1000)) }), { timeout: 30000 });
  const headers = { Authorization: `Bearer ${auth.data.access_token}` };
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/1S8WDIGKnt0gwQB_dVhasseUOgmAtLQbjS3iH5wyglGY';
  const directories = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  const apply = process.argv.includes('--apply');
  for (const [tab, file, columns] of [['PDF import', 'import.csv', 'A:S'], ['PDF multi-version', 'multi-version.csv', 'A:H']]) {
    sheets.assertOwnTab(tab);
    const range = encodeURIComponent(`'${tab}'!${columns}`);
    const response = await axios.get(`${base}/values/${range}`, { headers, timeout: 60000 });
    const existing = response.data.values || [];
    const signature = (row) => JSON.stringify(Array.from({ length: columns === 'A:S' ? 19 : 8 }, (_, i) => String(row[i] ?? '')));
    const counts = new Map();
    for (const row of existing.slice(1)) { const k = signature(row); counts.set(k, (counts.get(k) || 0) + 1); }
    const missing = [];
    for (const directory of directories) {
      const filePath = path.join(directory, file);
      if (!fs.existsSync(filePath)) continue;
      const parsed = csv.parse(fs.readFileSync(filePath, 'utf8'), { skipEmptyLines: true });
      if (parsed.errors.length) throw new Error('CSV parsing failed');
      if (signature(parsed.data[0]) !== signature(existing[0])) throw new Error('Sheet and CSV headers differ');
      for (const row of parsed.data.slice(1)) {
        const k = signature(row), n = counts.get(k) || 0;
        if (n > 0) counts.set(k, n - 1); else missing.push(row);
      }
    }
    console.log(JSON.stringify({ tab, existingRows: existing.length - 1, missingRows: missing.length, apply }));
    if (!apply) continue;
    for (let i = 0; i < missing.length; i += 500) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await axios.post(`${base}/values/${encodeURIComponent(`'${tab}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { values: missing.slice(i, i + 500) }, { headers, timeout: 60000 });
    }
    if (missing.length) console.log(JSON.stringify({ tab, appended: missing.length }));
  }
}
main().catch((e) => { console.error(JSON.stringify({ error: e.name, status: e.response?.status, detail: e.response ? undefined : e.message })); process.exitCode = 1; });
