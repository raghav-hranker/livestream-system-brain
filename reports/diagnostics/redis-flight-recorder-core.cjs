'use strict';

function buildRecorder(now = Date.now) {
    const ids = new WeakMap();
    const queues = new Map();
    let sequence = 0;
    const id = object => {
        if (!ids.has(object)) ids.set(object, ++sequence);
        return ids.get(object);
    };
    const state = object => {
        const key = id(object);
        if (!queues.has(key)) queues.set(key, { id: key, pending: new Map(), resolved: 0, rejected: 0,
            bytesReceived: 0, lastReceivedAt: null });
        return queues.get(key);
    };
    return {
        id,
        command(queue, command, promise) {
            const q = state(queue);
            const token = {};
            // Command name only. Never retain AUTH args, keys or values.
            q.pending.set(token, { command, at: now() });
            promise.then(() => { q.pending.delete(token); q.resolved++; },
                () => { q.pending.delete(token); q.rejected++; });
        },
        received(queue, bytes) { const q = state(queue); q.bytesReceived += bytes; q.lastReceivedAt = now(); },
        snapshot() {
            return Array.from(queues.values()).map(q => {
                const commands = {};
                let oldestPendingMs = 0;
                for (const p of q.pending.values()) {
                    commands[p.command] = (commands[p.command] || 0) + 1;
                    oldestPendingMs = Math.max(oldestPendingMs, now() - p.at);
                }
                return { id: q.id, pending: q.pending.size, pendingCommands: commands, oldestPendingMs,
                    resolved: q.resolved, rejected: q.rejected, bytesReceived: q.bytesReceived,
                    lastReceivedAgoMs: q.lastReceivedAt === null ? null : now() - q.lastReceivedAt };
            });
        }
    };
}
module.exports = { buildRecorder };
