'use strict';

// Stage only. Preload on the named QuickTricks socket process at its next
// approved restart: NODE_OPTIONS="--require=/absolute/path/to/this/file".
// Does not log command arguments, keys, values, credentials, or reply contents.
const path = require('node:path');
const { monitorEventLoopDelay, performance } = require('node:perf_hooks');
const root = process.cwd();
const resolve = name => require.resolve(name, { paths: [root] });
const { buildRecorder } = require('./redis-flight-recorder-core.cjs');
const recorder = buildRecorder();
const emit = data => console.error('[redis-flight]', JSON.stringify({ utc: new Date().toISOString(), pid: process.pid, ...data }));

try {
    const Queue = require(resolve('@redis/client/dist/lib/client/commands-queue')).default;
    const Socket = require(resolve('@redis/client/dist/lib/client/socket')).default;
    const add = Queue.prototype.addCommand;
    Queue.prototype.addCommand = function (args, options) {
        const promise = add.call(this, args, options);
        recorder.command(this, String(args[0]), promise);
        return promise;
    };
    const read = Queue.prototype.onReplyChunk;
    Queue.prototype.onReplyChunk = function (chunk) {
        recorder.received(this, chunk.length);
        return read.call(this, chunk);
    };
    const socketEmit = Socket.prototype.emit;
    Socket.prototype.emit = function (event, ...args) {
        if (['connect', 'ready', 'reconnecting', 'error', 'end'].includes(event)) {
            emit({ type: 'socket-event', socket: recorder.id(this), event,
                errorCode: event === 'error' ? args[0]?.code || args[0]?.name : undefined });
        }
        return socketEmit.call(this, event, ...args);
    };
    const lag = monitorEventLoopDelay({ resolution: 20 });
    lag.enable();
    let ticks = 0;
    setInterval(() => {
        const queues = recorder.snapshot();
        if (++ticks % 15 === 0 || queues.some(q => q.oldestPendingMs >= 3000)) {
            emit({ type: 'queues', eventLoopMaxMs: Math.round(lag.max / 1e6), queues });
            lag.reset();
        }
    }, 1000).unref();

    // Independent connection: same endpoint/auth, different TCP flow and queue.
    // One outstanding PING maximum; a stalled probe never accumulates requests.
    const startProbe = () => {
        if (!process.env.REDIS_HOST) { emit({ type: 'probe-disabled', reason: 'REDIS_HOST absent' }); return; }
        const { createClient } = require(resolve('redis'));
        const probe = createClient({ username: process.env.REDIS_USERNAME || undefined,
            password: process.env.REDIS_PASSWORD || undefined,
            socket: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) || 6379,
                connectTimeout: 5000, reconnectStrategy: false } });
        let busy = false;
        probe.on('error', error => emit({ type: 'independent-error', code: error.code || error.name }));
        const ping = async () => {
            if (busy) return;
            busy = true;
            const started = performance.now();
            let timeout;
            try {
                if (!probe.isOpen) await probe.connect();
                const overdue = new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('probe-timeout')), 3000); });
                await Promise.race([probe.ping(), overdue]);
                emit({ type: 'independent-ping', ms: Math.round(performance.now() - started) });
            } catch (error) {
                emit({ type: 'independent-failed', code: error.code || error.name, ms: Math.round(performance.now() - started) });
                if (probe.isOpen) { try { await probe.disconnect(); } catch {} }
            } finally { clearTimeout(timeout); busy = false; }
        };
        setInterval(ping, 5000).unref();
        ping();
    };
    // Existing app loads its dotenv configuration during normal startup.
    setTimeout(startProbe, 2000).unref();
    emit({ type: 'installed', redisClientVersion: require(resolve('@redis/client/package.json')).version });
} catch (error) {
    emit({ type: 'not-installed', code: error.code || error.name });
}
