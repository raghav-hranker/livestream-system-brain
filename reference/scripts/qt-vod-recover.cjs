// One-off replay of the encoder's end-of-stream finalize for a class whose
// finalize was interrupted (routes/stream.js upload-mode branch + the
// doStreamCleanup 'ended' write), using the deployed checkout's own modules.
// Only difference: the bucket existence checks run concurrently, not serially.
//
//   node qt-vod-recover.cjs <clientId> <classId>            # dry run: HEAD + build VOD playlists on disk
//   node qt-vod-recover.cjs <clientId> <classId> --commit   # + heal, upload VOD playlists, deliver 'ended'
const ROOT = '/home/raghav/quicktricks-livestream/backend';
require(`${ROOT}/node_modules/dotenv`).config({ path: `${ROOT}/.env` });
const fs = require('fs');
const path = require('path');
const config = require(`${ROOT}/config/config`);
const { objectExistsInS3, uploadFileToS3, uploadVodPlaylistsOnly } = require(`${ROOT}/lib/fileUpload`);
const { readReferencedSegments, QUALITY_FOLDERS } = require(`${ROOT}/lib/segmentReconciler`);
const executeManifestFiles = require(`${ROOT}/lib/hls`);

const [clientId, classId] = process.argv.slice(2, 4);
const commit = process.argv.includes('--commit');
if (!/^\d+$/.test(clientId || '') || !/^[0-9a-f]{24}$/.test(classId || '')) {
    console.error('usage: node qt-vod-recover.cjs <clientId> <classId> [--commit]');
    process.exit(2);
}
const prefix = `${clientId}/${classId}`;
const basePath = `${config.videoSaveBasePath}/${prefix}`;
const bucketName = process.env.LIVE_S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;

async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: n }, async () => {
        while (i < items.length) { const it = items[i++]; await fn(it); }
    }));
}

(async () => {
    const t0 = Date.now();
    console.log(JSON.stringify({ prefix, basePath, bucketName, commit }));
    const checks = [];
    for (const q of QUALITY_FOLDERS) {
        for (const s of readReferencedSegments(path.join(basePath, q, 'playlist.m3u8'))) checks.push({ q, s });
    }
    const missing = [], unusable = new Set(), errors = [], repaired = [];
    await pool(checks, 16, async ({ q, s }) => {
        const key = `${prefix}/${q}/${s}`;
        try {
            if (await objectExistsInS3(bucketName, key)) return;
        } catch (e) { errors.push(`${key}: ${e.message}`); return; } // keep, like the reconciler
        missing.push(`${q}/${s}`);
        let size = -1;
        try { size = fs.statSync(path.join(basePath, q, s)).size; } catch (_) {}
        if (size <= 0) { unusable.add(`${q}/${s}`); return; }
        if (!commit) return;
        try { await uploadFileToS3(path.join(basePath, q, s), bucketName, key); repaired.push(key); }
        catch (e) { unusable.add(`${q}/${s}`); errors.push(`repair ${key}: ${e.message}`); }
    });
    console.log(JSON.stringify({ checked: checks.length, missing, unusable: [...unusable], repaired, errors: errors.slice(0, 20), errorCount: errors.length, ms: Date.now() - t0 }));

    const out = await executeManifestFiles(prefix, unusable);
    for (const q of QUALITY_FOLDERS) {
        const p = path.join(basePath, q, 'playlist-vod.m3u8');
        const txt = fs.readFileSync(p, 'utf8');
        console.log(JSON.stringify({ q, segments: (txt.match(/#EXTINF/g) || []).length, endlist: txt.includes('#EXT-X-ENDLIST'), playlistType: (txt.match(/#EXT-X-PLAYLIST-TYPE:\w+/) || [null])[0] }));
    }
    console.log('master', out, '\n' + fs.readFileSync(path.join(basePath, 'playlist-mpl-vod.m3u8'), 'utf8'));
    if (!commit) { console.log('DRY RUN done'); process.exit(0); }

    await uploadVodPlaylistsOnly(basePath, bucketName, prefix);
    for (const k of ['playlist-mpl-vod.m3u8', '0/playlist-vod.m3u8', '1/playlist-vod.m3u8', '2/playlist-vod.m3u8', '3/playlist-vod.m3u8']) {
        console.log('present', k, await objectExistsInS3(bucketName, `${prefix}/${k}`));
    }
    // Same write doStreamCleanup makes after a successful stream POST.
    const { updateStreamStatus } = require(`${ROOT}/lib/streamStatusUpdater`);
    const vodHlsAsset = { bucket: 'live', key: `${prefix}/playlist-mpl-vod.m3u8` };
    const res = await updateStreamStatus(classId, 'ended', { hlsAsset: vodHlsAsset });
    console.log('ended delivery', res === undefined ? 'queued for retry (NOT delivered synchronously)' : 'delivered', JSON.stringify(res && { success: res.success, message: res.message }));
    process.exit(res === undefined ? 1 : 0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
