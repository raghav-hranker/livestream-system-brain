# stream-status delivery is at-least-once: producer retries, owner sweeps

The stream-status webhook is fire-and-forget in livestream-v2, and with Room retired there is no
fallback store — a single lost `ended` write leaves `Class.streamStatus` stuck at `processing` and
`/playback` returning 425 for that class forever, detected only by user complaint.

Decided: **at-least-once delivery, two layers.**

1. **Producer retries (livestream).** `streamStatusUpdater` persists the *latest* pending transition
   per class in Redis and retries with backoff until a 2xx, dropping only on explicit 400/401/404.
   Last-write-wins per class — no event history — is safe because the LMS write is a deterministic
   `$set`, which also makes retries idempotent.
2. **Owner detects (nodejs-server).** A periodic sweep alerts on classes sitting in a *transient*
   status (`preparing`, `processing`, `reconnecting`) beyond a threshold. Detection only — the LMS
   never auto-repairs, because it cannot know the stream's true state.

Rejected: exactly-once via a message bus (infrastructure cost unjustified at this scale) and a full
transition event log (no current consumer for history; revisit if stream-reliability analytics or
duration-based billing appear).

Consequence worth naming: `preparing`/`processing`/`reconnecting` are now contractually **bounded**
states — any class must escape them within the sweep threshold or something is wrong.
