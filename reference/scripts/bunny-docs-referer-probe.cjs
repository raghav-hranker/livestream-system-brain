// Read-only. Signs one exact-file documents-zone URL with a backend env's
// BUNNY_DOCUMENTS_SECURITY_KEY and fetches it with no Referer and with each
// Referer in REFERERS; prints status + first bytes only (no key, no URL).
// 206 "%PDF" = served; Bunny's HTML 403 = token or hotlink (referrer) block.
// Run on webserver2-2:
//   ENV_FILE=<checkout>/.env.development KEY_PATH=/781/pdfs/<sha>.pdf \
//   REFERERS=https://admin.vidyagramar.com/,https://www.vidyagramar.com/ node - < this
const fs = require('fs'), crypto = require('crypto'), https = require('https');
const env = Object.fromEntries(fs.readFileSync(process.env.ENV_FILE, 'utf8').split('\n')
  .map((l) => l.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]));
const P = process.env.KEY_PATH, exp = Math.floor(Date.now() / 1000) + 600;
const tok = 'HS256-' + crypto.createHmac('sha256', env.BUNNY_DOCUMENTS_SECURITY_KEY).update(`${P}${exp}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const url = `${env.BUNNY_DOCUMENTS_CDN_BASE.replace(/\/+$/, '')}${P}?token=${tok}&expires=${exp}`;
const get = (headers) => new Promise((res) => {
  https.get(url, { headers: { Range: 'bytes=0-7', ...headers } }, (r) => {
    let b = ''; r.on('data', (c) => { b += c; if (b.length > 16) r.destroy(); });
    r.on('close', () => res(`${r.statusCode} ${JSON.stringify(b.slice(0, 8))}`));
  }).on('error', (e) => res('ERR ' + e.code));
});
(async () => {
  console.log('no referer'.padEnd(48), await get({}));
  for (const ref of (process.env.REFERERS || '').split(',').filter(Boolean)) {
    console.log(ref.padEnd(48), await get({ Referer: ref }));
  }
})();
