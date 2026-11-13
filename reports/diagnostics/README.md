# Redis incident diagnostics — staged, not deployed

The recorder is prepared for the named QuickTricks socket process. It has not been deployed or enabled in production. It requires the deployed node-redis 4 / @redis/client 1.x internal module paths; verify them at rollout. Start from the app's backend working directory. Both recorder files must be present beside each other.

At an approved socket-process restart, append `--require=/absolute/path/redis-flight-recorder.cjs` to that process's existing `NODE_OPTIONS`; preserve any existing options. Do not apply it to other PM2 apps. A restart drops current client sockets, so coordinate the rollout during a suitable gap. Remove that preload at the next suitable restart after the incident is captured.

The preload observes the existing command promises and raw reply-chunk lengths and adds one independent connection to the configured app Redis. It sends one PING every five seconds and records queue health every fifteen seconds, or every second while commands are overdue. It does not log arguments, Redis keys, message bodies, credentials, reply contents, or full error strings. Promise observation adds rejection handlers and therefore can affect otherwise-unhandled rejection reporting; use alongside existing app error logs. This diagnostic does not fix or change the existing watchdog/reconnect ownership.

## Interpreting the first failure

| App queue | Independent PING | Other evidence | Finding |
|---|---|---|---|
| Pending, incoming bytes continue, promises do not resolve | Answers promptly | Event-loop delay remains low | Client reply decoding/queue handling is the primary suspect; inspect parser/queue state |
| Pending, no incoming bytes | Answers promptly | Event-loop delay remains low | App connection-specific transport/service handling; capture TCP retransmissions and Redis per-client logs |
| Pending, no incoming bytes | Also fails | Event-loop delay remains low | Shared endpoint/path failure; compare TCP packet evidence and provider logs |
| All callbacks delayed | Probe timers also delayed | Event-loop delay spikes | App synchronous work or runtime pause; profile the process |
| Queue grows but replies keep arriving | Answers promptly | Sustained demand exceeds completions | Workload/backlog; inspect command rates and reply volume |

Aggregate counters cannot conclusively identify a malformed reply or distinguish endpoint proxy loss from intermediate network packet loss. That last distinction needs simultaneous TCP header evidence and provider connection logs. The hook is useful because the original logs have neither per-command queue age nor independent probe results.

## Host kernel evidence still needed

The existing `hranker` account cannot read the host's kernel log and has no passwordless sudo. An administrator was asked to run:

```sh
sudo journalctl -k --since '2026-10-14 13:20:00' --until '2026-10-14 14:00:00' --no-pager \
  | grep -Ei 'drop|reject|conntrack|table full|link|reset|timeout|oom|network|enp8'
```

If journal history is unavailable, inspect the corresponding time interval in `/var/log/kern.log`. No output from an unprivileged journal view is not evidence of no kernel event.

## Validation performed

JavaScript syntax check passed. Deterministic offline checks confirmed that the recorder distinguishes pending commands with no bytes from pending commands despite incoming bytes, tracks resolve/reject outcomes, and retains no reply values or error contents.

The complete preload was also tested in a separate temporary Node process on the host using the actual deployed `@redis/client` **1.6.1** library against a simulated Redis server on an ephemeral localhost port. An intentionally delayed GET produced a recorded queue age of **3,915 ms**, while the independent connection returned PING in **2 ms** and event-loop maximum delay was **21 ms**. The original GET later resolved correctly. No production Redis connection or running app was used by that test. Temporary remote test files were removed. Real incident capture remains outstanding.
