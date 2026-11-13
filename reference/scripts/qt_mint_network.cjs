// Read-only, on webserver2-2 from the backend checkout via `node -` (env MINTS="classId@HH:MM:SS,...", LOG optional):
// finds each playback mint in today's API access log and looks up the caller's network, which decides the CDN it got.
// A shared second can also match other viewers, so match the rows to the user's UA and repeat IP range. Hides the
// last IP block, prints no tokens.
const fs = require('fs');
const readline = require('readline');
const { lookupAsn } = require(`${process.cwd()}/dist/src/services/asnLookup.js`);
const LOG = process.env.LOG || '/var/log/apache2/backend.quicktricksbysahilsir.com-access.log';
const VI = new Set((process.env.CDN_ROUTE_BUNNY_ASNS || '38266,45271,55410,55644').split(',').map(Number));

(async () => {
  // The log runs past 500 MB, so stream it and keep only playback mints.
  const lines = [];
  for await (const l of readline.createInterface({ input: fs.createReadStream(LOG) })) {
    if (l.includes('/playback')) lines.push(l);
  }
  for (const mint of process.env.MINTS.split(',')) {
    const [cls, time] = mint.split('@');
    const hits = lines.filter((l) => l.includes(`/api/classes/${cls}/playback`) && l.includes(`:${time} `));
    if (!hits.length) console.log(`${cls.slice(0, 8)} ${time} no log line`);
    for (const l of hits.slice(0, 5)) {
      const ip = l.split(' ')[0];
      const asn = await lookupAsn(ip);
      const status = (/" (\d{3}) /.exec(l) || [])[1];
      const ua = ((l.match(/"([^"]*)"\s*$/) || [])[1] || '').slice(0, 16);
      console.log(`${cls.slice(0, 8)} ${time} status ${status} ip ${ip.replace(/[0-9a-f]+$/i, 'x')} asn ${asn} ${asn !== null && VI.has(asn) ? 'BUNNY' : 'CLOUDFLARE'} ${ua}`);
    }
  }
})();
