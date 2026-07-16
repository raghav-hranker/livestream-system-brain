# livestream reads LMS Class directly from Mongo, frozen to two fields

With Room retired, the livestream backend needs a few LMS-owned Class facts at runtime. The obvious
service-boundary answer is an HTTP read API; we deliberately deviate: **livestream reads the LMS Mongo
`classes` collection directly** (`classClient.getClass`), because the deployment already shares DB access
and the read surface is tiny. Writes never go this way — they use the owner's secured HTTP endpoints.

The read contract is **frozen to exactly two fields**:

- `isPrivate` — needed live, during websocket firings (private-mode behavior).
- `streamStatus` — **cold-start fallback only**; the primary source is livestream's own write-through
  Redis copy, stashed whenever `streamStatusUpdater` fires (livestream originates this value, so reading
  it back from the LMS on the hot path is a round trip for our own output).

Explicitly rejected from the contract after checking consumers: `teacherName` (selected but consumed
nowhere), `mp4Recordings` (only consumer is a legacy recordings GET superseded by the LMS `/downloads`),
`isChat` (never crosses the livestream boundary — the LMS frontend reads it from the LMS API).

Guardrails: the livestream DB user should be **read-only** on `classes`; the Class schema in nodejs-server
carries a comment naming livestream as a direct-Mongo reader of these two fields (a small contract test in
nodejs-server CI is recommended, not required). Widening this surface requires revisiting this ADR — the
field list *is* the contract. If DB access ever stops being shared (per-customer clusters), fall back to a
secured HTTP read endpoint.
