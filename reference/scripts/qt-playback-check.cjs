// Read-only playback check for a class's hlsAsset, run from the LMS checkout on the box:
//   DOTENV_CONFIG_PATH=.env.development node -r dotenv/config qt-playback-check.cjs <classId>
// Signs the master exactly as /playback does for the default CDN (no ?cdn override), then walks
// master -> every rendition -> first/middle/last segment of each. Prints statuses only, never the token.
const path = require('path');
const DIST = path.join(process.cwd(), 'dist/src');
const m = require(path.join(process.cwd(), 'node_modules/mongoose'));
const { signCloudflareFolderAsset } = require(`${DIST}/services/cloudflareFolderSigner`);
const { signAssetUrl } = require(`${DIST}/services/bunnyAssetSigner`);
const vp = require(`${DIST}/config/videoProtection`);

const classId = process.argv[2];
const redact = (u) => { const x = new URL(u); return `${x.host}${x.pathname.replace(/[^/]{40,}/g, '<token>')}`; };

(async () => {
    await m.connect(process.env.MONGO_URI);
    const cls = await m.connection.db.collection('classes').findOne({ _id: new m.Types.ObjectId(classId) }, { projection: { streamStatus: 1, hlsAsset: 1 } });
    await m.disconnect();
    const asset = cls.hlsAsset;
    const live = vp.loadCloudflareLiveConfig();
    const provider = asset.bucket === 'live' ? (live?.provider ?? 'bunny') : 'n/a';
    const now = Math.floor(Date.now() / 1000);
    const signed = provider === 'cloudflare'
        ? signCloudflareFolderAsset(asset, now, live)
        : signAssetUrl(asset, undefined, now + 3600, vp.loadVideoProtectionConfig());
    console.log(JSON.stringify({ streamStatus: cls.streamStatus, key: asset.key, provider, master: redact(signed.url) }));

    const get = async (u, asText = true) => {
        const r = await fetch(u);
        const body = asText ? await r.text() : Buffer.from(await r.arrayBuffer());
        return { status: r.status, body, cache: r.headers.get('cf-cache-status') };
    };
    const master = await get(signed.url);
    const renditions = master.body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    console.log(JSON.stringify({ master: master.status, renditions }));
    for (const rel of renditions) {
        const ru = new URL(rel, signed.url).toString();
        const pl = await get(ru);
        const segs = pl.body.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
        const durations = [...pl.body.matchAll(/#EXTINF:([\d.]+)/g)].map((x) => Number(x[1]));
        const out = { rel, status: pl.status, segments: segs.length, seconds: Math.round(durations.reduce((a, b) => a + b, 0)), endlist: pl.body.includes('#EXT-X-ENDLIST'), probe: [] };
        for (const s of [segs[0], segs[Math.floor(segs.length / 2)], segs[segs.length - 1]].filter(Boolean)) {
            const r = await get(new URL(s, ru).toString(), false);
            out.probe.push({ seg: s.split('?')[0], status: r.status, bytes: r.body.length, ts: r.body[0] === 0x47, cache: r.cache });
        }
        console.log(JSON.stringify(out));
    }
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
