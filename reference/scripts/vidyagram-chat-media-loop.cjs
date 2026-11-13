#!/usr/bin/env node
// Local only: boots the real livestream socket server (backend/rtmpserver-2.js) against a throwaway Redis
// and Mongo on this Mac, then sends class-chat images and PDFs the way ls does (a base64 data URL in `userMsg`).
// Prints PASS/FAIL per case and exits 1 if any case fails. Touches no prod host: every URL below is local,
// and DB_URI must stay set because config.js otherwise defaults to the prod cluster.
//
//   node reference/scripts/vidyagram-chat-media-loop.cjs [backendDir]
//
// Default backendDir: ~/Projects/worktrees/livestream-1080p/backend. Needs redis-server and Docker.
const { spawn, execFileSync } = require('child_process');
const os = require('os');
const path = require('path');

const backend = path.resolve(process.argv[2] || path.join(os.homedir(), 'Projects/worktrees/livestream-1080p/backend'));
const { io } = require(path.join(backend, 'node_modules/socket.io-client'));

const REDIS_PORT = 16399;
const MONGO_PORT = 27099;
const HTTP_PORT = 18082;
const MONGO_NAME = 'vg-chat-media-loop-mongo';
const ROOM = '6aeb40abc408c8bdb18f7c99';
const MEDIA_HOST = 'cdn.chatmedialoop.test';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dataUrl = (mime, bytes) => `data:${mime};base64,${Buffer.alloc(bytes, 7).toString('base64')}`;

function connect(userId) {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${HTTP_PORT}`, { path: '/ws/socket.io/', transports: ['websocket'], reconnection: false });
    socket.seen = [];
    if (process.env.LOOP_EVENTS) socket.onAny((e, a) => console.log(`[${userId}] <- ${e} ${JSON.stringify(a ?? null).slice(0, 160)}`));
    socket.closeReason = null;
    socket.errors = [];
    socket.on('userMsgBroadcast', (m) => socket.seen.push(m));
    socket.on('getMediaMessagesResponse', (r) => socket.seen.push(...(r.mediaMessages || [])));
    socket.on('userMsgError', (e) => socket.errors.push(e.message));
    socket.on('disconnect', (reason) => { socket.closeReason = reason; });
    socket.once('connect_error', reject);
    socket.once('connect', () => {
      socket.emit('joinRoom', { roomId: ROOM, userId, userName: userId });
      setTimeout(() => resolve(socket), 500);
    });
  });
}

// One case = a fresh sender and viewer, so a killed connection cannot leak into the next case.
async function runCase({ name, type, mime, bytes, text, url, expect = 'shown' }) {
  const sender = await connect(`sender-${name}`);
  const viewer = await connect(`viewer-${name}`);
  const fileName = `${name}.${type === 'pdf' ? 'pdf' : 'png'}`;
  sender.emit('userMsg', {
    roomId: ROOM,
    roomName: ROOM,
    data: { message: text || url || dataUrl(mime, bytes), userId: `sender-${name}`, userName: `sender-${name}`, timestamp: Date.now(), type, fileName },
  });
  await sleep(2500);
  const shown = viewer.seen.some((m) => m.fileName === fileName);
  const history = await new Promise((resolve) => {
    const late = io(`http://127.0.0.1:${HTTP_PORT}`, { path: '/ws/socket.io/', transports: ['websocket'], reconnection: false });
    late.once('messageHistoryResponse', (r) => { late.close(); resolve(JSON.stringify(r).includes(fileName)); });
    late.once('connect', () => {
      late.emit('joinRoom', { roomId: ROOM, userId: `late-${name}`, userName: 'late' });
      setTimeout(() => late.emit('messageHistory', { roomId: ROOM, limit: 100 }), 300);
    });
    setTimeout(() => { late.close(); resolve(null); }, 2000);
  });
  // PDFs reach the chat through the media list, so they are never in message history.
  const stored = type === 'pdf' ? shown : history === true;
  const result = { name, type, viewerSawIt: shown, inHistory: history, senderDropped: sender.closeReason, refused: sender.errors[0] || null };
  sender.close();
  viewer.close();
  const pass = {
    shown: shown && stored && !result.senderDropped,
    refused: !shown && !!result.refused && !result.senderDropped,
    dropped: !shown && !!result.senderDropped,
  }[expect];
  return { ...result, expect, pass };
}

async function main() {
  const redis = spawn('redis-server', ['--port', String(REDIS_PORT), '--save', '', '--appendonly', 'no', '--bind', '127.0.0.1', '--requirepass', 'local-loop'], { stdio: 'ignore' });
  try { execFileSync('docker', ['rm', '-f', MONGO_NAME], { stdio: 'ignore' }); } catch {}
  execFileSync('docker', ['run', '-d', '--rm', '--name', MONGO_NAME, '-p', `127.0.0.1:${MONGO_PORT}:27017`, 'mongo:7'], { stdio: 'ignore' });

  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'test',
    DB_URI: `mongodb://127.0.0.1:${MONGO_PORT}/chatmedialoop`,
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: String(REDIS_PORT),
    REDIS_USERNAME: 'default',
    REDIS_PASSWORD: 'local-loop',
    GPU_REDIS_USERNAME: 'default',
    GPU_REDIS_PASSWORD: 'local-loop',
    GPU_REDIS_HOST: '127.0.0.1',
    GPU_REDIS_PORT: String(REDIS_PORT),
    SERVER_PORT: String(HTTP_PORT),
    RTMP_PORT: '18937',
    LMS_BASE_URL: 'http://127.0.0.1:9',
    LMS_PUBLIC_BASE_URL: 'http://127.0.0.1:9',
    OWNER_BASE_URL: 'http://127.0.0.1:9',
    PUBLIC_BASE_URL: `http://127.0.0.1:${HTTP_PORT}`,
    TRANSCODER_WEBHOOK_SECRET: 'local-loop',
    JWT_SECRET_KEY: 'local-loop',
    REALTIME_TOKEN_SECRET: 'local-loop',
    REALTIME_AUTH_REQUIRED: 'false',
    CF_LIVE_CDN_BASE: 'https://live.invalid',
    CF_LIVE_HMAC_SECRET: 'local-loop',
    STREAM_STATUS_NAMESPACE: 'chatmedialoop',
    CHATMOD_CONSUMER_ENABLED: 'false',
    POST_LIVE_TRANSCODE_ENABLED: 'false',
    CHAT_MEDIA_HOSTS: MEDIA_HOST,
    ...(process.env.LOOP_MAX_BUFFER ? { SOCKET_MAX_BUFFER_BYTES: process.env.LOOP_MAX_BUFFER } : {}),
  };
  const server = spawn('node', ['rtmpserver-2.js'], { cwd: backend, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let bootLog = '';
  server.stdout.on('data', (d) => { bootLog += d; });
  server.stderr.on('data', (d) => { bootLog += d; });

  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { stop(); process.exit(0); });
  const stop = () => {
    server.kill('SIGKILL');
    redis.kill('SIGKILL');
    try { execFileSync('docker', ['rm', '-f', MONGO_NAME], { stdio: 'ignore' }); } catch {}
  };

  try {
    for (let i = 0; i < 60 && !bootLog.includes('Server running on port'); i++) {
      if (server.exitCode !== null) throw new Error(`server exited:\n${bootLog.slice(-1500)}`);
      await sleep(500);
    }
    if (!bootLog.includes('Server running on port')) throw new Error(`server did not start:\n${bootLog.slice(-1500)}`);

    if (process.env.LOOP_SERVE) {
      // Keep everything up for a browser test, with a stub of the LMS upload route on HTTP_PORT + 1.
      require('http').createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        if (req.url.startsWith('/api/uploads/files')) {
          req.resume();
          req.on('end', () => {
            console.log('stub upload received');
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: { url: `https://${MEDIA_HOST}/chat-media/${Date.now()}-file` } }));
          });
          return;
        }
        // What the viewer page needs to render the player and the chat beside it.
        res.setHeader('Content-Type', 'application/json');
        if (/\/realtime-token/.test(req.url)) {
          const jwt = require(path.join(backend, 'node_modules/jsonwebtoken'));
          const caller = JSON.parse(Buffer.from((req.headers.authorization || '').split('.')[1] || 'e30', 'base64url'));
          const host = caller.role === 'teacher';
          const token = jwt.sign({ role: host ? 'host' : 'viewer', userId: host ? ROOM : caller.userId, classId: ROOM, customerId: '781', name: caller.name || 'User' },
            'local-loop', { algorithm: 'HS256', issuer: 'lms', audience: 'livestream-socket', expiresIn: 600 });
          res.end(JSON.stringify({ token, expiresIn: 600 }));
          return;
        }
        if (/\/playback/.test(req.url)) { res.end(JSON.stringify({ data: { url: `https://${MEDIA_HOST}/none.m3u8`, expiresAt: Date.now() + 3600e3 }, url: `https://${MEDIA_HOST}/none.m3u8`, expiresAt: Date.now() + 3600e3 })); return; }
        if (/^\/api\/classes\/[^/]+$/.test(req.url.split('?')[0])) { res.end(JSON.stringify({ data: { _id: ROOM, streamStatus: 'live' }, _id: ROOM, streamStatus: 'live' })); return; }
        res.writeHead(404); res.end('{}');
      }).listen(HTTP_PORT + 1, () => console.log('serving'));
      await new Promise((resolve) => setTimeout(resolve, 20 * 60 * 1000));
      return;
    }
    const cases = [
      { name: 'text-control', type: 'text', text: 'hello', bytes: 5 },
      { name: 'image-url', type: 'image', url: `https://${MEDIA_HOST}/chat-media/a.png`, bytes: 0 },
      { name: 'pdf-url', type: 'pdf', url: `https://${MEDIA_HOST}/chat-media/a.pdf`, bytes: 0 },
      { name: 'image-inline', type: 'image', mime: 'image/png', bytes: 100 * 1024 },
      { name: 'foreign-url', type: 'pdf', url: 'https://evil.test/a.pdf', bytes: 0, expect: 'refused' },
      // The frame cap stays: the old client's way of sending a large file still fails.
      { name: 'image-2mb-old', type: 'image', mime: 'image/jpeg', bytes: 2 * 1024 * 1024, expect: 'dropped' },
    ];
    let failed = 0;
    for (const c of cases) {
      const r = await runCase(c);
      if (!r.pass) failed++;
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.name.padEnd(14)} expect=${r.expect} viewer saw it=${r.viewerSawIt} in history=${r.inHistory} sender dropped=${r.senderDropped} refused=${r.refused}`);
    }
    process.exitCode = failed ? 1 : 0;
    if (process.env.LOOP_LOG) console.log(bootLog.split('\n').filter((l) => new RegExp(process.env.LOOP_LOG).test(l)).map((l) => l.slice(0, 240)).join('\n'));
  } finally {
    stop();
  }
}

main().catch((e) => { console.error(e.message); process.exit(2); }).finally(() => setTimeout(() => process.exit(process.exitCode || 0), 300));
